'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, Copy, ImagePlus, Loader2, Plus, Trash2, Unlink } from 'lucide-react';
import type { Configuration, ImageRef } from '@/lib/data/types';
import { MAX_UPLOAD_BYTES, inspectImage, uploadImageToCloudinary } from '@/lib/media';
import { EmptyRow, Field, SubSection, inr, toNullableFloat, toNullableInt, toNullableText } from '@/components/ui/form';
import { MediaUploader } from '../MediaUploader';
import { newConfiguration } from './model';
import { SectionCard, useDraft } from './ui';

const QUICK: [string, number | null][] = [
  ['1 BHK', 1],
  ['2 BHK', 2],
  ['2.5 BHK', 2.5],
  ['3 BHK', 3],
  ['3.5 BHK', 3.5],
  ['4 BHK', 4],
  ['5 BHK', 5],
  ['Villa', null],
  ['Plot', null],
  ['Office', null],
  ['Retail', null],
];

/** Floor plan picker for one unit type: upload a new image or reuse one already uploaded. */
function FloorPlanSlot({ index, label }: { index: number; label: string }) {
  const { control, setValue, getValues } = useDraft();
  const planId = useWatch({ control, name: `configurations.${index}.floorPlanImageId` });
  const plans = useWatch({ control, name: 'media.floorPlans' }) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState('');
  const plan = plans.find((p) => p.id === planId);

  const upload = async (file: File) => {
    setProblem('');
    if (!file.type.startsWith('image/')) return setProblem('Upload an image (JPEG or PNG). Put PDF plan sets under Documents.');
    if (file.size > MAX_UPLOAD_BYTES) return setProblem('Image is larger than 10 MB.');
    try {
      setBusy(1);
      const meta = await inspectImage(file);
      const title = getValues('title') || 'Project';
      const current = getValues('media.floorPlans') ?? [];
      const ref = await uploadImageToCloudinary(file, `properties/${getValues('id')}/floorplans`, { alt: `${title} ${label} floor plan`, order: current.length, ...meta }, ({ loaded, total }) =>
        setBusy(Math.max(1, Math.round((loaded / total) * 100))),
      );
      setValue('media.floorPlans', [...(getValues('media.floorPlans') ?? []), ref], { shouldDirty: true });
      setValue(`configurations.${index}.floorPlanImageId`, ref.id, { shouldDirty: true });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(0);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Floor plan</p>
      {plan ? (
        <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-white">
          <Image src={plan.url} alt={plan.alt} fill sizes="240px" className="object-contain" />
          <button type="button" onClick={() => setValue(`configurations.${index}.floorPlanImageId`, null, { shouldDirty: true })} className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-1 text-2xs text-white hover:bg-danger" title="Unlink this floor plan">
            <Unlink className="h-3 w-3" /> Unlink
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy > 0}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-center text-2xs text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? `Uploading ${busy}%` : 'Upload floor plan image'}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      {plans.length > 0 && (
        <select value={planId ?? ''} onChange={(e) => setValue(`configurations.${index}.floorPlanImageId`, e.target.value || null, { shouldDirty: true })} className="field min-h-[32px] text-2xs">
          <option value="">{plan ? 'No floor plan' : 'Or pick an uploaded plan…'}</option>
          {plans.map((p: ImageRef, i: number) => (
            <option key={p.id} value={p.id}>
              {p.alt || `Floor plan ${i + 1}`}
            </option>
          ))}
        </select>
      )}
      {plan && (
        <button type="button" onClick={() => input.current?.click()} className="text-2xs font-medium text-accent-ink hover:underline">
          Replace with a new upload
        </button>
      )}
      {problem && <p className="text-2xs text-danger">{problem}</p>}
    </div>
  );
}

function summarise(configs: Configuration[]) {
  const prices = configs.map((c) => c.priceMin).filter((n): n is number => typeof n === 'number' && n > 0);
  const tops = configs.map((c) => c.priceMax ?? c.priceMin).filter((n): n is number => typeof n === 'number' && n > 0);
  const useSuper = configs.some((c) => c.superSqftMin != null);
  const sizes = configs.flatMap((c) => (useSuper ? [c.superSqftMin, c.superSqftMax] : [c.carpetSqftMin, c.carpetSqftMax])).filter((n): n is number => typeof n === 'number' && n > 0);
  const rates = configs
    .map((c) => {
      const area = c.superSqftMin ?? c.carpetSqftMin;
      return c.priceMin && area ? c.priceMin / area : null;
    })
    .filter((n): n is number => n != null && Number.isFinite(n));
  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = tops.length ? Math.max(...tops) : null;
  return {
    priceMin,
    priceMax: priceMin && priceMax && priceMax > priceMin ? priceMax : null,
    sizeMin: sizes.length ? Math.min(...sizes) : null,
    sizeMax: sizes.length && Math.max(...sizes) > Math.min(...sizes) ? Math.max(...sizes) : null,
    pricePerSqft: rates.length ? Math.round(Math.min(...rates)) : null,
  };
}

export function SectionUnits({ isNew }: { isNew: boolean }) {
  const { control, register, setValue, getValues, watch, formState } = useDraft();
  const { errors } = formState;
  const configs = useFieldArray({ control, name: 'configurations', keyName: 'key' });
  const watched = (useWatch({ control, name: 'configurations' }) ?? []) as Configuration[];
  const segment = watch('segment');
  const transaction = watch('transaction');
  const priceOnRequest = watch('priceOnRequest');
  const offer = watch('offer');
  const priceMin = watch('priceMin');
  const priceMaxValue = watch('priceMax');
  const floorPlans = watch('media.floorPlans') ?? [];
  const [auto, setAuto] = useState(isNew || !getValues('priceMin'));
  const plot = segment === 'plot';
  const commercial = segment === 'commercial';

  const signature = JSON.stringify(watched.map((c) => [c.priceMin, c.priceMax, c.carpetSqftMin, c.carpetSqftMax, c.superSqftMin, c.superSqftMax]));
  useEffect(() => {
    if (!auto) return;
    const s = summarise(watched);
    const opts = { shouldDirty: true, shouldValidate: false } as const;
    if (s.priceMin) setValue('priceMin', s.priceMin, opts);
    setValue('priceMax', s.priceMax, opts);
    if (s.sizeMin) setValue('sizeMin', s.sizeMin, opts);
    setValue('sizeMax', s.sizeMax, opts);
    if (s.pricePerSqft) setValue('pricePerSqft', s.pricePerSqft, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, signature, setValue]);

  const add = (label: string, bhk: number | null) => configs.append(newConfiguration(label, bhk));
  const unlinkRemovedPlans = (next: ImageRef[]) => {
    const ids = new Set(next.map((p) => p.id));
    (getValues('configurations') ?? []).forEach((c, i) => {
      if (c.floorPlanImageId && !ids.has(c.floorPlanImageId)) setValue(`configurations.${i}.floorPlanImageId`, null, { shouldDirty: true });
    });
    setValue('media.floorPlans', next, { shouldDirty: true });
  };

  return (
    <SectionCard id="units">
      <SubSection
        title="Unit types"
        description={plot ? 'One row per plot size. Plot area goes in the area fields.' : 'One row per configuration or size variant, e.g. two different 3 BHK sizes get two rows.'}
      >
        <div className="flex flex-wrap gap-1.5">
          {QUICK.filter(([label]) => (plot ? ['Plot', 'Villa'].includes(label) : commercial ? ['Office', 'Retail'].includes(label) : !['Plot', 'Office', 'Retail'].includes(label))).map(([label, bhk]) => (
            <button key={label} type="button" onClick={() => add(label, bhk)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft/40">
              <Plus className="h-3 w-3" /> {label}
            </button>
          ))}
          <button type="button" onClick={() => add('', null)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:border-accent">
            <Plus className="h-3 w-3" /> Custom
          </button>
        </div>
        {errors.configurations?.message && <p className="text-2xs text-danger">{errors.configurations.message}</p>}

        {configs.fields.length === 0 ? (
          <EmptyRow>No unit types yet. Use the buttons above to add each configuration from the price sheet.</EmptyRow>
        ) : (
          <ol className="space-y-4">
            {configs.fields.map((field, i) => {
              const e = errors.configurations?.[i];
              const c = watched[i] ?? field;
              return (
                <li key={field.key} className="rounded-xl border border-line bg-surface-2/30 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-2xs text-white">{i + 1}</span>
                      {c.label || 'Unit type'}
                      {c.priceMin ? <span className="font-normal text-ink-muted">· {inr(c.priceMin)}{c.priceMax ? ` – ${inr(c.priceMax)}` : ''}</span> : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => configs.move(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => configs.move(i, i + 1)} disabled={i === configs.fields.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => configs.insert(i + 1, { ...getValues(`configurations.${i}`), id: newConfiguration('', null).id, floorPlanImageId: null })} className="rounded p-1.5 text-ink-muted hover:bg-surface-2" title="Duplicate (for another size of the same type)">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => configs.remove(i)} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove unit type">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field label="Name" required error={e?.label ? 'Name this unit type.' : undefined} className="col-span-2">
                        <input {...register(`configurations.${i}.label`)} className="field min-h-[36px] text-sm font-medium" placeholder="e.g. 3 BHK + Study" />
                      </Field>
                      {!plot && !commercial && (
                        <>
                          <Field label="BHK" error={e?.bhk?.message}>
                            <input type="number" step="0.5" min={0.5} {...register(`configurations.${i}.bhk`, toNullableFloat)} className="field min-h-[36px] text-xs" placeholder="3" />
                          </Field>
                          <Field label="Bathrooms" error={e?.bathrooms?.message}>
                            <input type="number" min={1} {...register(`configurations.${i}.bathrooms`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="3" />
                          </Field>
                        </>
                      )}
                      {(plot || commercial) && <div className="col-span-2 hidden sm:block" />}

                      <Field label={plot ? 'Plot area from (sq.ft)' : 'Carpet area from (sq.ft)'} error={e?.carpetSqftMin?.message}>
                        <input type="number" min={1} {...register(`configurations.${i}.carpetSqftMin`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder={plot ? '1200' : '1150'} />
                      </Field>
                      <Field label={plot ? 'Plot area to' : 'Carpet area to'} error={e?.carpetSqftMax?.message}>
                        <input type="number" min={1} {...register(`configurations.${i}.carpetSqftMax`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="optional" />
                      </Field>
                      {plot ? (
                        <Field label="Dimensions" className="col-span-2" error={e?.dimensions?.message}>
                          <input {...register(`configurations.${i}.dimensions`, toNullableText)} className="field min-h-[36px] text-xs" placeholder="e.g. 30 × 40 ft, 40 × 60 ft" />
                        </Field>
                      ) : (
                        <>
                          <Field label="Super built-up from" error={e?.superSqftMin?.message}>
                            <input type="number" min={1} {...register(`configurations.${i}.superSqftMin`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="1650" />
                          </Field>
                          <Field label="Super built-up to" error={e?.superSqftMax?.message}>
                            <input type="number" min={1} {...register(`configurations.${i}.superSqftMax`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="optional" />
                          </Field>
                        </>
                      )}

                      <Field label={transaction === 'rent' ? 'Rent from (₹/month)' : 'Price from (₹)'} hint={inr(c.priceMin) || undefined} error={e?.priceMin?.message}>
                        <input type="number" min={1} {...register(`configurations.${i}.priceMin`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="18500000" />
                      </Field>
                      <Field label="Price to (₹)" hint={inr(c.priceMax) || undefined} error={e?.priceMax?.message}>
                        <input type="number" min={1} {...register(`configurations.${i}.priceMax`, toNullableInt)} className="field min-h-[36px] text-xs" placeholder="optional" />
                      </Field>
                      <Field label="Availability">
                        <select {...register(`configurations.${i}.availability`)} className="field min-h-[36px] text-xs">
                          <option value="available">Available</option>
                          <option value="limited">Few units left</option>
                          <option value="sold-out">Sold out</option>
                        </select>
                      </Field>
                      <Field label="Note" error={e?.notes?.message}>
                        <input {...register(`configurations.${i}.notes`)} className="field min-h-[36px] text-xs" placeholder="e.g. Duplex, with terrace" maxLength={200} />
                      </Field>
                    </div>
                    <FloorPlanSlot index={i} label={c.label || `unit ${i + 1}`} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </SubSection>

      <SubSection title="All floor plan images" description="Every plan uploaded for this listing. Plans linked to a unit type show beside it on the website; the rest appear in the floor-plan gallery.">
        <MediaUploader
          label=""
          images={floorPlans}
          onChange={unlinkRemovedPlans}
          storagePath={`properties/${getValues('id')}/floorplans`}
          altPrefix={`${watch('title') || 'Project'} floor plan`}
        />
      </SubSection>

      <SubSection title="Price summary" description="Shown on cards and in search. Budget filters always use the starting price, even when prices are hidden.">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Calculate from the unit types
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" {...register('priceOnRequest')} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Show “Price on request” instead of prices
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={transaction === 'rent' ? 'Rent from (₹/month)' : 'Starting price (₹)'} required error={errors.priceMin ? 'Enter the starting price.' : undefined} hint={inr(priceMin) || (priceOnRequest ? 'Indicative, for filters only' : undefined)}>
            <input type="number" min={1} readOnly={auto && summarise(watched).priceMin != null} {...register('priceMin', toNullableInt)} className="field read-only:bg-surface-2" placeholder="e.g. 13500000" />
          </Field>
          <Field label="Up to (₹)" hint={inr(priceMaxValue) || undefined} error={errors.priceMax?.message}>
            <input type="number" min={1} readOnly={auto} {...register('priceMax', toNullableInt)} className="field read-only:bg-surface-2" placeholder="optional" />
          </Field>
          <Field label="Rate (₹ per sq.ft)" error={errors.pricePerSqft?.message}>
            <input type="number" min={1} readOnly={auto && summarise(watched).pricePerSqft != null} {...register('pricePerSqft', toNullableFloat)} className="field read-only:bg-surface-2" placeholder="e.g. 11500" />
          </Field>
          <Field label="Smallest size (sq.ft)" error={errors.sizeMin?.message}>
            <input type="number" min={1} readOnly={auto && summarise(watched).sizeMin != null} {...register('sizeMin', toNullableInt)} className="field read-only:bg-surface-2" />
          </Field>
          <Field label="Largest size (sq.ft)" error={errors.sizeMax?.message}>
            <input type="number" min={1} readOnly={auto} {...register('sizeMax', toNullableInt)} className="field read-only:bg-surface-2" />
          </Field>
          {transaction === 'rent' ? (
            <Field label="Monthly rent (₹)" error={errors.rentPerMonth?.message}>
              <input type="number" min={1} {...register('rentPerMonth', toNullableInt)} className="field" />
            </Field>
          ) : (
            <Field label="Price note" hint="Printed beside the price, e.g. “+ GST & registration” or “All-inclusive”.">
              <input {...register('priceNote')} className="field" placeholder="+ GST, registration & other charges" maxLength={160} />
            </Field>
          )}
        </div>
      </SubSection>

      <SubSection title="Current offer" description="Optional. Shown as a badge on the project page until the date passes.">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(offer)} onChange={(e) => setValue('offer', e.target.checked ? { text: '', validUntil: null } : null, { shouldDirty: true })} className="h-4 w-4 accent-[rgb(var(--accent))]" />
          This project has a running offer
        </label>
        {offer && (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Offer" required error={errors.offer?.text ? 'Describe the offer.' : undefined}>
              <input {...register('offer.text')} className="field" placeholder="e.g. No floor-rise charges for bookings this month" maxLength={200} />
            </Field>
            <Field label="Valid until">
              <input type="date" {...register('offer.validUntil', toNullableText)} className="field" />
            </Field>
          </div>
        )}
      </SubSection>
    </SectionCard>
  );
}
