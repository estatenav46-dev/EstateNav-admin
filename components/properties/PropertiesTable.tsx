'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { Search, Plus, Star, Copy, Trash2, Edit, ExternalLink, Loader2 } from 'lucide-react';
import type { Corridor, Property, PublishStatus } from '@/lib/data/types';
import { setStatusAction, setFeaturedAction, duplicatePropertyAction, deletePropertyAction } from '@/app/actions/properties';

export function PropertiesTable({ properties, corridors }: { properties: Property[]; corridors: Corridor[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [corridorFilter, setCorridorFilter] = useState('all');
  const [isPending, startTransition] = useTransition();

  const filtered = properties.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (corridorFilter !== 'all' && p.corridorId !== corridorFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.developerName.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = (id: string, status: PublishStatus) => {
    startTransition(async () => {
      await setStatusAction(id, status);
    });
  };

  const handleToggleFeatured = (id: string, featured: boolean) => {
    startTransition(async () => {
      await setFeaturedAction(id, !featured);
    });
  };

  const handleDuplicate = (id: string) => {
    if (confirm('Create a duplicate copy of this property listing?')) {
      startTransition(async () => {
        await duplicatePropertyAction(id);
      });
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to permanently delete “${title}”?`)) {
      startTransition(async () => {
        await deletePropertyAction(id);
      });
    }
  };

  const formatPrice = (p: number) => {
    if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
    if (p >= 100000) return `₹${(p / 100000).toFixed(1)} L`;
    return `₹${p.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, locality..."
              className="field min-h-[38px] pl-9 text-xs"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field min-h-[38px] text-xs"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>

          {/* Corridor Filter */}
          <select
            value={corridorFilter}
            onChange={(e) => setCorridorFilter(e.target.value)}
            className="field min-h-[38px] text-xs"
          >
            <option value="all">All corridors</option>
            {corridors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <Link href="/properties/new" className="btn-primary min-h-[38px] px-4 text-xs flex items-center gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Add Property
        </Link>
      </div>

      {/* Table Panel */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-2xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Developer</th>
                <th className="px-4 py-3 font-semibold">Corridor</th>
                <th className="px-4 py-3 font-semibold">Price Range</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Featured</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-ink-muted">
                    No properties match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/40 transition-colors">
                    {/* Thumbnail & Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {p.media?.cover?.url ? (
                            <Image
                              src={p.media.cover.url}
                              alt={p.title}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xs text-ink-muted">
                              No img
                            </div>
                          )}
                        </div>
                        <div>
                          <Link href={`/properties/${p.id}`} className="font-semibold text-ink hover:text-accent-ink block">
                            {p.title}
                          </Link>
                          <span className="text-2xs text-ink-muted">{p.locality}</span>
                        </div>
                      </div>
                    </td>

                    {/* Developer */}
                    <td className="px-4 py-3 text-xs text-ink-muted font-medium">{p.developerName}</td>

                    {/* Corridor */}
                    <td className="px-4 py-3 text-xs text-ink-muted">{p.corridorName}</td>

                    {/* Price Range */}
                    <td className="px-4 py-3 text-xs font-mono font-medium text-ink">
                      {formatPrice(p.priceMin)}
                      {p.priceMax ? ` – ${formatPrice(p.priceMax)}` : '+'}
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3 text-xs">
                      <select
                        value={p.status}
                        disabled={isPending}
                        onChange={(e) => handleStatusChange(p.id, e.target.value as PublishStatus)}
                        className={`rounded border px-2 py-1 text-2xs font-medium cursor-pointer ${
                          p.status === 'published'
                            ? 'border-accent/40 bg-accent-soft text-accent-ink'
                            : p.status === 'draft'
                            ? 'border-line bg-surface-2 text-ink-muted'
                            : 'border-danger/30 bg-danger/10 text-danger'
                        }`}
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>

                    {/* Featured Toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleFeatured(p.id, p.featured)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          p.featured ? 'text-amber-500 hover:bg-amber-500/10' : 'text-ink-muted hover:bg-surface-2'
                        }`}
                        title={p.featured ? 'Remove from featured' : 'Mark as featured'}
                      >
                        <Star className={`h-4 w-4 ${p.featured ? 'fill-current' : ''}`} />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/properties/${p.id}`}
                          className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
                          title="Edit listing"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDuplicate(p.id)}
                          className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
                          title="Duplicate listing"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(p.id, p.title)}
                          className="rounded p-1.5 text-danger hover:bg-danger/10"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

