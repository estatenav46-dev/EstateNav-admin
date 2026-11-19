import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth/session';

// Signs browser uploads for signed-in admins only. Only the parameters below can be signed,
// and uploads must stay inside the estatenav/ folder.
const SIGNABLE = new Set(['folder', 'timestamp', 'use_filename', 'unique_filename']);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as { params?: Record<string, unknown>; folder?: unknown; timestamp?: unknown };
    // Older clients send { folder, timestamp } at the top level.
    const raw = body.params ?? { folder: body.folder, timestamp: body.timestamp };
    const params = Object.fromEntries(
      Object.entries(raw)
        .filter(([key, value]) => SIGNABLE.has(key) && value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)]),
    );

    const folder = params.folder ?? '';
    if (!/^estatenav\/[a-z0-9/_-]{1,160}$/i.test(folder)) {
      return NextResponse.json({ error: 'Invalid upload folder' }, { status: 400 });
    }
    const timestamp = Number(params.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 3600) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    if (!apiSecret || !apiKey) {
      return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 500 });
    }

    // Cloudinary signs the parameters sorted alphabetically, joined as key=value&key=value.
    const paramsToSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

    return NextResponse.json({ signature, timestamp: params.timestamp, apiKey });
  } catch {
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 });
  }
}
