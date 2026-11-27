'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Pager, usePaged } from '@/components/ui/Pager';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, Copy, Edit, ExternalLink, Eye, EyeOff, FileText, Globe, Images, LayoutGrid, Layers, List, Plus, Search, Star, Trash2, X } from 'lucide-react';
import type { Corridor, Developer, Property, PublishStatus } from '@/lib/data/types';
import { setStatusAction, setFeaturedAction, duplicatePropertyAction, deletePropertyAction, deletePropertiesAction, setHiddenAction, setStatusesAction } from '@/app/actions/properties';
import { PROPERTY_TYPE_LABEL } from '@/lib/listingMeta';
import { ZONE_OPTIONS, zoneLabel } from '@/components/corridors/CorridorForm';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in').replace(/\/$/, '');

export type TableFilters = { status: string; region: string; developer: string; corridor: string; segment: string; q: string; view?: string };

type PartnerSort = 'count' | 'name' | 'drafts';

const formatPrice = (p: number) => {
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(1).replace(/\.0$/, '')} L`;
  return `₹${p.toLocaleString('en-IN')}`;
};

export function PropertiesTable({ properties, corridors, developers, initialFilters }: { properties: Property[]; corridors: Corridor[]; developers: Developer[]; initialFilters: TableFilters }) {
  const router = useRouter();
  const [filters, setFilters] = useState<TableFilters>(initialFilters);
  const [isPending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<TableFilters>) => setFilters((f) => ({ ...f, ...patch }));

  // Keep filters in the address bar so links and the back button work.
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && value !== 'all' && value !== 'list' && params.set(key, value));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  const counts = useMemo(() => ({
    all: properties.length,
    published: properties.filter((p) => p.status === 'published').length,
    draft: properties.filter((p) => p.status === 'draft').length,
    archived: properties.filter((p) => p.status === 'archived').length,
  }), [properties]);

  const zoneOf = useMemo(() => new Map(corridors.map((c) => [c.id, c.zone ?? null])), [corridors]);
  const areaOptions = filters.region === 'all' ? corridors : corridors.filter((c) => c.zone === filters.region);
  const regionCounts = ZONE_OPTIONS.map((z) => ({ id: z.id as string, label: z.label, count: properties.filter((p) => zoneOf.get(p.corridorId) === z.id).length })).filter((r) => r.count > 0);
  const hiddenDevs = useMemo(() => new Set(developers.filter((d) => d.hidden).map((d) => d.id)), [developers]);
  const filtered = properties.filter((p) => {
    if (filters.status !== 'all' && p.status !== filters.status) return false;
    if (filters.corridor !== 'all' && p.corridorId !== filters.corridor) return false;
    if (filters.region !== 'all' && zoneOf.get(p.corridorId) !== filters.region) return false;
    if (filters.developer !== 'all' && p.developerId !== filters.developer) return false;
    if (filters.segment !== 'all' && p.segment !== filters.segment) return false;
    const q = filters.q.trim().toLowerCase();
    return !q || `${p.title} ${p.developerName} ${p.locality} ${p.corridorName} ${p.slug}`.toLowerCase().includes(q);
  });

  const paged = usePaged(filtered, JSON.stringify(filters), 'admin.properties.pageSize');

  // Several listings at once: tick rows (or the header box for this page), then Delete selected.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filterKey = JSON.stringify(filters);
  useEffect(() => setSelected(new Set()), [filterKey]);
  const pageIds = paged.rows.map((p) => p.id);
  const pageAll = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      pageIds.forEach((id) => (pageAll ? next.delete(id) : next.add(id)));
      return next;
    });
  const deleteSelected = () => {
    const ids = Array.from(selected);
    const titles = properties.filter((p) => selected.has(p.id)).map((p) => p.title);
    if (!ids.length) return;
    const list = titles.slice(0, 12).join('\n• ') + (titles.length > 12 ? `\n…and ${titles.length - 12} more` : '');
    if (!confirm(`Delete ${ids.length} listing${ids.length === 1 ? '' : 's'} permanently?\n\n• ${list}\n\nThis cannot be undone. Archive them instead if you may need them again.`)) return;
    run(async () => {
      const res = await deletePropertiesAction(ids);
      if (res.ok) setSelected(new Set());
      return res;
    });
  };

  const publishSelected = () => {
    const ids = Array.from(selected);
    if (!ids.length || !confirm(`Publish ${ids.length} listing${ids.length === 1 ? '' : 's'} on the website?`)) return;
    run(async () => {
      const res = await setStatusesAction(ids, 'published');
      if (res.ok) setSelected(new Set());
      return res;
    });
  };

  // Partner view: one card per partner, click to see that partner's listings.
  const [partnerSort, setPartnerSort] = useState<PartnerSort>('count');
  const devById = useMemo(() => new Map(developers.map((d) => [d.id, d])), [developers]);
  const partnerCards = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; logo: string | null; hidden: boolean; total: number; published: number; draft: number; archived: number; covers: string[] }>();
    properties.forEach((p) => {
      const dev = devById.get(p.developerId);
      const g = groups.get(p.developerId) ?? { id: p.developerId, name: dev?.name ?? p.developerName, logo: dev?.logo?.url ?? null, hidden: !!dev?.hidden, total: 0, published: 0, draft: 0, archived: 0, covers: [] };
      g.total += 1;
      g[p.status] += 1;
      if (p.media.gallery.length && g.covers.length < 3) g.covers.push(p.media.cover.url);
      groups.set(p.developerId, g);
    });
    const q = filters.q.trim().toLowerCase();
    const list = Array.from(groups.values()).filter((g) => !q || g.name.toLowerCase().includes(q));
    return list.sort((a, b) => (partnerSort === 'name' ? a.name.localeCompare(b.name) : partnerSort === 'drafts' ? b.draft - a.draft || a.name.localeCompare(b.name) : b.total - a.total || a.name.localeCompare(b.name)));
  }, [properties, devById, partnerSort, filters.q]);
  const view = filters.view === 'partners' ? 'partners' : 'list';
  const openPartner = (id: string) => setFilters((f) => ({ ...f, view: 'list', developer: id, region: 'all', corridor: 'all', q: '' }));

  const run = (fn: () => Promise<{ ok: boolean; message?: string; warning?: string }>) =>
    startTransition(async () => {
      setProblem(null);
      const res = await fn();
      if (!res.ok) setProblem(res.message ?? 'That did not work.');
      else if (res.warning) setProblem(res.warning);
      router.refresh();
    });

  const active = filters.region !== 'all' || filters.developer !== 'all' || filters.corridor !== 'all' || filters.segment !== 'all' || filters.q;

  const viewToggle = (
    <div className="flex shrink-0 gap-1 rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="View">
      <button type="button" onClick={() => set({ view: 'list' })} aria-pressed={view === 'list'} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${view === 'list' ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'}`}>
        <List className="h-3.5 w-3.5" /> All listings
      </button>
      <button type="button" onClick={() => set({ view: 'partners', q: '' })} aria-pressed={view === 'partners'} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${view === 'partners' ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'}`}>
        <LayoutGrid className="h-3.5 w-3.5" /> By partner
      </button>
    </div>
  );

  if (view === 'partners') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {viewToggle}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Find a partner…" className="field pl-8 text-xs" />
          </div>
          <select value={partnerSort} onChange={(e) => setPartnerSort(e.target.value as PartnerSort)} className="field text-xs sm:w-48" aria-label="Sort partners">
            <option value="count">Most listings first</option>
            <option value="name">Name A–Z</option>
            <option value="drafts">Most drafts first</option>
          </select>
        </div>
        <p className="text-2xs text-ink-muted">{partnerCards.length} partner{partnerCards.length === 1 ? '' : 's'} · {properties.length} listings. Click a partner to see its listings.</p>
        {partnerCards.length === 0 ? (
          <p className="panel px-4 py-10 text-center text-xs text-ink-muted">{properties.length ? 'No partner matches that search.' : 'No listings yet.'}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {partnerCards.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => openPartner(g.id)} className={`group flex h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-left shadow-sm transition hover:border-accent hover:shadow-md ${g.hidden ? 'opacity-60' : ''}`}>
                  <div className="grid h-24 grid-cols-3 gap-px bg-line">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="relative bg-surface-2">
                        {g.covers[i] && <Image src={g.covers[i]} alt="" fill sizes="120px" className="object-cover" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
                        {g.logo ? <Image src={g.logo} alt="" fill sizes="36px" className="object-contain p-1" /> : <Building2 className="h-4 w-4 text-ink-muted" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink group-hover:text-accent-ink">{g.name}</p>
                        <p className="text-2xs text-ink-muted">{g.total} listing{g.total === 1 ? '' : 's'}{g.hidden ? ' · partner hidden' : ''}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5 text-2xs font-semibold">
                      {g.published > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-ink">{g.published} published</span>}
                      {g.draft > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{g.draft} draft</span>}
                      {g.archived > 0 && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">{g.archived} archived</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const partnerName = filters.developer !== 'all' ? devById.get(filters.developer)?.name ?? properties.find((p) => p.developerId === filters.developer)?.developerName : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {viewToggle}
        {partnerName && (
          <span className="inline-flex items-center gap-2 text-xs">
            <button type="button" onClick={() => set({ view: 'partners', developer: 'all' })} className="inline-flex items-center gap-1 font-semibold text-accent-ink hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> All partners
            </button>
            <span className="text-ink-muted">/</span>
            <span className="font-semibold text-ink">{partnerName}</span>
          </span>
        )}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Region">
        <button type="button" onClick={() => set({ region: 'all', corridor: 'all' })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filters.region === 'all' ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'}`}>
          All properties <span className="ml-0.5 font-mono opacity-70">{properties.length}</span>
        </button>
        {regionCounts.map((r) => (
          <button key={r.id} type="button" onClick={() => set({ region: r.id, corridor: 'all' })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filters.region === r.id ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'}`}>
            {r.label.replace(' Bengaluru', '')} <span className="ml-0.5 font-mono opacity-70">{r.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2.5 lg:flex-row lg:items-center">
        <div className="flex shrink-0 gap-1 rounded-lg bg-surface-2 p-0.5">
          {(['all', 'published', 'draft', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ status: s })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${filters.status === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            >
              {s === 'all' ? 'All' : s} <span className="ml-0.5 font-mono text-2xs opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search name, partner, locality…" className="field pl-8 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <select value={filters.region} onChange={(e) => set({ region: e.target.value, corridor: 'all' })} className="field text-xs lg:w-40" aria-label="Region">
            <option value="all">All regions</option>
            {ZONE_OPTIONS.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
          <select value={filters.developer} onChange={(e) => set({ developer: e.target.value })} className="field text-xs lg:w-40" aria-label="Partner">
            <option value="all">All partners</option>
            {[...developers].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={filters.corridor} onChange={(e) => set({ corridor: e.target.value })} className="field text-xs lg:w-40" aria-label="Area">
            <option value="all">All areas</option>
            {areaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={filters.segment} onChange={(e) => set({ segment: e.target.value })} className="field text-xs lg:w-36" aria-label="Segment">
            <option value="all">All segments</option>
            <option value="residential">Residential</option>
            <option value="plot">Plots</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        {active && (
          <button type="button" onClick={() => setFilters({ ...initialFilters, view: 'list', status: filters.status, region: 'all', developer: 'all', corridor: 'all', segment: 'all', q: '' })} className="btn-ghost shrink-0 px-2 text-xs text-ink-muted">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {problem && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {problem}
        </div>
      )}

      <div className="flex min-h-[32px] flex-wrap items-center gap-3">
        <p className="text-2xs text-ink-muted">
          Showing {filtered.length} of {properties.length} listings{isPending ? ' · updating…' : ''}
        </p>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1 text-xs">
            <span className="font-semibold text-ink">{selected.size} selected</span>
            {selected.size < filtered.length && (
              <button type="button" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))} className="font-semibold text-accent-ink hover:underline">
                Select all {filtered.length}
              </button>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="btn-secondary min-h-[28px] px-2.5 text-2xs">
              Clear
            </button>
            <button type="button" disabled={isPending} onClick={publishSelected} className="btn-secondary min-h-[28px] border-accent/40 px-2.5 text-2xs text-accent-ink hover:bg-accent-soft">
              <Globe className="h-3.5 w-3.5" /> Publish selected
            </button>
            <button type="button" disabled={isPending} onClick={deleteSelected} className="btn-secondary min-h-[28px] border-danger/40 px-2.5 text-2xs text-danger hover:bg-danger/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete selected
            </button>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="border-b border-line bg-surface-2 text-2xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="w-10 py-2.5 pl-3">
                  <input type="checkbox" checked={pageAll} onChange={togglePage} disabled={!pageIds.length} aria-label="Select all listings on this page" className="h-4 w-4 accent-[rgb(var(--accent))]" />
                </th>
                <th className="px-3 py-2.5 font-semibold">Property</th>
                <th className="px-3 py-2.5 font-semibold">Partner · Area</th>
                <th className="px-3 py-2.5 font-semibold">Price</th>
                <th className="px-3 py-2.5 font-semibold">Content</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Featured</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-ink-muted">
                    {properties.length ? 'No listings match these filters.' : 'No listings yet. Post the first property or import an Excel sheet.'}
                  </td>
                </tr>
              ) : (
                paged.rows.map((p) => {
                  const plans = p.configurations.filter((c) => c.floorPlanImageId).length;
                  return (
                    <tr key={p.id} className={`transition-colors hover:bg-surface-2/40 ${p.hidden || hiddenDevs.has(p.developerId) ? 'opacity-60' : ''} ${selected.has(p.id) ? 'bg-danger/5' : ''}`}>
                      <td className="py-2.5 pl-3">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.title}`} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                            {p.media.gallery.length ? <Image src={p.media.cover.url} alt="" fill sizes="64px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-muted">No photo</div>}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/properties/${p.id}`} className="block truncate font-semibold text-ink hover:text-accent-ink">
                              {p.title}
                            </Link>
                            <span className="block truncate text-2xs text-ink-muted">
                              {PROPERTY_TYPE_LABEL[p.propertyType]} · {p.locality}
                            </span>
                            {(p.hidden || hiddenDevs.has(p.developerId)) && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-ink/10 px-1.5 py-px text-[10px] font-semibold uppercase text-ink-muted">
                                <EyeOff className="h-3 w-3" /> {p.hidden ? 'Hidden' : 'Partner hidden'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="block font-medium text-ink">{p.developerName}</span>
                        <span className="text-ink-muted">
                          {p.corridorName}
                          {zoneOf.get(p.corridorId) ? ` · ${zoneLabel(zoneOf.get(p.corridorId) ?? null).replace(' Bengaluru', '')}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs font-medium text-ink">
                        {formatPrice(p.priceMin)}
                        {p.priceMax ? ` – ${formatPrice(p.priceMax)}` : '+'}
                        {p.priceOnRequest && <span className="mt-0.5 block font-sans text-2xs font-normal text-amber-700">Shown as “on request”</span>}
                      </td>
                      <td className="px-3 py-2.5 text-2xs text-ink-muted">
                        <span className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1" title="Photos"><Images className="h-3.5 w-3.5" /> {p.media.gallery.length}</span>
                          <span className="inline-flex items-center gap-1" title="Unit types (with floor plan)"><Layers className="h-3.5 w-3.5" /> {p.configurations.length}{plans ? `/${plans}` : ''}</span>
                          <span className="inline-flex items-center gap-1" title="Documents"><FileText className="h-3.5 w-3.5" /> {p.documents.length}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <select
                          value={p.status}
                          disabled={isPending}
                          onChange={(e) => run(() => setStatusAction(p.id, e.target.value as PublishStatus))}
                          className={`cursor-pointer rounded border px-2 py-1 text-2xs font-medium ${p.status === 'published' ? 'border-accent/40 bg-accent-soft text-accent-ink' : p.status === 'draft' ? 'border-amber-400/40 bg-amber-50 text-amber-800' : 'border-danger/30 bg-danger/10 text-danger'}`}
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" disabled={isPending} onClick={() => run(() => setFeaturedAction(p.id, !p.featured))} className={`rounded-lg p-1.5 transition-colors ${p.featured ? 'text-amber-500 hover:bg-amber-500/10' : 'text-ink-muted hover:bg-surface-2'}`} title={p.featured ? 'Remove from home page' : 'Feature on home page'}>
                          <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/properties/${p.id}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs font-semibold text-ink hover:border-accent hover:text-accent-ink" title="Edit listing">
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </Link>
                          {p.status === 'published' && (
                            <a href={`${SITE_URL}/properties/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs font-semibold text-ink-muted hover:border-line-strong hover:text-ink" title="View on website">
                              <ExternalLink className="h-3.5 w-3.5" /> View
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => setHiddenAction(p.id, !p.hidden))}
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs font-semibold text-ink-muted hover:border-line-strong hover:text-ink"
                            title={p.hidden ? 'Show this listing on the website again' : 'Hide this listing from the website (keeps its status)'}
                          >
                            {p.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {p.hidden ? 'Show' : 'Hide'}
                          </button>
                          <button type="button" disabled={isPending} onClick={() => confirm(`Create a draft copy of “${p.title}”?`) && run(() => duplicatePropertyAction(p.id))} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" title="Duplicate as draft">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={isPending} onClick={() => confirm(`Delete “${p.title}” permanently? Archive it instead if you may need it again.`) && run(() => deletePropertyAction(p.id))} className="rounded p-1.5 text-danger hover:bg-danger/10" title="Delete permanently">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pager {...paged} noun="listings" />

      <Link href="/properties/new" className="btn-primary w-full sm:hidden">
        <Plus className="h-4 w-4" /> Post new property
      </Link>
    </div>
  );
}
