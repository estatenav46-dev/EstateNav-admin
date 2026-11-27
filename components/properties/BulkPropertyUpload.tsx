'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, FileSpreadsheet, FolderOpen, Globe, ImagePlus, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react';
import { setStatusesAction } from '@/app/actions/properties';
import { createDeveloperAction } from '@/app/actions/developers';
import { partnerOptions, placeholderPartner } from '@/lib/partners';
import type { Developer, ImageRef, PropertyDocument } from '@/lib/data/types';
import { inspectImage, uploadDocumentToCloudinary, uploadImageToCloudinary } from '@/lib/media';
import type { PreviewProject } from '@/app/api/properties/import/route';
import type { Candidate, Copied, ResolveResult } from '@/lib/import/media';
import type { ImportedMedia } from '@/lib/import/build';

type Phase = 'idle' | 'reading' | 'preview' | 'importing' | 'done';
type RunState = { state: 'waiting' | 'working' | 'done' | 'failed'; step: string; done: number; total: number; messages: string[]; slug?: string; id?: string; status?: string };

const IMAGE_RE = /\.(jpe?g|png|webp|avif|heic|gif)$/i;
const base = (path: string) => path.split(/[\\/]/).pop()!.toLowerCase();

/** Role of an attached file found in a folder named after the project_key. */
function roleFromName(name: string): Candidate['role'] {
  if (/master\s*-?plan|site\s*plan|layout/i.test(name)) return 'master-plan';
  if (/floor|unit\s*-?plan|typical|bhk|plan/i.test(name)) return 'floor-plan';
  return 'gallery';
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
  return data as T;
}

