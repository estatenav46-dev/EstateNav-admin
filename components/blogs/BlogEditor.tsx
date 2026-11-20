'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Bold, Check, ExternalLink, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Minus, Quote, Save, Send, Star, Undo2, X,
} from 'lucide-react';
import type { BlogPost, Property } from '@/lib/data/types';
import { checkBlogSlugAction, saveBlogAction } from '@/app/actions/blogs';
import { MediaUploader } from '@/components/properties/MediaUploader';
import { ArticleBody, readMinutes } from '@/components/blog/ArticleBody';
import { Field, slugify } from '@/components/ui/form';
import { MAX_UPLOAD_BYTES, inspectImage, uploadImageToCloudinary } from '@/lib/media';

type Draft = Omit<BlogPost, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in').replace(/\/$/, '');
const CATEGORIES = ['Buying guides', 'Market updates', 'Locality guides', 'Legal & RERA', 'Home loans', 'Investment', 'Project spotlights', 'News'];

function blankPost(): Draft {
  return {
    id: `b-${Date.now().toString(36)}`,
    slug: '',
    status: 'draft',
    title: '',
    excerpt: '',
    body: '',
    cover: null,
    category: 'Buying guides',
    tags: [],
    author: { name: 'SV Praveen', role: 'K-RERA registered agent' },
    readMinutes: 1,
    featured: false,
    relatedPropertyIds: [],
    seo: { title: '', description: '' },
    publishedAt: null,
  };
}

type Props = { initial: BlogPost | null; properties: Pick<Property, 'id' | 'title' | 'locality' | 'status'>[] };

