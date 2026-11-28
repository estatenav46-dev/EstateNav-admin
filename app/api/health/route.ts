import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { QUOTA_MESSAGE, isQuotaError } from '@/lib/data/dbErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lets the error page say why a page failed: one small read tells quota problems apart. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, reason: 'session' }, { status: 401 });
  try {
    await getDb().collection('settings').doc('site').get();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isQuotaError(error)) return NextResponse.json({ ok: false, reason: 'quota', message: QUOTA_MESSAGE }, { status: 503 });
    console.error('[health] database check failed:', error);
    return NextResponse.json({ ok: false, reason: 'database' }, { status: 503 });
  }
}
