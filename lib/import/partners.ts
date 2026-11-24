import type { Developer } from '@/lib/data/types';
import { findPartner } from '@/lib/partners';
import type { Column, SheetSpec } from './spec';
import { findSheet, loadWorkbook, readSheet } from './parse';
import { clean, dateValue, isUrl, num, slugify, type Raw } from './values';

/**
 * Bulk partner import: one "Partners" sheet whose columns are the fields of the Add partner form
 * (brand, ID, company name, headquarters, website, about, the four track-record facts each with a
 * source and the date it was checked, and the logo).
 */

type FactField = Developer['sources'][number]['field'];

const FACTS: { field: FactField; key: string; label: string; numeric: boolean; example: string }[] = [
  { field: 'yearsActive', key: 'years_in_business', label: 'Years in business', numeric: true, example: '30' },
  { field: 'projectsDelivered', key: 'projects_delivered', label: 'Projects delivered', numeric: true, example: '150' },
  { field: 'sqftDelivered', key: 'sqft_delivered', label: 'Total sq.ft delivered', numeric: true, example: '130000000' },
  { field: 'constructionTech', key: 'construction_method', label: 'Construction method', numeric: false, example: 'In-house backward integration, precast' },
];

const factColumns: Column[] = FACTS.flatMap((f) => [
  {
    key: f.key,
    type: f.numeric ? 'int' : 'text',
    width: f.numeric ? 18 : 34,
    help: `${f.label}${f.numeric ? ' as a whole number (digits only' + (f.field === 'sqftDelivered' ? '; 130 million = 130000000' : '') + ')' : ''}. Shown on the website only when ${f.key}_source is filled.`,
    example: f.example,
  },
  { key: `${f.key}_source`, type: 'text', width: 30, help: `Where the ${f.label.toLowerCase()} figure comes from (annual report, company website, RERA filing…).`, example: 'Company website, About us' },
  { key: `${f.key}_checked_on`, type: 'date', width: 16, help: 'Date you checked the source, YYYY-MM-DD. Today is used when blank.', example: '2026-11-24' },
]);

export const PARTNERS_SHEET: SheetSpec = {
  name: 'Partners',
  purpose: 'One row per partner (developer). A row whose partner_id or brand name matches an existing partner updates it; empty cells keep what is there.',
  columns: [
    { key: 'brand_name', type: 'text', required: true, width: 26, help: 'Brand name as buyers know it.', example: 'Sobha' },
    { key: 'partner_id', type: 'text', width: 22, help: 'Lowercase ID with hyphens, used internally and in imports. Made from the brand name when blank. Existing partners keep their ID.', example: 'sobha' },
    { key: 'registered_company_name', type: 'text', width: 30, help: 'Registered company name. The brand name is used when blank.', example: 'Sobha Limited' },
    { key: 'headquarters', type: 'text', width: 24, help: 'City and state of the head office.', example: 'Bengaluru, Karnataka' },
    { key: 'website', type: 'url', width: 30, help: 'Official website, starting with https://', example: 'https://www.sobha.com' },
    { key: 'about', type: 'longtext', width: 60, help: 'Short summary shown on project pages: who they are, what they build in Bengaluru, notable projects. 40–120 words, in your own words.', example: '' },
    ...factColumns,
    { key: 'logo', type: 'media', width: 34, help: 'Logo: a direct image link, a Google Drive file link (shared with anyone with the link), or the file name of a logo attached on upload. Square or wide, plain background; PNG or SVG preferred.', example: 'sobha-logo.png' },
  ],
};

