'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit2, Building2, ExternalLink, BadgeCheck, Settings2, Archive } from 'lucide-react';
import type { Developer } from '@/lib/data/types';
import { otherDevelopers, resolvePartners } from '@/lib/partners';
import { Modal } from '@/components/ui/Modal';
import { DeveloperForm, blankDeveloper } from './DeveloperForm';

interface Props {
  initialDevelopers: Developer[];
  listingCounts: Record<string, number>;
}

const fmtSqft = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M sq.ft` : `${n.toLocaleString('en-IN')} sq.ft`);

type Editing = { developer: Developer; mode: 'create' | 'edit'; lockId: boolean };

function PartnerCard({ dev, count, onEdit }: { dev: Developer; count: number; onEdit: () => void }) {
  const sourced = new Set(dev.sources.map((s) => s.field));
  const facts = [
    dev.yearsActive ? { label: 'Years', value: `${dev.yearsActive}+ years`, ok: sourced.has('yearsActive') } : null,
    dev.projectsDelivered ? { label: 'Delivered', value: `${dev.projectsDelivered} projects`, ok: sourced.has('projectsDelivered') } : null,
    dev.sqftDelivered ? { label: 'Area', value: fmtSqft(dev.sqftDelivered), ok: sourced.has('sqftDelivered') } : null,
  ].filter(Boolean) as { label: string; value: string; ok: boolean }[];

  return (
    <div className="panel flex flex-col justify-between p-5 transition-all hover:border-line-strong">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {dev.logo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dev.logo.url} alt={dev.name} className="h-12 w-12 rounded-lg border border-line bg-white object-contain p-1" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-muted">
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink">{dev.name}</h3>
              <p className="truncate font-mono text-2xs text-ink-muted">{dev.id}</p>
            </div>
          </div>
          <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink" title={`Edit ${dev.name}`}>
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 line-clamp-2 text-xs text-ink-muted">{dev.about || 'No description yet. Add a short profile so it shows on project pages.'}</p>
        {facts.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <li key={f.label} title={f.ok ? 'Sourced: shown on the website' : 'No source: hidden on the website'} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs ${f.ok ? 'border-accent/30 bg-accent-soft text-accent-ink' : 'border-line text-ink-muted'}`}>
                {f.ok && <BadgeCheck className="h-3 w-3" />} {f.value}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-3 text-xs">
        <Link href={`/properties?developer=${dev.id}`} className="font-medium text-accent-ink hover:underline">
          {count} {count === 1 ? 'listing' : 'listings'}
        </Link>
        {dev.website && (
          <a href={dev.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink-muted hover:text-ink">
            Website <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function DevelopersManager({ initialDevelopers, listingCounts }: Props) {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers);
  const [editing, setEditing] = useState<Editing | null>(null);
  const partners = useMemo(() => resolvePartners(developers), [developers]);
  const others = useMemo(() => otherDevelopers(developers), [developers]);
  const ready = partners.filter((p) => p.developer).length;

  const saved = (dev: Developer) => {
    setDevelopers((list) => (list.some((d) => d.id === dev.id) ? list.map((d) => (d.id === dev.id ? dev : d)) : [...list, dev]));
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6">
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Catalogue</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Partners</h1>
        <p className="text-sm text-ink-muted">
          The {partners.length} developers EstateNav lists for — the only partners offered when posting a property. {ready} of {partners.length} have a profile set up; the rest are created
          automatically the first time a listing uses them, or when you set them up here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partners.map((p) =>
          p.developer ? (
            <PartnerCard key={p.id} dev={p.developer} count={listingCounts[p.id] ?? 0} onEdit={() => setEditing({ developer: p.developer!, mode: 'edit', lockId: true })} />
          ) : (
            <div key={p.id} className="flex flex-col justify-between rounded-2xl border border-dashed border-line-strong bg-surface-2/40 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">{p.name}</h3>
                  <p className="font-mono text-2xs text-ink-muted">{p.id} · not set up yet</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditing({ developer: { ...blankDeveloper(p.name), id: p.id, legalName: p.name }, mode: 'create', lockId: true })} className="btn-secondary mt-4 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Set up profile
              </button>
            </div>
          ),
        )}
      </div>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Archive className="h-4 w-4 text-ink-muted" /> Other developers in the database
          </h2>
          <p className="text-2xs text-ink-muted">Not on the partner list, so they cannot be chosen for new listings. Listings already using them keep working.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((dev) => (
              <PartnerCard key={dev.id} dev={dev} count={listingCounts[dev.id] ?? 0} onEdit={() => setEditing({ developer: dev, mode: 'edit', lockId: true })} />
            ))}
          </div>
        </section>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'create' ? `Set up ${editing.developer.name}` : `Edit ${editing?.developer.name ?? 'partner'}`}
        description="Partner details appear on every project page for this developer."
        width="lg"
      >
        {editing && <DeveloperForm key={editing.developer.id || 'new'} initial={editing.developer} mode={editing.mode} lockId={editing.lockId} onSaved={saved} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
