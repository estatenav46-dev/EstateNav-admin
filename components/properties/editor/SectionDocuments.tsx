'use client';

import { useRef, useState } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { CloudUpload, ExternalLink, FileText, Link2, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { DocumentKind, PropertyDocument } from '@/lib/data/types';
import { DOCUMENT_KIND_LABEL } from '@/lib/listingMeta';
import { MAX_UPLOAD_BYTES, formatBytes, uploadDocumentToCloudinary } from '@/lib/media';
import { EmptyRow, Field, SubSection, newId } from '@/components/ui/form';
import { SectionCard, useDraft } from './ui';

const QUICK: DocumentKind[] = ['brochure', 'floor-plans', 'master-plan', 'price-sheet', 'payment-plan', 'specifications', 'rera-certificate'];

/** Where one document's file comes from: an upload, a link copied into Cloudinary, or an external link. */
function DocumentFile({ index }: { index: number }) {
  const { control, setValue, getValues } = useDraft();
  const doc = useWatch({ control, name: `documents.${index}` }) as PropertyDocument | undefined;
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'import' | 'link'>('upload');
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const folder = `properties/${getValues('id')}/documents`;

  const apply = (patch: Partial<PropertyDocument>) => {
    const current = getValues(`documents.${index}`);
    setValue(`documents.${index}`, { ...current, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  const upload = async (file: File) => {
    setProblem('');
    if (!/pdf|image\//.test(file.type) && !/\.pdf$/i.test(file.name)) return setProblem('Upload a PDF or an image.');
    if (file.size > MAX_UPLOAD_BYTES) return setProblem(`This file is ${formatBytes(file.size)}. Cloudinary accepts up to 10 MB: compress the PDF, or use “External link” (e.g. the developer's own download link).`);
    try {
      setProgress(0);
      const res = await uploadDocumentToCloudinary(file, folder, ({ loaded, total }) => setProgress(Math.round((loaded / total) * 100)));
      apply({ url: res.url, storagePath: res.storagePath, sizeBytes: res.sizeBytes, format: res.format });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setProgress(null);
    }
  };

  const saveLink = async () => {
    const value = link.trim();
    setProblem('');
    if (!/^https?:\/\//i.test(value)) return setProblem('Paste a full link starting with https://');
    if (mode === 'link') {
      apply({ url: value, storagePath: '', sizeBytes: null, format: 'link' });
      setLink('');
      return;
    }
    try {
      setProgress(0);
      const res = await uploadDocumentToCloudinary(value, folder);
      apply({ url: res.url, storagePath: res.storagePath, sizeBytes: res.sizeBytes, format: res.format });
      setLink('');
    } catch (err) {
      setProblem(`${err instanceof Error ? err.message : 'Import failed.'} If the file is over 10 MB, choose “External link” instead.`);
    } finally {
      setProgress(null);
    }
  };

  if (doc?.url) {
    const name = decodeURIComponent(doc.url.split('/').pop()?.split('?')[0] ?? 'file');
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-xs">
        {doc.format === 'link' ? <Link2 className="h-4 w-4 shrink-0 text-ink-muted" /> : <FileText className="h-4 w-4 shrink-0 text-accent" />}
        <span className="min-w-0 flex-1 truncate font-mono" title={doc.url}>
          {doc.format === 'link' ? doc.url : name}
        </span>
        <span className="text-ink-muted">{doc.format === 'link' ? 'External link' : `Cloudinary${doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ''}`}</span>
        <a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
          Open <ExternalLink className="h-3 w-3" />
        </a>
        <button type="button" onClick={() => apply({ url: '', storagePath: '', sizeBytes: null })} className="inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink">
          <RefreshCw className="h-3 w-3" /> Replace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-line-strong p-3">
      <div className="flex flex-wrap gap-1 text-2xs">
        {(
          [
            ['upload', 'Upload file'],
            ['import', 'Copy from a link'],
            ['link', 'External link'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-md px-2.5 py-1 font-semibold ${mode === id ? 'bg-ink text-bg' : 'text-ink-muted hover:bg-surface-2'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'upload' ? (
        <>
          <button type="button" onClick={() => input.current?.click()} disabled={progress !== null} className="btn-secondary w-full text-xs">
            {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {progress !== null ? `Uploading ${progress}%` : 'Choose PDF or image (max 10 MB)'}
          </button>
          <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveLink();
              }
            }}
            className="field min-h-[36px] flex-1 text-xs"
            placeholder={mode === 'import' ? 'https://www.developer.com/…/brochure.pdf (copied into Cloudinary)' : 'https://… (stored as a link, not copied)'}
          />
          <button type="button" onClick={saveLink} disabled={!link.trim() || progress !== null} className="btn-secondary min-h-[36px] px-3 text-xs">
            {progress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'import' ? 'Copy' : 'Save link'}
          </button>
        </div>
      )}
      {problem && <p className="text-2xs text-danger">{problem}</p>}
    </div>
  );
}

export function SectionDocuments() {
  const { control, register, getValues, formState } = useDraft();
  const docs = useFieldArray({ control, name: 'documents', keyName: 'key' });
  const errors = formState.errors.documents;
  const title = getValues('title');

  const add = (kind: DocumentKind) =>
    docs.append({
      id: newId('doc'),
      kind,
      label: `${title ? `${title} ` : ''}${DOCUMENT_KIND_LABEL[kind].toLowerCase()}`.replace(/^./, (c) => c.toUpperCase()),
      url: '',
      storagePath: '',
      format: 'pdf',
      sizeBytes: null,
      access: kind === 'price-sheet' || kind === 'payment-plan' ? 'on-request' : 'public',
    });

  return (
    <SectionCard id="documents">
      <SubSection title="Documents" description="“Public” files download straight from the project page. “On request” files ask the visitor to enquire first, and their links are never sent to the browser.">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((kind) => (
            <button key={kind} type="button" onClick={() => add(kind)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft/40">
              <Plus className="h-3 w-3" /> {DOCUMENT_KIND_LABEL[kind]}
            </button>
          ))}
          <button type="button" onClick={() => add('other')} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:border-accent">
            <Plus className="h-3 w-3" /> Other
          </button>
        </div>

        {docs.fields.length === 0 ? (
          <EmptyRow>No documents yet. Add the brochure, floor-plan set and master plan PDFs from the developer&apos;s channel-partner kit.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {docs.fields.map((field, i) => (
              <li key={field.key} className="space-y-3 rounded-xl border border-line bg-surface p-3">
                <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)_170px_auto] sm:items-end">
                  <Field label="Type">
                    <select {...register(`documents.${i}.kind`)} className="field min-h-[36px] text-xs">
                      {(Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[]).map((k) => (
                        <option key={k} value={k}>
                          {DOCUMENT_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Name shown" error={errors?.[i]?.label ? 'Name the document.' : undefined}>
                    <input {...register(`documents.${i}.label`)} className="field min-h-[36px] text-xs" placeholder="e.g. SOBHA Neopolis brochure" />
                  </Field>
                  <Field label="Access">
                    <select {...register(`documents.${i}.access`)} className="field min-h-[36px] text-xs">
                      <option value="public">Public download</option>
                      <option value="on-request">On request (lead form)</option>
                    </select>
                  </Field>
                  <button type="button" onClick={() => docs.remove(i)} className="rounded p-2 text-danger hover:bg-danger/10 sm:mb-0.5" aria-label="Remove document">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <DocumentFile index={i} />
                {errors?.[i]?.url && <p className="text-2xs text-danger">Upload the file or add a link, or remove this row.</p>}
              </li>
            ))}
          </ul>
        )}
      </SubSection>
    </SectionCard>
  );
}