export function BulkPropertyUpload({ developers, defaultOpen = false }: { developers: Developer[]; defaultOpen?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [scope, setScope] = useState<'all' | 'partner'>('all');
  const [developerId, setDeveloperId] = useState('');
  const [workbook, setWorkbook] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replacePhotos, setReplacePhotos] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<PreviewProject[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [finishWarning, setFinishWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newPartners, setNewPartners] = useState<string[]>([]);
  const [addingPartner, setAddingPartner] = useState(false);
  const [addedPartners, setAddedPartners] = useState<Developer[]>([]);
  const allPartners = useMemo(() => [...developers, ...addedPartners.filter((a) => !developers.some((d) => d.id === a.id))], [developers, addedPartners]);
  const [publishNote, setPublishNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (window.location.hash === '#bulk-upload') setOpen(true);
  }, []);

  const attachedByName = useMemo(() => {
    const map = new Map<string, File>();
    attachments.forEach((f) => {
      map.set(base(f.name), f);
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      if (rel) map.set(rel.toLowerCase(), f);
    });
    return map;
  }, [attachments]);

  const ready = projects.filter((p) => !p.errors.length);
  const blocked = projects.filter((p) => p.errors.length);

  const copyPrompt = async () => {
    try {
      const res = await fetch('/api/properties/import/prompt');
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('The prompt could not be copied. Open /api/properties/import/prompt and copy it from there.');
    }
  };

  const reset = () => {
    setPhase('idle');
    setProjects([]);
    setNotes([]);
    setRuns({});
    setError(null);
    setFinishWarning(null);
    setPublishNote(null);
    setNewPartners([]);
  };

  const read = async () => {
    if (!workbook || (scope === 'partner' && !developerId)) return;
    setPhase('reading');
    setError(null);
    const data = new FormData();
    data.set('file', workbook);
    if (scope === 'partner') data.set('developerId', developerId);
    try {
      const res = await fetch('/api/properties/import', { method: 'POST', body: data });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'The workbook could not be read.');
      setProjects(payload.projects);
      setNotes(payload.notes ?? []);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The workbook could not be read.');
      setPhase('idle');
    }
  };

  const update = (key: string, patch: Partial<RunState> | ((r: RunState) => Partial<RunState>)) =>
    setRuns((all) => {
      const current = all[key];
      return { ...all, [key]: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } };
    });

  /** Uploads a file attached in the browser straight to Cloudinary. */
  async function uploadLocal(c: Candidate, file: File, propertyId: string, title: string, order: number): Promise<Copied> {
    if (c.role === 'document') {
      const up = await uploadDocumentToCloudinary(file, `properties/${propertyId}/documents`);
      const kind = c.docKind ?? 'other';
      const document: PropertyDocument = { id: `doc-${Date.now().toString(36)}${order}`, kind, label: (c.label || file.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 120), url: up.url, storagePath: up.storagePath, format: up.format, sizeBytes: up.sizeBytes, access: c.access ?? 'public' };
      return { kind: 'document', document };
    }
    if (!IMAGE_RE.test(file.name)) throw new Error(`${file.name} is not a JPG, PNG or WEBP image`);
    const meta = await inspectImage(file).catch(() => ({ width: 1600, height: 1060, blurDataURL: '' }));
    const folder = c.role === 'gallery' || c.role === 'cover' ? 'gallery' : 'plans';
    const alt = c.role === 'floor-plan' ? `${title} floor plan` : c.role === 'master-plan' ? `${title} master plan` : `${title} photo ${order + 1}`;
    const image: ImageRef = await uploadImageToCloudinary(file, `properties/${propertyId}/${folder}`, { alt, order, ...meta });
    return { kind: 'image', image };
  }

  async function importOne(p: PreviewProject) {
    const key = p.key;
    const propertyId = p.existingId ?? `p-${p.key}`;
    const title = [p.fields.name, p.fields.phase].filter(Boolean).join(' ');
    const images = replacePhotos || p.existingPhotos === 0;
    const messages: string[] = [];
    update(key, { state: 'working', step: 'Finding photos and files', done: 0, total: 0, messages });

    // 1. What the links point to.
    const resolved = await postJson<ResolveResult>('/api/properties/import/media', { project: p, propertyId, title, images });
    messages.push(...resolved.warnings);
    const candidates = [...resolved.candidates];
    // Attached files inside a folder named after the project_key belong to this project.
    if (images) {
      for (const f of attachments) {
        const rel = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '').toLowerCase();
        if (rel && rel.split('/').slice(0, -1).includes(p.key) && !candidates.some((c) => c.local && base(c.local) === base(f.name))) {
          candidates.push({ role: /\.pdf$/i.test(f.name) ? 'document' : roleFromName(f.name), fetchUrl: '', local: f.name, name: f.name, docKind: /\.pdf$/i.test(f.name) ? (/brochure/i.test(f.name) ? 'brochure' : /floor|plan/i.test(f.name) ? 'floor-plans' : /price|cost/i.test(f.name) ? 'price-sheet' : 'other') : undefined });
        }
      }
    }
    update(key, { step: 'Copying photos and files', total: candidates.length, messages: [...messages] });

    // 2. Copy everything (attached files from the browser, links through the server in batches of 4).
    const media: ImportedMedia = { cover: null, gallery: [], masterPlan: null, floorPlans: [], documents: [], videoUrl: resolved.videoUrl, replaced: images };
    const place = (c: Candidate, result: Copied) => {
      if (result.kind === 'document') media.documents.push(result.document);
      else if (c.role === 'cover') media.cover = result.image;
      else if (c.role === 'gallery') media.gallery.push(result.image);
      else if (c.role === 'master-plan') media.masterPlan = media.masterPlan ?? result.image;
      else media.floorPlans.push({ image: result.image, unitIndex: c.unitIndex });
    };
    let order = 0;
    const local = candidates.filter((c) => c.local);
    const remote = candidates.filter((c) => !c.local);
    for (const c of local) {
      const file = attachedByName.get(c.local!.toLowerCase()) ?? attachedByName.get(base(c.local!));
      if (!file) messages.push(`“${c.local}” is named in the sheet but was not attached.`);
      else {
        try {
          place(c, await uploadLocal(c, file, propertyId, title, order++));
        } catch (e) {
          messages.push(e instanceof Error ? e.message : `${c.local} could not be uploaded`);
        }
      }
      update(key, (r) => ({ done: r.done + 1, messages: [...messages] }));
    }
    for (let i = 0; i < remote.length; i += 4) {
      const batch = remote.slice(i, i + 4).map((c) => ({ ...c, order: order++ }));
      try {
        const { results } = await postJson<{ results: ({ ok: true; copied: Copied } | { ok: false; error: string })[] }>('/api/properties/import/copy', { propertyId, title, items: batch });
        results.forEach((r, j) => {
          if (!r.ok) return void messages.push(r.error);
          place(batch[j], r.copied);
          if (r.copied.note && !messages.includes(r.copied.note)) messages.push(r.copied.note);
        });
      } catch (e) {
        messages.push(e instanceof Error ? e.message : 'Some files could not be copied');
      }
      update(key, (r) => ({ done: Math.min(r.total, r.done + batch.length), messages: [...messages] }));
    }

    // 3. Save.
    update(key, { step: 'Saving listing', messages: [...messages] });
    const saved = await postJson<{ id: string; slug: string; status: string; created: boolean; areaCreated: boolean; partnerCreated?: boolean; partnerName?: string; warnings: string[] }>('/api/properties/import/save', {
      project: p,
      media,
      developerId: scope === 'partner' ? developerId : undefined,
    });
    messages.push(...saved.warnings);
    if (saved.partnerCreated && saved.partnerName) {
      const name = saved.partnerName;
      messages.push(`New partner “${name}” was added to the Partners page.`);
      setNewPartners((list) => (list.includes(name) ? list : [...list, name]));
    }
    if (saved.areaCreated) messages.push(`New area “${p.fields.area}” was created in the ${p.fields.region} region.`);
    update(key, { state: 'done', step: saved.created ? `Created (${saved.status})` : `Updated (${saved.status})`, slug: saved.slug, id: saved.id, status: saved.status, messages: [...messages] });
  }

  /** "+ Add new partner…" in the partner list: creates a placeholder to fill in on the Partners page. */
  const addPartner = async () => {
    const name = window.prompt('Name of the new partner (developer)?')?.trim();
    if (!name) return;
    const existing = allPartners.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) return setDeveloperId(existing.id);
    setAddingPartner(true);
    const res = await createDeveloperAction(placeholderPartner(name, allPartners));
    setAddingPartner(false);
    if (!res.ok) return setError(res.message);
    setAddedPartners((list) => [...list, res.data]);
    setDeveloperId(res.data.id);
    setNewPartners((list) => [...list, res.data.name]);
    router.refresh();
  };

  const runImport = async () => {
    setPhase('importing');
    setRuns(Object.fromEntries(ready.map((p) => [p.key, { state: 'waiting', step: 'Waiting', done: 0, total: 0, messages: [] } as RunState])));
    // Two projects at a time keeps uploads quick without overloading the server.
    const queue = [...ready];
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        try {
          await importOne(p);
        } catch (e) {
          update(p.key, (r) => ({ state: 'failed', step: 'Failed', messages: [...(r?.messages ?? []), e instanceof Error ? e.message : 'Import failed'] }));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    try {
      const done = await postJson<{ warning?: string }>('/api/properties/import/finish', {});
      setFinishWarning(done.warning ?? null);
    } catch {
      setFinishWarning('Listings were saved, but the website refresh could not be requested. Changes appear within a minute.');
    }
    setPhase('done');
    router.refresh();
  };

  const totals = Object.values(runs);
  const doneCount = totals.filter((r) => r.state === 'done').length;
  const failedCount = totals.filter((r) => r.state === 'failed').length;
  const unpublished = Object.values(runs).filter((r) => r.state === 'done' && r.id && r.status !== 'published');

  /** Final step: the imported listings stay drafts until this is pressed. */
  const publishAll = async () => {
    const ids = unpublished.map((r) => r.id!);
    if (!ids.length || !confirm(`Publish ${ids.length} imported listing${ids.length === 1 ? '' : 's'} on the website now?`)) return;
    setPublishing(true);
    setPublishNote(null);
    const res = await setStatusesAction(ids, 'published');
    setPublishing(false);
    if (!res.ok) return setPublishNote({ ok: false, text: res.message });
    const changed = new Set(res.data.changed);
    setRuns((all) => Object.fromEntries(Object.entries(all).map(([k, r]) => [k, r.id && changed.has(r.id) ? { ...r, status: 'published', step: r.step.replace(/\((draft|archived)\)/, '(published)') } : r])));
    setPublishNote({ ok: !res.data.skipped.length, text: `${res.data.changed.length} listing${res.data.changed.length === 1 ? '' : 's'} published.${res.warning ? ` ${res.warning}` : ''}` });
    router.refresh();
  };

  return (
    <section id="bulk-upload" className="scroll-mt-24 rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Bulk upload from Excel</h2>
            <p className="text-2xs text-ink-muted">Projects, every unit size, charges, payment plan, nearby places, specifications, documents and photos in one workbook.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href="/api/properties/template" className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" /> Template
          </a>
          <button type="button" onClick={copyPrompt} className="btn-secondary text-xs" title="Paste into ChatGPT, Claude or Gemini with the template and the developer's files">
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
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">1. Fill the template.</span> Download it, then attach it with the brochure, cost sheet and floor-plan book to an AI tool together with the copied prompt, or fill it yourself.</li>
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">2. Photos.</span> Put a public Google Drive folder, ZIP or project-page link in <code>media_folder_link</code>, or attach images below (file names in the sheet, or a folder per project_key).</li>
                <li className="rounded-lg bg-surface-2/60 p-2.5"><span className="font-semibold text-ink">3. Check and import.</span> You see every project, its units and any problems before anything is saved. New listings are saved as drafts unless the sheet says published; publish them all with one click at the end.</li>
              </ol>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Partner</label>
                  <div className="flex gap-2">
                    <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'partner')} className="field w-1/2 text-sm">
                      <option value="all">From the sheet</option>
                      <option value="partner">One partner for all rows</option>
                    </select>
                    <select value={developerId} disabled={scope !== 'partner' || addingPartner} onChange={(e) => (e.target.value === '__new' ? addPartner() : setDeveloperId(e.target.value))} className="field w-1/2 text-sm disabled:opacity-50">
                      <option value="">{addingPartner ? 'Adding partner…' : 'Select partner'}</option>
                      {partnerOptions(allPartners).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}{partner.hidden ? ' (hidden)' : ''}</option>)}
                      <option value="__new">+ Add new partner…</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Files</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary px-3 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> {workbook ? 'Change workbook' : 'Choose workbook (.xlsx)'}
                    </button>
                    <button type="button" onClick={() => filesRef.current?.click()} className="btn-secondary px-3 text-xs">
                      <ImagePlus className="h-3.5 w-3.5" /> Attach images / PDFs
                    </button>
                    <button type="button" onClick={() => folderRef.current?.click()} className="btn-secondary px-3 text-xs">
                      <FolderOpen className="h-3.5 w-3.5" /> Attach a folder
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => setWorkbook(e.target.files?.[0] || null)} />
                  <input ref={filesRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => setAttachments((a) => [...a, ...Array.from(e.target.files ?? [])])} />
                  <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(e) => setAttachments((a) => [...a, ...Array.from(e.target.files ?? []).filter((f) => IMAGE_RE.test(f.name) || /\.pdf$/i.test(f.name))])} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                {workbook && <span>Workbook: <span className="font-medium text-ink">{workbook.name}</span> ({Math.ceil(workbook.size / 1024)} KB)</span>}
                {attachments.length > 0 && (
                  <span>
                    {attachments.length} file(s) attached{' '}
                    <button type="button" onClick={() => setAttachments([])} className="font-semibold text-accent-ink hover:underline">clear</button>
                  </span>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input type="checkbox" checked={replacePhotos} onChange={(e) => setReplacePhotos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
                <span>
                  <span className="font-semibold text-ink">Re-import photos for listings that already have photos</span>
                  <span className="block text-ink-muted">Off: existing listings keep their current photos and floor plans; only new listings get photos. Documents and all other details are always updated.</span>
                </span>
              </label>

              <button type="button" onClick={read} disabled={!workbook || phase === 'reading' || (scope === 'partner' && !developerId)} className="btn-primary text-xs disabled:opacity-50">
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
                  <span className="font-semibold text-ink">{projects.length}</span> project(s) in the workbook · <span className="text-emerald-700">{ready.length} ready</span>
                  {blocked.length > 0 && <> · <span className="text-danger">{blocked.length} with errors (skipped)</span></>}
                  {phase === 'importing' && <> · importing {doneCount + failedCount}/{ready.length}</>}
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
                      <Upload className="h-3.5 w-3.5" /> Import {ready.length} project{ready.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              </div>

              {phase === 'importing' && (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-all" style={{ width: `${ready.length ? ((doneCount + failedCount) / ready.length) * 100 : 0}%` }} />
                </div>
              )}
              {phase === 'done' && doneCount > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-soft/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink">
                    {unpublished.length ? (
                      <><span className="font-semibold">{unpublished.length} listing{unpublished.length === 1 ? ' is' : 's are'} saved as draft{unpublished.length === 1 ? '' : 's'}</span> and not on the website yet. Review them if you like, then publish.</>
                    ) : (
                      <span className="font-semibold">All imported listings are published.</span>
                    )}
                  </p>
                  {unpublished.length > 0 && (
                    <button type="button" onClick={publishAll} disabled={publishing} className="btn-primary shrink-0 text-xs disabled:opacity-50">
                      {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />} {publishing ? 'Publishing…' : `Publish ${unpublished.length} listing${unpublished.length === 1 ? '' : 's'}`}
                    </button>
                  )}
                </div>
              )}
              {newPartners.length > 0 && (
                <p className="rounded-lg bg-violet-50 p-2 text-xs text-violet-900">
                  New partner{newPartners.length === 1 ? '' : 's'} added: <span className="font-semibold">{newPartners.join(', ')}</span>.{' '}
                  <Link href="/developers?filter=incomplete" className="font-semibold underline">Fill in the details on the Partners page →</Link>
                </p>
              )}
              {publishNote && <p className={`rounded-lg p-2 text-xs ${publishNote.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{publishNote.text}</p>}
              {finishWarning && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{finishWarning}</p>}
              {notes.length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg bg-amber-50 p-2 pl-6 text-xs text-amber-900">
                  {notes.slice(0, 20).map((n) => <li key={n}>{n}</li>)}
                  {notes.length > 20 && <li>…and {notes.length - 20} more</li>}
                </ul>
              )}

              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {projects.map((p) => {
                  const run = runs[p.key];
                  const f = p.fields;
                  const counts = [
                    p.units && `${p.units.length} unit${p.units.length === 1 ? '' : 's'}`,
                    p.charges && `${p.charges.length} charges`,
                    p.stages && `${p.stages.length} payment stages`,
                    p.nearby && `${p.nearby.length} nearby`,
                    p.specs && `${p.specs.length} specs`,
                    p.documents && `${p.documents.length} docs`,
                    p.extras && `${p.extras.length} more details`,
                    f.amenities && `${f.amenities.length} amenities`,
                  ].filter(Boolean);
                  const bhks = Array.from(new Set((p.units ?? []).map((u) => (u.bhk ? `${u.bhk} BHK` : u.kind)))).join(', ');
                  const mediaInfo = [f.mediaFolder && 'media folder', f.cover && 'cover', f.gallery?.length && `${f.gallery.length} photo links`].filter(Boolean).join(', ');
                  return (
                    <li key={`${p.key}-${p.row}`} className={`p-3 text-xs ${p.errors.length ? 'bg-danger/5' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {[f.name, f.phase].filter(Boolean).join(' · ') || '(no name)'} <span className="font-mono font-normal text-ink-muted">/{p.key}</span>
                          </p>
                          <p className="text-ink-muted">
                            Row {p.row} · {p.partnerName ?? f.partner ?? '—'}
                            {p.partnerIsNew && <span className="ml-1 rounded bg-violet-100 px-1 text-violet-800">new partner</span>} · {p.areaName ?? f.area ?? '—'}
                            {p.areaIsNew && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-800">new area</span>} · {p.existingId ? `updates the existing listing${p.existingPhotos ? ` (${p.existingPhotos} photos)` : ''}` : 'new listing'}
                          </p>
                          <p className="text-ink-muted">{[bhks, counts.join(' · '), mediaInfo ? `Photos from: ${mediaInfo}` : 'no photo source'].filter(Boolean).join(' — ')}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {run ? (
                            <span className={`inline-flex items-center gap-1 font-semibold ${run.state === 'done' ? 'text-emerald-700' : run.state === 'failed' ? 'text-danger' : 'text-ink'}`}>
                              {run.state === 'working' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {run.state === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {run.state === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                              {run.step}
                              {run.state === 'working' && run.total > 0 && ` ${run.done}/${run.total}`}
                            </span>
                          ) : p.errors.length ? (
                            <span className="font-semibold text-danger">Will be skipped</span>
                          ) : (
                            <span className="text-emerald-700">Ready</span>
                          )}
                          {run?.id && (
                            <Link href={`/properties/${run.id}`} className="mt-1 block font-semibold text-accent-ink hover:underline">
                              Review listing →
                            </Link>
                          )}
                        </div>
                      </div>
                      {p.errors.length > 0 && (
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-danger">
                          {p.errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                      )}
                      {(p.warnings.length > 0 || (run?.messages.length ?? 0) > 0) && (
                        <details className="mt-1.5">
                          <summary className="inline-flex cursor-pointer items-center gap-1 text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" /> {p.warnings.length + (run?.messages.length ?? 0)} note(s)
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
                            {[...p.warnings, ...(run?.messages ?? [])].slice(0, 40).map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
                          </ul>
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
