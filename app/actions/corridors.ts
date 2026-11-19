'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { createCorridor, saveCorridor } from '@/lib/data/api';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { Corridor } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

function failure(error: unknown, fallback: string): Result<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, message: 'Some fields need attention.', issues: error.issues.map((i) => `${i.path.join('.') || 'area'}: ${i.message}`) };
  }
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}

async function refresh() {
  revalidatePath('/corridors');
  revalidatePath('/properties');
  revalidatePath('/');
  // Area names are copied onto listings, so both caches change.
  await triggerWebsiteRevalidation('catalogue', '/');
  await triggerWebsiteRevalidation('properties');
}

export async function saveCorridorAction(input: unknown): Promise<Result<Corridor>> {
  try {
    await requireAuth();
    const data = await saveCorridor(input);
    await refresh();
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'Failed to save area.');
  }
}

/** Creates a new area without overwriting an existing one (used inside the property editor). */
export async function createCorridorAction(input: unknown): Promise<Result<Corridor>> {
  try {
    await requireAuth();
    const data = await createCorridor(input);
    await refresh();
    return { ok: true, data };
  } catch (error) {
    return failure(error, 'Failed to create area.');
  }
}
