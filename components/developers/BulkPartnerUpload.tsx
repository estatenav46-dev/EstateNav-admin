'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, FileSpreadsheet, ImagePlus, Loader2, RotateCcw, Upload, Users, XCircle } from 'lucide-react';
import type { ImageRef } from '@/lib/data/types';
import { inspectImage, uploadImageToCloudinary } from '@/lib/media';
import type { ParsedPartner } from '@/lib/import/partners';

type Phase = 'idle' | 'reading' | 'preview' | 'importing' | 'done';
type Run = { state: 'waiting' | 'working' | 'done' | 'failed'; note: string; messages: string[] };

const IMAGE_RE = /\.(png|jpe?g|webp|svg|avif|gif)$/i;
const base = (path: string) => path.split(/[\\/]/).pop()!.toLowerCase();

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
  return data as T;
}

/** Bulk add or update partners from the partner template (same fields as the Add partner form). */
export function BulkPartnerUpload({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const logosRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [workbook, setWorkbook] = useState<File | null>(null);
  const [logos, setLogos] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedPartner[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [finishWarning, setFinishWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ready = rows.filter((r) => !r.errors.length);
  const doneCount = Object.values(runs).filter((r) => r.state === 'done').length;
  const failedCount = Object.values(runs).filter((r) => r.state === 'failed').length;

  const copyPrompt = async () => {
    try {
      const res = await fetch('/api/developers/import/prompt');
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('The prompt could not be copied. Open /api/developers/import/prompt and copy it from there.');
    }
  };

  const reset = () => {
    setPhase('idle');
    setRows([]);
    setNotes([]);
    setRuns({});
    setError(null);
    setFinishWarning(null);
  };

  const read = async () => {
    if (!workbook) return;
    setPhase('reading');
    setError(null);
    const data = new FormData();
    data.set('file', workbook);
    try {
      const res = await fetch('/api/developers/import', { method: 'POST', body: data });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'The workbook could not be read.');
      setRows(payload.partners);
      setNotes(payload.notes ?? []);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The workbook could not be read.');
      setPhase('idle');
    }
  };

  const setRun = (id: string, patch: Partial<Run>) => setRuns((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

  const importOne = async (p: ParsedPartner) => {
    const messages: string[] = [];
    setRun(p.id, { state: 'working', note: 'Saving', messages });
    // A logo named in the sheet and attached here is uploaded from the browser.
    let logo: ImageRef | undefined;
    if (p.logo && !/^https?:\/\//i.test(p.logo)) {
      const file = logos.find((f) => base(f.name) === base(p.logo!));
      if (!file) messages.push(`Logo “${p.logo}” is named in the sheet but was not attached.`);
      else {
        try {
          const meta = await inspectImage(file).catch(() => ({ width: 600, height: 300, blurDataURL: '' }));
          logo = await uploadImageToCloudinary(file, `developers/${p.existingId ?? p.id}`, { alt: `${p.name} logo`, order: 0, ...meta });
        } catch (e) {
          messages.push(e instanceof Error ? e.message : 'The logo could not be uploaded.');
        }
      }
    }
    const saved = await postJson<{ created: boolean; warnings: string[] }>('/api/developers/import/save', { partner: p, logo });
    messages.push(...saved.warnings);
    setRun(p.id, { state: 'done', note: saved.created ? 'Created' : 'Updated', messages });
  };

  const runImport = async () => {
    setPhase('importing');
    setRuns(Object.fromEntries(ready.map((p) => [p.id, { state: 'waiting', note: 'Waiting', messages: [] } as Run])));
    for (const p of ready) {
      try {
        await importOne(p);
      } catch (e) {
        setRun(p.id, { state: 'failed', note: 'Failed', messages: [e instanceof Error ? e.message : 'Could not be saved'] });
      }
    }
    try {
      const done = await postJson<{ warning?: string }>('/api/developers/import/finish', {});
      setFinishWarning(done.warning ?? null);
    } catch {
      setFinishWarning('Partners were saved, but the website refresh could not be requested. Changes appear within a minute.');
    }
    setPhase('done');
    onDone();
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Bulk add partners from Excel</h2>
            <p className="text-2xs text-ink-muted">Same fields as Add partner: names, headquarters, website, about, track record with sources, and logo. Matching partners are updated.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href="/api/developers/template" className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" /> Template
          </a>
          <button type="button" onClick={copyPrompt} className="btn-secondary text-xs" title="Paste into ChatGPT, Claude or Gemini with the template">
            <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? 'Prompt copied' : 'Copy AI prompt'}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={open ? 'btn-secondary text-xs' : 'btn-primary text-xs'}>
            {open ? 'Close' : (<><Upload className="h-3.5 w-3.5" /> Upload Excel</>)}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line p-3 sm:px-4">
          {(phase === 'idle' || phase === 'reading') && (
            <>
              <ol className="grid gap-2 text-2xs text-ink-muted sm:grid-cols-3">
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">1. Fill the template.</span> Download it, then fill it yourself or attach it to an AI tool with the copied prompt and the developers&apos; names.</li>
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">2. Logos.</span> Put an image or Google Drive link in <code>logo</code>, or attach the logo files below and write their file names.</li>
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">3. Check and import.</span> You see every partner, whether it is new or an update, and any problems before anything is saved.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary px-3 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> {workbook ? 'Change workbook' : 'Choose workbook (.xlsx)'}
                </button>
                <button type="button" onClick={() => logosRef.current?.click()} className="btn-secondary px-3 text-xs">
                  <ImagePlus className="h-3.5 w-3.5" /> Attach logos
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => setWorkbook(e.target.files?.[0] || null)} />
                <input ref={logosRef} type="file" multiple accept="image/*,.svg" className="hidden" onChange={(e) => setLogos((l) => [...l, ...Array.from(e.target.files ?? []).filter((f) => IMAGE_RE.test(f.name))])} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                {workbook && <span>Workbook: <span className="font-medium text-ink">{workbook.name}</span></span>}
                {logos.length > 0 && (
                  <span>
                    {logos.length} logo file(s) attached{' '}
                    <button type="button" onClick={() => setLogos([])} className="font-semibold text-accent-ink hover:underline">clear</button>
                  </span>
                )}
              </div>
              <button type="button" onClick={read} disabled={!workbook || phase === 'reading'} className="btn-primary text-xs disabled:opacity-50">
                {phase === 'reading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} {phase === 'reading' ? 'Reading workbook…' : 'Read workbook and preview'}
              </button>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {phase !== 'idle' && phase !== 'reading' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{rows.length}</span> partner(s) · <span className="text-emerald-700">{ready.filter((r) => !r.existingId).length} new</span> · {ready.filter((r) => r.existingId).length} update(s)
                  {rows.length > ready.length && <> · <span className="text-danger">{rows.length - ready.length} with errors (skipped)</span></>}
                  {phase === 'done' && <> · <span className="font-semibold text-emerald-700">{doneCount} saved</span>{failedCount > 0 && <span className="text-danger">, {failedCount} failed</span>}</>}
                </p>
                <div className="flex gap-2">
                  {phase !== 'importing' && (
                    <button type="button" onClick={reset} className="btn-secondary text-xs">
                      <RotateCcw className="h-3.5 w-3.5" /> {phase === 'done' ? 'Import another' : 'Start over'}
                    </button>
                  )}
                  {phase === 'preview' && (
                    <button type="button" onClick={runImport} disabled={!ready.length} className="btn-primary text-xs disabled:opacity-50">
                      <Upload className="h-3.5 w-3.5" /> Import {ready.length} partner{ready.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              </div>
              {finishWarning && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{finishWarning}</p>}
              {notes.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg bg-amber-50 p-2 pl-6 text-xs text-amber-900">
                  {notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {rows.map((p) => {
                  const run = runs[p.id];
                  const facts = Object.keys(p.facts).length;
                  const details = [p.headquarters, p.website && 'website', p.about && 'about', facts && `${facts} track-record fact${facts > 1 ? 's' : ''} (${p.sources.length} sourced)`, p.logo && (/^https?:/i.test(p.logo) ? 'logo link' : `logo file ${p.logo}`)].filter(Boolean);
                  const messages = [...p.warnings, ...(run?.messages ?? [])];
                  return (
                    <li key={`${p.id}-${p.row}`} className={`p-3 text-xs ${p.errors.length ? 'bg-danger/5' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {p.name || '(no name)'} <span className="font-mono font-normal text-ink-muted">/{p.id || '—'}</span>
                          </p>
                          <p className="text-ink-muted">Row {p.row} · {p.existingId ? 'updates the existing partner' : 'new partner'}{details.length ? ` — ${details.join(' · ')}` : ''}</p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${run?.state === 'done' ? 'text-emerald-700' : run?.state === 'failed' || p.errors.length ? 'text-danger' : 'text-ink'}`}>
                          {run?.state === 'working' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {run?.state === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {run?.state === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                          {run ? run.note : p.errors.length ? 'Will be skipped' : <span className="font-normal text-emerald-700">Ready</span>}
                        </span>
                      </div>
                      {p.errors.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-danger">{p.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
                      {messages.length > 0 && (
                        <details className="mt-1.5">
                          <summary className="inline-flex cursor-pointer items-center gap-1 text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" /> {messages.length} note(s)
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">{messages.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