export function BlogEditor({ initial, properties }: Props) {
  const router = useRouter();
  const isNew = !initial;
  const start = useMemo<Draft>(() => {
    if (!initial) return blankPost();
    const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...rest } = initial;
    return rest;
  }, [initial]);
  const [post, setPost] = useState<Draft>(start);
  const [saved, setSaved] = useState<Draft>(start);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [manualRead, setManualRead] = useState(!isNew && initial!.readMinutes !== readMinutes(initial!.body));
  const [mode, setMode] = useState<'write' | 'split' | 'preview'>('split');
  const [busy, setBusy] = useState<BlogPost['status'] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; issues?: string[] } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [propQuery, setPropQuery] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(post) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setPost((p) => ({ ...p, [key]: value }));

  // Web address follows the title until edited; availability is checked as you type.
  useEffect(() => {
    if (!slugTouched) setPost((p) => ({ ...p, slug: slugify(p.title, 90) }));
  }, [post.title, slugTouched]);
  useEffect(() => {
    if (!post.slug || post.slug.length < 2) return setSlugFree(null);
    const t = setTimeout(async () => setSlugFree(await checkBlogSlugAction(post.slug, post.id).catch(() => null)), 450);
    return () => clearTimeout(t);
  }, [post.slug, post.id]);
  useEffect(() => {
    if (!manualRead) setPost((p) => ({ ...p, readMinutes: readMinutes(p.body) }));
  }, [post.body, manualRead]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Wraps the selection (or inserts a template) in the body textarea. */
  const format = (before: string, after = '', placeholder = '', block = false) => {
    const el = body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e) || placeholder;
    const lead = block && s > 0 && !value.slice(0, s).endsWith('\n\n') ? (value.slice(0, s).endsWith('\n') ? '\n' : '\n\n') : '';
    const insert = `${lead}${before}${selected}${after}`;
    const next = value.slice(0, s) + insert + value.slice(e);
    set('body', next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = s + lead.length + before.length;
      el.setSelectionRange(cursor, cursor + selected.length);
    });
  };
  const prefixLines = (prefix: (i: number) => string, placeholder: string) => {
    const el = body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const text = value.slice(s, e) || placeholder;
    const lead = s > 0 && !value.slice(0, s).endsWith('\n\n') ? (value.slice(0, s).endsWith('\n') ? '\n' : '\n\n') : '';
    const insert = lead + text.split('\n').map((l, i) => `${prefix(i)}${l.replace(/^([-*]|\d+[.)]|>)\s+/, '')}`).join('\n');
    set('body', value.slice(0, s) + insert + value.slice(e));
    requestAnimationFrame(() => el.focus());
  };
  const insertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return setMessage({ ok: false, text: 'Choose an image file.' });
    if (file.size > MAX_UPLOAD_BYTES) return setMessage({ ok: false, text: 'Images must be under 10 MB.' });
    setUploading(true);
    try {
      const meta = await inspectImage(file);
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
      const ref = await uploadImageToCloudinary(file, `blogs/${post.id}`, { alt, order: 0, ...meta });
      format(`![${alt}](${ref.url})`, '', '', true);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Image upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const save = async (status: BlogPost['status']) => {
    setMessage(null);
    if (!post.title.trim()) return setMessage({ ok: false, text: 'Add a title first.' });
    setBusy(status);
    const excerpt = post.excerpt.trim() || post.body.replace(/!\[[^\]]*\]\([^)]*\)|[#>*_`[\]]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);
    const res = await saveBlogAction({ ...post, excerpt, slug: post.slug || slugify(post.title, 90) }, status);
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: res.message, issues: 'issues' in res ? res.issues : undefined });
    const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...next } = res.data;
    setPost(next);
    setSaved(next);
    setMessage({ ok: true, text: res.data.status === 'published' ? 'Published. The blog on the website refreshes within a minute.' : 'Draft saved. It is not visible on the website.' });
    if (isNew) router.replace(`/blogs/${res.data.id}`);
    router.refresh();
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '');
    if (tag && !post.tags.includes(tag) && post.tags.length < 12) set('tags', [...post.tags, tag]);
    setTagInput('');
  };
  const published = saved.status === 'published';
  const shownProps = properties.filter((p) => `${p.title} ${p.locality}`.toLowerCase().includes(propQuery.toLowerCase())).slice(0, 40);

  const publishButtons = published ? (
    <>
      <button type="button" onClick={() => save('draft')} disabled={busy !== null} className="btn-secondary min-h-[34px] px-3 text-xs">
        {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Unpublish
      </button>
      <button type="button" onClick={() => save('published')} disabled={busy !== null} className="btn-primary min-h-[34px] px-3 text-xs">
        {busy === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Update
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => save('draft')} disabled={busy !== null} className="btn-secondary min-h-[34px] px-3 text-xs">
        {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
      </button>
      <button type="button" onClick={() => save('published')} disabled={busy !== null} className="btn-primary min-h-[34px] px-3 text-xs">
        {busy === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
      </button>
    </>
  );

  const tools: { icon: typeof Bold; label: string; run: () => void }[] = [
    { icon: Heading2, label: 'Heading', run: () => format('## ', '', 'Section heading', true) },
    { icon: Heading3, label: 'Sub-heading', run: () => format('### ', '', 'Sub-heading', true) },
    { icon: Bold, label: 'Bold', run: () => format('**', '**', 'bold text') },
    { icon: Italic, label: 'Italic', run: () => format('*', '*', 'italic text') },
    { icon: List, label: 'Bullet list', run: () => prefixLines(() => '- ', 'First point\nSecond point') },
    { icon: ListOrdered, label: 'Numbered list', run: () => prefixLines((i) => `${i + 1}. `, 'First step\nSecond step') },
    { icon: Quote, label: 'Quote', run: () => prefixLines(() => '> ', 'A line worth highlighting') },
    {
      icon: Link2,
      label: 'Link',
      run: () => {
        const url = window.prompt('Link address (https://… or /properties/…)');
        if (url) format('[', `](${url.trim()})`, 'link text');
      },
    },
    { icon: Minus, label: 'Divider', run: () => format('---', '', '', true) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase ${published ? 'bg-accent-soft text-accent-ink' : 'bg-amber-500/10 text-amber-700'}`}>{isNew ? 'New post' : saved.status}</span>
            {dirty && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-2xs font-semibold text-ink-muted">Unsaved changes</span>}
          </div>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">{post.title || 'New blog post'}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {published && (
            <a href={`${SITE_URL}/blogs/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-[34px] px-3 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> View on website
            </a>
          )}
          {publishButtons}
        </div>
      </div>

      {message && (
        <div role={message.ok ? 'status' : 'alert'} className={`rounded-xl border p-3 text-xs ${message.ok ? 'border-accent/30 bg-accent-soft/40 text-accent-ink' : 'border-danger/30 bg-danger/10 text-danger'}`}>
          <p className="flex items-center gap-2 font-semibold">
            {message.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {message.text}
          </p>
          {message.issues && <ul className="mt-1 list-disc pl-6">{message.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Writing area */}
        <div className="min-w-0 space-y-3">
          <div className="panel space-y-3 p-4">
            <Field label="Title" hint={`${post.title.length}/140 · the headline on the blog page and in Google.`}>
              <input
                value={post.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. How to check a project's K-RERA registration"
                className="field text-base font-semibold"
                maxLength={140}
                autoFocus={isNew}
              />
            </Field>
            <Field label="Web address" hint={slugTouched ? 'Lower-case words joined by hyphens.' : 'Filled in from the title; edit it if you want a shorter link.'}>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-surface focus-within:border-accent">
                <span className="flex items-center border-r border-line bg-surface-2 px-2.5 font-mono text-2xs text-ink-muted">/blogs/</span>
                <input
                  value={post.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  }}
                  placeholder="how-to-check-k-rera-registration"
                  className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-xs text-ink outline-none"
                />
                {slugFree !== null && (
                  <span className={`flex items-center px-2.5 text-2xs font-semibold ${slugFree ? 'text-accent-ink' : 'text-danger'}`}>{slugFree ? 'Available' : 'Already used'}</span>
                )}
              </div>
            </Field>
            <Field label="Short description" hint={`${post.excerpt.length}/320 · shown on blog cards and in Google. Left empty, the first lines of the article are used.`}>
              <textarea value={post.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} maxLength={320} className="field" placeholder="One or two sentences on what the reader will learn." />
            </Field>
          </div>

          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2/60 px-2 py-1.5">
              {tools.map(({ icon: Icon, label, run }) => (
                <button key={label} type="button" onClick={run} title={label} aria-label={label} className="rounded-md p-1.5 text-ink-muted hover:bg-surface hover:text-ink" disabled={mode === 'preview'}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading || mode === 'preview'} title="Insert image" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-semibold text-ink-muted hover:bg-surface hover:text-ink">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Image
              </button>
              <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void insertImage(e.target.files[0])} />
              <div className="ml-auto flex gap-0.5 rounded-md bg-surface p-0.5">
                {(['write', 'split', 'preview'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2 py-0.5 text-2xs font-semibold capitalize ${mode === m ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className={`grid ${mode === 'split' ? 'lg:grid-cols-2' : ''}`}>
              {mode !== 'preview' && (
                <textarea
                  ref={body}
                  value={post.body}
                  onChange={(e) => set('body', e.target.value)}
                  onPaste={(e) => {
                    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
                    if (file) {
                      e.preventDefault();
                      void insertImage(file);
                    }
                  }}
                  placeholder={'Write the article here.\n\n## Use headings for sections\n\nParagraphs are separated by a blank line. Use the toolbar for lists, quotes, links and images (you can also paste an image).'}
                  className="min-h-[24rem] w-full resize-y border-0 bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink outline-none"
                />
              )}
              {mode !== 'write' && (
                <div className={`max-h-[40rem] min-h-[24rem] overflow-y-auto bg-bg/60 p-5 ${mode === 'split' ? 'border-t border-line lg:border-l lg:border-t-0' : ''}`}>
                  {post.body.trim() ? <ArticleBody source={post.body} /> : <p className="text-sm text-ink-muted">The preview appears here as you write.</p>}
                </div>
              )}
            </div>
            <p className="border-t border-line px-4 py-2 text-2xs text-ink-muted">
              {post.body.split(/\s+/).filter(Boolean).length} words · about {readMinutes(post.body)} min read
            </p>
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="space-y-3">
          <div className="panel space-y-3 p-4">
            <p className="text-sm font-semibold">Visibility</p>
            <button
              type="button"
              onClick={() => set('featured', !post.featured)}
              aria-pressed={post.featured}
              className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${post.featured ? 'border-amber-400/60 bg-amber-500/10' : 'border-line hover:border-line-strong hover:bg-surface-2/60'}`}
            >
              <Star className={`mt-0.5 h-4 w-4 shrink-0 ${post.featured ? 'fill-amber-400 text-amber-500' : 'text-ink-muted'}`} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink">{post.featured ? 'Featured in the carousel' : 'Feature this post'}</span>
                <span className="block text-2xs leading-snug text-ink-muted">Featured posts rotate in the carousel at the top of the blog page and on the home page. Save or publish to apply.</span>
              </span>
            </button>
            <Field label="Publish date" hint="Leave empty to use the moment you publish.">
              <input type="date" value={post.publishedAt?.slice(0, 10) ?? ''} onChange={(e) => set('publishedAt', e.target.value ? `${e.target.value}T09:00:00.000Z` : null)} className="field text-xs" />
            </Field>
          </div>

          <div className="panel p-4">
            <MediaUploader
              label="Cover image"
              description="Wide image (about 1600 × 900). Required to publish."
              images={post.cover ? [post.cover] : []}
              onChange={(imgs) => set('cover', imgs[0] ?? null)}
              storagePath={`blogs/${post.id}`}
              max={1}
              altPrefix={post.title || 'Blog cover'}
            />
          </div>

          <div className="panel space-y-3 p-4">
            <Field label="Category">
              <input value={post.category} onChange={(e) => set('category', e.target.value)} list="blog-categories" className="field text-xs" />
              <datalist id="blog-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Tags" hint="Press Enter to add; up to 12.">
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-line p-1.5">
                {post.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-2xs font-semibold">
                    {t}
                    <button type="button" onClick={() => set('tags', post.tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder="e.g. Sarjapur Road"
                  className="min-w-[6rem] flex-1 bg-transparent px-1 text-xs outline-none"
                />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Author">
                <input value={post.author.name} onChange={(e) => set('author', { ...post.author, name: e.target.value })} className="field text-xs" />
              </Field>
              <Field label="Author role">
                <input value={post.author.role} onChange={(e) => set('author', { ...post.author, role: e.target.value })} className="field text-xs" />
              </Field>
            </div>
            <Field label="Read time (minutes)">
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={120} value={post.readMinutes} disabled={!manualRead} onChange={(e) => set('readMinutes', Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)))} className="field w-20 text-xs" />
                <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-ink-muted">
                  <input type="checkbox" checked={manualRead} onChange={(e) => setManualRead(e.target.checked)} className="accent-[rgb(var(--accent))]" />
                  Set manually (otherwise from word count)
                </label>
              </div>
            </Field>
          </div>

          <div className="panel space-y-2 p-4">
            <p className="text-sm font-semibold">Related projects</p>
            <p className="text-2xs text-ink-muted">Shown as cards under the article (up to 6).</p>
            <input value={propQuery} onChange={(e) => setPropQuery(e.target.value)} placeholder="Search listings…" className="field text-xs" />
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">
              {shownProps.map((p) => {
                const on = post.relatedPropertyIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-2 ${on ? 'font-semibold' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && post.relatedPropertyIds.length >= 6}
                        onChange={() => set('relatedPropertyIds', on ? post.relatedPropertyIds.filter((x) => x !== p.id) : [...post.relatedPropertyIds, p.id])}
                        className="accent-[rgb(var(--accent))]"
                      />
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {p.status !== 'published' && <span className="text-[10px] uppercase text-amber-700">{p.status}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel space-y-3 p-4">
            <p className="text-sm font-semibold">Search & sharing</p>
            <Field label="Google title" hint={`${post.seo.title.length}/60 · empty uses the post title`}>
              <input value={post.seo.title} onChange={(e) => set('seo', { ...post.seo, title: e.target.value })} maxLength={90} className="field text-xs" placeholder={post.title} />
            </Field>
            <Field label="Google description" hint={`${post.seo.description.length}/160 · empty uses the short description`}>
              <textarea value={post.seo.description} onChange={(e) => set('seo', { ...post.seo, description: e.target.value })} maxLength={200} rows={2} className="field text-xs" placeholder={post.excerpt} />
            </Field>
          </div>
        </aside>
      </div>
    </div>
  );
}
