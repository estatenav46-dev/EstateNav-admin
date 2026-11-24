import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use an ISO date (YYYY-MM-DD)');
const slug = z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only');

export const imageRefSchema = z.object({
  id: z.string().min(1),
  storagePath: z.string(),
  url: z.string().url(),
  alt: z.string().min(1, 'Alt text is required'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: z.string(),
  order: z.number().int().nonnegative(),
  credit: z.string().optional(),
});

export const fileRefSchema = z.object({
  id: z.string().min(1),
  storagePath: z.string(),
  url: z.string().url(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const segmentSchema = z.enum(['residential', 'plot', 'commercial']);
export const transactionSchema = z.enum(['sale', 'rent']);
export const propertyTypeSchema = z.enum(['apartment', 'villa', 'row-house', 'villament', 'penthouse', 'independent-house', 'plot', 'office', 'retail']);
export const publishStatusSchema = z.enum(['draft', 'published', 'archived']);
export const possessionStatusSchema = z.enum(['ready', 'under-construction', 'pre-launch']);
export const lensSchema = z.enum(['first-home', 'upgrading', 'nri', 'senior', 'investor']);
export const unitAvailabilitySchema = z.enum(['available', 'limited', 'sold-out']);
/** What a unit row is. Lets one project mix apartments, studios, row houses, villas or plots. */
export const unitKindSchema = z.enum(['apartment', 'studio', 'duplex', 'penthouse', 'villa', 'row-house', 'villament', 'independent-house', 'plot', 'office', 'retail']);

// For plotted listings the carpet fields hold the plot area. The optional fields were added
// later; older records simply do not have them.
export const configurationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bhk: z.number().positive().nullable(),
  carpetSqftMin: z.number().int().positive().nullable(),
  carpetSqftMax: z.number().int().positive().nullable(),
  superSqftMin: z.number().int().positive().nullable(),
  superSqftMax: z.number().int().positive().nullable(),
  priceMin: z.number().int().positive().nullable(),
  priceMax: z.number().int().positive().nullable(),
  floorPlanImageId: z.string().nullable(),
  bathrooms: z.number().int().positive().nullable().optional(),
  /** Plot or villa dimensions, e.g. "30 × 40 ft". */
  dimensions: z.string().max(60).nullable().optional(),
  availability: unitAvailabilitySchema.optional(),
  /** Short note such as "with study" or "duplex". */
  notes: z.string().max(200).optional(),
  // ---- Added with the structured Excel import (all optional; older records lack them) ----
  unitKind: unitKindSchema.optional(),
  balconySqft: z.number().int().nonnegative().nullable().optional(),
  /** Private terrace or garden (row houses, penthouses, ground-floor units). */
  terraceSqft: z.number().int().nonnegative().nullable().optional(),
  /** Undivided share of land. */
  udsSqft: z.number().nonnegative().nullable().optional(),
  ratePerSqft: z.number().positive().nullable().optional(),
  /** All-inclusive price (basic + charges + GST, before stamp duty and registration). */
  totalPriceMin: z.number().int().positive().nullable().optional(),
  totalPriceMax: z.number().int().positive().nullable().optional(),
  carParks: z.number().int().nonnegative().nullable().optional(),
  facing: z.string().max(80).nullable().optional(),
  /** Tower, block, wing or series the unit belongs to. */
  tower: z.string().max(80).nullable().optional(),
  unitCount: z.number().int().positive().nullable().optional(),
});

export const sourcedSchema = z.object({ source: z.string().min(1), asOf: isoDate });

// ---- Listing details. Every field defaults, so listings saved before they existed still parse. ----

export const projectFactsSchema = z.object({
  landAcres: z.number().positive().nullable().default(null),
  totalUnits: z.number().int().positive().nullable().default(null),
  towers: z.number().int().positive().nullable().default(null),
  /** Free text such as "2B + G + 32". */
  floors: z.string().max(60).nullable().default(null),
  openSpacePct: z.number().min(0).max(100).nullable().default(null),
  clubhouseSqft: z.number().int().positive().nullable().default(null),
  launchDate: isoDate.nullable().default(null),
  /** e.g. "G+3, plus a 5,000 sq.ft kids' clubhouse". */
  clubhouseDetails: z.string().max(200).nullable().default(null),
  /** Facings available, e.g. "East & North". */
  facing: z.string().max(120).nullable().default(null),
});

export const specificationSchema = z.object({
  id: z.string().min(1),
  category: z.string().trim().min(1, 'Add a category').max(60),
  detail: z.string().trim().min(1, 'Add the specification').max(400),
});

export const nearbyCategorySchema = z.enum([
  'metro', 'railway', 'airport', 'bus', 'highway', 'it-park', 'school', 'college', 'hospital', 'mall', 'market', 'park', 'landmark',
]);

export const nearbyPlaceSchema = z.object({
  id: z.string().min(1),
  category: nearbyCategorySchema,
  name: z.string().trim().min(1, 'Name the place').max(120),
  distanceKm: z.number().nonnegative().max(500).nullable().default(null),
  travelMins: z.number().int().positive().max(600).nullable().default(null),
});

export const documentKindSchema = z.enum([
  'brochure', 'floor-plans', 'master-plan', 'price-sheet', 'payment-plan', 'specifications', 'rera-certificate', 'approval', 'other',
]);

export const propertyDocumentSchema = z.object({
  id: z.string().min(1),
  kind: documentKindSchema,
  label: z.string().trim().min(1, 'Name the document').max(120),
  url: z.string().url('Upload the file or paste a valid link'),
  /** Cloudinary public id; empty for documents linked from another site. */
  storagePath: z.string().default(''),
  format: z.enum(['pdf', 'image', 'link']).default('pdf'),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
  /** 'public' downloads straight away; 'on-request' asks the visitor to enquire first. */
  access: z.enum(['public', 'on-request']).default('on-request'),
});

/** Admin-defined label/value pairs for anything the fixed fields do not cover. */
export const extraDetailSchema = z.object({
  id: z.string().min(1),
  group: z.string().trim().max(60).default('More details'),
  label: z.string().trim().min(1, 'Add a label').max(80),
  value: z.string().trim().min(1, 'Add a value').max(500),
});

/** How a charge is counted: a fixed sum, per sq.ft, a percentage, monthly, or at actuals. */
export const chargeBasisSchema = z.enum(['lumpsum', 'per-sqft', 'percent', 'per-month', 'per-sqft-month', 'actuals', 'included']);

/** One line of the developer's cost sheet beyond the basic price (corpus, maintenance, floor rise…). */
export const chargeSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, 'Name the charge').max(120),
  amount: z.number().nonnegative().nullable().default(null),
  basis: chargeBasisSchema.default('lumpsum'),
  /** When it is paid, e.g. "At possession". */
  payable: z.string().trim().max(120).default(''),
  note: z.string().trim().max(300).default(''),
});

