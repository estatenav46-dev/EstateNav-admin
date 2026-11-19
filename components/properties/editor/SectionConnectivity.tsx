'use client';

import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { NearbyCategory, OfficeHub } from '@/lib/data/types';
import { NEARBY_CATEGORY_LABEL } from '@/lib/listingMeta';
import { EmptyRow, Field, SubSection, newId, toNullableFloat, toNullableInt } from '@/components/ui/form';
import { SectionCard, useDraft } from './ui';

const QUICK: NearbyCategory[] = ['metro', 'it-park', 'school', 'hospital', 'mall', 'airport', 'railway', 'highway'];

export function SectionConnectivity({ hubs }: { hubs: OfficeHub[] }) {
  const { control, register, formState } = useDraft();
  const nearby = useFieldArray({ control, name: 'nearby', keyName: 'key' });
  const commute = useFieldArray({ control, name: 'commute', keyName: 'key' });
  const nErrors = formState.errors.nearby;
  const cErrors = formState.errors.commute;

  return (
    <SectionCard id="connectivity">
      <SubSection title="Nearby places" description="Distances from the project, as given by the developer or measured on Google Maps. Aim for at least one metro, IT park, school and hospital.">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => nearby.append({ id: newId('near'), category, name: '', distanceKm: null, travelMins: null })}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft/40"
            >
              <Plus className="h-3 w-3" /> {NEARBY_CATEGORY_LABEL[category]}
            </button>
          ))}
        </div>
        {nearby.fields.length === 0 ? (
          <EmptyRow>No nearby places yet. Use the buttons above, e.g. “Kadubeesanahalli Metro — 2.5 km, 8 min”.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {nearby.fields.map((field, i) => (
              <li key={field.key} className="grid items-start gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[180px_minmax(0,1fr)_110px_110px_auto]">
                <select {...register(`nearby.${i}.category`)} className="field min-h-[36px] text-xs">
                  {(Object.keys(NEARBY_CATEGORY_LABEL) as NearbyCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {NEARBY_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                <Field label="" error={nErrors?.[i]?.name ? 'Name the place.' : undefined}>
                  <input {...register(`nearby.${i}.name`)} className="field min-h-[36px] text-xs" placeholder="e.g. Kadubeesanahalli Metro Station" />
                </Field>
                <Field label="" error={nErrors?.[i]?.distanceKm?.message}>
                  <div className="relative">
                    <input type="number" step="0.1" min={0} {...register(`nearby.${i}.distanceKm`, toNullableFloat)} className="field min-h-[36px] pr-9 text-xs" placeholder="2.5" />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-ink-muted">km</span>
                  </div>
                </Field>
                <Field label="" error={nErrors?.[i]?.travelMins?.message}>
                  <div className="relative">
                    <input type="number" min={1} {...register(`nearby.${i}.travelMins`, toNullableInt)} className="field min-h-[36px] pr-10 text-xs" placeholder="8" />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-ink-muted">min</span>
                  </div>
                </Field>
                <button type="button" onClick={() => nearby.remove(i)} className="justify-self-end rounded p-2 text-danger hover:bg-danger/10" aria-label="Remove place">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SubSection>

      <SubSection
        title="Commute to office hubs"
        description="Measured drive times, shown on the commute radar with their source and date."
        action={
          hubs.length > 0 ? (
            <button
              type="button"
              onClick={() => commute.append({ hubId: hubs[0].id, peakMins: 45, offPeakMins: 25, source: 'Google Maps, measured', asOf: new Date().toISOString().slice(0, 10) })}
              className="btn-secondary min-h-[34px] px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add drive time
            </button>
          ) : undefined
        }
      >
        {hubs.length === 0 ? (
          <EmptyRow>No office hubs are set up in the database yet.</EmptyRow>
        ) : commute.fields.length === 0 ? (
          <EmptyRow>No drive times yet. Optional: add peak and off-peak minutes to hubs like Manyata or ITPL.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {commute.fields.map((field, i) => (
              <li key={field.key} className="grid items-end gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1.2fr_1fr_auto]">
                <Field label="Hub">
                  <select {...register(`commute.${i}.hubId`)} className="field min-h-[36px] text-xs">
                    {hubs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Peak (min)" error={cErrors?.[i]?.peakMins ? 'Minutes' : undefined}>
                  <input type="number" min={1} {...register(`commute.${i}.peakMins`, { valueAsNumber: true })} className="field min-h-[36px] text-xs" />
                </Field>
                <Field label="Off-peak (min)" error={cErrors?.[i]?.offPeakMins ? 'Minutes' : undefined}>
                  <input type="number" min={1} {...register(`commute.${i}.offPeakMins`, { valueAsNumber: true })} className="field min-h-[36px] text-xs" />
                </Field>
                <Field label="Source" error={cErrors?.[i]?.source ? 'Add the source' : undefined}>
                  <input {...register(`commute.${i}.source`)} className="field min-h-[36px] text-xs" />
                </Field>
                <Field label="Measured on" error={cErrors?.[i]?.asOf ? 'Date' : undefined}>
                  <input type="date" {...register(`commute.${i}.asOf`)} className="field min-h-[36px] text-xs" />
                </Field>
                <button type="button" onClick={() => commute.remove(i)} className="rounded p-2 text-danger hover:bg-danger/10" aria-label="Remove drive time">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SubSection>
    </SectionCard>
  );
}
