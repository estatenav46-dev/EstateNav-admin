'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { saveSettings } from '@/lib/data/api';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { SiteSettings } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

export async function saveSettingsAction(input: unknown): Promise<Result<SiteSettings>> {
  try {
    await requireAuth();
    const data = await saveSettings(input);
    revalidatePath('/settings');
    revalidatePath('/');
    await triggerWebsiteRevalidation('settings', '/');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: 'Some fields need attention.',
        issues: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to save settings.' };
  }
}

