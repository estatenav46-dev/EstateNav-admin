'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { createDeveloper, deleteDeveloper, saveDeveloper, setDeveloperHidden, setDevelopersLogoWall } from '@/lib/data/api';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { Developer } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

function failure(error: unknown, fallback: string): Result<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, message: 'Some fields need attention.', issues: error.issues.map((i) => `${i.path.join('.') || 'partner'}: ${i.message}`) };
  }
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}

async function refresh() {
  revalidatePath('/developers');
  revalidatePath('/properties');
  revalidatePath('/');
  // Partner names are copied onto listings, so both caches change.
  await triggerWebsiteRevalidation('catalogue', '/');
  await triggerWebsiteRevalidation('properties');
}

/** Edits an existing partner (or creates one from the Partners page). */
export async function saveDeveloperAction(input: unknown): Promise<Result<Developer>> {
  try {
    await requireAuth();
    const data = await saveDeveloper(input);
    await refresh();
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'Failed to save partner.');
  }
}

/** Creates a new partner without overwriting an existing one (used inside the property editor). */
export async function createDeveloperAction(input: unknown): Promise<Result<Developer>> {
  try {
    await requireAuth();
    const data = await createDeveloper(input);
    await refresh();
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'Failed to create partner.');
  }
}

/** Hides or shows a partner; hidden partners and all their listings leave the website. */
export async function setDeveloperHiddenAction(id: string, hidden: boolean): Promise<Result<null>> {
  try {
    await requireAuth();
    await setDeveloperHidden(z.string().min(1).parse(id), hidden);
    await refresh();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, 'Could not update the partner.');
  }
}

/** Deletes several partners; partners that still have listings are kept and reported. */
export async function deleteDevelopersAction(ids: string[]): Promise<Result<{ deleted: string[]; kept: string[] }>> {
  try {
    await requireAuth();
    const list = z.array(z.string().min(1)).min(1).max(200).parse(ids);
    const deleted: string[] = [];
    const kept: string[] = [];
    for (const id of list) {
      try {
        await deleteDeveloper(id);
        deleted.push(id);
      } catch {
        kept.push(id);
      }
    }
    if (deleted.length) await refresh();
    return { ok: true, data: { deleted, kept } };
  } catch (error) {
    return failure(error, 'Could not delete the partners.');
  }
}

/** Shows or hides partners on the website's channel-partner logo wall (the partners stay listed). */
export async function setLogoWallAction(ids: string[], show: boolean): Promise<Result<null>> {
  try {
    await requireAuth();
    await setDevelopersLogoWall(z.array(z.string().min(1)).min(1).max(200).parse(ids), show);
    revalidatePath('/developers');
    revalidatePath('/partner-logos');
    await triggerWebsiteRevalidation('catalogue', '/');
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, 'Could not update the logo wall.');
  }
}

/** Deletes a partner that has no listings. */
export async function deleteDeveloperAction(id: string): Promise<Result<null>> {
  try {
    await requireAuth();
    await deleteDeveloper(z.string().min(1).parse(id));
    await refresh();
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, 'Could not delete the partner.');
  }
}
