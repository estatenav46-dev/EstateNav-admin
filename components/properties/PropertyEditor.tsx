'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import {
  Building2,
  MapPin,
  Layers,
  Calendar,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  Car,
  Search,
  Save,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { propertySchema } from '@/lib/data/schemas';
import type { Corridor, Developer, ImageRef, Lens, OfficeHub, Property, PublishStatus } from '@/lib/data/types';
import { savePropertyAction, checkSlugAction } from '@/app/actions/properties';
import { MediaUploader } from './MediaUploader';

const formSchema = propertySchema.omit({
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  createdBy: true,
  updatedBy: true,
});

type Draft = typeof formSchema._type;

const TABS = [
  { id: 'basics', label: '1. Basics', icon: Building2 },
  { id: 'location', label: '2. Location', icon: MapPin },
  { id: 'configs', label: '3. Configurations & Price', icon: Layers },
  { id: 'possession', label: '4. Possession', icon: Calendar },
  { id: 'legal', label: '5. RERA & Approvals', icon: ShieldCheck },
  { id: 'features', label: '6. Amenities & Lenses', icon: Sparkles },
  { id: 'media', label: '7. Media & Cloudinary', icon: ImageIcon },
  { id: 'commute', label: '8. Commute Radar', icon: Car },
  { id: 'seo', label: '9. SEO & Metadata', icon: Search },
] as const;

const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'LIC HFL', 'Bank of Baroda'];
const LENSES: { id: Lens; label: string }[] = [
  { id: 'first-home', label: 'First-time homebuyer' },
  { id: 'upgrading', label: 'Upgrading space / luxury' },
  { id: 'nri', label: 'NRI investors & buyers' },
  { id: 'senior', label: 'Senior citizens' },
  { id: 'investor', label: 'High rental yield / investor' },
];

const COMMON_AMENITIES = [
  'Clubhouse',
  'Swimming Pool',
  'Gymnasium',
  'Landscaped Gardens',
  'Children Play Area',
  'Jogging / Walking Track',
  'Security & RFID',
  'EV Charging Bays',
  'Badminton / Tennis Court',
  'Power Backup',
  'Rainwater Harvesting',
];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const EMPTY_IMAGE: ImageRef = {
  id: 'placeholder',
  storagePath: '',
  url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
  alt: 'Cover photo',
  width: 1600,
  height: 1060,
  blurDataURL: '',
  order: 0,
};

function blankProperty(dev?: Developer, corr?: Corridor): Draft {
  const id = `p-${Date.now().toString(36)}`;
  return {
    id,
    slug: '',
    status: 'draft',
    featured: false,
    featuredRank: 99,
    segment: 'residential',
    transaction: 'sale',
    isNewLaunch: false,
    propertyType: 'apartment',
    title: '',
    tagline: '',
    description: '',
    highlights: ['Direct developer pricing', 'Clear titles and approvals'],
    developerId: dev?.id || '',
    developerName: dev?.name || '',
    corridorId: corr?.id || '',
    corridorName: corr?.name || '',
    locality: '',
    address: '',
    geo: null,
    geohash: null,
    configurations: [
      {
        id: `${id}-c1`,
        label: '2 BHK',
        bhk: 2,
        carpetSqftMin: 1100,
        carpetSqftMax: 1250,
        superSqftMin: 1350,
        superSqftMax: 1550,
        priceMin: 12000000,
        priceMax: 13500000,
        floorPlanImageId: null,
      },
    ],
    bhkOptions: [2],
    priceMin: 12000000,
    priceMax: null,
    sizeMin: 1100,
    sizeMax: null,
    pricePerSqft: null,
    rentPerMonth: null,
    possession: { status: 'under-construction', date: null, label: 'Under construction' },
    rera: { number: null, verifyUrl: 'https://rera.karnataka.gov.in/', registered: false },
    approvals: { khata: 'A', planAuthority: 'BDA', titleCheck: 'clear', notes: '' },
    bankApprovals: ['HDFC', 'ICICI', 'SBI'],
    amenities: ['Clubhouse', 'Swimming Pool'],
    lenses: ['first-home', 'upgrading'],
    media: { cover: EMPTY_IMAGE, gallery: [], floorPlans: [], brochure: null },
    metrics: null,
    commute: [],
    seo: { title: '', description: '', ogImageId: null },
  };
}

