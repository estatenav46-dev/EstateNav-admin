'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/session';
import { deleteBlog, getBlogById, isBlogSlugAvailable, saveBlog, type BlogDraft } from '@/lib/data/api';
import { blogPostSchema, blogStatusSchema } from '@/lib/data/schemas';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import type { BlogPost } from '@/lib/data/types';

type Result<T> = { ok: true; data: T } | { ok: false; message: string; issues?: string[] };

const draftSchema = blogPostSchema.omit({ createdAt: true, updatedAt: true, createdBy: true, updatedBy: true }).extend({ publishedAt: z.string().nullable().optional() });

/** Refreshes the admin list and the website's blog pages (list, post, home page section). */
async function refresh(post?: { id: string; slug: string } | null, oldSlug?: string) {
  revalidatePath('/blogs');
  if (post) revalidatePath(`/blogs/${post.id}`);
  await triggerWebsiteRevalidation('blogs', '/blogs');
  if (post) await triggerWebsiteRevalidation(undefined, `/blogs/${post.slug}`);
  if (oldSlug && oldSlug !== post?.slug) await triggerWebsiteRevalidation(undefined, `/blogs/${oldSlug}`);
  await triggerWebsiteRevalidation(undefined, '/');
}

export async function saveBlogAction(input: unknown, status: BlogPost['status']): Promise<Result<BlogPost>> {
  try {
    const session = await requireAuth();
    const draft = draftSchema.parse({ ...(input as object), status: blogStatusSchema.parse(status) }) as BlogDraft;
    if (status === 'published' && !draft.cover) return { ok: false, message: 'Add a cover image before publishing.' };
    if (status === 'published' && draft.body.trim().split(/\s+/).length < 40) return { ok: false, message: 'The article is very short. Write at least a few paragraphs before publishing.' };
    if (!(await isBlogSlugAvailable(draft.slug, draft.id))) return { ok: false, message: `Another post already uses the web address “${draft.slug}”.` };
    const previous = await getBlogById(draft.id);
    const data = await saveBlog(draft, session.email);
    await refresh(data, previous?.slug);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Some fields need attention.', issues: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    return { ok: false, message: error instanceof Error ? error.message : 'Could not save the post.' };
  }
}

export async function checkBlogSlugAction(slug: string, exceptId?: string): Promise<boolean> {
  await requireAuth();
  return isBlogSlugAvailable(slug, exceptId);
}

export async function deleteBlogAction(id: string): Promise<Result<null>> {
  try {
    await requireAuth();
    const existing = await getBlogById(id);
    await deleteBlog(id);
    await refresh(existing);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not delete the post.' };
  }
}

export async function setBlogStatusAction(id: string, status: BlogPost['status']): Promise<Result<BlogPost>> {
  try {
    const session = await requireAuth();
    const existing = await getBlogById(id);
    if (!existing) return { ok: false, message: 'Post not found.' };
    if (status === 'published' && !existing.cover) return { ok: false, message: 'Add a cover image before publishing.' };
    const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...rest } = existing;
    const data = await saveBlog({ ...rest, status }, session.email);
    await refresh(data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not update the post.' };
  }
}

/** Featured posts rotate in the carousel at the top of the website's blog page and home section. */
export async function setBlogFeaturedAction(id: string, featured: boolean): Promise<Result<BlogPost>> {
  try {
    const session = await requireAuth();
    const existing = await getBlogById(id);
    if (!existing) return { ok: false, message: 'Post not found.' };
    const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...rest } = existing;
    const data = await saveBlog({ ...rest, featured }, session.email);
    await refresh(data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not update the post.' };
  }
}
