import type { Charge, Configuration, Corridor, Developer, ImageRef, Property, PropertyDocument, UnitKind } from '@/lib/data/types';
import type { PropertyDraft } from '@/lib/data/api';
import { emptyListingDetails } from '@/lib/data/defaults';
import type { ParsedProject, ParsedUnit } from './parse';

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

/** Media copied for one project, in the order the importer found it. */
export interface ImportedMedia {
  cover: ImageRef | null;
  gallery: ImageRef[];
  masterPlan: ImageRef | null;
  floorPlans: { image: ImageRef; unitIndex?: number }[];
  documents: PropertyDocument[];
  videoUrl?: string;
  /** False when photos were not re-imported (the listing keeps its current photos). */
  replaced: boolean;
}

const KIND_LABEL: Partial<Record<UnitKind, string>> = {
  studio: 'Studio',
  duplex: 'Duplex',
  penthouse: 'Penthouse',
  villa: 'Villa',
  'row-house': 'Row house',
  villament: 'Villament',
  'independent-house': 'Independent house',
  plot: 'Plot',
  office: 'Office',
  retail: 'Retail',
};

/** "2.5 BHK", "4 BHK Row house", "Studio", "30 × 40 plot", "1,200 sq.ft plot". */
export function unitLabel(u: ParsedUnit): string {
  if (u.label) return u.label.slice(0, 80);
  if (u.kind === 'plot') return u.dimensions ? `${u.dimensions.replace(/\s*[x*×]\s*/i, ' × ')} plot` : u.carpetMin ? `${u.carpetMin.toLocaleString('en-IN')} sq.ft plot` : 'Plot';
  const kind = KIND_LABEL[u.kind];
  if (u.bhk != null) return kind && u.kind !== 'apartment' ? `${u.bhk} BHK ${kind}` : `${u.bhk} BHK`;
  return kind ?? 'Unit';
}

