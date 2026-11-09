'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import type { ImageRef } from '@/lib/data/types';
import { uploadImageToCloudinary } from '@/lib/media';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function inspect(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = Math.max(1, Math.round((16 * bitmap.height) / bitmap.width));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const result = { width: bitmap.width, height: bitmap.height, blurDataURL: canvas.toDataURL('image/jpeg', 0.6) };
  bitmap.close();
  return result;
}

type Props = {
  label: string;
  images: ImageRef[];
  onChange: (images: ImageRef[]) => void;
  storagePath: string;
  coverId?: string;
  onSetCover?: (image: ImageRef) => void;
  description?: string;
};

export function MediaUploader({ label, images, onChange, storagePath, coverId, onSetCover, description }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [problem, setProblem] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    setProblem('');
    const list = Array.from(files).filter((f) => {
      if (!f.type.startsWith('image/')) {
        setProblem(`${f.name} is not an image.`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        setProblem(`${f.name} exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });

    let current = [...images];
    for (const file of list) {
      setUploads((prev) => [...prev, { name: file.name, pct: 0 }]);
      try {
        const meta = await inspect(file);
        const ref = await uploadImageToCloudinary(
          file,
          storagePath,
          { alt: '', order: current.length, ...meta },
          ({ loaded, total }) => {
            setUploads((prev) =>
              prev.map((item) => (item.name === file.name ? { ...item, pct: Math.round((loaded / total) * 100) } : item))
            );
          }
        );
        current = [...current, ref];
        onChange(current);
        if (current.length === 1 && onSetCover) {
          onSetCover(ref);
        }
      } catch (err: unknown) {
        setProblem(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      } finally {
        setUploads((prev) => prev.filter((item) => item.name !== file.name));
      }
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next.map((img, i) => ({ ...img, order: i })));
  };

  const updateAlt = (index: number, alt: string) => {
    onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)));
  };

  const remove = (index: number) => {
    onChange(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i })));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium">{label}</label>
        {description && <p className="text-2xs text-ink-muted">{description}</p>}
      </div>

      {problem && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{problem}</span>
        </div>
      )}

      {/* Upload Zone */}
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
        className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging ? 'border-accent-ink bg-accent-soft/30' : 'border-line hover:border-line-strong hover:bg-surface-2'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink">
          <ImagePlus className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Click to upload or drag & drop</p>
        <p className="text-2xs text-ink-muted mt-0.5">JPEG, PNG, WebP or AVIF up to 10 MB per image</p>
      </div>

      {/* Progress Bars */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.name} className="rounded-lg border border-line bg-surface p-2 text-xs">
              <div className="flex items-center justify-between text-2xs mb-1">
                <span className="truncate max-w-[200px] flex items-center gap-1.5 font-mono">
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

      {/* Gallery Grid */}
      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {images.map((img, i) => {
            const isCover = coverId ? img.id === coverId : i === 0;
            return (
              <div
                key={img.id || i}
                className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-all ${
                  isCover ? 'border-accent shadow-sm ring-1 ring-accent' : 'border-line'
                }`}
              >
                <div className="relative aspect-[4/3] w-full bg-surface-2">
                  <Image
                    src={img.url}
                    alt={img.alt || 'Property image'}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                    placeholder={img.blurDataURL ? 'blur' : 'empty'}
                    blurDataURL={img.blurDataURL}
                  />

                  {/* Actions overlay */}
                  <div className="absolute inset-0 flex items-start justify-between bg-gradient-to-b from-black/60 via-transparent to-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-2xs text-white">
                      #{i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="rounded bg-black/60 p-1 text-danger hover:bg-danger hover:text-white transition-colors"
                      title="Delete image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isCover && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-white shadow-sm flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Cover
                    </div>
                  )}
                </div>

                <div className="p-2 space-y-1.5">
                  <input
                    type="text"
                    value={img.alt}
                    onChange={(e) => updateAlt(i, e.target.value)}
                    placeholder="Alt text / description"
                    className="field min-h-[30px] text-2xs px-2"
                  />

                  <div className="flex items-center justify-between text-2xs text-ink-muted">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                        className="rounded p-1 hover:bg-surface-2 disabled:opacity-30"
                        title="Move left"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={i === images.length - 1}
                        onClick={() => move(i, i + 1)}
                        className="rounded p-1 hover:bg-surface-2 disabled:opacity-30"
                        title="Move right"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {!isCover && onSetCover && (
                      <button
                        type="button"
                        onClick={() => onSetCover(img)}
                        className="text-accent-ink hover:underline flex items-center gap-1 font-medium"
                      >
                        <Star className="h-3 w-3" /> Set cover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

