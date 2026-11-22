import ExcelJS from 'exceljs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  chargeBasisSchema,
  documentKindSchema,
  lensSchema,
  nearbyCategorySchema,
  planAuthoritySchema,
  propertyTypeSchema,
  unitKindSchema,
} from '@/lib/data/schemas';
import type { ChargeBasis, DocumentKind, Lens, NearbyCategory, PlanAuthority, UnitKind } from '@/lib/data/types';
import { CHILD_SHEETS, PROJECTS, REGIONS, type SheetSpec } from './spec';
import {
  areaRange,
  bool,
  clean,
  coordsFromMapsLink,
  dateValue,
  enumKey,
  int,
  isBengaluru,
  isUrl,
  list,
  money,
  monthLabel,
  num,
  slugify,
  type Raw,
} from './values';

// ---------- Parsed shapes (plain JSON: they travel to the browser for the preview and back) ----------

export interface ParsedUnit {
  row: number;
  kind: UnitKind;
  bhk: number | null;
  label: string;
  carpetMin: number | null;
  carpetMax: number | null;
  superMin: number | null;
  superMax: number | null;
  balcony: number | null;
  terrace: number | null;
  uds: number | null;
  dimensions: string | null;
  bathrooms: number | null;
  carParks: number | null;
  facing: string | null;
  tower: string | null;
  unitCount: number | null;
  rate: number | null;
  priceMin: number | null;
  priceMax: number | null;
  totalMin: number | null;
  totalMax: number | null;
  availability: 'available' | 'limited' | 'sold-out';
  floorPlan: string | null;
  notes: string;
}

export interface ParsedCharge { label: string; amount: number | null; basis: ChargeBasis; payable: string; note: string }
export interface ParsedStage { stage: string; percent: number | null; note: string }
export interface ParsedNearby { category: NearbyCategory; name: string; distanceKm: number | null; travelMins: number | null }
export interface ParsedSpec { category: string; detail: string }
export interface ParsedDocument { kind: DocumentKind; label: string; file: string; access: 'public' | 'on-request' }
export interface ParsedExtra { group: string; label: string; value: string }

/** Projects-sheet values. `undefined` means the cell was blank (an update keeps the old value). */
export interface ProjectFields {
  name: string;
  phase?: string;
  partner: string;
  city?: string;
  region?: (typeof REGIONS)[number];
  area: string;
  locality?: string;
  address?: string;
  pincode?: string;
  geo?: { lat: number; lng: number };
  propertyType?: (typeof propertyTypeSchema.options)[number];
  segment?: 'residential' | 'plot' | 'commercial';
  transaction?: 'sale' | 'rent';
  status?: 'draft' | 'published';
  newLaunch?: boolean;
  featured?: boolean;
  lenses?: Lens[];
  tagline?: string;
  description?: string;
  highlights?: string[];
  landAcres?: number;
  totalUnits?: number;
  towers?: number;
  floors?: string;
  openSpacePct?: number;
  clubhouseSqft?: number;
  clubhouseDetails?: string;
  facing?: string;
  launchDate?: string;
  priceOnRequest?: boolean;
  startingPrice?: number;
  maxPrice?: number;
  ratePerSqft?: number;
  priceNote?: string;
  rentPerMonth?: number;
  offerText?: string;
  offerValidUntil?: string;
  paymentPlanType?: string;
  bookingPct?: number;
  possessionStatus?: 'ready' | 'under-construction' | 'pre-launch';
  possessionDate?: string;
  possessionLabel?: string;
  reraNumber?: string;
  reraDate?: string;
  reraVerified?: boolean;
  khata?: 'A' | 'B' | 'E';
  planAuthority?: PlanAuthority;
  titleCheck?: 'clear' | 'pending';
  oc?: 'received' | 'applied' | 'not-yet';
  approvalNotes?: string;
  bankApprovals?: string[];
  amenities?: string[];
  mediaFolder?: string;
  cover?: string;
  gallery?: string[];
  masterPlan?: string;
  videoUrl?: string;
  virtualTourUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ParsedProject {
  key: string;
  row: number;
  fields: ProjectFields;
  /** null = the sheet had no rows for this project (an update keeps what the listing has). */
  units: ParsedUnit[] | null;
  charges: ParsedCharge[] | null;
  stages: ParsedStage[] | null;
  nearby: ParsedNearby[] | null;
  specs: ParsedSpec[] | null;
  documents: ParsedDocument[] | null;
  extras: ParsedExtra[] | null;
  errors: string[];
  warnings: string[];
}

export interface ParsedWorkbook {
  projects: ParsedProject[];
  /** Problems that are not tied to one project (unknown sheets, orphan rows…). */
  notes: string[];
}

// ---------- Reading cells ----------

type Row = { row: number; get: (key: string) => Raw; link: (key: string) => string };

function cellRaw(cell: ExcelJS.Cell): { value: Raw; link: string } {
  const v = cell.value as unknown;
  if (v == null) return { value: null, link: '' };
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return { value: v as Raw, link: '' };
  if (typeof v === 'string') return { value: v, link: '' };
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: unknown; hyperlink?: string; result?: unknown; error?: unknown };
    if (o.richText) return { value: o.richText.map((r) => r.text).join(''), link: '' };
    if (o.hyperlink) return { value: typeof o.text === 'string' ? o.text : o.hyperlink, link: o.hyperlink };
    if ('result' in o) return { value: (o.result instanceof Date || ['string', 'number', 'boolean'].includes(typeof o.result) ? o.result : null) as Raw, link: '' };
    if (o.error) return { value: null, link: '' };
  }
  return { value: cell.text || null, link: '' };
}

const headerKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/\*|\(.*?\)|₹|:/g, '')
    .trim()
    .replace(/[\s\-/.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

/** Older template columns and common spellings mapped onto the current keys. */
const ALIASES: Record<string, string> = {
  slug: 'project_key', key: 'project_key', project_id: 'project_key', projectkey: 'project_key',
  title: 'project_name', name: 'project_name', project: 'project_name',
  developer: 'partner', developer_id: 'partner', builder: 'partner', partner_id: 'partner', developer_name: 'partner',
  corridor: 'area', corridor_id: 'area', micro_market: 'area', area_id: 'area',
  status: 'listing_status', is_new_launch: 'new_launch',
  lenses: 'buyer_types', price_min_project: 'starting_price', price_per_sqft: 'avg_rate_per_sqft', price_note: 'price_includes',
  rera_registered: 'rera_verified', maps_link: 'google_maps_link', map_link: 'google_maps_link', lat: 'latitude', lng: 'longitude', long: 'longitude',
  cover_image_url: 'cover_image', gallery_image_urls: 'gallery_images', photos_folder: 'media_folder_link', images_folder: 'media_folder_link', media_link: 'media_folder_link',
  type: 'unit_kind', configuration: 'unit_label', label: 'unit_label', carpet_area: 'carpet_sqft_min', super_area: 'super_builtup_sqft_min', super_built_up: 'super_builtup_sqft_min',
  sba: 'super_builtup_sqft_min', plot_area_sqft: 'carpet_sqft_min', plot_area: 'carpet_sqft_min', price: 'price_min', total_price: 'all_inclusive_price_min', floor_plan: 'floor_plan_image',
  charge_name: 'charge', basis_type: 'basis', milestone: 'stage', percentage: 'percent', place: 'place_name', km: 'distance_km', minutes: 'travel_mins',
  type_of_document: 'document_type', url: 'file', link: 'file',
};

function readSheet(sheet: ExcelJS.Worksheet, spec: SheetSpec, notes: string[]): Row[] {
  const known = new Set(spec.columns.map((c) => c.key));
  // The header is the first row that contains a known column key (tolerates a title row above it).
  let headerRowNumber = 0;
  const headers: string[] = [];
  for (let r = 1; r <= Math.min(sheet.rowCount, 5) && !headerRowNumber; r += 1) {
    const candidate: string[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headerKey(String(cell.text ?? ''));
      candidate[col] = known.has(key) ? key : ALIASES[key] && known.has(ALIASES[key]) ? ALIASES[key] : '';
    });
    if (candidate.filter(Boolean).length >= Math.min(2, known.size)) {
      headerRowNumber = r;
      candidate.forEach((k, i) => (headers[i] = k));
    }
  }
  if (!headerRowNumber) {
    notes.push(`Sheet "${sheet.name}" was skipped: its first row does not have the template's column names.`);
    return [];
  }
  const missing = spec.columns.filter((c) => c.required && !headers.includes(c.key)).map((c) => c.key);
  if (missing.length) notes.push(`Sheet "${sheet.name}" is missing required column(s): ${missing.join(', ')}.`);

  const rows: Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (wsRow, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const values: Record<string, Raw> = {};
    const links: Record<string, string> = {};
    headers.forEach((key, col) => {
      if (!key) return;
      const { value, link } = cellRaw(wsRow.getCell(col));
      values[key] = value;
      if (link) links[key] = link;
    });
    if (!Object.values(values).some((v) => clean(v) !== '')) return;
    rows.push({ row: rowNumber, get: (key) => values[key] ?? null, link: (key) => links[key] ?? '' });
  });
  return rows;
}

