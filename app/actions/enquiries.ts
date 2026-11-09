'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { updateEnquiry } from '@/lib/data/api';
import { enquiryStatusSchema } from '@/lib/data/schemas';
import type { Enquiry } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export async function updateEnquiryAction(
  id: string,
  patch: { status?: Enquiry['status']; notes?: string; assignedTo?: string | null }
): Promise<Result<Enquiry>> {
  try {
    await requireAuth();
    const data = await updateEnquiry(id, {
      ...(patch.status ? { status: enquiryStatusSchema.parse(patch.status) } : {}),
      ...(patch.notes !== undefined ? { notes: z.string().max(2000).parse(patch.notes) } : {}),
      ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
    });
    revalidatePath('/enquiries');
    revalidatePath('/');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update enquiry.' };
  }
}

