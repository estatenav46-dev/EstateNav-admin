'use client';

import { useFieldArray } from 'react-hook-form';
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { AMENITY_GROUPS, SPEC_CATEGORIES } from '@/lib/listingMeta';
import { EmptyRow, Field, SubSection, newId } from '@/components/ui/form';
import { AddCustom, Chip, SectionCard, useDraft } from './ui';

export function SectionAmenities() {
  const { control, register, watch, setValue, getValues, formState } = useDraft();
  const amenities = watch('amenities') ?? [];
  const specs = useFieldArray({ control, name: 'specifications', keyName: 'key' });
  const errors = formState.errors.specifications;
  const preset = new Set(AMENITY_GROUPS.flatMap((g) => g.items.map((i) => i.toLowerCase())));
  const custom = amenities.filter((a) => !preset.has(a.toLowerCase()));

  const toggle = (item: string) =>
    setValue('amenities', amenities.includes(item) ? amenities.filter((a) => a !== item) : [...amenities, item], { shouldDirty: true });

  const addStandardSpecs = () => {
    const present = new Set((getValues('specifications') ?? []).map((s) => s.category.toLowerCase()));
    SPEC_CATEGORIES.filter((c) => !present.has(c.toLowerCase())).forEach((category) => specs.append({ id: newId('spec'), category, detail: '' }));
  };

  return (
    <SectionCard id="amenities" aside={<span className="rounded-full bg-surface-2 px-3 py-1 text-2xs font-medium text-ink-muted">{amenities.length} amenities selected</span>}>
      <SubSection title="Amenities" description="Tap to select. The website groups them under these headings.">
        <div className="space-y-4">
          {AMENITY_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <Chip key={item} active={amenities.some((a) => a.toLowerCase() === item.toLowerCase())} onClick={() => toggle(amenities.find((a) => a.toLowerCase() === item.toLowerCase()) ?? item)}>
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted">Other amenities</p>
            {custom.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {custom.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1 rounded-lg border border-accent-ink bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent-ink">
                    {item}
                    <button type="button" onClick={() => toggle(item)} aria-label={`Remove ${item}`} className="rounded hover:bg-accent/10">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AddCustom placeholder="Add an amenity not listed above, e.g. “Infinity pool”, “Hydroponic farm”" onAdd={(value) => !amenities.some((a) => a.toLowerCase() === value.toLowerCase()) && setValue('amenities', [...amenities, value], { shouldDirty: true })} />
          </div>
        </div>
      </SubSection>

      <SubSection
        title="Specifications"
        description="What the homes are built and finished with, from the brochure's specification page."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addStandardSpecs} className="btn-secondary min-h-[34px] px-3 text-xs">
              <ListChecks className="h-3.5 w-3.5" /> Add standard rows
            </button>
            <button type="button" onClick={() => specs.append({ id: newId('spec'), category: '', detail: '' })} className="btn-secondary min-h-[34px] px-3 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          </div>
        }
      >
        <datalist id="spec-categories">
          {SPEC_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {specs.fields.length === 0 ? (
          <EmptyRow>No specifications yet. “Add standard rows” adds Structure, Flooring, Kitchen, Bathrooms, Doors, Windows, Electrical and more.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {specs.fields.map((field, i) => (
              <li key={field.key} className="grid gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start">
                <Field label="" error={errors?.[i]?.category?.message}>
                  <input {...register(`specifications.${i}.category`)} list="spec-categories" className="field min-h-[36px] text-xs font-semibold" placeholder="Category" />
                </Field>
                <Field label="" error={errors?.[i]?.detail ? 'Add the detail or remove this row.' : undefined}>
                  <textarea {...register(`specifications.${i}.detail`)} rows={1} className="field min-h-[36px] text-xs" placeholder="e.g. Vitrified tiles 800 × 800 mm in living, dining and kitchen" />
                </Field>
                <div className="flex items-center gap-1 sm:pt-1">
                  <button type="button" onClick={() => specs.move(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => specs.move(i, i + 1)} disabled={i === specs.fields.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => specs.remove(i)} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove row">
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