const findSheet = (workbook: ExcelJS.Workbook, name: string) => {
  const target = name.toLowerCase().replace(/[\s_-]+/g, '');
  return workbook.worksheets.find((ws) => ws.name.toLowerCase().replace(/[\s_-]+/g, '') === target);
};

// ---------- Enum matching with the spellings brochures use ----------

function pick<T extends string>(value: Raw, options: readonly T[], synonyms: [RegExp, T][] = []): T | null | 'invalid' {
  const text = clean(value);
  if (!text) return null;
  const key = enumKey(text);
  const direct = options.find((o) => enumKey(o) === key);
  if (direct) return direct;
  const syn = synonyms.find(([re]) => re.test(text.toLowerCase()));
  return syn ? syn[1] : 'invalid';
}

const POSSESSION: [RegExp, 'ready' | 'under-construction' | 'pre-launch'][] = [
  [/rtmi|ready|completed|delivered|oc received|handed over/, 'ready'],
  [/pre[\s-]?launch|upcoming|new launch|eoi|soft launch/, 'pre-launch'],
  [/under|uc\b|ongoing|construction/, 'under-construction'],
];
const UNIT_KIND: [RegExp, UnitKind][] = [
  [/studio/, 'studio'],
  [/row\s*-?\s*house|town\s*house/, 'row-house'],
  [/villament/, 'villament'],
  [/villa/, 'villa'],
  [/penthouse/, 'penthouse'],
  [/duplex|simplex/, 'duplex'],
  [/plot|site|land/, 'plot'],
  [/independent|house/, 'independent-house'],
  [/office|commercial|workspace/, 'office'],
  [/retail|shop|showroom/, 'retail'],
  [/apartment|flat|bhk|unit/, 'apartment'],
];
const PROPERTY_TYPE: [RegExp, (typeof propertyTypeSchema.options)[number]][] = [
  [/row\s*-?\s*house/, 'row-house'],
  [/villament/, 'villament'],
  [/villa/, 'villa'],
  [/penthouse/, 'penthouse'],
  [/plot|site|land/, 'plot'],
  [/independent|house/, 'independent-house'],
  [/office|commercial|workspace/, 'office'],
  [/retail|shop/, 'retail'],
  [/apartment|flat|residential|studio/, 'apartment'],
];
const BASIS: [RegExp, ChargeBasis][] = [
  [/actual/, 'actuals'],
  [/includ/, 'included'],
  [/sq\.?\s*ft.*month|psf.*month|per sqft per month/, 'per-sqft-month'],
  [/sq\.?\s*ft|sft|psf|per sq/, 'per-sqft'],
  [/%|percent/, 'percent'],
  [/month|monthly|pm\b/, 'per-month'],
  [/lump|fixed|flat|one[\s-]?time|total/, 'lumpsum'],
];
const NEARBY: [RegExp, NearbyCategory][] = [
  [/metro/, 'metro'],
  [/rail|train/, 'railway'],
  [/airport|kia\b/, 'airport'],
  [/bus/, 'bus'],
  [/highway|nh\b|expressway|road|ring|orr|prr|str/, 'highway'],
  [/it|tech|office|sez|business park|workplace|campus/, 'it-park'],
  [/school/, 'school'],
  [/college|university|institute/, 'college'],
  [/hospital|clinic|medical|health/, 'hospital'],
  [/mall|shopping/, 'mall'],
  [/market|supermarket|d-?mart|grocery/, 'market'],
  [/park|lake|garden|golf/, 'park'],
];
const DOC_KIND: [RegExp, DocumentKind][] = [
  [/brochure|e-?book|catalog/, 'brochure'],
  [/floor|unit plan/, 'floor-plans'],
  [/master|site plan|layout/, 'master-plan'],
  [/cost|price|rate/, 'price-sheet'],
  [/payment/, 'payment-plan'],
  [/spec/, 'specifications'],
  [/rera|registration certificate/, 'rera-certificate'],
  [/approval|sanction|noc|oc\b|cc\b|khata/, 'approval'],
];

