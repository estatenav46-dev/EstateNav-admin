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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex shrink-0 gap-0.5 rounded-[12px] bg-surface p-1 ring-1 ring-line">
          {(['all', 'published', 'draft'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-[9px] px-3 py-1.5 text-sm font-semibold capitalize ${status === s ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'}`}>
              {s} <span className="text-xs opacity-70">{s === 'all' ? posts.length : posts.filter((p) => p.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, category, tag…" className="field pl-9" />
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
            <li key={p.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-2/40 sm:flex-row sm:items-center">
              <div className="relative h-[4.5rem] w-32 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                {p.cover ? <Image src={p.cover.url} alt="" fill sizes="128px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-ink-muted">No cover</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`pill capitalize ${p.status === 'published' ? 'pill-green' : 'pill-amber'}`}>{p.status}</span>
                  {p.featured && (
                    <span className="pill pill-amber">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </span>
                  )}
                  <span className="text-xs text-ink-muted">
                    {p.category} · {p.readMinutes} min read · {p.status === 'published' ? `published ${fmt(p.publishedAt)}` : `edited ${fmt(p.updatedAt)}`}
                  </span>
                </div>
                <Link href={`/blogs/${p.id}`} className="mt-1 block truncate text-[0.95rem] font-semibold text-ink hover:text-accent-ink">
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
                  className={`icon-btn ${p.featured ? '!text-amber-500 hover:!bg-amber-500/10' : 'hover:!text-amber-500'}`}
                >
                  <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
                </button>
                <button type="button" disabled={pending} onClick={() => run(() => setBlogStatusAction(p.id, p.status === 'published' ? 'draft' : 'published'))} className="btn-secondary min-h-[36px] px-3 text-xs">
                  {p.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <Link href={`/blogs/${p.id}`} className="icon-btn" title="Edit" aria-label={`Edit ${p.title}`}>
                  <Edit className="h-4 w-4" />
                </Link>
                {p.status === 'published' && (
                  <a href={`${SITE_URL}/blogs/${p.slug}`} target="_blank" rel="noopener noreferrer" className="icon-btn" title="View on website" aria-label={`View ${p.title} on the website`}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button type="button" disabled={pending} onClick={() => confirm(`Delete "${p.title}" permanently?`) && run(() => deleteBlogAction(p.id))} className="icon-btn !text-danger hover:!bg-danger/10" title="Delete" aria-label={`Delete ${p.title}`}>
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
