'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { saveDeveloper } from '@/lib/data/api';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { Developer } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

export async function saveDeveloperAction(input: unknown): Promise<Result<Developer>> {
  try {
    await requireAuth();
    const data = await saveDeveloper(input);
    revalidatePath('/developers');
    revalidatePath('/properties');
    revalidatePath('/');
    await triggerWebsiteRevalidation('catalogue', '/');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: 'Some fields need attention.',
        issues: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to save developer.' };
  }
}