// ---------- Main entry ----------

/**
 * Removes cell notes/comments from an .xlsx. Files written by openpyxl (which ChatGPT and other AI
 * tools use) keep notes at paths exceljs cannot read, so those workbooks are retried without them.
 */
function stripComments(buffer: ArrayBuffer): Uint8Array {
  const files = unzipSync(new Uint8Array(buffer));
  const out: Record<string, Uint8Array> = {};
  const dropped = new Set<string>();
  for (const name of Object.keys(files)) {
    if (/(^|\/)(comments?\d*\.xml|threadedComment\d*\.xml|person\.xml)$|comments\/|commentsDrawing\d*\.vml$|vmlDrawing\d*\.vml$|threadedComments\/|persons\//i.test(name)) dropped.add(name);
  }
  for (const [name, data] of Object.entries(files)) {
    if (dropped.has(name)) continue;
    if (/\.rels$/.test(name)) {
      const xml = strFromU8(data).replace(/<Relationship\b[^>]*Type="[^"]*\/(comments|vmlDrawing|threadedComment|person)"[^>]*\/>/gi, '');
      out[name] = strToU8(xml);
    } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      out[name] = strToU8(strFromU8(data).replace(/<legacyDrawing\b[^>]*\/>/g, ''));
    } else if (name === '[Content_Types].xml') {
      out[name] = strToU8(strFromU8(data).replace(/<Override\b[^>]*PartName="[^"]*(comment|vmlDrawing|commentsDrawing|threadedComment|person)[^"]*"[^>]*\/>/gi, ''));
    } else out[name] = data;
  }
  return zipSync(out);
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (first) {
    try {
      const retry = new ExcelJS.Workbook();
      const cleaned = stripComments(buffer);
      await retry.xlsx.load(Buffer.from(cleaned) as unknown as ArrayBuffer);
      return retry;
    } catch (second) {
      console.error('[import] workbook retry failed:', second);
      throw new Error(`The file could not be opened as an Excel workbook (${first instanceof Error ? first.message : 'unknown error'}). Open it in Excel or Google Sheets and save it again as .xlsx.`);
    }
  }
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const workbook = await loadWorkbook(buffer);
  const notes: string[] = [];

  const projectSheet = findSheet(workbook, PROJECTS.name) ?? workbook.worksheets.find((ws) => !['guide', 'lists'].includes(ws.name.toLowerCase()));
  if (!projectSheet) throw new Error('The workbook has no "Projects" sheet. Download the latest template and fill it in.');
  const projectRows = readSheet(projectSheet, PROJECTS, notes);
  if (!projectRows.length) throw new Error('The "Projects" sheet has no project rows below the header.');
  if (projectRows.length > 200) throw new Error('Import at most 200 projects at a time; split the workbook.');

  const projects: ParsedProject[] = [];
  const byKey = new Map<string, ParsedProject>();
  const byName = new Map<string, ParsedProject>();

  for (const r of projectRows) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const text = (key: string) => clean(r.get(key)) || undefined;
    const name = clean(r.get('project_name'));
    const phase = clean(r.get('phase'));
    const key = slugify(clean(r.get('project_key')) || [name, phase].filter(Boolean).join(' '));
    if (!name) errors.push('project_name is required.');
    if (!key) errors.push('project_key is required (lowercase words joined by hyphens).');
    if (key && byKey.has(key)) errors.push(`project_key "${key}" is used twice; every project or phase needs its own key.`);

    const enumField = <T extends string>(col: string, options: readonly T[], synonyms: [RegExp, T][] = []): T | undefined => {
      const result = pick(r.get(col), options, synonyms);
      if (result === 'invalid') {
        warnings.push(`${col} "${clean(r.get(col))}" is not one of: ${options.join(', ')}; ignored.`);
        return undefined;
      }
      return result ?? undefined;
    };
    const numberField = (col: string, reader: (v: Raw) => number | null = num): number | undefined => {
      const raw = r.get(col);
      if (clean(raw) === '') return undefined;
      const n = reader(raw);
      if (n == null) warnings.push(`${col} "${clean(raw)}" is not a number; ignored.`);
      return n ?? undefined;
    };
    const priceField = (col: string): number | undefined => {
      const n = numberField(col, money);
      if (n != null && n < 10000) {
        warnings.push(`${col} "${clean(r.get(col))}" looks too small for rupees; write full rupees (e.g. 15000000) or add Cr / L. Ignored.`);
        return undefined;
      }
      return n;
    };
    const dateField = (col: string) => {
      const raw = r.get(col);
      if (clean(raw) === '') return undefined;
      const d = dateValue(raw);
      if (!d && !/rtmi|ready|completed/i.test(clean(raw))) warnings.push(`${col} "${clean(raw)}" is not a date (use YYYY-MM or YYYY-MM-DD); ignored.`);
      return d ?? undefined;
    };
    const urlField = (col: string) => {
      const value = r.link(col) || clean(r.get(col));
      if (!value) return undefined;
      if (!isUrl(value)) {
        warnings.push(`${col} is not a web link; ignored.`);
        return undefined;
      }
      return value;
    };
    const mediaField = (col: string) => r.link(col) || clean(r.get(col)) || undefined;

    const city = text('city');
    const address = text('address');
    const pincode = text('pincode')?.replace(/\D/g, '').slice(0, 6);
    const bengaluru = isBengaluru(city ?? '', address ?? '', pincode ?? '');
    if (bengaluru === false) errors.push(`city "${city}" is outside Bengaluru; only Bengaluru projects are listed.`);
    else if (bengaluru === null) warnings.push('city is blank; assumed Bengaluru. Fill city to be sure.');

    const partner = clean(r.get('partner'));
    const area = clean(r.get('area'));
    if (!partner) errors.push('partner is required.');
    if (!area) errors.push('area is required.');
    if (!clean(r.get('locality'))) warnings.push('locality is blank; the area name will be shown instead.');

    // Location: explicit coordinates win, then the maps link.
    const lat = num(r.get('latitude'));
    const lng = num(r.get('longitude'));
    const mapsLink = r.link('google_maps_link') || clean(r.get('google_maps_link'));
    let geo = lat != null && lng != null ? { lat, lng } : mapsLink ? coordsFromMapsLink(mapsLink) ?? undefined : undefined;
    if (geo && (geo.lat < 12.4 || geo.lat > 13.6 || geo.lng < 77.0 || geo.lng > 78.2)) {
      warnings.push(`Coordinates ${geo.lat}, ${geo.lng} are outside Bengaluru; ignored (latitude and longitude may be swapped).`);
      geo = undefined;
    }

    const possessionDate = dateField('possession_date');
    const launch = dateField('launch_date');
    const reraDate = dateField('rera_completion_date');
    const offerUntil = dateField('offer_valid_until');
    const lenses = list(r.get('buyer_types'))
      .map((l) => lensSchema.safeParse(enumKey(l)))
      .flatMap((x) => (x.success ? [x.data] : []));
    const reraNumber = text('rera_number')?.replace(/\s+/g, '');
    if (reraNumber && !/^PRM\/KA\/RERA\//i.test(reraNumber)) warnings.push(`rera_number "${reraNumber}" does not look like a K-RERA number (PRM/KA/RERA/…).`);

    const fields: ProjectFields = {
      name,
      phase: phase || undefined,
      partner,
      city,
      region: enumField('region', REGIONS, [[/south\s*east|se\b/, 'south-east'], [/north/, 'north'], [/east/, 'east'], [/south/, 'south'], [/west/, 'west'], [/central|cbd/, 'central']]),
      area,
      locality: text('locality'),
      address,
      pincode,
      geo,
      propertyType: enumField('property_type', propertyTypeSchema.options, PROPERTY_TYPE),
      segment: enumField('segment', ['residential', 'plot', 'commercial'] as const, [[/plot|land/, 'plot'], [/commercial|office|retail/, 'commercial'], [/resid|apartment|villa/, 'residential']]),
      transaction: enumField('transaction', ['sale', 'rent'] as const, [[/lease|rent/, 'rent'], [/buy|sell|sale/, 'sale']]),
      status: enumField('listing_status', ['draft', 'published'] as const, [[/live|publish|active/, 'published'], [/hidden|review|draft/, 'draft']]),
      newLaunch: bool(r.get('new_launch')) ?? undefined,
      featured: bool(r.get('featured')) ?? undefined,
      lenses: lenses.length ? lenses : undefined,
      tagline: text('tagline'),
      description: text('description'),
      highlights: list(r.get('highlights')).length ? list(r.get('highlights')).slice(0, 20) : undefined,
      landAcres: numberField('land_acres'),
      totalUnits: numberField('total_units', int),
      towers: numberField('towers', int),
      floors: text('floors'),
      openSpacePct: numberField('open_space_pct'),
      clubhouseSqft: numberField('clubhouse_sqft', int),
      clubhouseDetails: text('clubhouse_details'),
      facing: text('facing_options'),
      launchDate: launch?.iso,
      priceOnRequest: bool(r.get('price_on_request')) ?? undefined,
      startingPrice: priceField('starting_price'),
      maxPrice: priceField('max_price'),
      ratePerSqft: numberField('avg_rate_per_sqft', money),
      priceNote: text('price_includes'),
      rentPerMonth: numberField('rent_per_month', money),
      offerText: text('offer_text'),
      offerValidUntil: offerUntil?.iso,
      paymentPlanType: text('payment_plan_type'),
      bookingPct: numberField('booking_amount_pct'),
      possessionStatus: enumField('possession_status', ['ready', 'under-construction', 'pre-launch'] as const, POSSESSION) ?? (/rtmi|ready/i.test(clean(r.get('possession_date'))) ? 'ready' : undefined),
      possessionDate: possessionDate?.iso,
      possessionLabel: text('possession_label') ?? (possessionDate ? monthLabel(possessionDate.iso, possessionDate.precision) : undefined),
      reraNumber,
      reraDate: reraDate?.iso,
      reraVerified: bool(r.get('rera_verified')) ?? undefined,
      khata: enumField('khata', ['A', 'B', 'E'] as const, [[/\ba\b|a[\s-]?khata/, 'A'], [/\bb\b|b[\s-]?khata/, 'B'], [/\be\b|e[\s-]?khata/, 'E']]),
      planAuthority: enumField('plan_authority', planAuthoritySchema.options, [[/bbmp|gba|greater bengaluru/i, 'BBMP'], [/bmrda/i, 'BMRDA'], [/biaapa|airport/i, 'BIAAPA'], [/bda/i, 'BDA'], [/anekal/i, 'APA'], [/hoskote/i, 'HPA'], [/nelamangala/i, 'NPA'], [/kiadb/i, 'KIADB'], [/dtcp|town planning/i, 'DTCP'], [/panchayat/i, 'Panchayat']]),
      titleCheck: enumField('title_check', ['clear', 'pending'] as const, [[/clear|verified|ok/, 'clear'], [/pending|progress/, 'pending']]),
      oc: enumField('oc_status', ['received', 'applied', 'not-yet'] as const, [[/receiv|yes|obtained|got/, 'received'], [/appl|await/, 'applied'], [/not|no\b|pending/, 'not-yet']]),
      approvalNotes: text('approval_notes'),
      bankApprovals: list(r.get('bank_approvals')).length ? list(r.get('bank_approvals')) : undefined,
      amenities: list(r.get('amenities')).length ? Array.from(new Set(list(r.get('amenities')))) : undefined,
      mediaFolder: urlField('media_folder_link'),
      cover: mediaField('cover_image'),
      gallery: list(r.link('gallery_images') || r.get('gallery_images')).length ? list(r.link('gallery_images') || r.get('gallery_images')) : undefined,
      masterPlan: mediaField('master_plan_image'),
      videoUrl: urlField('video_url'),
      virtualTourUrl: urlField('virtual_tour_url'),
      seoTitle: text('seo_title'),
      seoDescription: text('seo_description'),
    };
    if (fields.tagline && fields.tagline.length > 160) warnings.push('tagline is longer than 160 characters; it may be cut on cards.');

    const project: ParsedProject = { key, row: r.row, fields, units: null, charges: null, stages: null, nearby: null, specs: null, documents: null, extras: null, errors, warnings };
    projects.push(project);
    if (key && !byKey.has(key)) byKey.set(key, project);
    if (name) byName.set(slugify([name, phase].filter(Boolean).join(' ')), project);
  }

  // Child sheets: rows are linked to their project by project_key (or the project's name).
  const childCounts: Record<string, number> = {};
  for (const spec of CHILD_SHEETS) {
    const sheet = findSheet(workbook, spec.name);
    if (!sheet) continue;
    const rows = readSheet(sheet, spec, notes);
    childCounts[spec.name] = rows.length;
    if (rows.length > 5000) throw new Error(`The "${spec.name}" sheet has more than 5,000 rows; split the workbook.`);
    for (const r of rows) {
      const ref = slugify(clean(r.get('project_key')));
      const project = byKey.get(ref) ?? byName.get(ref);
      if (!project) {
        notes.push(`${spec.name} row ${r.row}: project_key "${clean(r.get('project_key')) || '(blank)'}" is not on the Projects sheet; row skipped.`);
        continue;
      }
      const where = `${spec.name} row ${r.row}`;
      switch (spec.name) {
        case 'Units':
          addUnit(project, r, where);
          break;
        case 'Charges': {
          const label = clean(r.get('charge'));
          if (!label) {
            project.warnings.push(`${where}: charge name missing; skipped.`);
            break;
          }
          const basis = pick(r.get('basis'), chargeBasisSchema.options, BASIS);
          const amountText = clean(r.get('amount'));
          const inferred: ChargeBasis = /actual/i.test(amountText) ? 'actuals' : /includ/i.test(amountText) ? 'included' : /%/.test(amountText) ? 'percent' : /sq\.?\s*ft|sft/i.test(amountText) ? 'per-sqft' : 'lumpsum';
          (project.charges ??= []).push({
            label,
            amount: money(r.get('amount')),
            basis: basis && basis !== 'invalid' ? basis : inferred,
            payable: clean(r.get('payable_when')),
            note: clean(r.get('note')),
          });
          break;
        }
        case 'Payment_Plan': {
          const stage = clean(r.get('stage'));
          if (!stage) break;
          const percent = num(r.get('percent'));
          (project.stages ??= []).push({ stage, percent: percent != null && percent >= 0 && percent <= 100 ? percent : null, note: clean(r.get('note')) });
          break;
        }
        case 'Nearby': {
          const name = clean(r.get('place_name'));
          if (!name) break;
          const cat = pick(r.get('category'), nearbyCategorySchema.options, NEARBY);
          (project.nearby ??= []).push({
            category: cat && cat !== 'invalid' ? cat : 'landmark',
            name,
            distanceKm: num(r.get('distance_km')),
            travelMins: int(r.get('travel_mins')),
          });
          break;
        }
        case 'Specifications': {
          const category = clean(r.get('category'));
          const detail = clean(r.get('detail'));
          if (category && detail) (project.specs ??= []).push({ category: category.slice(0, 60), detail: detail.slice(0, 400) });
          else project.warnings.push(`${where}: category and detail are both needed; skipped.`);
          break;
        }
        case 'Documents': {
          const file = r.link('file') || clean(r.get('file'));
          if (!file) {
            project.warnings.push(`${where}: file is blank; skipped.`);
            break;
          }
          const kind = pick(r.get('document_type'), documentKindSchema.options, DOC_KIND);
          const resolvedKind: DocumentKind = kind && kind !== 'invalid' ? kind : 'other';
          const access = pick(r.get('access'), ['public', 'on-request'] as const, [[/request|enquir|private/, 'on-request'], [/public|open|download/, 'public']]);
          (project.documents ??= []).push({
            kind: resolvedKind,
            label: clean(r.get('label')),
            file,
            access: access && access !== 'invalid' ? access : resolvedKind === 'price-sheet' ? 'on-request' : 'public',
          });
          break;
        }
        case 'More_Details': {
          const label = clean(r.get('label'));
          const value = clean(r.get('value'));
          if (label && value) (project.extras ??= []).push({ group: clean(r.get('group')) || 'More details', label: label.slice(0, 80), value: value.slice(0, 500) });
          break;
        }
      }
    }
  }

  for (const p of projects) {
    if (!p.units?.length && p.fields.startingPrice == null && !p.fields.priceOnRequest && p.fields.transaction !== 'rent') {
      p.warnings.push('No unit prices and no starting_price: the listing is saved with price on request.');
    }
    if (p.stages) {
      const total = p.stages.reduce((sum, s) => sum + (s.percent ?? 0), 0);
      if (total > 0 && Math.abs(total - 100) > 1) p.warnings.push(`Payment plan stages add up to ${Number(total.toFixed(2))}%, not 100%.`);
    }
  }
  if (!Object.keys(childCounts).length) notes.push('No Units, Charges or other child sheets were found; only the Projects sheet was read.');
  return { projects, notes };
}

