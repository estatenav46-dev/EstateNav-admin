'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { AlertCircle, Check, CheckCircle2, Circle, ExternalLink, Loader2, Save, Send, Undo2 } from 'lucide-react';
import type { Corridor, Developer, OfficeHub, Property, PublishStatus } from '@/lib/data/types';
import { savePropertyAction } from '@/app/actions/properties';
import {
  PLACEHOLDER_COVER,
  SECTIONS,
  blankProperty,
  draftFromProperty,
  flattenErrors,
  formSchema,
  sectionComplete,
  sectionOf,
  type Draft,
  type SectionId,
} from './editor/model';
import { SectionLocation } from './editor/SectionLocation';
import { SectionBasics } from './editor/SectionBasics';
import { SectionFacts } from './editor/SectionFacts';
import { SectionUnits } from './editor/SectionUnits';
import { SectionCharges } from './editor/SectionCharges';
import { SectionLegal } from './editor/SectionLegal';
import { SectionAmenities } from './editor/SectionAmenities';
import { SectionConnectivity } from './editor/SectionConnectivity';
import { SectionMedia } from './editor/SectionMedia';
import { SectionDocuments } from './editor/SectionDocuments';
import { SectionExtras } from './editor/SectionExtras';
import { SectionSeo, autoSeo } from './editor/SectionSeo';

