import crypto from 'crypto';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dqcdzoi3';

export const cloudinaryServerReady = () => Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

/** Server-side signed upload of a remote URL (Cloudinary fetches it). Used by the Excel import. */
export async function copyRemoteToCloudinary(url: string, folder: string, resourceType: 'image' | 'raw' = 'image') {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Cloudinary API key/secret are not configured.');
  const params: Record<string, string> = { folder: `estatenav/${folder}`, timestamp: String(Math.round(Date.now() / 1000)) };
  if (resourceType === 'raw') {
    params.use_filename = 'true';
    params.unique_filename = 'true';
  }
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
  const body = new FormData();
  body.set('file', url);
  Object.entries(params).forEach(([k, v]) => body.set(k, v));
  body.set('api_key', apiKey);
  body.set('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body });
  const data = (await res.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number; bytes?: number; error?: { message?: string } };
  if (!res.ok || !data.secure_url || !data.public_id) throw new Error(data.error?.message || `Cloudinary rejected ${url}`);
  return { url: data.secure_url, publicId: data.public_id, width: data.width ?? 1600, height: data.height ?? 1060, bytes: data.bytes ?? null };
}

/** Cloudinary's per-file limit on the current plan; larger files stay as links. */
export const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Server-side signed upload of bytes the server already downloaded (Drive files, ZIP entries,
 * pages that block hotlinking). Images go to /image/upload, PDFs to /raw/upload.
 */
export async function uploadBufferToCloudinary(bytes: Uint8Array, filename: string, folder: string, resourceType: 'image' | 'raw' = 'image') {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('Cloudinary API key/secret are not configured.');
  if (bytes.byteLength > CLOUDINARY_MAX_BYTES) throw new Error(`${filename} is larger than 10 MB`);
  const params: Record<string, string> = { folder: `estatenav/${folder}`, timestamp: String(Math.round(Date.now() / 1000)) };
  if (resourceType === 'raw') {
    params.use_filename = 'true';
    params.unique_filename = 'true';
  }
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
  const body = new FormData();
  body.set('file', new Blob([bytes as Uint8Array<ArrayBuffer>]), filename.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file');
  Object.entries(params).forEach(([k, v]) => body.set(k, v));
  body.set('api_key', apiKey);
  body.set('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body, signal: AbortSignal.timeout(90_000) });
  const data = (await res.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number; bytes?: number; error?: { message?: string } };
  if (!res.ok || !data.secure_url || !data.public_id) throw new Error(data.error?.message || `Cloudinary rejected ${filename}`);
  return { url: data.secure_url, publicId: data.public_id, width: data.width ?? 1600, height: data.height ?? 1060, bytes: data.bytes ?? null };
}

/** Deletes an uploaded file (used when Cloudinary refuses to deliver it). */
export async function destroyCloudinary(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) return;
  const params: Record<string, string> = { public_id: publicId, timestamp: String(Math.round(Date.now() / 1000)) };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const body = new FormData();
  Object.entries(params).forEach(([k, v]) => body.set(k, v));
  body.set('api_key', apiKey);
  body.set('signature', crypto.createHash('sha1').update(toSign + apiSecret).digest('hex'));
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`, { method: 'POST', body, signal: AbortSignal.timeout(20_000) }).catch(() => undefined);
}

/** True when the delivered file actually loads (accounts can block PDF delivery). */
export async function isDeliverable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}
