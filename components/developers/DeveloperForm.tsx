'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import type { Developer } from '@/lib/data/types';
import { createDeveloperAction, saveDeveloperAction } from '@/app/actions/developers';
import { MediaUploader } from '@/components/properties/MediaUploader';
import { Field, slugify } from '@/components/ui/form';

type FactField = Developer['sources'][number]['field'];

const FACTS: { field: FactField; label: string; placeholder: string; numeric: boolean }[] = [
  { field: 'yearsActive', label: 'Years in business', placeholder: 'e.g. 30', numeric: true },
  { field: 'projectsDelivered', label: 'Projects delivered', placeholder: 'e.g. 150', numeric: true },
  { field: 'sqftDelivered', label: 'Total sq.ft delivered', placeholder: 'e.g. 130000000', numeric: true },
  { field: 'constructionTech', label: 'Construction method', placeholder: 'e.g. In-house backward integration, precast', numeric: false },
];

const today = () => new Date().toISOString().slice(0, 10);

export function blankDeveloper(name = ''): Developer {
  return {
    id: slugify(name, 60),
    name,
    legalName: '',
    about: '',
    yearsActive: null,
    sqftDelivered: null,
    constructionTech: null,
    projectsDelivered: null,
    headquarters: null,
    sources: [],
    website: null,
    logo: null,
  };
}

type Props = {
  initial: Developer;
  mode: 'create' | 'edit';
  /** Keep the given ID (approved partners have fixed IDs). */
  lockId?: boolean;
  onSaved: (developer: Developer) => void;
  onCancel: () => void;
};

/** Partner (developer) details. Track-record facts are shown on the website only with a source. */
export function DeveloperForm({ initial, mode, lockId = false, onSaved, onCancel }: Props) {
  const [dev, setDev] = useState<Developer>(initial);
  const [idTouched, setIdTouched] = useState(mode === 'edit' || lockId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; issues?: string[] } | null>(null);

  const set = <K extends keyof Developer>(key: K, value: Developer[K]) => setDev((d) => ({ ...d, [key]: value }));
  const source = (field: FactField) => dev.sources.find((s) => s.field === field);
  const setSource = (field: FactField, patch: Partial<Developer['sources'][number]> | null) =>
    setDev((d) => {
      const rest = d.sources.filter((s) => s.field !== field);
      if (patch === null) return { ...d, sources: rest };
      const current = d.sources.find((s) => s.field === field) ?? { field, label: '', url: null, asOf: today() };
      return { ...d, sources: [...rest, { ...current, ...patch }] };
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // React events bubble through portals: keep this submit away from an enclosing editor form.
    event.stopPropagation();
    setError(null);
    // Drop half-filled sources so they do not block saving; unsourced facts simply stay private.
    const payload: Developer = {
      ...dev,
      id: slugify(dev.id, 60),
      legalName: dev.legalName.trim() || dev.name.trim(),
      sources: dev.sources.filter((s) => s.label.trim()),
    };
    setSaving(true);
    const res = mode === 'create' ? await createDeveloperAction(payload) : await saveDeveloperAction(payload);
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name" required>
          <input
            className="field"
            required
            value={dev.name}
            placeholder="e.g. Sobha Limited"
            onChange={(e) => {
              const name = e.target.value;
              setDev((d) => ({ ...d, name, ...(idTouched ? {} : { id: slugify(name, 60) }) }));
            }}
          />
        </Field>
        <Field label="Partner ID" required hint={mode === 'edit' || lockId ? 'Fixed: listings and imports use this ID.' : 'Lowercase, used internally and in imports.'}>
          <input
            className="field font-mono disabled:opacity-60"
            required
            disabled={mode === 'edit' || lockId}
            value={dev.id}
            placeholder="e.g. sobha"
            onChange={(e) => {
              setIdTouched(true);
              set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
            }}
          />
        </Field>
        <Field label="Registered company name" hint="Leave blank to use the brand name.">
          <input className="field" value={dev.legalName} placeholder="e.g. Sobha Limited" onChange={(e) => set('legalName', e.target.value)} />
        </Field>
        <Field label="Headquarters">
          <input className="field" value={dev.headquarters ?? ''} placeholder="e.g. Bengaluru, Karnataka" onChange={(e) => set('headquarters', e.target.value || null)} />
        </Field>
        <Field label="Official website" className="sm:col-span-2">
          <input className="field" type="url" value={dev.website ?? ''} placeholder="https://www.sobha.com" onChange={(e) => set('website', e.target.value.trim() || null)} />
        </Field>
        <Field label="About the partner" className="sm:col-span-2" hint="Shown on project pages under the developer heading.">
          <textarea className="field" rows={3} value={dev.about} placeholder="Short summary: who they are, what they build in Bengaluru, notable projects." onChange={(e) => set('about', e.target.value)} />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-4">
        <div>
          <p className="text-sm font-semibold">Track record</p>
          <p className="text-2xs text-ink-muted">A fact appears on the website only when you name its source (annual report, company website, RERA filing…) and the date you checked it.</p>
        </div>
        {FACTS.map(({ field, label, placeholder, numeric }) => {
          const src = source(field);
          const raw = dev[field];
          return (
            <div key={field} className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1.2fr_0.8fr]">
              <Field label={label}>
                <input
                  className="field min-h-[36px] text-xs"
                  type={numeric ? 'number' : 'text'}
                  min={numeric ? 1 : undefined}
                  value={raw ?? ''}
                  placeholder={placeholder}
                  onChange={(e) => {
                    const v = e.target.value;
                    set(field, (numeric ? (v ? Math.round(Number(v)) : null) : v || null) as never);
                  }}
                />
              </Field>
              <Field label="Source" hint={raw != null && raw !== '' && !src?.label ? 'Not shown publicly until a source is added.' : undefined}>
                <input className="field min-h-[36px] text-xs" value={src?.label ?? ''} placeholder="e.g. Sobha annual report FY25" onChange={(e) => setSource(field, e.target.value ? { label: e.target.value } : null)} />
              </Field>
              <Field label="Checked on">
                <input className="field min-h-[36px] text-xs" type="date" value={src?.asOf ?? ''} disabled={!src} onChange={(e) => setSource(field, { asOf: e.target.value || today() })} />
              </Field>
            </div>
          );
        })}
      </div>

      <MediaUploader
        label="Logo"
        description="Square or wide logo on a plain background. Shown in the admin; the public site lists partners in text only."
        storagePath={`developers/${dev.id || 'new'}`}
        images={dev.logo ? [dev.logo] : []}
        onChange={(images) => set('logo', images[0] ?? null)}
        max={1}
        altPrefix={`${dev.name || 'Partner'} logo`}
      />

      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving || !dev.name.trim() || !dev.id.trim()} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === 'create' ? 'Create partner' : 'Save partner'}
        </button>
      </div>
    </form>
  );
}
