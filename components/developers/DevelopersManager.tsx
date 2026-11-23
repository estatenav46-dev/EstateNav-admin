'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, BadgeCheck, Building2, Edit2, ExternalLink, Eye, EyeOff, Plus, Search, Trash2 } from 'lucide-react';
import type { Developer } from '@/lib/data/types';
import { deleteDeveloperAction, setDeveloperHiddenAction } from '@/app/actions/developers';
import { Modal } from '@/components/ui/Modal';
import { DeveloperForm, blankDeveloper } from './DeveloperForm';

interface Props {
  initialDevelopers: Developer[];
  listingCounts: Record<string, number>;
}

const fmtSqft = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M sq.ft` : `${n.toLocaleString('en-IN')} sq.ft`);

export function DevelopersManager({ initialDevelopers, listingCounts }: Props) {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers);
  const [editing, setEditing] = useState<{ developer: Developer; mode: 'create' | 'edit' } | null>(null);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...developers]
      .filter((d) => !q || `${d.name} ${d.legalName} ${d.id}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || a.name.localeCompare(b.name));
  }, [developers, query]);
  const hiddenCount = developers.filter((d) => d.hidden).length;

  const saved = (dev: Developer) => {
    setDevelopers((list) => (list.some((d) => d.id === dev.id) ? list.map((d) => (d.id === dev.id ? dev : d)) : [...list, dev]));
    setEditing(null);
    router.refresh();
  };

  const toggleHidden = (dev: Developer) =>
    start(async () => {
      setProblem(null);
      const res = await setDeveloperHiddenAction(dev.id, !dev.hidden);
      if (!res.ok) return setProblem(res.message);
      setDevelopers((list) => list.map((d) => (d.id === dev.id ? { ...d, hidden: !dev.hidden } : d)));
      router.refresh();
    });

  const remove = (dev: Developer) => {
    if (!confirm(`Delete the partner "${dev.name}"? This cannot be undone.`)) return;
    start(async () => {
      setProblem(null);
      const res = await deleteDeveloperAction(dev.id);
      if (!res.ok) return setProblem(res.message);
      setDevelopers((list) => list.filter((d) => d.id !== dev.id));
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">Partners</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {developers.length} partners{hiddenCount ? ` · ${hiddenCount} hidden` : ''}. These are the partners offered when posting a property or uploading Excel. A hidden partner and all its listings are left off the website.
          </p>
        </div>
        <button type="button" onClick={() => setEditing({ developer: blankDeveloper(), mode: 'create' })} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> Add partner
        </button>
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
        <div className="panel p-10 text-center text-sm text-ink-muted">{developers.length ? 'No partner matches that search.' : 'No partners yet. Add the first developer you work with.'}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((dev) => {
            const sourced = new Set(dev.sources.map((s) => s.field));
            const facts = [
              dev.yearsActive ? { label: `${dev.yearsActive}+ years`, ok: sourced.has('yearsActive') } : null,
              dev.projectsDelivered ? { label: `${dev.projectsDelivered} projects`, ok: sourced.has('projectsDelivered') } : null,
              dev.sqftDelivered ? { label: fmtSqft(dev.sqftDelivered), ok: sourced.has('sqftDelivered') } : null,
            ].filter(Boolean) as { label: string; ok: boolean }[];
            const count = listingCounts[dev.id] ?? 0;
            return (
              <div key={dev.id} className={`panel flex flex-col p-4 transition-opacity ${dev.hidden ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {dev.logo?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dev.logo.url} alt={dev.name} className="h-11 w-11 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-muted">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-ink">{dev.name}</h3>
                      {dev.hidden && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">Hidden</span>}
                    </div>
                    <p className="truncate font-mono text-2xs text-ink-muted">{dev.id}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-ink-muted">{dev.about || 'No profile yet — click Edit to add the about text, website, logo and track record.'}</p>
                {facts.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {facts.map((f) => (
                      <li key={f.label} title={f.ok ? 'Sourced: shown on the website' : 'No source: hidden on the website'} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs ${f.ok ? 'border-accent/30 bg-accent-soft text-accent-ink' : 'border-line text-ink-muted'}`}>
                        {f.ok && <BadgeCheck className="h-3 w-3" />} {f.label}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <Link href={`/properties?developer=${dev.id}`} className="font-semibold text-accent-ink hover:underline">
                    {count} {count === 1 ? 'listing' : 'listings'}
                  </Link>
                  {dev.website && (
                    <a href={dev.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => setEditing({ developer: dev, mode: 'edit' })} className="btn-secondary min-h-[32px] px-2 text-2xs">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" disabled={pending} onClick={() => toggleHidden(dev)} className="btn-secondary min-h-[32px] px-2 text-2xs" title={dev.hidden ? 'Show this partner and its listings on the website' : 'Hide this partner and all its listings from the website'}>
                    {dev.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {dev.hidden ? 'Show' : 'Hide'}
                  </button>
                  <button
                    type="button"
                    disabled={pending || count > 0}
                    onClick={() => remove(dev)}
                    className="btn-secondary min-h-[32px] px-2 text-2xs text-danger hover:border-danger/40 hover:bg-danger/10"
                    title={count > 0 ? 'Partners with listings cannot be deleted. Hide it, or move or delete its listings first.' : 'Delete this partner'}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'create' ? 'Add partner' : `Edit ${editing?.developer.name ?? 'partner'}`}
        description="Partner details appear on every project page for this developer."
        width="lg"
      >
        {editing && <DeveloperForm key={editing.developer.id || 'new'} initial={editing.developer} mode={editing.mode} lockId={editing.mode === 'edit'} onSaved={saved} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
