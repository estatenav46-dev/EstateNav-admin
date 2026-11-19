'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPinned, Plus } from 'lucide-react';
import type { Corridor, Developer } from '@/lib/data/types';
import { Field } from '@/components/ui/form';
import { Modal } from '@/components/ui/Modal';
import { CorridorForm, ZONE_OPTIONS, blankCorridor } from '@/components/corridors/CorridorForm';
import { resolvePartners } from '@/lib/partners';
import { SectionCard, useDraft } from './ui';

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

type Props = {
  developers: Developer[];
  corridors: Corridor[];
  onCorridorCreated: (corridor: Corridor) => void;
};

export function SectionLocation({ developers, corridors, onCorridorCreated }: Props) {
  const { register, setValue, watch, formState } = useDraft();
  const { errors } = formState;
  const developerId = watch('developerId');
  const corridorId = watch('corridorId');
  const geo = watch('geo');
  const address = watch('address');
  const locality = watch('locality');
  const [newArea, setNewArea] = useState(false);
  const [lat, setLat] = useState(geo ? String(geo.lat) : '');
  const [lng, setLng] = useState(geo ? String(geo.lng) : '');
  const [mapsLink, setMapsLink] = useState('');
  const [mapsProblem, setMapsProblem] = useState('');

  // Only the approved partners are offered; a listing saved earlier with another developer keeps it.
  const partners = useMemo(() => resolvePartners(developers), [developers]);
  const legacy = useMemo(() => {
    if (!developerId || partners.some((p) => p.id === developerId)) return null;
    return developers.find((d) => d.id === developerId) ?? null;
  }, [developerId, developers, partners]);
  const corridorGroups = useMemo(() => {
    const sorted = [...corridors].sort((a, b) => a.order - b.order);
    return [
      ...ZONE_OPTIONS.map((z) => ({ label: z.label, items: sorted.filter((c) => c.zone === z.id) })),
      { label: 'No region yet', items: sorted.filter((c) => !c.zone) },
    ].filter((g) => g.items.length);
  }, [corridors]);

  // Keep the copied names in step with the chosen partner and area.
  // (An id that is no longer in the list keeps its stored name.)
  useEffect(() => {
    const name = partners.find((p) => p.id === developerId)?.name ?? developers.find((d) => d.id === developerId)?.name;
    if (name || !developerId) setValue('developerName', name ?? '', { shouldDirty: false });
  }, [developerId, developers, partners, setValue]);
  useEffect(() => {
    const corr = corridors.find((c) => c.id === corridorId);
    if (corr || !corridorId) setValue('corridorName', corr?.name ?? '', { shouldDirty: false });
  }, [corridorId, corridors, setValue]);

  const applyGeo = (nextLat: string, nextLng: string) => {
    setLat(nextLat);
    setLng(nextLng);
    const a = Number(nextLat);
    const b = Number(nextLng);
    const valid = nextLat.trim() !== '' && nextLng.trim() !== '' && Number.isFinite(a) && Number.isFinite(b);
    setValue('geo', valid ? { lat: a, lng: b } : null, { shouldDirty: true });
  };

  const mapsUrl = geo
    ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address || locality || ''}, Bengaluru, Karnataka`)}`;

  return (
    <SectionCard id="location">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Partner developer"
          required
          error={errors.developerId?.message ? 'Choose the partner developer.' : undefined}
          hint={legacy ? `“${legacy.name}” is not on the partner list. It stays on this listing, but choose a listed partner if it applies.` : 'Partner details (about, track record) are edited on the Partners page.'}
        >
          <select {...register('developerId')} className="field">
            <option value="">Select partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {legacy && (
              <option value={legacy.id}>
                {legacy.name} (not on partner list)
              </option>
            )}
          </select>
        </Field>

        <Field label="Area (micro-market)" required error={errors.corridorId?.message ? 'Choose the area.' : undefined} hint="Grouped by Bengaluru region. Add a new area if it is missing.">
          <div className="flex gap-2">
            <select {...register('corridorId')} className="field flex-1">
              <option value="">Select area…</option>
              {corridorGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={() => setNewArea(true)} className="btn-secondary shrink-0 px-3 text-xs" title="Add a new area">
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </Field>

        <Field label="Locality / landmark" required error={errors.locality ? 'Add the locality.' : undefined} hint="Shown on cards, e.g. “Off Sarjapur Road, near Dommasandra Circle”.">
          <input {...register('locality')} className="field" placeholder="e.g. Off Sarjapur Road, Dommasandra" />
        </Field>

        <Field label="Full site address">
          <input {...register('address')} className="field" placeholder="e.g. Sy. No. 42/1, Dommasandra Village, Sarjapur Road, Bengaluru 562125" />
        </Field>
      </div>

      <div className="rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPinned className="h-4 w-4 text-accent" /> Map pin
          </p>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline">
            Check on Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Paste a Google Maps link" error={mapsProblem || undefined} hint="Open the site on Google Maps, copy the link from the address bar and paste it here.">
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
                } else setMapsProblem('No coordinates found in that link. Use the full link (with @12.9…,77.6…) or type them below.');
              }}
              className="field text-xs"
              placeholder="https://www.google.com/maps/place/…/@12.9101,77.6899,17z"
            />
          </Field>
          <Field label="Latitude">
            <input value={lat} onChange={(e) => applyGeo(e.target.value, lng)} className="field font-mono text-xs" inputMode="decimal" placeholder="12.9101" />
          </Field>
          <Field label="Longitude">
            <input value={lng} onChange={(e) => applyGeo(lat, e.target.value)} className="field font-mono text-xs" inputMode="decimal" placeholder="77.6899" />
          </Field>
        </div>
      </div>

      <Modal open={newArea} onClose={() => setNewArea(false)} title="Add an area" description="The new area is saved straight away and selected for this listing." width="lg">
        {newArea && (
          <CorridorForm
            initial={blankCorridor(corridors.length + 1)}
            mode="create"
            onCancel={() => setNewArea(false)}
            onSaved={(corridor) => {
              onCorridorCreated(corridor);
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