export const paymentStageSchema = z.object({
  id: z.string().min(1),
  stage: z.string().trim().min(1, 'Name the stage').max(200),
  percent: z.number().min(0).max(100).nullable().default(null),
  note: z.string().trim().max(200).default(''),
});

export const paymentPlanSchema = z.object({
  /** e.g. "Construction linked", "Time linked", "Down payment", "Subvention". */
  type: z.string().trim().max(80).default(''),
  bookingPct: z.number().min(0).max(100).nullable().default(null),
  stages: z.array(paymentStageSchema).default([]),
});

export const offerSchema = z.object({
  text: z.string().trim().min(1).max(200),
  validUntil: isoDate.nullable().default(null),
});

/** Bengaluru plan-sanctioning authorities (BBMP is now GBA; both names are accepted). */
export const planAuthoritySchema = z.enum(['BBMP', 'GBA', 'BDA', 'BMRDA', 'BIAAPA', 'APA', 'HPA', 'NPA', 'KIADB', 'DTCP', 'Panchayat', 'Other']);

export const propertySchema = z.object({
  id: z.string().min(1),
  slug,
  status: publishStatusSchema,
  featured: z.boolean(),
  featuredRank: z.number().int().nonnegative(),

  segment: segmentSchema,
  transaction: transactionSchema,
  isNewLaunch: z.boolean(),
  propertyType: propertyTypeSchema,

  title: z.string().min(2),
  tagline: z.string(),
  description: z.string(),
  highlights: z.array(z.string()),

  developerId: z.string().min(1),
  developerName: z.string().min(1),
  corridorId: z.string().min(1),
  corridorName: z.string().min(1),
  locality: z.string().min(1),
  address: z.string(),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  geohash: z.string().nullable(),

  configurations: z.array(configurationSchema),
  bhkOptions: z.array(z.number().positive()),
  priceMin: z.number().int().positive(),
  priceMax: z.number().int().positive().nullable(),
  sizeMin: z.number().int().positive().nullable(),
  sizeMax: z.number().int().positive().nullable(),
  pricePerSqft: z.number().positive().nullable(),
  rentPerMonth: z.number().int().positive().nullable(),
  /** Hides every price on the website; priceMin still drives budget filters and sorting. */
  priceOnRequest: z.boolean().default(false),
  /** e.g. "+ GST, registration and other charges" or "All-inclusive". */
  priceNote: z.string().max(160).default(''),

  possession: z.object({
    status: possessionStatusSchema,
    date: isoDate.nullable(),
    label: z.string().min(1),
    /** Completion date on the K-RERA registration, when it differs from the developer's target. */
    reraDate: isoDate.nullable().optional(),
  }),

  rera: z.object({ number: z.string().nullable(), verifyUrl: z.string().url().nullable(), registered: z.boolean() }),
  approvals: z.object({
    khata: z.enum(['A', 'B', 'E']).nullable(),
    planAuthority: planAuthoritySchema.nullable(),
    titleCheck: z.enum(['clear', 'pending']).nullable(),
    /** Occupancy certificate. */
    oc: z.enum(['received', 'applied', 'not-yet']).nullable().optional(),
    notes: z.string(),
  }),
  bankApprovals: z.array(z.string()),

  amenities: z.array(z.string()),
  lenses: z.array(lensSchema),

  media: z.object({
    cover: imageRefSchema,
    gallery: z.array(imageRefSchema),
    floorPlans: z.array(imageRefSchema),
    brochure: fileRefSchema.nullable(),
    masterPlan: imageRefSchema.nullable().optional(),
    videoUrl: z.string().url().nullable().optional(),
    virtualTourUrl: z.string().url().nullable().optional(),
  }),

  facts: projectFactsSchema.default({}),
  specifications: z.array(specificationSchema).default([]),
  nearby: z.array(nearbyPlaceSchema).default([]),
  documents: z.array(propertyDocumentSchema).default([]),
  extraDetails: z.array(extraDetailSchema).default([]),
  offer: offerSchema.nullable().default(null),
  /** e.g. "Phase 2". Phases with their own K-RERA number are listed separately. */
  phase: z.string().trim().max(80).default(''),
  charges: z.array(chargeSchema).default([]),
  paymentPlan: paymentPlanSchema.default({}),
  /** Kept in the admin but left off the website, whatever its status. */
  hidden: z.boolean().default(false),

  metrics: z.object({ grossYield: z.number().positive() }).merge(sourcedSchema).nullable(),
  commute: z.array(
    z.object({ hubId: z.string(), peakMins: z.number().int().positive(), offPeakMins: z.number().int().positive() }).merge(sourcedSchema)
  ),

  seo: z.object({ title: z.string(), description: z.string(), ogImageId: z.string().nullable() }),

  createdAt: isoDate,
  updatedAt: isoDate,
  publishedAt: isoDate.nullable(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

export const developerFactField = z.enum(['yearsActive', 'sqftDelivered', 'constructionTech', 'projectsDelivered']);

export const developerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  legalName: z.string().min(1),
  about: z.string(),
  yearsActive: z.number().int().positive().nullable(),
  sqftDelivered: z.number().int().positive().nullable(),
  constructionTech: z.string().nullable(),
  projectsDelivered: z.number().int().positive().nullable().default(null),
  headquarters: z.string().max(120).nullable().default(null),
  /** Hidden partners and all their listings are left off the website. */
  hidden: z.boolean().default(false),
  /** Shown on the website's channel-partner logo wall (admin → Channel partner logos). */
  showOnLogoWall: z.boolean().default(true),
  sources: z.array(z.object({ field: developerFactField, label: z.string().min(1), url: z.string().url().nullable(), asOf: isoDate })),
  website: z.string().url().nullable(),
  logo: imageRefSchema.nullable(),
});

export const corridorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug,
  description: z.string(),
  svgPathId: z.string().min(1),
  heroImage: imageRefSchema.nullable(),
  order: z.number().int().nonnegative(),
  // Kept in step with the public catalogue: this is the top-level region used
  // by the home-page category cards and region filters.
  zone: z.enum(['north', 'east', 'south-east', 'south', 'west', 'central']).nullable().optional(),
});

