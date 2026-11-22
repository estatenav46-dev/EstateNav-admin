'use client';

import { useFieldArray, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { EmptyRow, Field, SubSection, newId, toNullableFloat } from '@/components/ui/form';
import type { ChargeBasis } from '@/lib/data/types';
import { SectionCard, useDraft } from './ui';

const BASIS: [ChargeBasis, string][] = [
  ['lumpsum', '₹ fixed'],
  ['per-sqft', '₹ per sq.ft'],
  ['percent', '%'],
  ['per-month', '₹ per month'],
  ['per-sqft-month', '₹ per sq.ft per month'],
  ['actuals', 'At actuals'],
  ['included', 'Included'],
];

/** The lines most Bengaluru cost sheets carry. */
const COMMON: { label: string; basis: ChargeBasis; payable?: string; note?: string }[] = [
  { label: 'Car park', basis: 'lumpsum' },
  { label: 'Amenities & clubhouse', basis: 'lumpsum', payable: 'At possession' },
  { label: 'Electricity & water (BESCOM / BWSSB)', basis: 'per-sqft', payable: 'At possession' },
  { label: 'Generator & gas piping', basis: 'lumpsum', payable: 'At possession' },
  { label: 'Legal & documentation', basis: 'lumpsum', payable: 'At possession' },
  { label: 'Corpus fund', basis: 'per-sqft', payable: 'At possession' },
  { label: 'Advance maintenance', basis: 'per-sqft-month', payable: 'At possession', note: '12 months in advance' },
  { label: 'Floor rise', basis: 'per-sqft', note: 'per floor from the … floor' },
  { label: 'Preferential location (PLC)', basis: 'per-sqft' },
  { label: 'GST', basis: 'percent', note: 'on agreement value' },
  { label: 'Infrastructure development', basis: 'per-sqft' },
  { label: 'Stamp duty & registration', basis: 'actuals', payable: 'At registration' },
];

const PLAN_TYPES = ['Construction linked', 'Time linked', 'Down payment', '10:90', '20:80', '30:70', 'Subvention'];

export function SectionCharges() {
  const { control, register, formState } = useDraft();
  const charges = useFieldArray({ control, name: 'charges', keyName: 'key' });
  const stages = useFieldArray({ control, name: 'paymentPlan.stages', keyName: 'key' });
  const chargeValues = useWatch({ control, name: 'charges' }) ?? [];
  const stageValues = useWatch({ control, name: 'paymentPlan.stages' }) ?? [];
  const errors = formState.errors;
  const used = new Set(chargeValues.map((c) => c.label.trim().toLowerCase()));
  const total = stageValues.reduce((sum, s) => sum + (Number(s.percent) || 0), 0);

  return (
    <SectionCard id="charges">
      <SubSection
        title="Charges beyond the basic price"
        description="Copy each line of the developer's cost sheet. The website shows them under “Price breakdown”, so buyers see the full cost."
        action={
          <button type="button" onClick={() => charges.append({ id: newId('chg'), label: '', amount: null, basis: 'lumpsum', payable: '', note: '' })} className="btn-secondary min-h-[34px] px-3 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add a charge
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {COMMON.filter((c) => !used.has(c.label.toLowerCase())).map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => charges.append({ id: newId('chg'), label: c.label, amount: null, basis: c.basis, payable: c.payable ?? '', note: c.note ?? '' })}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft/40"
            >
              <Plus className="h-3 w-3" /> {c.label}
            </button>
          ))}
        </div>
        {charges.fields.length === 0 ? (
          <EmptyRow>No charges yet. Use the buttons above for the usual lines, or “Add a charge”.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {charges.fields.map((field, i) => {
              const basis = chargeValues[i]?.basis;
              const noAmount = basis === 'actuals' || basis === 'included';
              return (
                <li key={field.key} className="grid items-start gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[minmax(0,1.4fr)_110px_150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Field label="" hint={i === 0 ? 'Charge' : undefined} error={errors.charges?.[i]?.label ? 'Name the charge.' : undefined}>
                    <input {...register(`charges.${i}.label`)} className="field min-h-[36px] text-xs font-semibold" placeholder="e.g. Corpus fund" maxLength={120} />
                  </Field>
                  <Field label="" hint={i === 0 ? 'Amount' : undefined}>
                    <input type="number" min={0} step="0.01" disabled={noAmount} {...register(`charges.${i}.amount`, toNullableFloat)} className="field min-h-[36px] text-xs disabled:opacity-40" placeholder={noAmount ? '—' : '100'} />
                  </Field>
                  <Field label="" hint={i === 0 ? 'Basis' : undefined}>
                    <select {...register(`charges.${i}.basis`)} className="field min-h-[36px] text-xs">
                      {BASIS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="" hint={i === 0 ? 'Payable' : undefined}>
                    <input {...register(`charges.${i}.payable`)} className="field min-h-[36px] text-xs" placeholder="At possession" maxLength={120} />
                  </Field>
                  <Field label="" hint={i === 0 ? 'Note' : undefined}>
                    <input {...register(`charges.${i}.note`)} className="field min-h-[36px] text-xs" placeholder="e.g. from the 4th floor" maxLength={300} />
                  </Field>
                  <div className="flex items-center gap-1 sm:pt-0.5">
                    <button type="button" onClick={() => charges.move(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => charges.move(i, i + 1)} disabled={i === charges.fields.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => charges.remove(i)} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove charge">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SubSection>

      <SubSection title="Payment plan" description="The schedule from the cost sheet, as a % of the agreement value.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Plan type">
            <input {...register('paymentPlan.type')} list="plan-types" className="field" placeholder="Construction linked" maxLength={80} />
            <datalist id="plan-types">
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Booking amount (%)">
            <input type="number" min={0} max={100} step="0.01" {...register('paymentPlan.bookingPct', toNullableFloat)} className="field" placeholder="10" />
          </Field>
          <div className="flex items-end">
            <button type="button" onClick={() => stages.append({ id: newId('pay'), stage: '', percent: null, note: '' })} className="btn-secondary min-h-[42px] w-full text-xs">
              <Plus className="h-3.5 w-3.5" /> Add a stage
            </button>
          </div>
        </div>
        {stages.fields.length === 0 ? (
          <EmptyRow>No stages yet.</EmptyRow>
        ) : (
          <>
            <ol className="space-y-2">
              {stages.fields.map((field, i) => (
                <li key={field.key} className="grid items-start gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[28px_minmax(0,2fr)_90px_minmax(0,1fr)_auto]">
                  <span className="flex h-9 items-center justify-center font-mono text-2xs text-ink-muted">{i + 1}</span>
                  <Field label="" error={errors.paymentPlan?.stages?.[i]?.stage ? 'Name the stage.' : undefined}>
                    <input {...register(`paymentPlan.stages.${i}.stage`)} className="field min-h-[36px] text-xs" placeholder="e.g. On completion of the 4th floor slab" maxLength={200} />
                  </Field>
                  <Field label="">
                    <input type="number" min={0} max={100} step="0.01" {...register(`paymentPlan.stages.${i}.percent`, toNullableFloat)} className="field min-h-[36px] text-xs" placeholder="%" />
                  </Field>
                  <Field label="">
                    <input {...register(`paymentPlan.stages.${i}.note`)} className="field min-h-[36px] text-xs" placeholder="Note (optional)" maxLength={200} />
                  </Field>
                  <div className="flex items-center gap-1 sm:pt-0.5">
                    <button type="button" onClick={() => stages.move(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => stages.move(i, i + 1)} disabled={i === stages.fields.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => stages.remove(i)} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove stage">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <p className={`text-2xs ${Math.abs(total - 100) > 0.5 ? 'text-amber-700' : 'text-ink-muted'}`}>Stages add up to {Number(total.toFixed(2))}%{Math.abs(total - 100) > 0.5 ? ' (usually 100%)' : ''}.</p>
          </>
        )}
      </SubSection>
    </SectionCard>
  );
}
