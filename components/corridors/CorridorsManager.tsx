'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, MapPin, AlertTriangle } from 'lucide-react';
import type { Corridor } from '@/lib/data/types';
import { Modal } from '@/components/ui/Modal';
import { CorridorForm, ZONE_OPTIONS, blankCorridor } from './CorridorForm';

interface Props {
  initialCorridors: Corridor[];
  listingCounts: Record<string, number>;
}

export function CorridorsManager({ initialCorridors, listingCounts }: Props) {
  const router = useRouter();
  const [corridors, setCorridors] = useState<Corridor[]>(initialCorridors);
  const [editing, setEditing] = useState<{ corridor: Corridor; mode: 'create' | 'edit' } | null>(null);

  const groups = useMemo(() => {
    const sorted = [...corridors].sort((a, b) => a.order - b.order);
    const known = ZONE_OPTIONS.map((z) => ({ id: z.id as string, label: z.label, items: sorted.filter((c) => c.zone === z.id) }));
    const unassigned = sorted.filter((c) => !c.zone);
    return [...known.filter((g) => g.items.length), ...(unassigned.length ? [{ id: 'none', label: 'No region yet', items: unassigned }] : [])];
  }, [corridors]);

  const saved = (corridor: Corridor) => {
    setCorridors((list) => (list.some((c) => c.id === corridor.id) ? list.map((c) => (c.id === corridor.id ? corridor : c)) : [...list, corridor]));
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Catalogue</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Regions & areas</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Bengaluru areas (micro-markets) grouped by region. Every listing belongs to one area.</p>
        </div>
        <button type="button" onClick={() => setEditing({ corridor: blankCorridor(corridors.length + 1), mode: 'create' })} className="btn-primary">
          <Plus className="h-4 w-4" /> Add area
        </button>
      </div>

      {groups.length === 0 && <div className="panel p-10 text-center text-sm text-ink-muted">No areas yet. Add the first Bengaluru area you list projects in.</div>}

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {group.id === 'none' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <MapPin className="h-4 w-4 text-accent" />}
            {group.label}
            <span className="font-normal text-ink-muted">· {group.items.length}</span>
          </h2>
          {group.id === 'none' && <p className="text-2xs text-ink-muted">Assign a region so these areas appear under the right region card on the website.</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((corr) => {
              const count = listingCounts[corr.id] ?? 0;
              return (
                <div key={corr.id} className="panel flex flex-col justify-between p-5 transition-all hover:border-line-strong">
                  <div>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-ink">{corr.name}</h3>
                        <p className="font-mono text-2xs text-ink-muted">/{corr.slug} · order {corr.order}</p>
                      </div>
                      <button type="button" onClick={() => setEditing({ corridor: corr, mode: 'edit' })} className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink" title={`Edit ${corr.name}`}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                    {corr.heroImage?.url && (
                      <div className="my-3 aspect-[16/9] overflow-hidden rounded-lg border border-line bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={corr.heroImage.url} alt={corr.heroImage.alt} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="mb-3 line-clamp-3 text-xs text-ink-muted">{corr.description || 'No description yet.'}</p>
                  </div>
                  <div className="border-t border-line pt-3 text-xs">
                    <Link href={`/properties?corridor=${corr.id}`} className="font-medium text-accent-ink hover:underline">
                      {count} {count === 1 ? 'listing' : 'listings'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'create' ? 'Add area' : `Edit ${editing?.corridor.name ?? 'area'}`}
        description="Areas group listings on the website: region → area → locality."
        width="lg"
      >
        {editing && <CorridorForm key={editing.corridor.id || 'new'} initial={editing.corridor} mode={editing.mode} onSaved={saved} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
