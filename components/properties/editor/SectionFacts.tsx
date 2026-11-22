'use client';

import { Field, toNullableFloat, toNullableInt, toNullableText } from '@/components/ui/form';
import { SectionCard, useDraft } from './ui';

export function SectionFacts() {
  const { register, watch, formState } = useDraft();
  const errors = formState.errors.facts;
  const acres = watch('facts.landAcres');
  const units = watch('facts.totalUnits');
  const density = acres && units ? Math.round(units / acres) : null;

  return (
    <SectionCard
      id="facts"
      aside={density ? <p className="rounded-full bg-surface-2 px-3 py-1 text-2xs font-medium text-ink-muted">Density ≈ {density} units / acre</p> : undefined}
    >
      <p className="-mt-2 text-2xs text-ink-muted">Fill what the brochure or RERA filing states; empty fields are simply not shown on the website.</p>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Land area (acres)" error={errors?.landAcres?.message}>
          <input type="number" step="0.01" min={0} {...register('facts.landAcres', toNullableFloat)} className="field" placeholder="e.g. 13.4" />
        </Field>
        <Field label="Total units" error={errors?.totalUnits?.message}>
          <input type="number" min={1} {...register('facts.totalUnits', toNullableInt)} className="field" placeholder="e.g. 1,140" />
        </Field>
        <Field label="Towers / blocks" error={errors?.towers?.message}>
          <input type="number" min={1} {...register('facts.towers', toNullableInt)} className="field" placeholder="e.g. 9" />
        </Field>
        <Field label="Floors" hint="As written, e.g. “2B + G + 32”." error={errors?.floors?.message}>
          <input {...register('facts.floors', toNullableText)} className="field" placeholder="2B + G + 32" />
        </Field>
        <Field label="Open space (%)" error={errors?.openSpacePct?.message}>
          <input type="number" step="0.1" min={0} max={100} {...register('facts.openSpacePct', toNullableFloat)} className="field" placeholder="e.g. 80" />
        </Field>
        <Field label="Clubhouse (sq.ft)" error={errors?.clubhouseSqft?.message}>
          <input type="number" min={1} {...register('facts.clubhouseSqft', toNullableInt)} className="field" placeholder="e.g. 50000" />
        </Field>
        <Field label="Launch date" error={errors?.launchDate?.message}>
          <input type="date" {...register('facts.launchDate', toNullableText)} className="field" />
        </Field>
        <Field label="Clubhouse details" className="sm:col-span-2" error={errors?.clubhouseDetails?.message}>
          <input {...register('facts.clubhouseDetails', toNullableText)} className="field" placeholder="e.g. G + 3, plus a 5,000 sq.ft kids&apos; clubhouse" maxLength={200} />
        </Field>
        <Field label="Facings available" error={errors?.facing?.message}>
          <input {...register('facts.facing', toNullableText)} className="field" placeholder="e.g. East & North" maxLength={120} />
        </Field>
      </div>
    </SectionCard>
  );
}
