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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">Blog</h1>
            <p className="mt-0.5 text-sm text-ink-muted">Guides and market notes for the website blog. Star a post to feature it in the carousel at the top of the blog page and on the home page; with none starred, the newest post leads.</p>
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
