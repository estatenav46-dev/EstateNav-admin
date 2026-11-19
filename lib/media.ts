import type { ImageRef } from './data/types';

export interface UploadProgress {
  loaded: number;
  total: number;
}

type ResourceType = 'image' | 'raw';

type CloudinaryResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  resource_type?: string;
};

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dqcdzoi3';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'estatenav_uploads';

/** Cloudinary's per-file limit on the free plan; larger files should be linked instead. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function post(resourceType: ResourceType, form: FormData, onProgress?: (p: UploadProgress) => void): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, true);
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total });
      };
    }
    xhr.onload = () => {
      let data: (CloudinaryResult & { error?: { message?: string } }) | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) resolve(data);
      else reject(new Error(data?.error?.message || `Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary.'));
    xhr.send(form);
  });
}

/**
 * Uploads a file, or a public URL that Cloudinary fetches itself, into estatenav/{path}.
 * Signed through /api/cloudinary-sign; falls back to the unsigned preset if signing is not configured.
 */
export async function uploadToCloudinary(
  source: File | string,
  path: string,
  options: { resourceType?: ResourceType; keepFilename?: boolean; onProgress?: (p: UploadProgress) => void } = {},
): Promise<CloudinaryResult> {
  const { resourceType = 'image', keepFilename = false, onProgress } = options;
  const folder = `estatenav/${path}`.replace(/\/+/g, '/');
  const params: Record<string, string> = { folder, timestamp: String(Math.round(Date.now() / 1000)) };
  if (keepFilename) {
    params.use_filename = 'true';
    params.unique_filename = 'true';
  }

  let signed: { signature: string; apiKey: string } | null = null;
  let status = 0;
  try {
    const res = await fetch('/api/cloudinary-sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params }) });
    status = res.status;
    if (res.ok) signed = (await res.json()) as { signature: string; apiKey: string };
  } catch {
    // Signing endpoint unreachable: use the unsigned preset below.
  }
  if (status === 401) throw new Error('Your admin session has expired. Sign in again to upload.');

  if (signed) {
    const form = new FormData();
    form.append('file', source);
    Object.entries(params).forEach(([key, value]) => form.append(key, value));
    form.append('api_key', signed.apiKey);
    form.append('signature', signed.signature);
    return post(resourceType, form, onProgress);
  }

  const fallback = new FormData();
  fallback.append('file', source);
  fallback.append('upload_preset', UPLOAD_PRESET);
  fallback.append('folder', folder);
  return post(resourceType, fallback, onProgress);
}

/** Reads real dimensions and a 16px blur preview in the browser before upload. */
export async function inspectImage(file: Blob): Promise<{ width: number; height: number; blurDataURL: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = Math.max(1, Math.round((16 * bitmap.height) / bitmap.width));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const result = { width: bitmap.width, height: bitmap.height, blurDataURL: canvas.toDataURL('image/jpeg', 0.6) };
  bitmap.close();
  return result;
}

export async function uploadImageToCloudinary(
  file: File,
  path: string,
  meta: { alt: string; order: number; width: number; height: number; blurDataURL: string },
  onProgress?: (progress: UploadProgress) => void,
): Promise<ImageRef> {
  const data = await uploadToCloudinary(file, path, { resourceType: 'image', onProgress });
  return {
    id: data.public_id,
    storagePath: data.public_id,
    url: data.secure_url,
    alt: meta.alt,
    width: data.width || meta.width,
    height: data.height || meta.height,
    blurDataURL: meta.blurDataURL,
    order: meta.order,
  };
}

/** Imports an image that already sits on another site (e.g. a developer's media kit) into Cloudinary. */
export async function importImageFromUrl(url: string, path: string, meta: { alt: string; order: number }): Promise<ImageRef> {
  const data = await uploadToCloudinary(url, path, { resourceType: 'image' });
  return {
    id: data.public_id,
    storagePath: data.public_id,
    url: data.secure_url,
    alt: meta.alt,
    width: data.width || 1600,
    height: data.height || 1000,
    blurDataURL: '',
    order: meta.order,
  };
}

const isPdfName = (name: string) => /\.pdf($|[?#])/i.test(name);

/**
 * Brochures, floor-plan sets and other documents. PDFs are stored as Cloudinary "raw" files so
 * they download as PDFs (image-type PDFs are blocked from delivery on free Cloudinary plans).
 */
export async function uploadDocumentToCloudinary(
  source: File | string,
  path: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ url: string; storagePath: string; sizeBytes: number | null; format: 'pdf' | 'image' }> {
  const pdf = typeof source === 'string' ? isPdfName(source) || !/\.(jpe?g|png|webp|avif|gif)($|[?#])/i.test(source) : source.type === 'application/pdf' || isPdfName(source.name);
  const data = await uploadToCloudinary(source, path, { resourceType: pdf ? 'raw' : 'image', keepFilename: true, onProgress });
  return {
    url: data.secure_url,
    storagePath: data.public_id,
    sizeBytes: typeof data.bytes === 'number' ? data.bytes : typeof source === 'string' ? null : source.size,
    format: pdf ? 'pdf' : 'image',
  };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
