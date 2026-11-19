'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, ArrowLeft, ArrowRight, AlertCircle, Loader2, Link2 } from 'lucide-react';
import type { ImageRef } from '@/lib/data/types';
import { MAX_UPLOAD_BYTES, importImageFromUrl, inspectImage, uploadImageToCloudinary } from '@/lib/media';

type Props = {
  label: string;
  images: ImageRef[];
  onChange: (images: ImageRef[]) => void;
  storagePath: string;
  coverId?: string;
  onSetCover?: (image: ImageRef) => void;
  description?: string;
  /** 1 = a single image slot (logo, hero, master plan): a new upload replaces the old one. */
  max?: number;
  /** Used to write default alt text, e.g. "Sobha Neopolis photo 3". */
  altPrefix?: string;
  allowUrlImport?: boolean;
};

const fileAlt = (name: string) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();

export function MediaUploader({ label, images, onChange, storagePath, coverId, onSetCover, description, max, altPrefix, allowUrlImport = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [problem, setProblem] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const single = max === 1;
  const full = max !== undefined && !single && images.length >= max;

  const defaultAlt = (index: number, name?: string) => (altPrefix ? `${altPrefix} ${single ? '' : `photo ${index + 1}`}`.trim() : name ? fileAlt(name) : `Image ${index + 1}`);

  const commit = (next: ImageRef[]) => {
    const ordered = next.map((img, i) => ({ ...img, order: i }));
    onChange(ordered);
    if (onSetCover && ordered.length && (!coverId || !ordered.some((img) => img.id === coverId))) onSetCover(ordered[0]);
  };

  const handleFiles = async (files: FileList | File[]) => {
    setProblem('');
    const accepted = Array.from(files).filter((f) => {
      if (!f.type.startsWith('image/')) {
        setProblem(`${f.name} is not an image. Upload PDFs under Documents.`);
        return false;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setProblem(`${f.name} is larger than 10 MB. Compress it or export a smaller JPEG.`);
        return false;
      }
      return true;
    });
    const list = single ? accepted.slice(0, 1) : max ? accepted.slice(0, Math.max(0, max - images.length)) : accepted;

    let current = single ? [] : [...images];
    for (const file of list) {
      setUploads((prev) => [...prev, { name: file.name, pct: 0 }]);
      try {
        const meta = await inspectImage(file);
        const ref = await uploadImageToCloudinary(file, storagePath, { alt: defaultAlt(current.length, file.name), order: current.length, ...meta }, ({ loaded, total }) =>
          setUploads((prev) => prev.map((item) => (item.name === file.name ? { ...item, pct: Math.round((loaded / total) * 100) } : item))),
        );
        current = [...current, ref];
        commit(current);
      } catch (err: unknown) {
        setProblem(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      } finally {
        setUploads((prev) => prev.filter((item) => item.name !== file.name));
      }
    }
  };

  const importUrl = async () => {
    const value = url.trim();
    if (!/^https?:\/\//i.test(value)) {
      setProblem('Paste a full image link starting with https://');
      return;
    }
    setProblem('');
    setImporting(true);
    try {
      const ref = await importImageFromUrl(value, storagePath, { alt: defaultAlt(single ? 0 : images.length), order: single ? 0 : images.length });
      commit(single ? [ref] : [...images, ref]);
      setUrl('');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That link could not be imported.');
    } finally {
      setImporting(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const updateAlt = (index: number, alt: string) => onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)));
  const remove = (index: number) => commit(images.filter((_, i) => i !== index));
  const busy = uploads.length > 0 || importing;

  return (
    <div className="space-y-3">
      {(label || description) && (
        <div>
          {label && <p className="text-sm font-semibold text-ink">{label}</p>}
          {description && <p className="text-2xs text-ink-muted">{description}</p>}
        </div>
      )}

      {problem && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{problem}</span>
        </div>
      )}

      {!full && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-all ${single ? 'min-h-[96px] p-4' : 'min-h-[120px] p-6'} ${
            isDragging ? 'border-accent-ink bg-accent-soft/30' : 'border-line hover:border-line-strong hover:bg-surface-2'
          }`}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple={!single} className="hidden" onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </div>
          <p className="text-sm font-medium">{single && images.length ? 'Replace image' : 'Click to upload or drag & drop'}</p>
          <p className="mt-0.5 text-2xs text-ink-muted">JPEG, PNG, WebP or AVIF, up to 10 MB each{!single ? ' · select many at once' : ''}</p>
        </div>
      )}

      {allowUrlImport && !full && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void importUrl();
                }
              }}
              placeholder="…or paste an image link to copy it into Cloudinary"
              className="field min-h-[38px] pl-8 text-xs"
            />
          </div>
          <button type="button" onClick={importUrl} disabled={!url.trim() || importing} className="btn-secondary min-h-[38px] px-3 text-xs">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Import'}
          </button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.name} className="rounded-lg border border-line bg-surface p-2 text-xs">
              <div className="mb-1 flex items-center justify-between text-2xs">
                <span className="flex max-w-[220px] items-center gap-1.5 truncate font-mono">
                  <Loader2 className="h-3 w-3 animate-spin text-accent-ink" />
                  {u.name}
                </span>
                <span className="font-mono text-accent-ink">{u.pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent transition-all duration-150" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className={`grid gap-3 ${single ? 'max-w-xs' : 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
          {images.map((img, i) => {
            const isCover = Boolean(onSetCover) && (coverId ? img.id === coverId : i === 0);
            return (
              <div key={img.id || i} className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-all ${isCover ? 'border-accent shadow-sm ring-1 ring-accent' : 'border-line'}`}>
                <div className="relative aspect-[4/3] w-full bg-surface-2">
                  <Image src={img.url} alt={img.alt || 'Uploaded image'} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover" placeholder={img.blurDataURL ? 'blur' : 'empty'} blurDataURL={img.blurDataURL || undefined} />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
                    {!single && <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-2xs text-white">#{i + 1}</span>}
                    <button type="button" onClick={() => remove(i)} className="ml-auto rounded bg-black/60 p-1 text-white transition-colors hover:bg-danger" title="Remove image" aria-label={`Remove image ${i + 1}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isCover && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-white shadow-sm">
                      <Star className="h-3 w-3 fill-current" /> Cover
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-2">
                  <input type="text" value={img.alt} onChange={(e) => updateAlt(i, e.target.value)} placeholder="Describe the photo (alt text)" className={`field min-h-[30px] px-2 text-2xs ${img.alt.trim() ? '' : 'border-danger/50'}`} />
                  {!single && (
                    <div className="flex items-center justify-between text-2xs text-ink-muted">
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" title="Move earlier" aria-label="Move earlier">
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button type="button" disabled={i === images.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" title="Move later" aria-label="Move later">
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                      {!isCover && onSetCover && (
                        <button type="button" onClick={() => onSetCover(img)} className="flex items-center gap-1 font-medium text-accent-ink hover:underline">
                          <Star className="h-3 w-3" /> Set as cover
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
