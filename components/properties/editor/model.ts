import type { z } from 'zod';
import { Building2, Car, FileText, Image as ImageIcon, Layers, ListPlus, MapPin, Receipt, Ruler, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { propertySchema } from '@/lib/data/schemas';
import { emptyListingDetails } from '@/lib/data/defaults';
import type { Configuration, Corridor, Developer, ImageRef, Property } from '@/lib/data/types';

export const formSchema = propertySchema.omit({
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  createdBy: true,
  updatedBy: true,
});

export type Draft = z.infer<typeof formSchema>;

/** Stand-in cover for drafts without photos. Publishing requires a real photo. */
export const PLACEHOLDER_COVER: ImageRef = {
  id: 'placeholder',
  storagePath: '',
  url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
  alt: 'Photo coming soon',
  width: 1600,
  height: 1060,
  blurDataURL: '',
  order: 0,
};

/** A new listing starts neutral: nothing is claimed (approvals, banks, RERA) until it is entered. */
export function blankProperty(developer?: Developer, corridor?: Corridor): Draft {
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
    highlights: [],
    developerId: developer?.id ?? '',
    developerName: developer?.name ?? '',
    corridorId: corridor?.id ?? '',
    corridorName: corridor?.name ?? '',
    locality: '',
    address: '',
    geo: null,
    geohash: null,
    configurations: [],
    bhkOptions: [],
    priceMin: undefined as unknown as number,
    priceMax: null,
    sizeMin: null,
    sizeMax: null,
    pricePerSqft: null,
    rentPerMonth: null,
    possession: { status: 'under-construction', date: null, label: '', reraDate: null },
    rera: { number: null, verifyUrl: 'https://rera.karnataka.gov.in/', registered: false },
    approvals: { khata: null, planAuthority: null, titleCheck: null, notes: '' },
    bankApprovals: [],
    amenities: [],
    lenses: [],
    media: { cover: PLACEHOLDER_COVER, gallery: [], floorPlans: [], brochure: null, masterPlan: null, videoUrl: null, virtualTourUrl: null },
    metrics: null,
    commute: [],
    seo: { title: '', description: '', ogImageId: null },
    ...emptyListingDetails(),
  };
}

export function draftFromProperty(property: Property): Draft {
  const { createdAt: _c, updatedAt: _u, publishedAt: _p, createdBy: _cb, updatedBy: _ub, ...rest } = property;
  return {
    ...rest,
    media: { masterPlan: null, videoUrl: null, virtualTourUrl: null, ...rest.media },
    possession: { reraDate: null, ...rest.possession },
    approvals: { oc: null, ...rest.approvals },
  };
}

export function newConfiguration(label: string, bhk: number | null): Configuration {
  return {
    id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    label,
    bhk,
    carpetSqftMin: null,
    carpetSqftMax: null,
    superSqftMin: null,
    superSqftMax: null,
    priceMin: null,
    priceMax: null,
    floorPlanImageId: null,
    bathrooms: bhk && bhk >= 1 ? Math.min(Math.ceil(bhk), 5) : null,
    dimensions: null,
    availability: 'available',
    notes: '',
  };
}

export type SectionId = 'location' | 'basics' | 'facts' | 'units' | 'charges' | 'legal' | 'amenities' | 'connectivity' | 'media' | 'documents' | 'extras' | 'seo';

export const SECTIONS: { id: SectionId; label: string; description: string; icon: typeof MapPin }[] = [
  { id: 'location', label: 'Region, area & partner', description: 'Pick the Bengaluru region and area first, then the locality, map pin and partner.', icon: MapPin },
  { id: 'basics', label: 'Basics', description: 'Name, web address, type and the story of the project.', icon: Building2 },
  { id: 'facts', label: 'Project facts', description: 'Land, towers, units and open space, as stated by the developer.', icon: Ruler },
  { id: 'units', label: 'Unit types & pricing', description: 'Each configuration with sizes, prices and its floor plan.', icon: Layers },
  { id: 'charges', label: 'Charges & payment plan', description: 'Every line of the cost sheet beyond the basic price, and the payment schedule.', icon: Receipt },
  { id: 'legal', label: 'Possession & RERA', description: 'Timelines, K-RERA registration, approvals and bank tie-ups.', icon: ShieldCheck },
  { id: 'amenities', label: 'Amenities & specifications', description: 'What residents get and what the homes are built with.', icon: Sparkles },
  { id: 'connectivity', label: 'Connectivity', description: 'Distances to metro, schools, hospitals, offices and more.', icon: Car },
  { id: 'media', label: 'Photos & media', description: 'Gallery, cover, master plan, video and virtual tour.', icon: ImageIcon },
  { id: 'documents', label: 'Documents', description: 'Brochure, floor-plan set, price sheet and other PDFs.', icon: FileText },
  { id: 'extras', label: 'More details', description: 'Any other detail as a label and value: charges, payment plan, parking…', icon: ListPlus },
  { id: 'seo', label: 'Search & sharing', description: 'How the listing appears on Google and when shared.', icon: Search },
];

