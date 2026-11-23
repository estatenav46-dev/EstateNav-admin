import { notFound } from 'next/navigation';
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
      <BlogEditor key={post.id} initial={post} properties={properties} />
    </AdminShell>
  );
}
