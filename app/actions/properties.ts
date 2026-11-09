'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import {
  saveProperty,
  setPropertyStatus,
  setPropertyFeatured,
  duplicateProperty,
  deleteProperty,
  isSlugAvailable,
  type PropertyDraft,
} from '@/lib/data/api';
import { propertySchema, publishStatusSchema } from '@/lib/data/schemas';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { Property, PublishStatus } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

const draftSchema = propertySchema.omit({
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  createdBy: true,
  updatedBy: true,
});

export async function savePropertyAction(input: unknown, status: PublishStatus): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const draft = draftSchema.parse({ ...(input as object), status });

    const available = await isSlugAvailable(draft.slug, draft.id);
    if (!available) {
      return { ok: false, message: `The slug “${draft.slug}” is already used by another listing.` };
    }

    const data = await saveProperty(draft as PropertyDraft, session.email);
    revalidatePath('/properties');
    revalidatePath(`/properties/${data.id}`);
    revalidatePath('/');
    await triggerWebsiteRevalidation('properties', '/');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: 'Some fields need attention.',
        issues: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to save property.' };
  }
}

export async function checkSlugAction(slug: string, exceptId?: string): Promise<boolean> {
  await requireAuth();
  return isSlugAvailable(slug, exceptId);
}

export async function setStatusAction(id: string, status: PublishStatus): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const validated = publishStatusSchema.parse(status);
    const data = await setPropertyStatus(id, validated, session.email);
    revalidatePath('/properties');
    revalidatePath('/');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update status.' };
  }
}

export async function setFeaturedAction(id: string, featured: boolean): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const data = await setPropertyFeatured(id, featured, session.email);
    revalidatePath('/properties');
    revalidatePath('/');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update featured rank.' };
  }
}

export async function duplicatePropertyAction(id: string): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const data = await duplicateProperty(id, session.email);
    revalidatePath('/properties');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to duplicate property.' };
  }
}

export async function deletePropertyAction(id: string): Promise<Result<void>> {
  try {
    await requireAuth();
    await deleteProperty(id);
    revalidatePath('/properties');
    revalidatePath('/');
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete property.' };
  }
}