export const officeHubSchema = z.object({
  id: z.string(),
  name: z.string(),
  corridorId: z.string(),
  geo: z.object({ lat: z.number(), lng: z.number() }),
});

export const enquiryIntentSchema = z.enum(['site-visit', 'price-sheet', 'loan-help', 'general', 'callback']);
export const enquirySourceSchema = z.enum(['card', 'quick-view', 'detail', 'contact', 'shortlist', 'home', 'dock']);
export const enquiryStatusSchema = z.enum(['new', 'contacted', 'visit-scheduled', 'closed', 'spam']);

export const enquirySchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  intent: enquiryIntentSchema,
  preferredDate: isoDate.nullable(),
  message: z.string(),
  propertyId: z.string().nullable(),
  propertySlug: z.string().nullable(),
  propertyTitle: z.string().nullable(),
  source: enquirySourceSchema,
  consentText: z.string(),
  consentVersion: z.string(),
  consentAt: z.string(),
  utm: z.object({ source: z.string().nullable(), medium: z.string().nullable(), campaign: z.string().nullable() }),
  status: enquiryStatusSchema,
  assignedTo: z.string().nullable(),
  notes: z.string(),
  createdAt: z.string(),
});

export const siteSettingsSchema = z.object({
  contact: z.object({ phone: z.string(), phoneDisplay: z.string(), whatsapp: z.string(), email: z.string().email() }),
  agent: z.object({
    name: z.string(),
    title: z.string(),
    reraNumber: z.string(),
    validFrom: z.string(),
    validTo: z.string(),
    verifyUrl: z.string().url(),
  }),
  partnerDeveloper: z.string(),
  costs: z.object({
    stampDutyPct: z.number().nonnegative(),
    registrationPct: z.number().nonnegative(),
    source: z.string(),
    asOf: isoDate,
    note: z.string(),
  }),
  disclaimers: z.object({ portal: z.string(), listing: z.string(), costs: z.string(), commute: z.string() }),
  consentVersion: z.string(),
  consentText: z.string(),
  privacyNote: z.string(),
});

