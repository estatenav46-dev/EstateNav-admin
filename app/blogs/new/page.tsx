import { requireAuth } from '@/lib/auth/session';
import { listProperties } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { BlogEditor } from '@/components/blogs/BlogEditor';

export const dynamic = 'force-dynamic';

export default async function NewBlogPage() {
  const session = await requireAuth();
  const properties = (await listProperties({ status: 'all' })).map(({ id, title, locality, status }) => ({ id, title, locality, status }));
  return (
    <AdminShell userEmail={session.email}>
      <BlogEditor initial={null} properties={properties} />
    </AdminShell>
  );
}
