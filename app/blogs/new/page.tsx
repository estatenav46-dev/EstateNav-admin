import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
      <Link href="/blogs" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> All posts
      </Link>
      <BlogEditor initial={null} properties={properties} />
    </AdminShell>
  );
}
