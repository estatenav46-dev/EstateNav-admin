'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import type { Developer } from '@/lib/data/types';
import { resolvePartners } from '@/lib/partners';

type ImportResult = { created: number; updated: number; failed: number; errors: string[]; message?: string };

export function BulkPropertyUpload({ developers, defaultOpen = false }: { developers: Developer[]; defaultOpen?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<'all' | 'partner'>('all');
  const [developerId, setDeveloperId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copyImages, setCopyImages] = useState(true);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (window.location.hash === '#bulk-upload') setOpen(true);
  }, []);

  const upload = async () => {
    if (!file || (scope === 'partner' && !developerId)) return;
    setUploading(true);
    setResult(null);
    const data = new FormData();
    data.set('file', file);
    if (scope === 'partner') data.set('developerId', developerId);
    data.set('copyImages', String(copyImages));
    try {
      const response = await fetch('/api/properties/import', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'The workbook could not be imported.');
      setResult(payload);
      if (payload.created || payload.updated) router.refresh();
    } catch (error) {
      setResult({ created: 0, updated: 0, failed: 0, errors: [], message: error instanceof Error ? error.message : 'The workbook could not be imported.' });
    } finally {
      setUploading(false);
    }
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
            <p className="truncate text-2xs text-ink-muted">Add or update many listings at once. Rows with the same web address update the existing listing.</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href="/api/properties/template" className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" /> Template
          </a>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={open ? 'btn-secondary text-xs' : 'btn-primary text-xs'}>
            {open ? 'Close' : (<><Upload className="h-3.5 w-3.5" /> Upload Excel</>)}
          </button>
        </div>
      </div>
      {open && (
      <div className="border-t border-line p-3 sm:px-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold">Upload scope</label>
          <select value={scope} onChange={(event) => setScope(event.target.value as 'all' | 'partner')} className="field w-full text-sm">
            <option value="all">All partners — use developer_id in the sheet</option>
            <option value="partner">One partner — apply the selected partner to every row</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Partner developer {scope === 'partner' ? '*' : '(optional)'}</label>
          <select value={developerId} disabled={scope !== 'partner'} onChange={(event) => setDeveloperId(event.target.value)} className="field w-full text-sm disabled:opacity-50">
            <option value="">Select partner</option>
            {resolvePartners(developers).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary px-3 text-xs">
            <Upload className="h-3.5 w-3.5" /> {file ? 'Change file' : 'Choose Excel'}
          </button>
          <button type="button" onClick={upload} disabled={!file || uploading || (scope === 'partner' && !developerId)} className="btn-primary px-3 text-xs disabled:opacity-50">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} {uploading ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs">
        <input type="checkbox" checked={copyImages} onChange={(e) => setCopyImages(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
        <span>
          <span className="font-semibold text-ink">Copy image and PDF links into Cloudinary</span>
          <span className="block text-ink-muted">Recommended, so listings do not depend on other websites. Works for up to 40 rows per upload; files over 10 MB stay as links.</span>
        </span>
      </label>
      {file && <p className="mt-3 text-xs text-ink-muted">Selected: <span className="font-medium text-ink">{file.name}</span> ({Math.ceil(file.size / 1024)} KB)</p>}
      <p className="mt-3 text-2xs text-ink-muted">Required columns: title, corridor_id, price_min, and developer_id unless you import for one partner. The template&apos;s “Column guide” sheet explains every column, and “Partners &amp; areas” lists the IDs to use.</p>

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-xs ${result.message ? 'border-danger/30 bg-danger/10 text-danger' : result.failed ? 'border-amber-400/40 bg-amber-50 text-amber-900' : 'border-emerald-400/40 bg-emerald-50 text-emerald-900'}`}>
          {result.message ? <div className="flex items-center gap-2"><XCircle className="h-4 w-4" />{result.message}</div> : <><p className="font-semibold">Import complete: {result.created} created, {result.updated} updated, {result.failed} skipped.</p>{result.errors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</>}
        </div>
      )}
      </div>
      )}
    </section>
  );
}
