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
