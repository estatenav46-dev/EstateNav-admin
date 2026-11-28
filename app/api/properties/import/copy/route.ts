import { dbErrorMessage } from '@/lib/data/dbErrors';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { copyCandidate, type Candidate, type Copied } from '@/lib/import/media';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Step 3: copies up to 6 files into Cloudinary per call, so no request runs too long. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  try {
    const body = (await request.json()) as { propertyId: string; title: string; items: (Candidate & { order: number })[] };
    if (!/^[\w-]{2,140}$/.test(body.propertyId ?? '') || !Array.isArray(body.items) || body.items.length > 6) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
    const results = await Promise.all(
      body.items.map(async (item): Promise<{ ok: true; copied: Copied; note?: string } | { ok: false; error: string }> => {
        try {
          return { ok: true, copied: await copyCandidate(item, body.propertyId, String(body.title).slice(0, 140), item.order ?? 0) };
        } catch (error) {
          return { ok: false, error: dbErrorMessage(error, `${item.name}: could not be copied`) };
        }
      }),
    );
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ message: dbErrorMessage(error, 'Copy failed.') }, { status: 500 });
  }
}
