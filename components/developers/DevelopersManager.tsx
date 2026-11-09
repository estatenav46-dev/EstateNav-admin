'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Developer, ImageRef } from '@/lib/data/types';
import { saveDeveloperAction } from '@/app/actions/developers';
import { MediaUploader } from '@/components/properties/MediaUploader';
import { Plus, Edit2, ExternalLink, Users, Check, AlertCircle, Building2, X } from 'lucide-react';

interface Props {
  initialDevelopers: Developer[];
}

export function DevelopersManager({ initialDevelopers }: Props) {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers);
  const [editing, setEditing] = useState<Developer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: `dev-${Date.now()}`,
      name: '',
      legalName: '',
      about: '',
      yearsActive: null,
      sqftDelivered: null,
      constructionTech: 'Mivan Monolithic Concrete',
      sources: [
        { field: 'yearsActive', label: 'Company filings', url: null, asOf: new Date().toISOString().slice(0, 10) },
      ],
      website: null,
      logo: null,
    });
    setError(null);
  };

  const startEdit = (dev: Developer) => {
    setIsNew(false);
    setEditing({ ...dev });
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);

    const res = await saveDeveloperAction(editing);
    setSaving(false);

    if (res.ok) {
      if (isNew) {
        setDevelopers([...developers, res.data]);
      } else {
        setDevelopers(developers.map((d) => (d.id === res.data.id ? res.data : d)));
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
          <h2 className="text-xl font-bold text-ink">Partner Developers</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Verified developers with track records, construction methodology, and RERA credentials.
          </p>
        </div>
        <button onClick={startNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Add Developer</span>
        </button>
      </div>

      {/* Grid of Developers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {developers.map((dev) => (
          <div key={dev.id} className="panel p-5 flex flex-col justify-between hover:border-line-strong transition-all">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {dev.logo?.url ? (
                    <img
                      src={dev.logo.url}
                      alt={dev.name}
                      className="w-12 h-12 object-contain rounded-lg border border-line bg-white p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-ink-muted">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-ink text-sm">{dev.name}</h3>
                    <p className="text-2xs text-ink-muted font-mono">{dev.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(dev)}
                  className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
                  title="Edit developer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-ink-muted line-clamp-2 mb-3">{dev.about || 'No description provided.'}</p>

              <div className="grid grid-cols-2 gap-2 text-2xs mb-3 py-2 px-2.5 bg-surface-2/60 rounded-lg">
                <div>
                  <span className="text-ink-muted block">Years Active</span>
                  <span className="font-semibold text-ink">{dev.yearsActive ? `${dev.yearsActive} Years` : '—'}</span>
                </div>
                <div>
                  <span className="text-ink-muted block">Delivered</span>
                  <span className="font-semibold text-ink">
                    {dev.sqftDelivered ? `${(dev.sqftDelivered / 1000000).toFixed(1)}M sqft` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-ink-muted">
              <span className="truncate max-w-[180px]">{dev.constructionTech || 'Standard RCC'}</span>
              {dev.website && (
                <a
                  href={dev.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline flex items-center gap-1"
                >
                  <span>Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
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
              {isNew ? 'Add Partner Developer' : `Edit ${editing.name}`}
            </h3>
            <p className="text-xs text-ink-muted mb-5">
              Accurate track records build homebuyer confidence in delivery schedules.
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
                  <label className="block text-xs font-semibold text-ink mb-1">Developer ID *</label>
                  <input
                    type="text"
                    required
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    disabled={!isNew}
                    placeholder="e.g. aparna"
                    className="field disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Aparna Constructions"
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Legal Registered Entity Name *</label>
                <input
                  type="text"
                  required
                  value={editing.legalName}
                  onChange={(e) => setEditing({ ...editing, legalName: e.target.value })}
                  placeholder="e.g. Aparna Constructions and Estates Private Limited"
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">About / Track Record Summary</label>
                <textarea
                  rows={3}
                  value={editing.about}
                  onChange={(e) => setEditing({ ...editing, about: e.target.value })}
                  placeholder="Summary of construction history, footprint in Hyderabad, architectural standards..."
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Years Active</label>
                  <input
                    type="number"
                    value={editing.yearsActive || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, yearsActive: e.target.value ? parseInt(e.target.value, 10) : null })
                    }
                    placeholder="e.g. 28"
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Sqft Delivered (Total)</label>
                  <input
                    type="number"
                    value={editing.sqftDelivered || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, sqftDelivered: e.target.value ? parseInt(e.target.value, 10) : null })
                    }
                    placeholder="e.g. 24000000"
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Construction Methodology</label>
                <input
                  type="text"
                  value={editing.constructionTech || ''}
                  onChange={(e) => setEditing({ ...editing, constructionTech: e.target.value })}
                  placeholder="e.g. Mivan Monolithic Shear Wall Aluminum Formwork"
                  className="field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Official Website URL</label>
                <input
                  type="url"
                  value={editing.website || ''}
                  onChange={(e) => setEditing({ ...editing, website: e.target.value || null })}
                  placeholder="https://aparnaconstructions.com"
                  className="field"
                />
              </div>

              {/* Logo Upload via Cloudinary */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Developer Logo</label>
                <MediaUploader
                  label="Developer Brand Logo"
                  storagePath={`developers/${editing.id}`}
                  images={editing.logo ? [editing.logo] : []}
                  coverId={editing.logo?.id || undefined}
                  onChange={(images) => {
                    setEditing({ ...editing, logo: images[0] || null });
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
                  {saving ? 'Saving...' : 'Save Developer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