interface Props {
  initial: Property | null;
  developers: Developer[];
  corridors: Corridor[];
  hubs: OfficeHub[];
}

export function PropertyEditor({ initial, developers, corridors, hubs }: Props) {
  const router = useRouter();
  const isNew = !initial;
  const [activeTab, setActiveTab] = useState<string>('basics');
  const [saveStatus, setSaveStatus] = useState<PublishStatus>(initial?.status || 'published');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const defaultValues = useMemo<Draft>(() => {
    if (!initial) return blankProperty(developers[0], corridors[0]);
    const { createdAt, updatedAt, publishedAt, createdBy, updatedBy, ...rest } = initial;
    return rest;
  }, [initial, developers, corridors]);

  const form = useForm<Draft>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const { register, control, handleSubmit, setValue, watch, formState } = form;
  const { errors, isSubmitting } = formState;

  const configs = useFieldArray({ control, name: 'configurations' });
  const highlights = useFieldArray({ control, name: 'highlights' as never });
  const commute = useFieldArray({ control, name: 'commute' });

  const watchedTitle = watch('title');
  const watchedSlug = watch('slug');
  const watchedDevId = watch('developerId');
  const watchedCorrId = watch('corridorId');
  const watchedGallery = watch('media.gallery') || [];
  const watchedFloorPlans = watch('media.floorPlans') || [];
  const watchedCover = watch('media.cover');

  // Auto-fill developerName when developerId changes
  useEffect(() => {
    const dev = developers.find((d) => d.id === watchedDevId);
    if (dev) setValue('developerName', dev.name);
  }, [watchedDevId, developers, setValue]);

  // Auto-fill corridorName when corridorId changes
  useEffect(() => {
    const corr = corridors.find((c) => c.id === watchedCorrId);
    if (corr) setValue('corridorName', corr.name);
  }, [watchedCorrId, corridors, setValue]);

  // Auto-generate slug for new listings
  const handleTitleBlur = () => {
    if (isNew && watchedTitle && !watchedSlug) {
      const generated = slugify(watchedTitle);
      setValue('slug', generated, { shouldValidate: true });
      void checkSlug(generated);
    }
  };

  const checkSlug = async (slugVal: string) => {
    if (!slugVal || slugVal.length < 2) return;
    setSlugStatus('checking');
    try {
      const ok = await checkSlugAction(slugVal, initial?.id);
      setSlugStatus(ok ? 'available' : 'taken');
    } catch {
      setSlugStatus('idle');
    }
  };

  const onSubmit = async (values: Draft) => {
    setMessage(null);

    // Ensure cover image exists
    const cover = values.media.gallery[0] || values.media.cover || EMPTY_IMAGE;
    const finalValues = {
      ...values,
      media: {
        ...values.media,
        cover,
      },
    };

    const res = await savePropertyAction(finalValues, saveStatus);
    if (res.ok) {
      setMessage({ ok: true, text: `Listing successfully saved as ${saveStatus}!` });
      router.refresh();
      if (isNew) {
        router.push(`/properties/${res.data.id}`);
      }
    } else {
      setMessage({
        ok: false,
        text: [res.message, ...(res.issues || [])].join('\n'),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-surface-2 text-ink-muted">
              {isNew ? 'New Property' : `Editing: ${initial.title}`}
            </span>
            <span
              className={`text-2xs font-mono uppercase px-2 py-0.5 rounded ${
                saveStatus === 'published' ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink-muted'
              }`}
            >
              Status: {saveStatus}
            </span>
          </div>
          <h1 className="mt-1 font-serif text-2xl">{watchedTitle || 'Untitled Property'}</h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={saveStatus}
            onChange={(e) => setSaveStatus(e.target.value as PublishStatus)}
            className="field min-h-[38px] text-xs font-medium"
          >
            <option value="published">Publish immediately</option>
            <option value="draft">Save as Draft</option>
            <option value="archived">Archive</option>
          </select>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="btn-primary min-h-[38px] px-4 text-xs flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Property
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs ${
            message.ok ? 'border-accent/30 bg-accent-soft/30 text-accent-ink' : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {message.ok ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <div className="whitespace-pre-line font-medium">{message.text}</div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="no-scrollbar flex border-b border-line overflow-x-auto gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                active ? 'border-accent-ink text-accent-ink bg-accent-soft/20' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. BASICS */}
        {activeTab === 'basics' && (
          <div className="panel space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold border-b border-line pb-2">Basic Listing Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Property Title *</label>
                <input
                  type="text"
                  {...register('title')}
                  onBlur={handleTitleBlur}
                  placeholder="e.g. Abhee Celestial City"
                  className="field min-h-[40px] text-sm font-medium"
                />
                {errors.title && <p className="text-2xs text-danger mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  URL Slug *
                  <span className="ml-1 text-ink-muted font-normal">(unique identifier in web address)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    {...register('slug')}
                    onBlur={(e) => checkSlug(e.target.value)}
                    placeholder="abhee-celestial-city"
                    className="field min-h-[40px] text-sm pr-20 font-mono"
                  />
                  <div className="absolute right-2 top-2.5 text-2xs">
                    {slugStatus === 'checking' && <span className="text-ink-muted">Checking...</span>}
                    {slugStatus === 'available' && <span className="text-accent-ink font-medium">✓ Available</span>}
                    {slugStatus === 'taken' && <span className="text-danger font-medium">✕ Taken</span>}
                  </div>
                </div>
                {errors.slug && <p className="text-2xs text-danger mt-1">{errors.slug.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  {...register('tagline')}
                  placeholder="e.g. Multi-generation apartments near Dommasandra"
                  className="field min-h-[40px] text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Full Description</label>
                <textarea
                  rows={4}
                  {...register('description')}
                  placeholder="Comprehensive description of the project, towers, location advantages, and layout details..."
                  className="field text-sm p-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Segment</label>
                <select {...register('segment')} className="field min-h-[40px] text-sm">
                  <option value="residential">Residential</option>
                  <option value="plot">Plot / Plotted Enclave</option>
                  <option value="commercial">Commercial / Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Transaction Type</label>
                <select {...register('transaction')} className="field min-h-[40px] text-sm">
                  <option value="sale">For Sale</option>
                  <option value="rent">For Lease / Rent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Property Type</label>
                <select {...register('propertyType')} className="field min-h-[40px] text-sm">
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="row-house">Row House</option>
                  <option value="plot">Plot</option>
                  <option value="office">Office Space</option>
                  <option value="retail">Retail Space</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Featured Position / Rank</label>
                <input
                  type="number"
                  {...register('featuredRank', { valueAsNumber: true })}
                  placeholder="1 = top, 99 = normal"
                  className="field min-h-[40px] text-sm"
                />
              </div>

              <div className="flex items-center gap-6 sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" {...register('featured')} className="h-4 w-4 rounded accent-accent" />
                  Mark as Featured on Homepage
                </label>

                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" {...register('isNewLaunch')} className="h-4 w-4 rounded accent-accent" />
                  New Launch Project
                </label>
              </div>
            </div>

            {/* Highlights */}
            <div className="pt-4 border-t border-line space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Key Highlights & USPs</h3>
                  <p className="text-2xs text-ink-muted">Appears as bullet points on cards and detail pages</p>
                </div>
                <button
                  type="button"
                  onClick={() => highlights.append('' as never)}
                  className="btn-secondary min-h-[32px] px-2.5 text-2xs flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Highlight
                </button>
              </div>

              <div className="space-y-2">
                {highlights.fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      {...register(`highlights.${idx}` as never)}
                      placeholder="e.g. 75% open greenery and podium landscaping"
                      className="field min-h-[36px] text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => highlights.remove(idx)}
                      className="p-2 text-danger hover:bg-surface-2 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. LOCATION & DEVELOPER */}
        {activeTab === 'location' && (
          <div className="panel space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold border-b border-line pb-2">Developer & Location</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Developer Partner *</label>
                <select {...register('developerId')} className="field min-h-[40px] text-sm">
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Corridor / Micro-Market *</label>
                <select {...register('corridorId')} className="field min-h-[40px] text-sm">
                  {corridors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Locality / Landmark *</label>
                <input
                  type="text"
                  {...register('locality')}
                  placeholder="e.g. Near Dommasandra, Sarjapur–Whitefield Road"
                  className="field min-h-[40px] text-sm"
                />
                {errors.locality && <p className="text-2xs text-danger mt-1">{errors.locality.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Full Postal Address</label>
                <input
                  type="text"
                  {...register('address')}
                  placeholder="e.g. Sy. No 42/1, Dommasandra Village, Sarjapur Road, Bengaluru 562125"
                  className="field min-h-[40px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">GPS Latitude (optional)</label>
                <input
                  type="number"
                  step="any"
                  {...register('geo.lat', {
                    setValueAs: (v) => (v === '' || v == null ? null : parseFloat(v)),
                  })}
                  placeholder="e.g. 12.9101"
                  className="field min-h-[40px] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">GPS Longitude (optional)</label>
                <input
                  type="number"
                  step="any"
                  {...register('geo.lng', {
                    setValueAs: (v) => (v === '' || v == null ? null : parseFloat(v)),
                  })}
                  placeholder="e.g. 77.6899"
                  className="field min-h-[40px] text-sm font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. CONFIGURATIONS & PRICING */}
        {activeTab === 'configs' && (
          <div className="panel space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div>
                <h2 className="text-base font-semibold">Configurations & Pricing</h2>
                <p className="text-2xs text-ink-muted">Add BHK unit types, area sizes, and guide price ranges</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  configs.append({
                    id: `c-${Date.now().toString(36)}`,
                    label: '3 BHK',
                    bhk: 3,
                    carpetSqftMin: 1400,
                    carpetSqftMax: 1650,
                    superSqftMin: 1750,
                    superSqftMax: 2050,
                    priceMin: 16000000,
                    priceMax: 18500000,
                    floorPlanImageId: null,
                  })
                }
                className="btn-secondary min-h-[34px] px-3 text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Configuration
              </button>
            </div>

            <div className="space-y-4">
              {configs.fields.map((c, idx) => (
                <div key={c.id} className="rounded-xl border border-line p-4 space-y-3 bg-surface-2/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-accent text-white flex items-center justify-center font-mono text-2xs">
                        {idx + 1}
                      </span>
                      Configuration #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => configs.remove(idx)}
                      className="text-danger hover:bg-surface-2 p-1.5 rounded"
                      title="Remove configuration"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Label *</label>
                      <input
                        type="text"
                        {...register(`configurations.${idx}.label`)}
                        placeholder="2 BHK / 3 BHK / 1200 sq.ft plot"
                        className="field min-h-[36px] text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">BHK Count</label>
                      <input
                        type="number"
                        step="0.5"
                        {...register(`configurations.${idx}.bhk`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseFloat(v)),
                        })}
                        placeholder="2, 2.5, 3"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Carpet Area Min (sq.ft)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.carpetSqftMin`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="1100"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Carpet Area Max (sq.ft)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.carpetSqftMax`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="1350"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Super Area Min (sq.ft)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.superSqftMin`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="1400"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Super Area Max (sq.ft)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.superSqftMax`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="1750"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Price Min (₹)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.priceMin`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="12000000"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Price Max (₹)</label>
                      <input
                        type="number"
                        {...register(`configurations.${idx}.priceMax`, {
                          setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                        })}
                        placeholder="14500000"
                        className="field min-h-[36px] text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Global Pricing Summary */}
            <div className="pt-4 border-t border-line">
              <h3 className="text-sm font-semibold mb-3">Overall Property Price & Size Summary</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Global Starting Price (₹) *</label>
                  <input
                    type="number"
                    {...register('priceMin', { valueAsNumber: true })}
                    placeholder="e.g. 13500000 (1.35 Cr)"
                    className="field min-h-[40px] text-sm font-semibold text-accent-ink"
                  />
                  {errors.priceMin && <p className="text-2xs text-danger mt-1">{errors.priceMin.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Global Maximum Price (₹)</label>
                  <input
                    type="number"
                    {...register('priceMax', {
                      setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                    })}
                    placeholder="e.g. 28500000 (2.85 Cr)"
                    className="field min-h-[40px] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Rate per Sq.Ft (₹)</label>
                  <input
                    type="number"
                    {...register('pricePerSqft', {
                      setValueAs: (v) => (v === '' || v == null ? null : parseFloat(v)),
                    })}
                    placeholder="e.g. 8500"
                    className="field min-h-[40px] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Minimum Area (sq.ft)</label>
                  <input
                    type="number"
                    {...register('sizeMin', {
                      setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                    })}
                    placeholder="e.g. 1180"
                    className="field min-h-[40px] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Maximum Area (sq.ft)</label>
                  <input
                    type="number"
                    {...register('sizeMax', {
                      setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                    })}
                    placeholder="e.g. 2850"
                    className="field min-h-[40px] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Monthly Rent (if commercial/lease)</label>
                  <input
                    type="number"
                    {...register('rentPerMonth', {
                      setValueAs: (v) => (v === '' || v == null ? null : parseInt(v, 10)),
                    })}
                    placeholder="e.g. 125000"
                    className="field min-h-[40px] text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. POSSESSION */}
        {activeTab === 'possession' && (
          <div className="panel space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold border-b border-line pb-2">Possession Timeline & Status</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium mb-1">Possession Status</label>
                <select {...register('possession.status')} className="field min-h-[40px] text-sm">
                  <option value="under-construction">Under Construction</option>
                  <option value="ready">Ready to Move in</option>
                  <option value="pre-launch">Pre-Launch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Possession Target Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  {...register('possession.date', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  className="field min-h-[40px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Display Label *</label>
                <input
                  type="text"
                  {...register('possession.label')}
                  placeholder="e.g. December 2026 / Ready to Move / 2030 (Pre-Launch)"
                  className="field min-h-[40px] text-sm"
                />
                {errors.possession?.label && <p className="text-2xs text-danger mt-1">{errors.possession.label.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* 5. LEGAL & APPROVALS */}
        {activeTab === 'legal' && (
          <div className="panel space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-semibold border-b border-line pb-2">RERA & Statutory Approvals</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">K-RERA Registration Number</label>
                <input
                  type="text"
                  {...register('rera.number', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  placeholder="PRM/KA/RERA/1251/308/PR/231102/006378"
                  className="field min-h-[40px] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">RERA Status</label>
                <label className="flex items-center gap-2 mt-2.5 text-sm cursor-pointer">
                  <input type="checkbox" {...register('rera.registered')} className="h-4 w-4 rounded accent-accent" />
                  RERA Registered & Verified
                </label>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium mb-1">RERA Verification Portal URL</label>
                <input
                  type="url"
                  {...register('rera.verifyUrl', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  placeholder="https://rera.karnataka.gov.in/"
                  className="field min-h-[40px] text-sm font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Khata Certificate</label>
                <select
                  {...register('approvals.khata', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  className="field min-h-[40px] text-sm"
                >
                  <option value="">Not Specified</option>
                  <option value="A">A Khata (Fully Compliant)</option>
                  <option value="B">B Khata</option>
                  <option value="E">E Khata</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Plan Sanctioning Authority</label>
                <select
                  {...register('approvals.planAuthority', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  className="field min-h-[40px] text-sm"
                >
                  <option value="">Not Specified</option>
                  <option value="BDA">BDA (Bangalore Development Authority)</option>
                  <option value="BBMP">BBMP (Bruhat Bengaluru Mahanagara Palike)</option>
                  <option value="BMRDA">BMRDA (Bangalore Metropolitan Region)</option>
                  <option value="BIAAPA">BIAAPA (Airport Area Planning)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Title & Kaveri Deed Check</label>
                <select
                  {...register('approvals.titleCheck', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  className="field min-h-[40px] text-sm"
                >
                  <option value="">Not Specified</option>
                  <option value="clear">Clear Title Verified</option>
                  <option value="pending">Legal Check Pending</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium mb-1">Legal & Approval Notes</label>
                <input
                  type="text"
                  {...register('approvals.notes')}
                  placeholder="e.g. Developer states full OC and CC received for Phase 1"
                  className="field min-h-[40px] text-sm"
                />
              </div>
            </div>

            {/* Bank APFs */}
            <div className="pt-4 border-t border-line">
              <label className="block text-xs font-medium mb-2">Pre-Approved Banking Partners (APFs)</label>
              <div className="flex flex-wrap gap-2">
                {BANKS.map((bank) => {
                  const currentBanks: string[] = watch('bankApprovals') || [];
                  const isChecked = currentBanks.includes(bank);
                  return (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setValue(
                            'bankApprovals',
                            currentBanks.filter((b) => b !== bank)
                          );
                        } else {
                          setValue('bankApprovals', [...currentBanks, bank]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        isChecked
                          ? 'border-accent-ink bg-accent-soft text-accent-ink font-semibold'
                          : 'border-line text-ink-muted hover:border-line-strong'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {bank}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 6. AMENITIES & LENSES */}
        {activeTab === 'features' && (
          <div className="panel space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold border-b border-line pb-2 mb-3">Target Buyer Lenses</h2>
              <p className="text-2xs text-ink-muted mb-3">Helps match buyers searching by personality or life stage</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {LENSES.map(({ id, label }) => {
                  const currentLenses: Lens[] = watch('lenses') || [];
                  const checked = currentLenses.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        checked ? 'border-accent-ink bg-accent-soft/30' : 'border-line hover:bg-surface-2'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setValue(
                              'lenses',
                              currentLenses.filter((l) => l !== id)
                            );
                          } else {
                            setValue('lenses', [...currentLenses, id]);
                          }
                        }}
                        className="h-4 w-4 rounded accent-accent"
                      />
                      <span className="text-xs font-medium">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-line">
              <h3 className="text-sm font-semibold mb-2">Amenities & Infrastructure</h3>
              <div className="flex flex-wrap gap-2">
                {COMMON_AMENITIES.map((am) => {
                  const currentAm: string[] = watch('amenities') || [];
                  const checked = currentAm.includes(am);
                  return (
                    <button
                      key={am}
                      type="button"
                      onClick={() => {
                        if (checked) {
                          setValue(
                            'amenities',
                            currentAm.filter((a) => a !== am)
                          );
                        } else {
                          setValue('amenities', [...currentAm, am]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        checked
                          ? 'border-accent-ink bg-accent-soft text-accent-ink font-semibold'
                          : 'border-line text-ink-muted hover:border-line-strong'
                      }`}
                    >
                      {checked ? '✓ ' : '+ '}
                      {am}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 7. MEDIA & CLOUDINARY */}
        {activeTab === 'media' && (
          <div className="panel space-y-6 p-5 sm:p-6">
            <div className="border-b border-line pb-2">
              <h2 className="text-base font-semibold">Media & Photography (Cloudinary)</h2>
              <p className="text-2xs text-ink-muted">
                Images are uploaded straight to Cloudinary with real dimensions and 16px blur previews
              </p>
            </div>

            {/* Gallery Uploader */}
            <MediaUploader
              label="Gallery Photos & Architecture Renders"
              description="The first image automatically acts as the cover photo, or click 'Set cover' on any image."
              images={watchedGallery}
              onChange={(imgs) => {
                setValue('media.gallery', imgs);
                if (imgs[0]) {
                  setValue('media.cover', imgs[0]);
                }
              }}
              storagePath={`properties/${watch('id')}/gallery`}
              coverId={watchedCover?.id}
              onSetCover={(img) => setValue('media.cover', img)}
            />

            {/* Floor Plans Uploader */}
            <div className="pt-4 border-t border-line">
              <MediaUploader
                label="Floor Plans & Master Plan Renders"
                description="Upload unit floor plan layouts for 2 BHK, 3 BHK, and master site layouts."
                images={watchedFloorPlans}
                onChange={(imgs) => setValue('media.floorPlans', imgs)}
                storagePath={`properties/${watch('id')}/floorplans`}
              />
            </div>
          </div>
        )}

        {/* 8. COMMUTE RADAR */}
        {activeTab === 'commute' && (
          <div className="panel space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div>
                <h2 className="text-base font-semibold">Commute Radar to Office Hubs</h2>
                <p className="text-2xs text-ink-muted">
                  Measured drive times to Bengaluru tech hubs with citable source and date
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  commute.append({
                    hubId: hubs[0]?.id || 'manyata',
                    peakMins: 45,
                    offPeakMins: 25,
                    source: 'Google Maps Traffic Measurement',
                    asOf: new Date().toISOString().slice(0, 10),
                  })
                }
                className="btn-secondary min-h-[32px] px-3 text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Hub Commute
              </button>
            </div>

            <div className="space-y-3">
              {commute.fields.map((field, idx) => (
                <div key={field.id} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-5 items-end">
                  <div>
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Tech Park / Hub</label>
                    <select {...register(`commute.${idx}.hubId`)} className="field min-h-[36px] text-xs">
                      {hubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Peak Drive (mins)</label>
                    <input
                      type="number"
                      {...register(`commute.${idx}.peakMins`, { valueAsNumber: true })}
                      placeholder="45"
                      className="field min-h-[36px] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Off-Peak (mins)</label>
                    <input
                      type="number"
                      {...register(`commute.${idx}.offPeakMins`, { valueAsNumber: true })}
                      placeholder="25"
                      className="field min-h-[36px] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Source & As-Of Date</label>
                    <input
                      type="text"
                      {...register(`commute.${idx}.source`)}
                      placeholder="Measured traffic"
                      className="field min-h-[36px] text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="date" {...register(`commute.${idx}.asOf`)} className="field min-h-[36px] text-xs flex-1" />
                    <button
                      type="button"
                      onClick={() => commute.remove(idx)}
                      className="p-2 text-danger hover:bg-surface-2 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. SEO & METADATA */}
        {activeTab === 'seo' && (
          <div className="panel space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold border-b border-line pb-2">Search Engine Optimization (SEO)</h2>
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-medium mb-1">Meta Title</label>
                <input
                  type="text"
                  {...register('seo.title')}
                  placeholder="e.g. Abhee Celestial City | Verified Homes near Dommasandra"
                  className="field min-h-[40px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Meta Description</label>
                <textarea
                  rows={3}
                  {...register('seo.description')}
                  placeholder="e.g. Discover verified 3+2 & 3+3 BHK apartments at Abhee Celestial City near Greenwood High with direct developer pricing."
                  className="field text-sm p-3"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom submit button */}
        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-2xs text-ink-muted">
            All updates save directly to Google Cloud Firestore and trigger instant website cache revalidation.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary min-h-[42px] px-6 text-sm flex items-center gap-2 font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save & Update Listing
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

