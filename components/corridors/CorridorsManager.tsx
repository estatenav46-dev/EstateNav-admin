'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Corridor, ImageRef } from '@/lib/data/types';
import { saveCorridorAction } from '@/app/actions/corridors';
import { MediaUploader } from '@/components/properties/MediaUploader';
import { Plus, Edit2, Compass, AlertCircle, X, MapPin } from 'lucide-react';

interface Props {
  initialCorridors: Corridor[];
}

export function CorridorsManager({ initialCorridors }: Props) {
  const router = useRouter();
  const [corridors, setCorridors] = useState<Corridor[]>(initialCorridors);
  const [editing, setEditing] = useState<Corridor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: `corridor-${Date.now()}`,
      name: '',
      slug: '',
      description: '',
      svgPathId: 'corridor-path',
      heroImage: null,
      order: corridors.length + 1,
    });
    setError(null);
  };

  const startEdit = (corr: Corridor) => {
    setIsNew(false);
    setEditing({ ...corr });
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);

    const res = await saveCorridorAction(editing);
    setSaving(false);

    if (res.ok) {
      if (isNew) {
        setCorridors([...corridors, res.data]);
      } else {
        setCorridors(corridors.map((c) => (c.id === res.data.id ? res.data : c)));
      }
      setEditing(null);
      setIsNew(false);
      router.refresh();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Micro-Market Corridors</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Hyderabad strategic development zones mapped with commute times and infrastructure growth.
          </p>
        </div>
        <button onClick={startNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Add Corridor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {corridors.map((corr) => (
          <div key={corr.id} className="panel p-5 flex flex-col justify-between hover:border-line-strong transition-all">
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs">
                    {corr.order}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-sm">{corr.name}</h3>
                    <p className="text-2xs text-ink-muted font-mono">/{corr.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(corr)}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {corr.heroImage?.url && (
                <div className="my-3 rounded-lg overflow-hidden border border-line aspect-[16/9] bg-surface-2">
                  <img src={corr.heroImage.url} alt={corr.name} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs text-ink-muted line-clamp-3 mb-3">{corr.description || 'No description provided.'}</p>
            </div>

            <div className="pt-3 border-t border-line text-2xs text-ink-muted flex items-center justify-between">
              <span>SVG: {corr.svgPathId}</span>
              <span className="font-mono">ID: {corr.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / New Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60 backdrop-blur-sm animate-fade-in">
          <div className="panel bg-surface max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
              className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-surface-2 text-ink-muted hover:text-ink"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-ink mb-1">
              {isNew ? 'Add Micro-Market Corridor' : `Edit ${editing.name}`}
            </h3>
            <p className="text-xs text-ink-muted mb-5">
              Corridors group projects by location and drive the interactive Hyderabad map view.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Corridor ID *</label>
                  <input
                    type="text"
                    required
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    disabled={!isNew}
                    placeholder="e.g. kokapet"
                    className="field disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={editing.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      setEditing({ ...editing, name, ...(isNew ? { slug } : {}) });
                    }}
                    placeholder="e.g. Kokapet & Neopolis"
                    className="field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })}
                    placeholder="e.g. kokapet"
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editing.order}
                    onChange={(e) => setEditing({ ...editing, order: parseInt(e.target.value, 10) || 0 })}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Description / Market Overview</label>
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Overview of commercial drivers, upcoming metro, ORR connectivity..."
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">SVG Map Path ID</label>
                <input
                  type="text"
                  value={editing.svgPathId}
                  onChange={(e) => setEditing({ ...editing, svgPathId: e.target.value })}
                  placeholder="e.g. corridor-kokapet"
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Hero Image</label>
                <MediaUploader
                  label="Corridor Hero Image"
                  storagePath={`corridors/${editing.id}`}
                  images={editing.heroImage ? [editing.heroImage] : []}
                  coverId={editing.heroImage?.id || undefined}
                  onChange={(images) => {
                    setEditing({ ...editing, heroImage: images[0] || null });
                  }}
                  onSetCover={() => {}}
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setIsNew(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Corridor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
