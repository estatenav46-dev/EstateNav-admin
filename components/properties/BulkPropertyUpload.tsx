'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import type { Developer } from '@/lib/data/types';

type ImportResult = { created: number; updated: number; failed: number; errors: string[]; message?: string };

export function BulkPropertyUpload({ developers }: { developers: Developer[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<'all' | 'partner'>('all');
  const [developerId, setDeveloperId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file || (scope === 'partner' && !developerId)) return;
    setUploading(true);
    setResult(null);
    const data = new FormData();
    data.set('file', file);
    if (scope === 'partner') data.set('developerId', developerId);
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
    <section id="bulk-upload" className="panel scroll-mt-24 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-ink">Bulk property upload</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-ink-muted">Import up to 1,000 listings from Excel. Existing listings with the same generated slug are updated; new rows start with the status in the sheet (draft is recommended).</p>
        </div>
        <a href="/api/properties/template" className="btn-secondary shrink-0 px-3 text-xs">
          <Download className="h-3.5 w-3.5" /> Download template
        </a>
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
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
            {developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}
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

      {file && <p className="mt-3 text-xs text-ink-muted">Selected: <span className="font-medium text-ink">{file.name}</span> ({Math.ceil(file.size / 1024)} KB)</p>}
      <p className="mt-3 text-2xs text-ink-muted">Required columns: title, corridor_id (or corridor/region), price_min. For overall import add developer_id (or developer). Use | between multiple BHKs, amenities, highlights, or gallery image URLs.</p>

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-xs ${result.message ? 'border-danger/30 bg-danger/10 text-danger' : result.failed ? 'border-amber-400/40 bg-amber-50 text-amber-900' : 'border-emerald-400/40 bg-emerald-50 text-emerald-900'}`}>
          {result.message ? <div className="flex items-center gap-2"><XCircle className="h-4 w-4" />{result.message}</div> : <><p className="font-semibold">Import complete: {result.created} created, {result.updated} updated, {result.failed} skipped.</p>{result.errors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</>}
        </div>
      )}
    </section>
  );
}