/** Which section owns an error at a given field path (most specific prefix first). */
const OWNERS: [string, SectionId][] = [
  ['media.floorPlans', 'units'],
  ['developer', 'location'],
  ['corridor', 'location'],
  ['locality', 'location'],
  ['address', 'location'],
  ['geo', 'location'],
  ['facts', 'facts'],
  ['configurations', 'units'],
  ['bhkOptions', 'units'],
  ['price', 'units'],
  ['size', 'units'],
  ['rentPerMonth', 'units'],
  ['offer', 'units'],
  ['charges', 'charges'],
  ['paymentPlan', 'charges'],
  ['possession', 'legal'],
  ['rera', 'legal'],
  ['approvals', 'legal'],
  ['bankApprovals', 'legal'],
  ['amenities', 'amenities'],
  ['specifications', 'amenities'],
  ['nearby', 'connectivity'],
  ['commute', 'connectivity'],
  ['media', 'media'],
  ['documents', 'documents'],
  ['extraDetails', 'extras'],
  ['metrics', 'extras'],
  ['seo', 'seo'],
];

export function sectionOf(path: string): SectionId {
  return OWNERS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'basics';
}

/** Plain-language messages for the errors people hit most. */
const FRIENDLY: Record<string, string> = {
  developerId: 'Choose the partner developer.',
  developerName: 'Choose the partner developer.',
  corridorId: 'Choose the area.',
  corridorName: 'Choose the area.',
  locality: 'Add the locality (e.g. “Off Sarjapur Road, near Dommasandra”).',
  title: 'Add the project name.',
  slug: 'Add a web address (lowercase letters, numbers and hyphens).',
  priceMin: 'Enter the starting price in ₹ — it is used for budget filters even when the price is shown “on request”.',
  'possession.label': 'Add the possession label (e.g. “Dec 2028”).',
};

export function friendlyMessage(path: string, message: string): string {
  return FRIENDLY[path] ?? message.replace(/^String must contain at least 1 character\(s\)$/, 'This field is required.').replace(/^Expected number, received (nan|null)$/, 'Enter a number.').replace(/^Required$/, 'This field is required.');
}

type ErrorNode = { message?: unknown } | Record<string, unknown> | undefined;

/** Turns react-hook-form's nested error object into [path, message] pairs. */
export function flattenErrors(errors: unknown, prefix = ''): { path: string; message: string }[] {
  if (!errors || typeof errors !== 'object') return [];
  const node = errors as ErrorNode & Record<string, unknown>;
  if (typeof node.message === 'string' && prefix) return [{ path: prefix, message: friendlyMessage(prefix, node.message) }];
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === 'ref' || key === 'type' || key === 'message' || key === 'types') return [];
    return flattenErrors(value, prefix ? `${prefix}.${key}` : key);
  });
}

/** A quick "is this section reasonably complete" check, used for the quality score. */
export function sectionComplete(id: SectionId, d: Draft): boolean | null {
  switch (id) {
    case 'location':
      return Boolean(d.developerId && d.corridorId && d.locality?.trim());
    case 'basics':
      return Boolean(d.title?.trim() && d.slug && (d.description?.trim().length ?? 0) >= 80);
    case 'facts':
      return Boolean(d.facts?.landAcres || d.facts?.totalUnits || d.facts?.towers);
    case 'units':
      return d.configurations.length > 0 && (d.priceOnRequest || Number(d.priceMin) > 0);
    case 'charges':
      return d.charges.length > 0 || d.paymentPlan.stages.length > 0 ? true : null;
    case 'legal':
      return Boolean(d.rera?.number && d.possession?.label);
    case 'amenities':
      return d.amenities.length >= 3;
    case 'connectivity':
      return d.nearby.length >= 3;
    case 'media':
      return d.media.gallery.length >= 3;
    case 'documents':
      return d.documents.length > 0;
    case 'seo':
      return Boolean(d.seo?.title?.trim() && d.seo?.description?.trim());
    default:
      return null;
  }
}
