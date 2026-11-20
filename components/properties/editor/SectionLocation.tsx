'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPinned, Plus } from 'lucide-react';
import type { Corridor, Developer } from '@/lib/data/types';
import { Field } from '@/components/ui/form';
import { Modal } from '@/components/ui/Modal';
import { CorridorForm, ZONE_OPTIONS, blankCorridor } from '@/components/corridors/CorridorForm';
import { partnerOptions } from '@/lib/partners';
import { DeveloperForm, blankDeveloper } from '@/components/developers/DeveloperForm';
import { SectionCard, useDraft } from './ui';

type Zone = NonNullable<Corridor['zone']>;

/** Pulls coordinates out of a Google Maps link or a plain "12.97, 77.59" pair. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const patterns = [/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[28px_minmax(0,1fr)]">
      <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-surface-2 font-mono text-2xs font-bold text-ink-muted sm:flex">{n}</span>
      <div className="min-w-0 space-y-2.5">
        <p className="text-xs font-semibold text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

type Props = {
  developers: Developer[];
  corridors: Corridor[];
  onCorridorCreated: (corridor: Corridor) => void;
  onDeveloperCreated: (developer: Developer) => void;
};

export function SectionLocation({ developers, corridors, onCorridorCreated, onDeveloperCreated }: Props) {
  const { register, setValue, watch, formState } = useDraft();
  const { errors } = formState;
  const developerId = watch('developerId');
  const corridorId = watch('corridorId');
  const geo = watch('geo');
  const address = watch('address');
  const locality = watch('locality');
  const current = corridors.find((c) => c.id === corridorId);
  const [region, setRegion] = useState<Zone | null>(current?.zone ?? null);
  const [newArea, setNewArea] = useState(false);
  const [newPartner, setNewPartner] = useState(false);
  const [lat, setLat] = useState(geo ? String(geo.lat) : '');
  const [lng, setLng] = useState(geo ? String(geo.lng) : '');
  const [mapsLink, setMapsLink] = useState('');
  const [mapsProblem, setMapsProblem] = useState('');

  // Every partner on the Partners page is offered; hidden ones are marked.
  const partners = useMemo(() => partnerOptions(developers), [developers]);
  const chosenHidden = partners.find((p) => p.id === developerId)?.hidden ?? false;

  const counts = useMemo(() => {
    const out: Partial<Record<Zone, number>> = {};
    for (const c of corridors) if (c.zone) out[c.zone] = (out[c.zone] ?? 0) + 1;
    return out;
  }, [corridors]);
  const unassigned = corridors.filter((c) => !c.zone);
  const areas = useMemo(() => [...corridors].filter((c) => (region ? c.zone === region : true)).sort((a, b) => a.order - b.order), [corridors, region]);

  // Copied names follow the chosen partner and area (an ID no longer in the list keeps its stored name).
  useEffect(() => {
    const name = partners.find((p) => p.id === developerId)?.name;
    if (name || !developerId) setValue('developerName', name ?? '', { shouldDirty: false });
  }, [developerId, developers, partners, setValue]);
  useEffect(() => {
    if (current || !corridorId) setValue('corridorName', current?.name ?? '', { shouldDirty: false });
  }, [corridorId, current, setValue]);

  const pickRegion = (zone: Zone) => {
    setRegion(zone);
    // Changing region clears an area that belongs to another region.
    if (current && current.zone !== zone) setValue('corridorId', '', { shouldDirty: true });
  };

  const applyGeo = (nextLat: string, nextLng: string) => {
    setLat(nextLat);
    setLng(nextLng);
    const a = Number(nextLat);
    const b = Number(nextLng);
    const valid = nextLat.trim() !== '' && nextLng.trim() !== '' && Number.isFinite(a) && Number.isFinite(b);
    setValue('geo', valid ? { lat: a, lng: b } : null, { shouldDirty: true });
  };

  const regionLabel = ZONE_OPTIONS.find((z) => z.id === region)?.label;
  const mapsUrl = geo
    ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address || locality || current?.name || ''}, Bengaluru, Karnataka`)}`;

  return (
    <SectionCard id="location">
      <Step n={1} title="Region of Bengaluru">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {ZONE_OPTIONS.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => pickRegion(z.id)}
              aria-pressed={region === z.id}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${region === z.id ? 'border-accent bg-accent-soft/50 ring-1 ring-accent' : 'border-line hover:border-line-strong hover:bg-surface-2/60'}`}
            >
              <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
                {z.label}
                <span className="font-mono text-2xs font-normal text-ink-muted">{counts[z.id] ?? 0}</span>
              </span>
              <span className="mt-0.5 block truncate text-2xs text-ink-muted">{z.examples}</span>
            </button>
          ))}
        </div>
        {unassigned.length > 0 && !region && <p className="text-2xs text-amber-700">{unassigned.length} area(s) have no region yet; set it under Regions &amp; areas.</p>}
      </Step>

      <Step n={2} title={regionLabel ? `Area in ${regionLabel}` : 'Area (micro-market)'}>
        <div className="flex gap-2">
          <select {...register('corridorId')} className="field flex-1" disabled={!region && corridors.length > 0 && !current}>
            <option value="">{region ? (areas.length ? 'Select area…' : 'No areas in this region yet — add one') : 'Pick a region first'}</option>
            {areas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setNewArea(true)} disabled={!region} className="btn-secondary shrink-0 text-xs" title={region ? `Add an area in ${regionLabel}` : 'Pick a region first'}>
            <Plus className="h-3.5 w-3.5" /> New area
          </button>
        </div>
        {errors.corridorId && <p className="text-2xs text-danger">Choose the area.</p>}
      </Step>

      <Step n={3} title="Locality, address & map pin">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Locality / landmark" required error={errors.locality ? 'Add the locality.' : undefined} hint="Shown on cards, e.g. “Off Sarjapur Road, near Dommasandra Circle”.">
            <input {...register('locality')} className="field" placeholder="e.g. Off Sarjapur Road, Dommasandra" />
          </Field>
          <Field label="Full site address">
            <input {...register('address')} className="field" placeholder="e.g. Sy. No. 42/1, Dommasandra Village, Sarjapur Road, Bengaluru 562125" />
          </Field>
        </div>
        <div className="grid gap-3 rounded-lg border border-line bg-surface-2/40 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Google Maps link" error={mapsProblem || undefined}>
            <input
              value={mapsLink}
              onChange={(e) => {
                const value = e.target.value;
                setMapsLink(value);
                if (!value.trim()) return setMapsProblem('');
                const coords = parseCoordinates(value);
                if (coords) {
                  setMapsProblem('');
                  applyGeo(String(coords.lat), String(coords.lng));
                } else setMapsProblem('No coordinates in that link. Use the full link (with @12.9…,77.6…) or type them.');
              }}
              className="field text-xs"
              placeholder="Paste the link from the browser address bar"
            />
          </Field>
          <Field label="Latitude">
            <input value={lat} onChange={(e) => applyGeo(e.target.value, lng)} className="field font-mono text-xs" inputMode="decimal" placeholder="12.9101" />
          </Field>
          <Field label="Longitude">
            <input value={lng} onChange={(e) => applyGeo(lat, e.target.value)} className="field font-mono text-xs" inputMode="decimal" placeholder="77.6899" />
          </Field>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs text-accent-ink">
            <MapPinned className="h-3.5 w-3.5" /> Check <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Step>

      <Step n={4} title="Partner developer">
        <div className="flex gap-2 sm:max-w-md">
          <select {...register('developerId')} className="field flex-1">
            <option value="">Select partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.hidden ? ' (hidden on website)' : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setNewPartner(true)} className="btn-secondary shrink-0 text-xs" title="Add a new partner">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
        {errors.developerId ? (
          <p className="text-2xs text-danger">Choose the partner developer.</p>
        ) : (
          <p className={`text-2xs ${chosenHidden ? 'text-amber-700' : 'text-ink-muted'}`}>
            {chosenHidden ? 'This partner is hidden, so this listing will not show on the website until the partner is shown again.' : 'Profiles, logos and visibility are managed on the Partners page.'}
          </p>
        )}
      </Step>

      <Modal open={newPartner} onClose={() => setNewPartner(false)} title="Add a partner" description="Saved straight away and selected for this listing." width="lg">
        {newPartner && (
          <DeveloperForm
            initial={blankDeveloper()}
            mode="create"
            onCancel={() => setNewPartner(false)}
            onSaved={(dev) => {
              onDeveloperCreated(dev);
              setValue('developerId', dev.id, { shouldDirty: true, shouldValidate: true });
              setValue('developerName', dev.name, { shouldDirty: true });
              setNewPartner(false);
            }}
          />
        )}
      </Modal>

      <Modal open={newArea} onClose={() => setNewArea(false)} title={`Add an area${regionLabel ? ` in ${regionLabel}` : ''}`} description="The new area is saved straight away and selected for this listing." width="lg">
        {newArea && (
          <CorridorForm
            initial={blankCorridor(corridors.length + 1, '', region)}
            mode="create"
            onCancel={() => setNewArea(false)}
            onSaved={(corridor) => {
              onCorridorCreated(corridor);
              if (corridor.zone) setRegion(corridor.zone);
              setValue('corridorId', corridor.id, { shouldDirty: true, shouldValidate: true });
              setValue('corridorName', corridor.name, { shouldDirty: true });
              setNewArea(false);
            }}
          />
        )}
      </Modal>
    </SectionCard>
  );
}
