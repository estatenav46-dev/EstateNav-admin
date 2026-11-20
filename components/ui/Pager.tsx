'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZES = [25, 50, 100] as const;

/**
 * Client-side paging for admin lists. `resetKey` should change whenever the filters change so
 * the list jumps back to page 1; the chosen page size is remembered in this browser.
 */
export function usePaged<T>(items: T[], resetKey: string, storageKey = 'admin.pageSize') {
  const [page, setPage] = useState(1);
  const [size, setSizeState] = useState<number>(PAGE_SIZES[0]);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      if ((PAGE_SIZES as readonly number[]).includes(saved)) setSizeState(saved);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, [storageKey]);
  useEffect(() => setPage(1), [resetKey]);

  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  const setSize = (next: number) => {
    setSizeState(next);
    setPage(1);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      /* ignore */
    }
  };
  return { rows: items.slice(start, start + size), page: current, pages, size, setSize, setPage, start, total: items.length };
}

type PagerProps = Pick<ReturnType<typeof usePaged>, 'page' | 'pages' | 'size' | 'setSize' | 'setPage' | 'start' | 'total'> & { noun?: string };

export function Pager({ page, pages, size, setSize, setPage, start, total, noun = 'items' }: PagerProps) {
  if (total <= PAGE_SIZES[0]) return null;
  const end = Math.min(start + size, total);
  // A compact run of page numbers around the current page.
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);

  return (
    <nav aria-label="Pages" className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-muted">
        {start + 1}–{end} of {total} {noun}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line hover:bg-surface-2 disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-0.5 text-ink-muted">…</span>}
            <button
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`h-7 min-w-[1.75rem] rounded-md px-1.5 font-semibold ${n === page ? 'bg-ink text-bg' : 'border border-line hover:bg-surface-2'}`}
            >
              {n}
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line hover:bg-surface-2 disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="ml-1 h-7 rounded-md border border-line bg-surface px-1.5 text-xs" aria-label="Rows per page">
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
