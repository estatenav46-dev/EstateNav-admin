import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { REFRESH_WARNING, triggerWebsiteRevalidation } from '@/lib/data/revalidate';

export const runtime = 'nodejs';

/** Last step: refreshes the admin lists and the public website once for the whole import. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  revalidatePath('/properties');
  revalidatePath('/corridors');
  revalidatePath('/developers');
  revalidatePath('/');
  const [listings, catalogue] = await Promise.all([triggerWebsiteRevalidation('properties', '/'), triggerWebsiteRevalidation('catalogue')]);
  return NextResponse.json({ refreshed: listings && catalogue, warning: listings && catalogue ? undefined : REFRESH_WARNING });
}