function addUnit(project: ParsedProject, r: Row, where: string) {
  const kindPick = pick(r.get('unit_kind'), unitKindSchema.options, UNIT_KIND);
  const labelText = clean(r.get('unit_label'));
  let bhk = num(r.get('bhk'));
  // "2.5 BHK" written in the bhk or label column.
  if (bhk == null) {
    const m = (clean(r.get('bhk')) || labelText).match(/(\d(?:\.5)?)\s*(?:bhk|bed)/i);
    if (m) bhk = Number(m[1]);
  }
  if (bhk != null && (bhk <= 0 || bhk > 12)) bhk = null;
  let kind: UnitKind = kindPick && kindPick !== 'invalid' ? kindPick : 'apartment';
  if ((!kindPick || kindPick === 'invalid') && labelText) {
    const fromLabel = UNIT_KIND.find(([re]) => re.test(labelText.toLowerCase()));
    if (fromLabel) kind = fromLabel[1];
  }
  if (kindPick === 'invalid') project.warnings.push(`${where}: unit_kind "${clean(r.get('unit_kind'))}" not recognised; used ${kind}.`);
  if (kind === 'studio') bhk = null;

  const [cMin, cMaxFromMin] = areaRange(r.get('carpet_sqft_min'));
  const [cMaxCell] = areaRange(r.get('carpet_sqft_max'));
  const [sMin, sMaxFromMin] = areaRange(r.get('super_builtup_sqft_min'));
  const [sMaxCell] = areaRange(r.get('super_builtup_sqft_max'));
  const dims = clean(r.get('plot_dimensions'));
  const plotArea = kind === 'plot' && cMin == null && dims ? areaRange(dims)[0] : null;
  const range = (min: number | null, max: number | null): [number | null, number | null] => {
    if (min == null) return [max, null];
    if (max == null || max === min) return [min, null];
    return max < min ? [max, min] : [min, max];
  };
  const [carpetMin, carpetMax] = range(cMin ?? plotArea, cMaxCell ?? cMaxFromMin);
  const [superMin, superMax] = range(sMin, sMaxCell ?? sMaxFromMin);
  if (carpetMin && superMin && carpetMin > superMin && kind !== 'plot') project.warnings.push(`${where}: carpet area (${carpetMin}) is larger than super built-up (${superMin}); check the columns are not swapped.`);

  const priceCell = (col: string) => {
    const raw = r.get(col);
    if (clean(raw) === '') return null;
    const n = money(raw);
    if (n == null || n < 10000) {
      project.warnings.push(`${where}: ${col} "${clean(raw)}" is not a full rupee amount (write 17928000 or 1.79 Cr); ignored.`);
      return null;
    }
    return Math.round(n);
  };
  let priceMin = priceCell('price_min');
  let priceMax = priceCell('price_max');
  if (priceMin && priceMax && priceMax < priceMin) [priceMin, priceMax] = [priceMax, priceMin];
  if (priceMax === priceMin) priceMax = null;
  let totalMin = priceCell('all_inclusive_price_min');
  let totalMax = priceCell('all_inclusive_price_max');
  if (totalMin && totalMax && totalMax < totalMin) [totalMin, totalMax] = [totalMax, totalMin];
  if (totalMax === totalMin) totalMax = null;

  const availability = pick(r.get('availability'), ['available', 'limited', 'sold-out'] as const, [[/sold|none left|unavailable/, 'sold-out'], [/few|limited|last/, 'limited'], [/avail|open|yes/, 'available']]);
  const area = (col: string) => areaRange(r.get(col))[0];

  (project.units ??= []).push({
    row: r.row,
    kind,
    bhk,
    label: labelText,
    carpetMin,
    carpetMax,
    superMin,
    superMax,
    balcony: area('balcony_sqft'),
    terrace: area('terrace_garden_sqft'),
    uds: area('uds_sqft'),
    dimensions: dims || null,
    bathrooms: int(r.get('bathrooms')),
    carParks: num(r.get('car_parks')) != null ? Math.max(0, Math.round(num(r.get('car_parks'))!)) : null,
    facing: clean(r.get('facing')) || null,
    tower: clean(r.get('tower_block')) || null,
    unitCount: int(r.get('units_count')),
    rate: money(r.get('rate_per_sqft')),
    priceMin,
    priceMax,
    totalMin,
    totalMax,
    availability: availability && availability !== 'invalid' ? availability : 'available',
    floorPlan: r.link('floor_plan_image') || clean(r.get('floor_plan_image')) || null,
    notes: clean(r.get('notes')).slice(0, 200),
  });
  if (!carpetMin && !superMin && !priceMin && !dims) project.warnings.push(`${where}: unit has no size and no price.`);
}