// ---- Blog (kept identical in EstateNav/lib/data/schemas.ts and EstateNav-admin/lib/data/schemas.ts) ----
// Posts are written in the admin and read by the website. `body` is light Markdown:
// ## / ### headings, paragraphs, - and 1. lists, > quotes, **bold**, *italic*, [links](url), ![images](url).
export const blogStatusSchema = z.enum(['draft', 'published']);

export const blogPostSchema = z.object({
  id: z.string().min(1),
  slug,
  status: blogStatusSchema,
  title: z.string().trim().min(3, 'Add a title').max(140),
  /** One or two sentences for cards, the list page and search results. */
  excerpt: z.string().trim().max(320).default(''),
  body: z.string().default(''),
  cover: imageRefSchema.nullable().default(null),
  category: z.string().trim().min(1).max(60).default('Buying guides'),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  author: z.object({ name: z.string().trim().min(1).max(80), role: z.string().trim().max(80).default('') }).default({ name: 'EstateNav Advisory', role: '' }),
  readMinutes: z.number().int().positive().max(120),
  featured: z.boolean().default(false),
  /** Listings mentioned in the post, shown as cards under the article. */
  relatedPropertyIds: z.array(z.string()).max(6).default([]),
  seo: z.object({ title: z.string().max(90).default(''), description: z.string().max(200).default('') }).default({}),
  publishedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