export interface ParsedPartner {
  row: number;
  id: string;
  name: string;
  legalName?: string;
  headquarters?: string;
  website?: string;
  about?: string;
  facts: Partial<Record<FactField, number | string>>;
  sources: { field: FactField; label: string; asOf?: string }[];
  logo?: string;
  /** Existing partner this row updates. */
  existingId: string | null;
  errors: string[];
  warnings: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

/** "130 million", "13 crore", "1.3 Cr sq.ft", "1,30,00,000" → 130000000. */
function bigNumber(value: Raw): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = clean(value).toLowerCase().replace(/(\d),(?=\d)/g, '$1');
  const m = text.match(/(\d+(?:\.\d+)?)\s*(million|mn|m\b|crore|cr\b|lakh|lac|l\b|k\b|thousand|billion|bn)?/);
  if (!m) return null;
  const mult: Record<string, number> = { million: 1e6, mn: 1e6, m: 1e6, crore: 1e7, cr: 1e7, lakh: 1e5, lac: 1e5, l: 1e5, k: 1e3, thousand: 1e3, billion: 1e9, bn: 1e9 };
  return Math.round(Number(m[1]) * (m[2] ? mult[m[2].trim()] ?? 1 : 1));
}

export async function parsePartners(buffer: ArrayBuffer, existing: Developer[]): Promise<{ partners: ParsedPartner[]; notes: string[] }> {
  const workbook = await loadWorkbook(buffer);
  const notes: string[] = [];
  const sheet = findSheet(workbook, PARTNERS_SHEET.name) ?? workbook.worksheets.find((ws) => !['guide'].includes(ws.name.toLowerCase()));
  if (!sheet) throw new Error('The workbook has no "Partners" sheet. Download the partner template and fill it in.');
  const rows = readSheet(sheet, PARTNERS_SHEET, notes);
  if (!rows.length) throw new Error('The "Partners" sheet has no rows below the header.');
  if (rows.length > 200) throw new Error('Import at most 200 partners at a time.');

  const seen = new Set<string>();
  const partners = rows.map((r): ParsedPartner => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const text = (key: string) => clean(r.get(key)) || undefined;
    const name = clean(r.get('brand_name'));
    if (!name) errors.push('brand_name is required.');
    const givenId = slugify(clean(r.get('partner_id'))).slice(0, 60);
    // Match an existing partner by ID first, then by brand or company name.
    const match = (givenId && existing.find((d) => d.id === givenId)) || (name ? findPartner(name, existing) : null) || (text('registered_company_name') ? findPartner(text('registered_company_name')!, existing) : null);
    const id = match?.id ?? givenId ?? slugify(name).slice(0, 60);
    const finalId = id || slugify(name).slice(0, 60);
    if (!finalId && name) errors.push('partner_id could not be made from the brand name; fill partner_id.');
    if (finalId && seen.has(finalId)) errors.push(`"${finalId}" appears twice in the sheet; keep one row per partner.`);
    seen.add(finalId);
    if (match && givenId && givenId !== match.id) warnings.push(`Matches the existing partner "${match.name}"; its ID "${match.id}" is kept.`);

    let website = r.link('website') || text('website');
    if (website && !/^https?:\/\//i.test(website) && /^[\w-]+(\.[\w-]+)+/.test(website)) website = `https://${website}`;
    if (website && !isUrl(website)) {
      warnings.push(`website "${website}" is not a valid link; left out.`);
      website = undefined;
    }
    const about = text('about');
    if (about && about.length > 1200) warnings.push('about is long; consider trimming it to 40–120 words.');

    const facts: ParsedPartner['facts'] = {};
    const sources: ParsedPartner['sources'] = [];
    for (const f of FACTS) {
      const raw = r.get(f.key);
      if (clean(raw)) {
        if (f.numeric) {
          const n = f.field === 'sqftDelivered' ? bigNumber(raw) : num(raw);
          if (n == null || n <= 0) warnings.push(`${f.key} "${clean(raw)}" is not a number; left out.`);
          else facts[f.field] = Math.round(n);
        } else facts[f.field] = clean(raw).slice(0, 200);
      }
      const label = clean(r.get(`${f.key}_source`));
      const checked = r.get(`${f.key}_checked_on`);
      if (label) {
        const d = clean(checked) ? dateValue(checked) : null;
        if (clean(checked) && !d) warnings.push(`${f.key}_checked_on "${clean(checked)}" is not a date; today is used.`);
        sources.push({ field: f.field, label: label.slice(0, 160), asOf: d?.iso });
      } else if (facts[f.field] != null) {
        warnings.push(`${f.label} has no source, so it stays private until a source is added.`);
      }
    }
    const logo = r.link('logo') || text('logo');
    return {
      row: r.row,
      id: finalId,
      name,
      legalName: text('registered_company_name'),
      headquarters: text('headquarters'),
      website,
      about,
      facts,
      sources,
      logo,
      existingId: match?.id ?? (existing.some((d) => d.id === finalId) ? finalId : null),
      errors,
      warnings,
    };
  });
  return { partners, notes };
}

