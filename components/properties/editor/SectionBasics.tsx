'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Lens, Property } from '@/lib/data/types';
import { checkSlugAction } from '@/app/actions/properties';
import { PROPERTY_TYPE_LABEL } from '@/lib/listingMeta';
import { Field, SubSection, EmptyRow, slugify } from '@/components/ui/form';
import { Chip, SectionCard, useDraft } from './ui';

const LENSES: { id: Lens; label: string }[] = [
  { id: 'first-home', label: 'First-time buyers' },
  { id: 'upgrading', label: 'Upgrading families' },
  { id: 'nri', label: 'NRI buyers' },
  { id: 'senior', label: 'Senior-friendly' },
  { id: 'investor', label: 'Investors' },
];

const TYPES_BY_SEGMENT: Record<Property['segment'], Property['propertyType'][]> = {
  residential: ['apartment', 'villa', 'row-house', 'villament', 'penthouse', 'independent-house'],
  plot: ['plot', 'villa'],
  commercial: ['office', 'retail'],
};

export function SectionBasics({ isNew, siteUrl }: { isNew: boolean; siteUrl: string }) {
  const { register, watch, setValue, getValues, formState } = useDraft();
  const { errors } = formState;
  const title = watch('title');
  const slug = watch('slug');
  const segment = watch('segment');
  const propertyType = watch('propertyType');
  const highlights = watch('highlights') ?? [];
  const lenses = watch('lenses') ?? [];
  const description = watch('description') ?? '';
  const featured = watch('featured');
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const initialSlug = useRef(slug);

  useEffect(() => {
    if (!slugTouched && title !== undefined) setValue('slug', slugify(title), { shouldDirty: true, shouldValidate: Boolean(title) });
  }, [title, slugTouched, setValue]);

  useEffect(() => {
    if (!slug || slug.length < 2) return setSlugState('idle');
    setSlugState('checking');
    const timer = setTimeout(async () => {
      try {
        const ok = await checkSlugAction(slug, getValues('id'));
        setSlugState(ok ? 'available' : 'taken');
      } catch {
        setSlugState('idle');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [slug, getValues]);

  // Keep the property type valid for the chosen segment.
  useEffect(() => {
    const allowed = TYPES_BY_SEGMENT[segment];
    if (allowed && !allowed.includes(propertyType)) setValue('propertyType', allowed[0], { shouldDirty: true });
  }, [segment, propertyType, setValue]);

  const setHighlights = (next: string[]) => setValue('highlights', next, { shouldDirty: true });
  const moveHighlight = (from: number, to: number) => {
    if (to < 0 || to >= highlights.length) return;
    const next = [...highlights];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setHighlights(next);
  };

  return (
    <SectionCard id="basics">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Project name" required error={errors.title ? 'Add the project name.' : undefined} hint="Include the phase if it is part of the name buyers search for.">
            <input {...register('title')} className="field text-base font-semibold" placeholder="e.g. SOBHA Neopolis" />
          </Field>
          <Field label="Phase" hint="e.g. Phase 2. Shown with the project facts.">
            <input {...register('phase')} className="field" placeholder="optional" maxLength={80} />
          </Field>
        </div>

        <Field
          label="Web address (slug)"
          required
          error={errors.slug?.message ?? (slugState === 'taken' ? 'Another listing already uses this address.' : undefined)}
          hint={
            <>
              {siteUrl.replace(/^https?:\/\//, '')}/properties/<span className="font-semibold text-ink">{slug || '…'}</span>
              {!isNew && slug !== initialSlug.current && <span className="ml-1 text-amber-700">· changing it breaks links already shared</span>}
            </>
          }
        >
          <div className="relative">
            <input
              {...register('slug', { onChange: () => setSlugTouched(true) })}
              className="field pr-24 font-mono text-xs"
              placeholder="sobha-neopolis"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-medium">
              {slugState === 'checking' && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" />}
              {slugState === 'available' && <span className="text-accent-ink">Available</span>}
              {slugState === 'taken' && <span className="text-danger">Taken</span>}
            </span>
          </div>
        </Field>

        <Field label="Tagline" hint="One line under the name on cards and the project page.">
          <input {...register('tagline')} className="field" placeholder="e.g. 2, 3 & 4 BHK homes off Panathur Road" maxLength={140} />
        </Field>

        <Field label="Segment">
          <select {...register('segment')} className="field">
            <option value="residential">Residential (homes)</option>
            <option value="plot">Plots / plotted development</option>
            <option value="commercial">Commercial (offices, retail)</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Property type">
            <select {...register('propertyType')} className="field">
              {TYPES_BY_SEGMENT[segment].map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Listing for">
            <select {...register('transaction')} className="field">
              <option value="sale">Sale</option>
              <option value="rent">Rent / lease</option>
            </select>
          </Field>
        </div>

        <Field
          label="Description"
          className="sm:col-span-2"
          hint={`${description.trim().length} characters · aim for 300+. Blank lines start new paragraphs; **bold** and - bullet lists work.`}
        >
          <textarea {...register('description')} rows={7} className="field leading-relaxed" placeholder="What the project is, its scale and design, the location advantages, who it suits and what makes it different." />
        </Field>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register('isNewLaunch')} className="h-4 w-4 rounded accent-[rgb(var(--accent))]" /> New launch
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register('featured')} className="h-4 w-4 rounded accent-[rgb(var(--accent))]" /> Feature on the home page
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium" title="Keeps the listing in the admin but leaves it off the website, whatever its status.">
            <input type="checkbox" {...register('hidden')} className="h-4 w-4 rounded accent-[rgb(var(--accent))]" /> Hide from the website
          </label>
          {featured && (
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Position
              <input type="number" min={0} {...register('featuredRank', { valueAsNumber: true })} className="field min-h-[34px] w-20 text-xs" />
              <span>(1 = first)</span>
            </label>
          )}
        </div>
      </div>

      <SubSection
        title="Key highlights"
        description="Short, factual points as stated by the developer. The first three show on the project page header."
        action={
          <button type="button" onClick={() => setHighlights([...highlights, ''])} className="btn-secondary min-h-[34px] px-3 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add highlight
          </button>
        }
      >
        {highlights.length === 0 ? (
          <EmptyRow>No highlights yet, e.g. “80% open space”, “5 min to Kadubeesanahalli metro”, “Clubhouse of 50,000 sq.ft”.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-right font-mono text-2xs text-ink-muted">{i + 1}</span>
                <input
                  value={h}
                  onChange={(e) => setHighlights(highlights.map((x, j) => (j === i ? e.target.value : x)))}
                  className="field min-h-[36px] flex-1 text-sm"
                  placeholder="e.g. 80% open space with a 2-acre central park"
                />
                <button type="button" onClick={() => moveHighlight(i, i - 1)} disabled={i === 0} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveHighlight(i, i + 1)} disabled={i === highlights.length - 1} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setHighlights(highlights.filter((_, j) => j !== i))} className="rounded p-1.5 text-danger hover:bg-danger/10" aria-label="Remove highlight">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SubSection>

      <SubSection title="Who is it for?" description="Matches the listing to buyer types in search and the welcome questions.">
        <div className="flex flex-wrap gap-2">
          {LENSES.map(({ id, label }) => (
            <Chip key={id} active={lenses.includes(id)} onClick={() => setValue('lenses', lenses.includes(id) ? lenses.filter((l) => l !== id) : [...lenses, id], { shouldDirty: true })}>
              {label}
            </Chip>
          ))}
        </div>
      </SubSection>
    </SectionCard>
  );
}
