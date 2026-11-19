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
  getPropertyById,
  isSlugAvailable,
  ensurePartnerRecord,
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

/** Refreshes the admin lists and purges the public site's cached listings. */
async function refresh(property?: { id: string; slug: string } | null) {
  revalidatePath('/properties');
  revalidatePath('/');
  if (property) revalidatePath(`/properties/${property.id}`);
  await triggerWebsiteRevalidation('properties', property ? `/properties/${property.slug}` : '/');
}

function zodResult(error: z.ZodError): Result<never> {
  return {
    ok: false,
    message: 'Some fields need attention.',
    issues: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}

/** Values the website derives from the unit types, kept in step on every save. */
function normalise(draft: z.infer<typeof draftSchema>): PropertyDraft {
  const bhkOptions = Array.from(new Set(draft.configurations.map((c) => c.bhk).filter((b): b is number => b != null && b > 0))).sort((a, b) => a - b);
  const documents = draft.documents.map((d) => ({ ...d, label: d.label.trim() }));
  const offer = draft.offer && draft.offer.text.trim() ? draft.offer : null;
  return { ...draft, bhkOptions, documents, offer };
}

export async function savePropertyAction(input: unknown, status: PublishStatus): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const draft = normalise(draftSchema.parse({ ...(input as object), status }));

    if (status === 'published' && draft.media.gallery.length === 0) {
      return { ok: false, message: 'Add at least one photo before publishing. You can save this listing as a draft meanwhile.' };
    }

    const available = await isSlugAvailable(draft.slug, draft.id);
    if (!available) {
      return { ok: false, message: `The web address “${draft.slug}” is already used by another listing. Change the slug in Basics.` };
    }

    // Approved partners get their record on first use; the listing keeps the record's name.
    const partner = await ensurePartnerRecord(draft.developerId);
    if (!partner) return { ok: false, message: 'Choose a partner from the list in “Partner & location”.' };
    draft.developerName = partner.developer.name;
    if (partner.created) await triggerWebsiteRevalidation('catalogue');

    const previous = await getPropertyById(draft.id);
    const data = await saveProperty(draft, session.email);
    await refresh(data);
    // A changed slug leaves the old public page cached; purge it too.
    if (previous && previous.slug !== data.slug) await triggerWebsiteRevalidation(undefined, `/properties/${previous.slug}`);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) return zodResult(error);
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
    if (validated === 'published') {
      const current = await getPropertyById(id);
      if (current && current.media.gallery.length === 0) {
        return { ok: false, message: `Add at least one photo to “${current.title}” before publishing.` };
      }
    }
    const data = await setPropertyStatus(id, validated, session.email);
    await refresh(data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update status.' };
  }
}

export async function setFeaturedAction(id: string, featured: boolean): Promise<Result<Property>> {
  try {
    const session = await requireAuth();
    const data = await setPropertyFeatured(id, featured, session.email);
    await refresh(data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update featured flag.' };
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
    const existing = await getPropertyById(id);
    await deleteProperty(id);
    await refresh(existing);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete property.' };
  }
}
