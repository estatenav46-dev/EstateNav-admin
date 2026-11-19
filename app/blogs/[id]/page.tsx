import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth/session';
import { getBlogById, listProperties } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { BlogEditor } from '@/components/blogs/BlogEditor';

export const dynamic = 'force-dynamic';

export default async function EditBlogPage({ params }: { params: { id: string } }) {
  const session = await requireAuth();
  const [post, all] = await Promise.all([getBlogById(params.id), listProperties({ status: 'all' })]);
  if (!post) notFound();
  const properties = all.map(({ id, title, locality, status }) => ({ id, title, locality, status }));
  return (
    <AdminShell userEmail={session.email}>
      <Link href="/blogs" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> All posts
      </Link>
      <BlogEditor key={post.id} initial={post} properties={properties} />
    </AdminShell>
  );
}