/** Cuts at a word boundary. */
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}`);
const PROPERTY_NOUN: Partial<Record<Property['propertyType'], string>> = { villa: 'Villas', 'row-house': 'Row houses', villament: 'Villaments', office: 'Offices', retail: 'Retail spaces', plot: 'Plots' };

const uid = (prefix: string, i: number) => `${prefix}-${Date.now().toString(36)}-${i}`;
const SEGMENT_OF: Record<string, Property['segment']> = { plot: 'plot', office: 'commercial', retail: 'commercial' };

export interface BuildContext {
  project: ParsedProject;
  existing: Property | null;
  developer: Developer;
  corridor: Corridor;
  media: ImportedMedia;
}

/** Builds the listing. Blank cells and child sheets without rows keep the existing values. */
export function buildDraft({ project, existing, developer, corridor, media }: BuildContext): { draft: PropertyDraft; warnings: string[] } {
  const f = project.fields;
  const warnings: string[] = [];
  const base = existing ?? null;
  const details = existing ?? { ...emptyListingDetails() };
  const id = existing?.id ?? `p-${project.key}`;
  const title = [f.name, f.phase].filter(Boolean).join(' ').trim() || existing?.title || project.key;
  const propertyType = f.propertyType ?? existing?.propertyType ?? (project.units?.every((u) => u.kind === 'plot') ? 'plot' : 'apartment');
  const segment = f.segment ?? existing?.segment ?? SEGMENT_OF[propertyType] ?? 'residential';
  const transaction = f.transaction ?? existing?.transaction ?? 'sale';

  // ---- Media ----
  let gallery = existing?.media.gallery ?? [];
  let floorPlans = existing?.media.floorPlans ?? [];
  let masterPlan = existing?.media.masterPlan ?? null;
  let cover = existing?.media.cover ?? PLACEHOLDER_COVER;
  const planForUnit = new Map<number, string>();
  if (media.replaced) {
    const photos = [...(media.cover ? [media.cover] : []), ...media.gallery.filter((g) => g.url !== media.cover?.url)];
    if (photos.length) {
      gallery = photos.map((img, order) => ({ ...img, order }));
      cover = gallery[0];
    }
    if (media.floorPlans.length) {
      floorPlans = media.floorPlans.map((p, order) => ({ ...p.image, order }));
      media.floorPlans.forEach((p) => p.unitIndex != null && planForUnit.set(p.unitIndex, p.image.id));
    }
    if (media.masterPlan) masterPlan = media.masterPlan;
  }
  if (!gallery.length && cover.id !== 'placeholder') gallery = [cover];

  // ---- Units ----
  let configurations: Configuration[] = existing?.configurations ?? [];
  if (project.units) {
    configurations = project.units.map((u, i) => {
      const old = existing?.configurations.find((c) => c.label === unitLabel(u));
      return {
        id: old?.id ?? `${id}-u${i + 1}`,
        label: unitLabel(u),
        bhk: u.bhk,
        unitKind: u.kind,
        carpetSqftMin: u.carpetMin,
        carpetSqftMax: u.carpetMax,
        superSqftMin: u.superMin,
        superSqftMax: u.superMax,
        priceMin: u.priceMin,
        priceMax: u.priceMax,
        floorPlanImageId: planForUnit.get(i) ?? (media.replaced ? null : old?.floorPlanImageId ?? null),
        bathrooms: u.bathrooms,
        dimensions: u.dimensions,
        availability: u.availability,
        notes: u.notes,
        balconySqft: u.balcony,
        terraceSqft: u.terrace,
        udsSqft: u.uds,
        ratePerSqft: u.rate,
        totalPriceMin: u.totalMin,
        totalPriceMax: u.totalMax,
        carParks: u.carParks,
        facing: u.facing,
        tower: u.tower,
        unitCount: u.unitCount,
      };
    });
    const labels = configurations.map((c) => c.label);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    if (dupes.length) {
      // Same label twice (two 3 BHK sizes): add the size so visitors can tell them apart.
      configurations = configurations.map((c) =>
        dupes.includes(c.label) && (c.superSqftMin || c.carpetSqftMin) ? { ...c, label: `${c.label} · ${(c.superSqftMin ?? c.carpetSqftMin)!.toLocaleString('en-IN')} sq.ft` } : c,
      );
    }
  }
  const valid = configurations.filter((c) => c.availability !== 'sold-out');
  const pool = valid.length ? valid : configurations;
  const prices = pool.flatMap((c) => [c.priceMin, c.priceMax]).filter((n): n is number => typeof n === 'number' && n > 0);
  const sizes = configurations.flatMap((c) => [c.superSqftMin ?? c.carpetSqftMin, c.superSqftMax ?? c.carpetSqftMax]).filter((n): n is number => typeof n === 'number' && n > 0);
  const rates = configurations.map((c) => c.ratePerSqft).filter((n): n is number => typeof n === 'number' && n > 0);
  const bhkOptions = Array.from(new Set(configurations.map((c) => c.bhk).filter((b): b is number => b != null && b > 0))).sort((a, b) => a - b);

  let priceMin = prices.length ? Math.min(...prices) : f.startingPrice ?? existing?.priceMin ?? null;
  let priceMax = prices.length > 1 ? Math.max(...prices) : f.maxPrice ?? (prices.length ? null : existing?.priceMax ?? null);
  if (f.startingPrice && !prices.length) priceMin = f.startingPrice;
  let priceOnRequest = f.priceOnRequest ?? details.priceOnRequest;
  if (!priceMin || priceMin <= 0) {
    // The schema needs a positive figure for budget filters; mark the price as on request.
    if (transaction === 'rent' && f.rentPerMonth) priceMin = f.rentPerMonth;
    else {
      priceMin = existing?.priceMin ?? 1;
      priceOnRequest = true;
    }
  }
  if (priceMax != null && priceMax <= priceMin) priceMax = null;

  // ---- Child lists ----
  const charges: Charge[] = project.charges
    ? project.charges.map((c, i) => ({ id: uid('chg', i), label: c.label.slice(0, 120), amount: c.amount, basis: c.basis, payable: c.payable.slice(0, 120), note: c.note.slice(0, 300) }))
    : details.charges;
  const paymentPlan = {
    type: f.paymentPlanType ?? details.paymentPlan.type,
    bookingPct: f.bookingPct ?? details.paymentPlan.bookingPct,
    stages: project.stages ? project.stages.map((s, i) => ({ id: uid('pay', i), stage: s.stage.slice(0, 200), percent: s.percent, note: s.note.slice(0, 200) })) : details.paymentPlan.stages,
  };
  const nearby = project.nearby
    ? project.nearby.map((n, i) => ({ id: uid('near', i), category: n.category, name: n.name.slice(0, 120), distanceKm: n.distanceKm != null && n.distanceKm >= 0 && n.distanceKm <= 500 ? n.distanceKm : null, travelMins: n.travelMins != null && n.travelMins <= 600 ? n.travelMins : null }))
    : details.nearby;
  const specifications = project.specs ? project.specs.map((s, i) => ({ id: uid('spec', i), category: s.category, detail: s.detail })) : details.specifications;
  const extraDetails = project.extras ? project.extras.map((x, i) => ({ id: uid('x', i), group: x.group.slice(0, 60), label: x.label, value: x.value })) : details.extraDetails;
  const documents = media.documents.length ? media.documents : details.documents;

  // ---- Status ----
  let status: Property['status'] = f.status ?? existing?.status ?? 'draft';
  if (status === 'published' && (!gallery.length || cover.id === 'placeholder')) {
    status = 'draft';
    warnings.push('Saved as a draft because it has no photos yet.');
  }

  const possessionStatus = f.possessionStatus ?? existing?.possession.status ?? 'under-construction';
  const possessionLabel = f.possessionLabel ?? existing?.possession.label ?? (possessionStatus === 'ready' ? 'Ready to move' : possessionStatus === 'pre-launch' ? 'Pre-launch' : 'Under construction');
  const offer = f.offerText ? { text: f.offerText.slice(0, 200), validUntil: f.offerValidUntil ?? null } : details.offer;
  const amenities = f.amenities ?? existing?.amenities ?? [];
  const tagline = f.tagline ?? existing?.tagline ?? '';
  const description = f.description ?? existing?.description ?? '';
  const configText = bhkOptions.length ? `${bhkOptions.join(', ')} BHK` : configurations[0]?.label ?? '';

  const draft: PropertyDraft = {
    id,
    slug: existing?.slug ?? project.key,
    status,
    featured: f.featured ?? existing?.featured ?? false,
    featuredRank: existing?.featuredRank ?? 99,
    segment,
    transaction,
    isNewLaunch: f.newLaunch ?? existing?.isNewLaunch ?? possessionStatus === 'pre-launch',
    propertyType,
    title,
    tagline: tagline.slice(0, 200),
    description,
    highlights: f.highlights ?? existing?.highlights ?? [],
    developerId: developer.id,
    developerName: developer.name,
    corridorId: corridor.id,
    corridorName: corridor.name,
    locality: f.locality ?? existing?.locality ?? corridor.name,
    address: f.address ?? existing?.address ?? '',
    geo: f.geo ?? existing?.geo ?? null,
    geohash: existing?.geohash ?? null,
    configurations,
    bhkOptions,
    priceMin: Math.round(priceMin),
    priceMax: priceMax != null ? Math.round(priceMax) : null,
    sizeMin: sizes.length ? Math.min(...sizes) : existing?.sizeMin ?? null,
    sizeMax: sizes.length > 1 && Math.max(...sizes) > Math.min(...sizes) ? Math.max(...sizes) : sizes.length ? null : existing?.sizeMax ?? null,
    pricePerSqft: f.ratePerSqft ?? (rates.length ? Math.min(...rates) : existing?.pricePerSqft ?? null),
    rentPerMonth: f.rentPerMonth ?? existing?.rentPerMonth ?? null,
    priceOnRequest,
    priceNote: (f.priceNote ?? details.priceNote).slice(0, 160),
    possession: {
      status: possessionStatus,
      date: f.possessionDate ?? existing?.possession.date ?? null,
      label: possessionLabel,
      reraDate: f.reraDate ?? existing?.possession.reraDate ?? null,
    },
    rera: {
      number: f.reraNumber ?? existing?.rera.number ?? null,
      verifyUrl: existing?.rera.verifyUrl ?? 'https://rera.karnataka.gov.in/',
      registered: f.reraVerified ?? existing?.rera.registered ?? false,
    },
    approvals: {
      khata: f.khata ?? existing?.approvals.khata ?? null,
      planAuthority: f.planAuthority ?? existing?.approvals.planAuthority ?? null,
      titleCheck: f.titleCheck ?? existing?.approvals.titleCheck ?? null,
      oc: f.oc ?? existing?.approvals.oc ?? null,
      notes: f.approvalNotes ?? existing?.approvals.notes ?? '',
    },
    bankApprovals: f.bankApprovals ?? existing?.bankApprovals ?? [],
    amenities,
    lenses: f.lenses ?? existing?.lenses ?? [],
    media: {
      cover,
      gallery,
      floorPlans,
      brochure: existing?.media.brochure ?? null,
      masterPlan,
      videoUrl: f.videoUrl ?? media.videoUrl ?? existing?.media.videoUrl ?? null,
      virtualTourUrl: f.virtualTourUrl ?? existing?.media.virtualTourUrl ?? null,
    },
    facts: {
      landAcres: f.landAcres ?? details.facts.landAcres,
      totalUnits: f.totalUnits ?? details.facts.totalUnits,
      towers: f.towers ?? details.facts.towers,
      floors: f.floors ?? details.facts.floors,
      openSpacePct: f.openSpacePct != null && f.openSpacePct <= 100 ? f.openSpacePct : details.facts.openSpacePct,
      clubhouseSqft: f.clubhouseSqft ?? details.facts.clubhouseSqft,
      launchDate: f.launchDate ?? details.facts.launchDate,
      clubhouseDetails: f.clubhouseDetails ?? details.facts.clubhouseDetails ?? null,
      facing: f.facing ?? details.facts.facing ?? null,
    },
    specifications,
    nearby,
    documents,
    extraDetails,
    offer,
    hidden: existing?.hidden ?? false,
    phase: f.phase ?? details.phase ?? '',
    charges,
    paymentPlan,
    metrics: base?.metrics ?? null,
    commute: base?.commute ?? [],
    seo: {
      title: f.seoTitle?.slice(0, 90) ?? existing?.seo.title ?? clip(`${title} | ${segment === 'plot' ? 'Plots' : configText || PROPERTY_NOUN[propertyType] || 'Homes'} in ${corridor.name}, Bengaluru`, 70),
      description: f.seoDescription?.slice(0, 200) ?? existing?.seo.description ?? clip(tagline || `${title} by ${developer.name} in ${corridor.name}, Bengaluru.`, 200),
      ogImageId: existing?.seo.ogImageId ?? null,
    },
  };
  return { draft, warnings };
}
