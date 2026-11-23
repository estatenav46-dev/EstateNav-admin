'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Bold, Check, ChevronDown, ChevronLeft, Circle, ExternalLink, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Minus, PenLine, Quote, Save, Send, Star, Undo2, X,
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
const NEW_CATEGORY = '__new__';

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

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

type Props = { initial: BlogPost | null; properties: Pick<Property, 'id' | 'title' | 'locality' | 'status'>[] };

// The blog post form, in the order a post is written: cover, title, short description, article.
// The side card holds what is needed to publish (checklist, category, featured); everything
// optional (web address, date, tags, author, read time, related projects, Google text) sits under
// "More settings" and fills itself in when left alone.
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
  const [mode, setMode] = useState<'write' | 'preview'>('write');
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

  /** Wraps the selection (or inserts a template) in the article text. */
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
      if (mode === 'preview') setMode('write');
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
  const wordCount = words(post.body);
  const checklist = [
    { label: 'Title', done: post.title.trim().length > 0 },
    { label: 'Cover image', done: Boolean(post.cover) },
    { label: 'Article text', done: wordCount >= 50, hint: wordCount >= 50 ? `${wordCount} words` : `${wordCount} / 50 words` },
    { label: 'Category', done: post.category.trim().length > 0 },
  ];
  const todo = checklist.filter((c) => !c.done).length;
  const categoryOptions = CATEGORIES.includes(post.category) || !post.category ? CATEGORIES : [post.category, ...CATEGORIES];

  const actionButtons = (
    <>
      {published && (
        <a href={`${SITE_URL}/blogs/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost hidden px-3 sm:inline-flex">
          <ExternalLink className="h-4 w-4" /> View on website
        </a>
      )}
      <button type="button" onClick={() => save('draft')} disabled={busy !== null} className="btn-secondary">
        {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <Undo2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {published ? 'Unpublish' : 'Save draft'}
      </button>
      <button type="button" onClick={() => save('published')} disabled={busy !== null} className="btn-primary">
        {busy === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {published ? 'Update post' : 'Publish'}
      </button>
    </>
  );

  // Toolbar: the everyday tools carry a word as well as an icon; the rest are icon-only with a tooltip.
  const tools: { icon: typeof Bold; label: string; text?: string; run: () => void }[][] = [
    [
      { icon: Heading2, label: 'Heading', text: 'Heading', run: () => format('## ', '', 'Section heading', true) },
      { icon: Heading3, label: 'Smaller heading', run: () => format('### ', '', 'Sub-heading', true) },
    ],
    [
      { icon: Bold, label: 'Bold', run: () => format('**', '**', 'bold text') },
      { icon: Italic, label: 'Italic', run: () => format('*', '*', 'italic text') },
    ],
    [
      { icon: List, label: 'Bullet list', text: 'List', run: () => prefixLines(() => '- ', 'First point\nSecond point') },
      { icon: ListOrdered, label: 'Numbered list', run: () => prefixLines((i) => `${i + 1}. `, 'First step\nSecond step') },
      { icon: Quote, label: 'Quote', run: () => prefixLines(() => '> ', 'A line worth highlighting') },
    ],
    [
      {
        icon: Link2,
        label: 'Link',
        text: 'Link',
        run: () => {
          const url = window.prompt('Link address (https://… or /properties/…)');
          if (url) format('[', `](${url.trim()})`, 'link text');
        },
      },
      { icon: Minus, label: 'Divider line', run: () => format('---', '', '', true) },
    ],
  ];

  return (
    <div className="pb-16">
      {/* Top bar: back, status, save and publish */}
      <div className="z-20 -mx-4 mb-5 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:sticky md:top-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/blogs" className="btn-ghost -ml-2 min-h-[36px] px-2">
            <ChevronLeft className="h-4 w-4" /> All posts
          </Link>
          <span className={`pill ${published ? 'pill-green' : 'pill-amber'}`}>{isNew ? 'New post' : published ? 'Published' : 'Draft'}</span>
          {dirty ? <span className="text-xs text-ink-muted">Unsaved changes</span> : !isNew && <span className="text-xs text-ink-muted">All changes saved</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">{actionButtons}</div>
        </div>
      </div>

      {message && (
        <div role={message.ok ? 'status' : 'alert'} className={`mb-5 rounded-[12px] border p-3.5 text-sm ${message.ok ? 'border-accent/30 bg-accent-soft/50 text-accent-ink' : 'border-danger/30 bg-danger/10 text-danger'}`}>
          <p className="flex items-center gap-2 font-semibold">
            {message.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {message.text}
          </p>
          {message.issues && <ul className="mt-1 list-disc pl-6 text-xs">{message.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Writing column */}
        <div className="min-w-0 space-y-4">
          <div className="panel p-5">
            <MediaUploader
              label="Cover image"
              description="A wide photo, about 1600 × 900. Needed before you publish."
              images={post.cover ? [post.cover] : []}
              onChange={(imgs) => set('cover', imgs[0] ?? null)}
              storagePath={`blogs/${post.id}`}
              max={1}
              altPrefix={post.title || 'Blog cover'}
            />
          </div>

          <div className="panel overflow-hidden">
            <div className="space-y-2 px-5 pb-4 pt-5">
              <label htmlFor="post-title" className="sr-only">Title</label>
              <input
                id="post-title"
                value={post.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Post title"
                className="w-full bg-transparent text-[1.6rem] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-muted/45 sm:text-[1.85rem]"
                maxLength={140}
                autoFocus={isNew}
              />
              <label htmlFor="post-excerpt" className="sr-only">Short description</label>
              <textarea
                id="post-excerpt"
                value={post.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                maxLength={320}
                placeholder="Short description: one or two sentences on what readers will learn. Optional; left empty, the opening lines are used."
                className="w-full resize-none bg-transparent text-[0.95rem] leading-relaxed text-ink-muted outline-none placeholder:text-ink-muted/45"
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-y border-line bg-surface-2/50 px-3 py-2">
              <div className="mr-1 flex rounded-[10px] bg-surface p-0.5 ring-1 ring-line" role="tablist" aria-label="Editor view">
                {([
                  ['write', 'Write', PenLine],
                  ['preview', 'Preview', Eye],
                ] as const).map(([m, label, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] px-3 text-xs font-semibold ${mode === m ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {mode === 'write' && (
                <>
                  {tools.map((group, gi) => (
                    <div key={gi} className="flex items-center gap-0.5 border-l border-line pl-1.5 ml-0.5">
                      {group.map(({ icon: Icon, label, text, run }) => (
                        <button key={label} type="button" onClick={run} title={label} aria-label={label} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium text-ink-muted hover:bg-surface hover:text-ink">
                          <Icon className="h-4 w-4" />
                          {text && <span className="hidden sm:inline">{text}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center border-l border-line pl-1.5 ml-0.5">
                    <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading} title="Add an image to the article" className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-60">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} <span className="hidden sm:inline">{uploading ? 'Uploading…' : 'Image'}</span>
                    </button>
                  </div>
                </>
              )}
              <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void insertImage(e.target.files[0])} />
            </div>

            {mode === 'write' ? (
              <>
                <label htmlFor="post-body" className="sr-only">Article</label>
                <textarea
                  id="post-body"
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
                  placeholder={'Start writing the article here.\n\nLeave a blank line between paragraphs. Use the toolbar above for headings, lists, links and images, or paste an image straight in.'}
                  className="block min-h-[28rem] w-full resize-y border-0 bg-surface px-5 py-4 text-[0.95rem] leading-7 text-ink outline-none placeholder:text-ink-muted/55"
                />
              </>
            ) : (
              <div className="min-h-[28rem] bg-bg/50 px-5 py-6">
                {post.body.trim() ? <ArticleBody source={post.body} /> : <p className="text-sm text-ink-muted">Nothing to preview yet. Switch to Write and start the article.</p>}
              </div>
            )}
            <p className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-2.5 text-xs text-ink-muted">
              <span>{wordCount} words · about {readMinutes(post.body)} min read</span>
              <span className="hidden sm:inline">Tip: select text, then press a toolbar button to format it.</span>
            </p>
          </div>
        </div>

        {/* Side: publishing essentials, then optional settings */}
        <aside className="space-y-4 lg:sticky lg:top-[8.5rem] lg:self-start">
          <div className="panel space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-ink">Before you publish</p>
              <p className="mt-0.5 text-xs text-ink-muted">{todo === 0 ? 'Everything is in place.' : `${todo} ${todo === 1 ? 'thing' : 'things'} left to add.`}</p>
              <ul className="mt-3 space-y-2">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5 text-sm">
                    {c.done ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
                    ) : (
                      <Circle className="h-5 w-5 text-line-strong" />
                    )}
                    <span className={c.done ? 'text-ink' : 'text-ink-muted'}>{c.label}</span>
                    {c.hint && <span className="ml-auto text-xs text-ink-muted">{c.hint}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <Field label="Category">
              <select
                value={post.category}
                onChange={(e) => {
                  if (e.target.value !== NEW_CATEGORY) return set('category', e.target.value);
                  const name = window.prompt('Name of the new category')?.trim();
                  if (name) set('category', name);
                }}
                className="field"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
            </Field>

            <button
              type="button"
              role="switch"
              aria-checked={post.featured}
              onClick={() => set('featured', !post.featured)}
              className="flex w-full items-center gap-3 rounded-[12px] border border-line p-3 text-left transition-colors hover:border-line-strong"
            >
              <Star className={`h-5 w-5 shrink-0 ${post.featured ? 'fill-amber-400 text-amber-500' : 'text-ink-muted'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Feature this post</span>
                <span className="block text-xs leading-snug text-ink-muted">Shows it in the carousel on the blog and home pages.</span>
              </span>
              <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${post.featured ? 'bg-accent' : 'bg-line-strong'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${post.featured ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </span>
            </button>

            <div className="flex flex-col gap-2 border-t border-line pt-4 lg:hidden">{actionButtons}</div>
          </div>

          <details className="panel group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-sm font-semibold text-ink">More settings</span>
                <span className="block text-xs text-ink-muted">Web address, date, tags, author, related projects, Google text. All optional.</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-line px-5 py-4">
              <Field label="Web address" hint={slugTouched ? 'Lower-case words joined by hyphens.' : 'Made from the title. Edit it for a shorter link.'}>
                <div className="flex items-stretch overflow-hidden rounded-[10px] border border-line-strong/80 bg-surface focus-within:border-accent">
                  <span className="flex items-center border-r border-line bg-surface-2 px-2.5 text-xs text-ink-muted">/blogs/</span>
                  <input
                    value={post.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                    }}
                    placeholder="how-to-check-k-rera"
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-ink outline-none"
                  />
                </div>
                {slugFree !== null && <p className={`mt-1 text-xs font-semibold ${slugFree ? 'text-accent-ink' : 'text-danger'}`}>{slugFree ? 'This address is free.' : 'Another post already uses this address.'}</p>}
              </Field>

              <Field label="Publish date" hint="Leave empty to use the moment you publish.">
                <input type="date" value={post.publishedAt?.slice(0, 10) ?? ''} onChange={(e) => set('publishedAt', e.target.value ? `${e.target.value}T09:00:00.000Z` : null)} className="field" />
              </Field>

              <Field label="Tags" hint="Press Enter after each tag; up to 12.">
                <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-[10px] border border-line-strong/80 p-1.5 focus-within:border-accent">
                  {post.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs font-medium">
                      {t}
                      <button type="button" onClick={() => set('tags', post.tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="rounded-full p-0.5 hover:bg-line">
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
                    placeholder={post.tags.length ? '' : 'e.g. Sarjapur Road'}
                    className="min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none"
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Author">
                  <input value={post.author.name} onChange={(e) => set('author', { ...post.author, name: e.target.value })} className="field" />
                </Field>
                <Field label="Author's role">
                  <input value={post.author.role} onChange={(e) => set('author', { ...post.author, role: e.target.value })} className="field" />
                </Field>
              </div>

              <Field label="Read time" hint={manualRead ? 'Set by hand.' : 'Worked out from the word count.'}>
                <div className="flex items-center gap-3">
                  <div className="relative w-28">
                    <input type="number" min={1} max={120} value={post.readMinutes} disabled={!manualRead} onChange={(e) => set('readMinutes', Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)))} className="field pr-12" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">min</span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
                    <input type="checkbox" checked={manualRead} onChange={(e) => setManualRead(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                    Set by hand
                  </label>
                </div>
              </Field>

              <div>
                <p className="text-xs font-semibold text-ink">Related projects</p>
                <p className="mt-0.5 text-xs text-ink-muted">Shown as cards under the article, up to 6. {post.relatedPropertyIds.length ? `${post.relatedPropertyIds.length} chosen.` : ''}</p>
                <input value={propQuery} onChange={(e) => setPropQuery(e.target.value)} placeholder="Search listings…" className="field mt-2" />
                <ul className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto">
                  {shownProps.map((p) => {
                    const on = post.relatedPropertyIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className={`flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-sm hover:bg-surface-2 ${on ? 'font-semibold' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!on && post.relatedPropertyIds.length >= 6}
                            onChange={() => set('relatedPropertyIds', on ? post.relatedPropertyIds.filter((x) => x !== p.id) : [...post.relatedPropertyIds, p.id])}
                            className="h-4 w-4 accent-[rgb(var(--accent))]"
                          />
                          <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          {p.status !== 'published' && <span className="pill pill-amber !px-2 !py-0 !text-[11px] capitalize">{p.status}</span>}
                        </label>
                      </li>
                    );
                  })}
                  {!shownProps.length && <li className="px-2 py-1.5 text-xs text-ink-muted">No listings match.</li>}
                </ul>
              </div>

              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-semibold text-ink">How it looks in Google</p>
                <Field label="Google title" hint={`${post.seo.title.length}/60 · empty uses the post title`}>
                  <input value={post.seo.title} onChange={(e) => set('seo', { ...post.seo, title: e.target.value })} maxLength={90} className="field" placeholder={post.title || 'Post title'} />
                </Field>
                <Field label="Google description" hint={`${post.seo.description.length}/160 · empty uses the short description`}>
                  <textarea value={post.seo.description} onChange={(e) => set('seo', { ...post.seo, description: e.target.value })} maxLength={200} rows={3} className="field" placeholder={post.excerpt || 'Short description'} />
                </Field>
              </div>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
