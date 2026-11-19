'use client';

import { useFieldArray, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { EXTRA_DETAIL_SUGGESTIONS } from '@/lib/listingMeta';
import { EmptyRow, Field, SubSection, newId } from '@/components/ui/form';
import { SectionCard, useDraft } from './ui';

export function SectionExtras() {
  const { control, register, formState } = useDraft();
  const extras = useFieldArray({ control, name: 'extraDetails', keyName: 'key' });
  const values = useWatch({ control, name: 'extraDetails' }) ?? [];
  const errors = formState.errors.extraDetails;
  const used = new Set(values.map((v) => v.label.trim().toLowerCase()));
  const groups = Array.from(new Set(['Charges', 'Payment', 'Project', ...values.map((v) => v.group).filter(Boolean)]));
  const placeholderFor = (label: string) => EXTRA_DETAIL_SUGGESTIONS.find((s) => s.label.toLowerCase() === label.trim().toLowerCase())?.placeholder ?? 'Value';

  return (
    <SectionCard id="extras">
      <SubSection
        title="Custom details"
        description="Add any detail the form does not have a field for. Each row shows on the project page under its group heading, in this order."
        action={
          <button type="button" onClick={() => extras.append({ id: newId('x'), group: 'More details', label: '', value: '' })} className="btn-secondary min-h-[34px] px-3 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add a detail
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {EXTRA_DETAIL_SUGGESTIONS.filter((s) => !used.has(s.label.toLowerCase())).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => extras.append({ id: newId('x'), group: s.group, label: s.label, value: '' })}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:bg-accent-soft/40"
            >
              <Plus className="h-3 w-3" /> {s.label}
            </button>
          ))}
        </div>
        <datalist id="extra-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        {extras.fields.length === 0 ? (
          <EmptyRow>Nothing extra yet. Use the suggestions above or “Add a detail” for anything else, e.g. “Clubhouse name: The Grand Pavilion”.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {extras.fields.map((field, i) => (
              <li key={field.key} className="grid items-start gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[150px_200px_minmax(0,1fr)_auto]">
                <Field label="" hint={i === 0 ? 'Group' : undefined}>
                  <input {...register(`extraDetails.${i}.group`)} list="extra-groups" className="field min-h-[36px] text-xs" placeholder="Group" />
                </Field>
                <Field label="" error={errors?.[i]?.label ? 'Add a label.' : undefined} hint={i === 0 ? 'Label' : undefined}>
                  <input {...register(`extraDetails.${i}.label`)} className="field min-h-[36px] text-xs font-semibold" placeholder="e.g. Maintenance charges" />
                </Field>
                <Field label="" error={errors?.[i]?.value ? 'Add a value or remove the row.' : undefined} hint={i === 0 ? 'Value' : undefined}>
                  <input {...register(`extraDetails.${i}.value`)} className="field min-h-[36px] text-xs" placeholder={placeholderFor(values[i]?.label ?? '')} />
                </Field>
                <div className="flex items-center gap-1 sm:pt-0.5">
                  <button type="button" onClick={() => extras.move(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => extras.move(i, i + 1)} disabled={i === extras.fields.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => extras.remove(i)} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove detail">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SubSection>
    </SectionCard>
  );
}
