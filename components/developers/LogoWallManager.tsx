'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ExternalLink, Search } from 'lucide-react';
import type { Developer } from '@/lib/data/types';
import { setLogoWallAction } from '@/app/actions/developers';
import { partnerLogo } from '@/lib/partnerLogos';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in').replace(/\/$/, '');

/** The logo the website shows: the uploaded one, else the bundled official logo, else none. */
function logoFor(d: Developer): { src: string; kind: 'uploaded' | 'bundled' } | null {
  if (d.logo?.url) return { src: d.logo.url, kind: 'uploaded' };
  const bundled = partnerLogo(d.id, d.name);
  return bundled ? { src: bundled.src, kind: 'bundled' } : null;
}

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-accent' : 'bg-ink/20'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Which partners appear on the website's "Official channel partners" logo wall. */
export function LogoWallManager({ initialDevelopers }: { initialDevelopers: Developer[] }) {
  const router = useRouter();
  const [developers, setDevelopers] = useState(initialDevelopers);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setDevelopers(initialDevelopers), [initialDevelopers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...developers].filter((d) => !q || `${d.name} ${d.id}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [developers, query]);
  const onWall = developers.filter((d) => d.showOnLogoWall && !d.hidden).length;

  const update = (ids: string[], show: boolean) =>
    start(async () => {
      setProblem(null);
      const before = developers;
      setDevelopers((list) => list.map((d) => (ids.includes(d.id) ? { ...d, showOnLogoWall: show } : d)));
      const res = await setLogoWallAction(ids, show);
      if (!res.ok) {
        setDevelopers(before);
        setProblem(res.message);
      } else router.refresh();
    });

  const visibleIds = shown.filter((d) => !d.hidden).map((d) => d.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">Channel partner logos</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
            Choose which partners appear on the website&apos;s “Official channel partners” logo wall. <span className="font-semibold text-ink">{onWall}</span> of {developers.length} shown. Turning a logo off keeps the partner and its listings on the website.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" disabled={pending || !visibleIds.length} onClick={() => update(visibleIds, true)} className="btn-secondary text-xs">
            Show all
          </button>
          <button type="button" disabled={pending || !visibleIds.length} onClick={() => update(visibleIds, false)} className="btn-secondary text-xs">
            Hide all
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partners…" className="field pl-8 text-xs" />
      </div>

      {problem && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {problem}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-ink-muted">{developers.length ? 'No partner matches that search.' : 'No partners yet. Add them on the Partners page.'}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((d) => {
            const logo = logoFor(d);
            const on = d.showOnLogoWall && !d.hidden;
            return (
              <li key={d.id} className={`panel flex flex-col overflow-hidden transition-opacity ${on ? '' : 'opacity-70'}`}>
                <div className="flex h-28 items-center justify-center border-b border-line bg-white px-6 py-4">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.src} alt={`${d.name} logo`} className={`max-h-full max-w-full object-contain ${on ? '' : 'grayscale'}`} />
                  ) : (
                    <span className="text-center font-serif text-lg leading-tight text-neutral-800">{d.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{d.name}</p>
                    <p className="truncate text-2xs text-ink-muted">
                      {d.hidden ? 'Partner hidden on the Partners page' : on ? 'Shown on the logo wall' : 'Not shown'}
                      {' · '}
                      {logo ? (logo.kind === 'uploaded' ? 'uploaded logo' : 'official logo') : 'name only (no logo)'}
                    </p>
                  </div>
                  <Switch on={on} disabled={pending || d.hidden} onChange={() => update([d.id], !d.showOnLogoWall)} label={`Show ${d.name} on the logo wall`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-muted">
        <span>To change a logo, edit the partner on the <Link href="/developers" className="font-semibold text-accent-ink hover:underline">Partners</Link> page. An uploaded logo replaces the official one.</span>
        <a href={`${SITE_URL}/#partners-title`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-ink hover:underline">
          See the logo wall <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
