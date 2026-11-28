import { dbErrorMessage } from '@/lib/data/dbErrors';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveMedia } from '@/lib/import/media';
import type { ParsedProject } from '@/lib/import/parse';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Step 2: lists the photos, plans and documents a project's links point to (ZIP photos are uploaded here). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  try {
    const body = (await request.json()) as { project: ParsedProject; propertyId: string; title: string; images: boolean };
    if (!body?.project?.key || !/^[\w-]{2,140}$/.test(body.propertyId ?? '')) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
    const result = await resolveMedia(body.project, body.propertyId, String(body.title || body.project.key).slice(0, 140), { images: body.images !== false });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: dbErrorMessage(error, 'Media could not be read.') }, { status: 500 });
  }
}
