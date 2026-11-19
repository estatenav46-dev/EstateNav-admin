'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import type { Corridor } from '@/lib/data/types';
import { createCorridorAction, saveCorridorAction } from '@/app/actions/corridors';
import { MediaUploader } from '@/components/properties/MediaUploader';
import { Field, slugify } from '@/components/ui/form';

type Zone = NonNullable<Corridor['zone']>;

/** Bengaluru regions used by the website's region cards and filters. */
export const ZONE_OPTIONS: { id: Zone; label: string; examples: string }[] = [
  { id: 'north', label: 'North Bengaluru', examples: 'Hebbal, Yelahanka, Devanahalli, Airport Road' },
  { id: 'east', label: 'East Bengaluru', examples: 'Whitefield, Varthur, KR Puram, Outer Ring Road' },
  { id: 'south-east', label: 'South-East Bengaluru', examples: 'Sarjapur Road, Dommasandra, Attibele' },
  { id: 'south', label: 'South Bengaluru', examples: 'Electronic City, Kanakapura Road, JP Nagar' },
  { id: 'west', label: 'West Bengaluru', examples: 'Yeshwanthpur, Rajajinagar, Tumkur Road' },
  { id: 'central', label: 'Central Bengaluru', examples: 'Indiranagar, Koramangala, CBD' },
];

export const zoneLabel = (zone: Corridor['zone']) => ZONE_OPTIONS.find((z) => z.id === zone)?.label ?? 'No region';

export function blankCorridor(order: number, name = ''): Corridor {
  const slug = slugify(name, 60);
  return { id: slug, name, slug, description: '', svgPathId: slug || 'corridor', heroImage: null, order, zone: null };
}

type Props = {
  initial: Corridor;
  mode: 'create' | 'edit';
  onSaved: (corridor: Corridor) => void;
  onCancel: () => void;
};

export function CorridorForm({ initial, mode, onSaved, onCancel }: Props) {
  const [c, setC] = useState<Corridor>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; issues?: string[] } | null>(null);
  const set = <K extends keyof Corridor>(key: K, value: Corridor[K]) => setC((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // React events bubble through portals: keep this submit away from an enclosing editor form.
    event.stopPropagation();
    setError(null);
    const slug = slugify(c.slug || c.name, 60);
    const payload: Corridor = { ...c, slug, id: mode === 'create' ? slugify(c.id || c.name, 60) : c.id, svgPathId: c.svgPathId || slug };
    setSaving(true);
    const res = mode === 'create' ? await createCorridorAction(payload) : await saveCorridorAction(payload);
    setSaving(false);
    if (res.ok) onSaved(res.data);
    else setError({ message: res.message, issues: 'issues' in res ? res.issues : undefined });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error.message}
          </p>
          {error.issues && <ul className="mt-1 list-disc pl-6">{error.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}

      <Field label="Region" required hint="Decides which region card and filter shows this area on the website.">
        <div className="grid gap-2 sm:grid-cols-2">
          {ZONE_OPTIONS.map((z) => (
            <label key={z.id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors ${c.zone === z.id ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-surface-2'}`}>
              <input type="radio" name="zone" className="mt-0.5 accent-[rgb(var(--accent))]" checked={c.zone === z.id} onChange={() => set('zone', z.id)} required />
              <span>
                <span className="block font-semibold text-ink">{z.label}</span>
                <span className="text-ink-muted">{z.examples}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area name" required hint="As buyers search for it, e.g. “Sarjapur Road”.">
          <input
            className="field"
            required
            value={c.name}
            placeholder="e.g. Kanakapura Road"
            onChange={(e) => {
              const name = e.target.value;
              setC((prev) => ({ ...prev, name, ...(mode === 'create' ? { id: slugify(name, 60), slug: slugify(name, 60), svgPathId: slugify(name, 60) } : {}) }));
            }}
          />
        </Field>
        <Field label="Display order" hint="Lower numbers appear first.">
          <input className="field" type="number" min={0} value={c.order} onChange={(e) => set('order', Math.max(0, parseInt(e.target.value, 10) || 0))} />
        </Field>
        <Field label="Area ID" hint={mode === 'edit' ? 'Fixed once created.' : 'Generated from the name.'}>
          <input className="field font-mono disabled:opacity-60" disabled={mode === 'edit'} value={c.id} onChange={(e) => set('id', slugify(e.target.value, 60))} />
        </Field>
        <Field label="URL slug">
          <input className="field font-mono" value={c.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
        </Field>
        <Field label="Description" className="sm:col-span-2" hint="One or two lines on what the area is known for.">
          <textarea className="field" rows={3} value={c.description} placeholder="e.g. Southern arterial towards Kanakapura with metro access at Silk Institute and new residential townships." onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>

      <MediaUploader
        label="Area photo (optional)"
        storagePath={`corridors/${c.id || 'new'}`}
        images={c.heroImage ? [c.heroImage] : []}
        onChange={(images) => set('heroImage', images[0] ?? null)}
        max={1}
        altPrefix={`${c.name || 'Area'}, Bengaluru`}
      />

      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving || !c.name.trim() || !c.zone} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === 'create' ? 'Create area' : 'Save area'}
        </button>
      </div>
    </form>
  );
}