/** The partner record to save. Blank cells keep the existing values. */
export function buildPartner(p: ParsedPartner, existing: Developer | null, logo: Developer['logo'] | undefined): Developer {
  const sources = [...(existing?.sources ?? [])];
  for (const s of p.sources) {
    const i = sources.findIndex((x) => x.field === s.field);
    const record = { field: s.field, label: s.label, url: i >= 0 ? sources[i].url : null, asOf: s.asOf ?? today() };
    if (i >= 0) sources[i] = record;
    else sources.push(record);
  }
  const name = existing ? p.name || existing.name : p.name;
  return {
    id: existing?.id ?? p.id,
    name,
    legalName: p.legalName ?? existing?.legalName ?? name,
    about: p.about ?? existing?.about ?? '',
    yearsActive: (p.facts.yearsActive as number | undefined) ?? existing?.yearsActive ?? null,
    projectsDelivered: (p.facts.projectsDelivered as number | undefined) ?? existing?.projectsDelivered ?? null,
    sqftDelivered: (p.facts.sqftDelivered as number | undefined) ?? existing?.sqftDelivered ?? null,
    constructionTech: (p.facts.constructionTech as string | undefined) ?? existing?.constructionTech ?? null,
    headquarters: p.headquarters ?? existing?.headquarters ?? null,
    hidden: existing?.hidden ?? false,
    showOnLogoWall: existing?.showOnLogoWall ?? true,
    sources,
    website: p.website ?? existing?.website ?? null,
    logo: logo !== undefined ? logo : existing?.logo ?? null,
  };
}

/** Prompt for filling the partner template with an AI tool. */
export function buildPartnerPrompt(): string {
  const cols = PARTNERS_SHEET.columns.map((c) => `- ${c.key}${c.required ? ' (required)' : ''}: ${c.help}`).join('\n');
  return `You are filling in the EstateNav partner import workbook (attached .xlsx template). EstateNav lists real-estate developers ("partners") that build in Bengaluru, India.

GOAL
Return the same workbook, filled in, as a downloadable .xlsx file. Keep the sheet names and every header exactly as they are; do not add, rename, reorder or delete columns, and do not add example rows. Leave the "Guide" sheet unchanged.

ROWS
- One row per developer on the "Partners" sheet. The developers are the ones I list below or the ones in the files I attach.
- brand_name is the name buyers know (e.g. "Sobha", "Prestige Group", "Sattva Group"); registered_company_name is the legal entity (e.g. "Sobha Limited").
- partner_id: lowercase words joined by hyphens (e.g. sobha, prestige-group). Leave it blank if unsure; EstateNav makes it from the brand name and keeps the ID of partners that already exist.

ACCURACY
- Use only facts from the files I attach or from the developer's official website, annual report or RERA filings. Never guess or invent figures.
- For each track-record figure (years_in_business, projects_delivered, sqft_delivered, construction_method), also fill its _source column (e.g. "Sobha annual report FY2025", "Company website, About us") and its _checked_on date (YYYY-MM-DD, today if you checked it today). Leave the figure blank if you cannot name a source.
- sqft_delivered and the other numbers are plain digits (130000000, not "130 million sq.ft").
- about: 40–120 words in your own words: who they are, what they build in Bengaluru, a few notable Bengaluru projects. No phone numbers, emails, prices or marketing superlatives.
- website: the official site, starting with https://.
- logo: only a direct link to the developer's official logo image, or the file name of a logo file I said I will attach. Leave it blank otherwise.

BEFORE YOU ANSWER
Check every row has brand_name, every number cell is digits only, and every filled figure has a source. Then give me the .xlsx file and a short list of anything you could not find.

COLUMN REFERENCE (sheet "Partners")
${cols}`;
}
