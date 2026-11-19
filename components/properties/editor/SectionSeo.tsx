'use client';

import { Wand2 } from 'lucide-react';
import { Field } from '@/components/ui/form';
import { SectionCard, useDraft } from './ui';

export function autoSeo(d: { title: string; tagline: string; description: string; locality: string; corridorName: string; developerName: string }) {
  const place = [d.locality, d.corridorName].filter(Boolean)[0] ?? 'Bengaluru';
  const title = `${d.title}${d.developerName && !d.title.toLowerCase().includes(d.developerName.toLowerCase().split(' ')[0]) ? ` by ${d.developerName}` : ''} | ${place}, Bengaluru`.slice(0, 70);
  const source = (d.tagline || d.description || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const description = (source ? `${source}${/[.!?]$/.test(source) ? '' : '.'} ` : '') + 'Floor plans, prices and K-RERA details on EstateNav.';
  return { title, description: description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description };
}

export function SectionSeo({ siteUrl }: { siteUrl: string }) {
  const { register, watch, setValue, getValues } = useDraft();
  const seoTitle = watch('seo.title') ?? '';
  const seoDescription = watch('seo.description') ?? '';
  const slug = watch('slug');
  const fallback = autoSeo({
    title: watch('title') || 'Project name',
    tagline: watch('tagline'),
    description: watch('description'),
    locality: watch('locality'),
    corridorName: watch('corridorName'),
    developerName: watch('developerName'),
  });
  const shownTitle = seoTitle || fallback.title;
  const shownDescription = seoDescription || fallback.description;

  return (
    <SectionCard
      id="seo"
      aside={
        <button
          type="button"
          onClick={() => {
            const next = autoSeo({ title: getValues('title'), tagline: getValues('tagline'), description: getValues('description'), locality: getValues('locality'), corridorName: getValues('corridorName'), developerName: getValues('developerName') });
            setValue('seo.title', next.title, { shouldDirty: true });
            setValue('seo.description', next.description, { shouldDirty: true });
          }}
          className="btn-secondary min-h-[34px] px-3 text-xs"
        >
          <Wand2 className="h-3.5 w-3.5" /> Fill automatically
        </button>
      }
    >
      <p className="-mt-2 text-2xs text-ink-muted">Left blank, these are written automatically from the name, tagline and location when you save.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Page title" hint={`${seoTitle.length}/60 characters`}>
            <input {...register('seo.title')} className="field" placeholder={fallback.title} maxLength={90} />
          </Field>
          <Field label="Meta description" hint={`${seoDescription.length}/160 characters`}>
            <textarea {...register('seo.description')} rows={3} className="field" placeholder={fallback.description} maxLength={220} />
          </Field>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 text-left">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">Google preview</p>
          <p className="mt-3 truncate text-xs text-[#202124]">{siteUrl.replace(/^https?:\/\//, '')} › properties › {slug || '…'}</p>
          <p className="mt-0.5 line-clamp-1 text-lg leading-snug text-[#1a0dab]">{shownTitle}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-[#4d5156]">{shownDescription}</p>
        </div>
      </div>
    </SectionCard>
  );
}
