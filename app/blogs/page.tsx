import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/session';
import { listBlogs } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { BlogList } from '@/components/blogs/BlogList';

export const dynamic = 'force-dynamic';

export default async function BlogsPage() {
  const session = await requireAuth();
  const posts = await listBlogs();

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Content</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Blog</h1>
            <p className="mt-0.5 text-sm text-ink-muted">Guides and market notes published on the website under /blogs. The newest (or featured) post leads the blog page.</p>
          </div>
          <Link href="/blogs/new" className="btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Write a post
          </Link>
        </div>
        <BlogList posts={posts} />
      </div>
    </AdminShell>
  );
}