interface Props {
  initial: Property | null;
  developers: Developer[];
  corridors: Corridor[];
  hubs: OfficeHub[];
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in').replace(/\/$/, '');

type Message = { tone: 'ok' | 'error'; title: string; items?: { section: SectionId | null; text: string }[] };

const scrollToSection = (id: SectionId) => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Left rail: section links with error counts, completion ticks and an overall quality score. */
function EditorNav({ control, errors }: { control: Control<Draft>; errors: FieldErrors<Draft> }) {
  const values = useWatch({ control }) as Draft;
  const [active, setActive] = useState<SectionId>('location');
  const errorCounts = useMemo(() => {
    const counts: Partial<Record<SectionId, number>> = {};
    for (const e of flattenErrors(errors)) counts[sectionOf(e.path)] = (counts[sectionOf(e.path)] ?? 0) + 1;
    return counts;
  }, [errors]);
  const status = SECTIONS.map((s) => ({ ...s, complete: sectionComplete(s.id, values) }));
  const scored = status.filter((s) => s.complete !== null);
  const score = Math.round((scored.filter((s) => s.complete).length / scored.length) * 100);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace('section-', '') as SectionId);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="Listing sections" className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-ink">Listing quality</p>
          <p className={`font-mono text-sm font-bold ${score >= 80 ? 'text-accent-ink' : score >= 50 ? 'text-amber-600' : 'text-ink-muted'}`}>{score}%</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-accent' : 'bg-amber-500'}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-2 text-2xs text-ink-muted">Complete listings get more enquiries. Ticks show sections with the essentials filled.</p>
      </div>
      <ol className="panel space-y-0.5 p-2">
        {status.map((s, i) => {
          const count = errorCounts[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => scrollToSection(s.id)}
                aria-current={active === s.id ? 'step' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${active === s.id ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}`}
              >
                {count ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-danger font-mono text-[10px] font-bold text-white">{count}</span>
                ) : s.complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-line-strong" />
                )}
                <span className="flex-1">
                  <span className="mr-1 font-mono text-[10px] text-ink-muted">{i + 1}</span>
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PropertyEditor({ initial, developers, corridors, hubs }: Props) {
  const router = useRouter();
  const isNew = !initial;
  const [areas, setAreas] = useState(corridors);
  const [devs, setDevs] = useState(developers);
  const [currentStatus, setCurrentStatus] = useState<PublishStatus>(initial?.status ?? 'draft');
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState<PublishStatus | null>(null);

  const defaultValues = useMemo<Draft>(() => (initial ? draftFromProperty(initial) : blankProperty()), [initial]);
  const form = useForm<Draft>({ resolver: zodResolver(formSchema), defaultValues, mode: 'onTouched' });
  const { handleSubmit, reset, formState, control, watch } = form;
  const slug = watch('slug');
  const title = watch('title');

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!formState.isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formState.isDirty]);

  const submit = useCallback(
    async (values: Draft, status: PublishStatus) => {
      setMessage(null);
      setSaving(status);
      const gallery = values.media.gallery;
      const coverInGallery = gallery.some((img) => img.id === values.media.cover?.id);
      const seo = autoSeo(values);
      const final: Draft = {
        ...values,
        highlights: values.highlights.map((h) => h.trim()).filter(Boolean),
        media: { ...values.media, cover: gallery.length ? (coverInGallery ? values.media.cover : gallery[0]) : PLACEHOLDER_COVER },
        seo: { ...values.seo, title: values.seo.title.trim() || seo.title, description: values.seo.description.trim() || seo.description },
      };
      const res = await savePropertyAction(final, status);
      setSaving(null);
      if (res.ok) {
        setCurrentStatus(res.data.status);
        reset(draftFromProperty(res.data));
        setMessage({
          tone: 'ok',
          title: res.warning ?? (res.data.status === 'published' ? 'Saved and live on the website.' : res.data.status === 'draft' ? 'Draft saved. It is not visible on the website yet.' : 'Saved as archived.'),
        });
        if (isNew) router.replace(`/properties/${res.data.id}`);
        router.refresh();
      } else {
        setMessage({
          tone: 'error',
          title: res.message,
          items: (res.issues ?? []).map((issue) => {
            const path = issue.split(':')[0];
            return { section: sectionOf(path), text: issue };
          }),
        });
      }
    },
    [isNew, reset, router],
  );

  const onInvalid = (errors: FieldErrors<Draft>) => {
    const list = flattenErrors(errors);
    const first = list[0] ? sectionOf(list[0].path) : null;
    setMessage({
      tone: 'error',
      title: `${list.length} ${list.length === 1 ? 'field needs' : 'fields need'} attention before saving.`,
      items: list.slice(0, 12).map((e) => ({ section: sectionOf(e.path), text: e.message })),
    });
    if (first) scrollToSection(first);
  };

  const save = (status: PublishStatus) => handleSubmit((values) => submit(values, status), onInvalid)();
  const published = currentStatus === 'published';
  const liveUrl = `${SITE_URL}/properties/${initial?.slug ?? slug}`;

  return (
    <FormProvider {...form}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${published ? 'bg-accent-soft text-accent-ink' : currentStatus === 'archived' ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-700'}`}>
                {isNew ? 'New listing' : currentStatus}
              </span>
              {formState.isDirty && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-2xs font-semibold text-ink-muted">Unsaved changes</span>}
            </div>
            <h1 className="mt-1.5 truncate text-2xl font-bold tracking-tight text-ink">{title || (isNew ? 'New property listing' : initial?.title)}</h1>
            {initial && (
              <p className="mt-0.5 text-2xs text-ink-muted">
                Last saved {initial.updatedAt} by {initial.updatedBy} · ID <span className="font-mono">{initial.id}</span>
              </p>
            )}
          </div>
          {initial && published && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> View on website
            </a>
          )}
        </div>

        {message && (
          <div role={message.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-xs ${message.tone === 'ok' ? 'border-accent/30 bg-accent-soft/40 text-accent-ink' : 'border-danger/30 bg-danger/10 text-danger'}`}>
            <p className="flex items-center gap-2 font-semibold">
              {message.tone === 'ok' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.title}
            </p>
            {message.items && message.items.length > 0 && (
              <ul className="mt-2 space-y-1 pl-6">
                {message.items.map((item, i) => (
                  <li key={i} className="list-disc">
                    {item.section ? (
                      <button type="button" onClick={() => scrollToSection(item.section!)} className="text-left hover:underline">
                        <span className="font-semibold">{SECTIONS.find((s) => s.id === item.section)?.label}:</span> {item.text}
                      </button>
                    ) : (
                      item.text
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[72px] max-h-[calc(100vh-84px)] overflow-y-auto pb-4">
              <EditorNav control={control} errors={formState.errors} />
            </div>
          </aside>

          <form onSubmit={(e) => e.preventDefault()} noValidate className="min-w-0 space-y-6">
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:hidden">
              {SECTIONS.map((s, i) => (
                <button key={s.id} type="button" onClick={() => scrollToSection(s.id)} className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-2xs font-medium text-ink-muted">
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>

            <SectionLocation developers={devs} corridors={areas} onCorridorCreated={(c) => setAreas((list) => [...list, c])} onDeveloperCreated={(d) => setDevs((list) => [...list, d])} />
            <SectionBasics isNew={isNew} siteUrl={SITE_URL} />
            <SectionFacts />
            <SectionUnits isNew={isNew} />
            <SectionCharges />
            <SectionLegal />
            <SectionAmenities />
            <SectionConnectivity hubs={hubs} />
            <SectionMedia />
            <SectionDocuments />
            <SectionExtras />
            <SectionSeo siteUrl={SITE_URL} />

            <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-2xs text-ink-muted">
                  {formState.isDirty ? 'You have unsaved changes.' : 'All changes saved.'} {published ? 'Saving updates the live page.' : 'Drafts stay hidden from the website.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {published ? (
                    <>
                      <button type="button" onClick={() => save('draft')} disabled={saving !== null} className="btn-secondary text-xs">
                        {saving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Unpublish
                      </button>
                      <button type="button" onClick={() => save('published')} disabled={saving !== null} className="btn-primary text-xs">
                        {saving === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => save(currentStatus === 'archived' ? 'archived' : 'draft')} disabled={saving !== null} className="btn-secondary text-xs">
                        {saving === 'draft' || saving === 'archived' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {currentStatus === 'archived' ? '' : 'draft'}
                      </button>
                      <button type="button" onClick={() => save('published')} disabled={saving !== null} className="btn-primary text-xs">
                        {saving === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
