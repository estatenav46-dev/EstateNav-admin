import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { REFRESH_WARNING, triggerWebsiteRevalidation } from '@/lib/data/revalidate';

export const runtime = 'nodejs';

/** Refreshes the admin and the website once after a partner import (names are copied onto listings). */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  revalidatePath('/developers');
  revalidatePath('/properties');
  revalidatePath('/');
  const [catalogue, listings] = await Promise.all([triggerWebsiteRevalidation('catalogue', '/'), triggerWebsiteRevalidation('properties')]);
  return NextResponse.json({ refreshed: catalogue && listings, warning: catalogue && listings ? undefined : REFRESH_WARNING });
}
