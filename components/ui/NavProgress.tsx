'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

// Instant feedback on every admin navigation: a bar starts the moment a link is clicked and,
// if the next page takes a moment, a small "Loading…" pill appears at the top.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const safety = useRef<ReturnType<typeof setTimeout>>();
  const pillTimer = useRef<ReturnType<typeof setTimeout>>();

  function finish() {
    const el = bar.current;
    clearTimeout(pillTimer.current);
    if (pill.current) pill.current.dataset.show = 'false';
    if (!el || !running.current) return;
    running.current = false;
    clearTimeout(safety.current);
    el.style.transition = 'transform 220ms ease-out, opacity 320ms ease 200ms';
    el.style.transform = 'scaleX(1)';
    el.style.opacity = '0';
  }

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const start = () => {
      running.current = true;
      clearTimeout(safety.current);
      clearTimeout(pillTimer.current);
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'scaleX(0.04)';
      void el.offsetWidth;
      el.style.transition = 'transform 6s cubic-bezier(0.08, 0.82, 0.17, 1)';
      el.style.transform = 'scaleX(0.86)';
      pillTimer.current = setTimeout(() => running.current && pill.current && (pill.current.dataset.show = 'true'), 300);
      safety.current = setTimeout(finish, 15_000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a');
      if (!link || !link.href || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(finish, [pathname, search]);

  return (
    <>
      <div ref={bar} aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px] origin-left bg-accent shadow-[0_0_10px_rgb(var(--accent)/0.6)]" style={{ opacity: 0, transform: 'scaleX(0)' }} />
      <div
        ref={pill}
        aria-hidden="true"
        data-show="false"
        className="pointer-events-none fixed left-1/2 top-3 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-lg transition-all duration-200 data-[show=false]:-translate-y-2 data-[show=false]:opacity-0"
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" /> Loading…
      </div>
    </>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
