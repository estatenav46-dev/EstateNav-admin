'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Pager, usePaged } from '@/components/ui/Pager';
import { useRouter } from 'next/navigation';
import { AlertCircle, Edit, ExternalLink, FileText, Search, Star, Trash2 } from 'lucide-react';
import type { BlogPost } from '@/lib/data/types';
import { deleteBlogAction, setBlogFeaturedAction, setBlogStatusAction } from '@/app/actions/blogs';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in').replace(/\/$/, '');
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function BlogList({ posts }: { posts: BlogPost[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | BlogPost['status']>('all');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = useMemo(
    () => posts.filter((p) => (status === 'all' || p.status === status) && `${p.title} ${p.category} ${p.tags.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())),
    [posts, q, status],
  );

  const paged = usePaged(shown, `${status}|${q}`, 'admin.blogs.pageSize');

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setProblem(null);
      const res = await fn();
      if (!res.ok) setProblem(res.message ?? 'That did not work.');
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 gap-1 rounded-lg bg-surface-2 p-0.5">
          {(['all', 'published', 'draft'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${status === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {s} <span className="font-mono text-2xs opacity-70">{s === 'all' ? posts.length : posts.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, category, tag…" className="field pl-8 text-xs" />
        </div>
      </div>

      {problem && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          <AlertCircle className="h-4 w-4" /> {problem}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 p-10 text-center text-sm text-ink-muted">
          <FileText className="h-8 w-8 opacity-40" />
          {posts.length ? 'No posts match.' : 'No posts yet. Write the first guide, for example how to check a K-RERA registration.'}
        </div>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {paged.rows.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {p.cover ? <Image src={p.cover.url} alt="" fill sizes="112px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-2xs text-ink-muted">No cover</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${p.status === 'published' ? 'bg-accent-soft text-accent-ink' : 'bg-amber-500/10 text-amber-700'}`}>{p.status}</span>
                  {p.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </span>
                  )}
                  <span className="text-2xs text-ink-muted">
                    {p.category} · {p.readMinutes} min read · {p.status === 'published' ? `published ${fmt(p.publishedAt)}` : `edited ${fmt(p.updatedAt)}`}
                  </span>
                </div>
                <Link href={`/blogs/${p.id}`} className="mt-0.5 block truncate text-sm font-semibold text-ink hover:text-accent-ink">
                  {p.title}
                </Link>
                {p.excerpt && <p className="truncate text-xs text-ink-muted">{p.excerpt}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setBlogFeaturedAction(p.id, !p.featured))}
                  aria-pressed={p.featured}
                  title={p.featured ? 'Featured: shown in the carousel on the website. Click to remove.' : 'Feature this post in the carousel on the website'}
                  className={`rounded p-1.5 transition-colors ${p.featured ? 'text-amber-500 hover:bg-amber-500/10' : 'text-ink-muted hover:bg-surface-2 hover:text-amber-500'}`}
                >
                  <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
                </button>
                <button type="button" disabled={pending} onClick={() => run(() => setBlogStatusAction(p.id, p.status === 'published' ? 'draft' : 'published'))} className="btn-secondary min-h-[32px] px-2.5 text-2xs">
                  {p.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <Link href={`/blogs/${p.id}`} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" title="Edit">
                  <Edit className="h-4 w-4" />
                </Link>
                {p.status === 'published' && (
                  <a href={`${SITE_URL}/blogs/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" title="View on website">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button type="button" disabled={pending} onClick={() => confirm(`Delete "${p.title}" permanently?`) && run(() => deleteBlogAction(p.id))} className="rounded p-1.5 text-danger hover:bg-danger/10" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager {...paged} noun="posts" />
    </div>
  );
}
