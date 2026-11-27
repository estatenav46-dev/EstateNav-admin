import type { Developer } from './data/types';

/**
 * The partners EstateNav started with. They are written to Firestore once (see seeding in
 * lib/data/api.ts); after that the partner list is whatever is in the database, so partners
 * can be added, hidden or deleted on the Partners page.
 */
export const APPROVED_PARTNERS: { id: string; name: string; match: RegExp }[] = [
  { id: 'abhee-ventures', name: 'Abhee Ventures', match: /\babhee\b/i },
  { id: 'mana-projects', name: 'Mana Projects', match: /\bmana\b/i },
  { id: 'sobha', name: 'Sobha', match: /\bsobha\b/i },
  { id: 'bren-corporation', name: 'Bren Corporation', match: /\bbren\b/i },
  { id: 'snn-raj-corp', name: 'SNN Raj Corp', match: /\bsnn\b/i },
  { id: 'prestige-group', name: 'Prestige Group', match: /\bprestige\b/i },
  { id: 'puravankara', name: 'Puravankara', match: /\bpurav?ankara\b|\bprovident\b|\bpurva\b/i },
  { id: 'sattva-group', name: 'Sattva Group', match: /\bsattva\b/i },
  { id: 'sumadhura-group', name: 'Sumadhura Group', match: /\bsumadhura\b/i },
  { id: 'vaswani-group', name: 'Vaswani Group', match: /\bvaswani\b/i },
  { id: 'total-environment', name: 'Total Environment', match: /\btotal environment\b/i },
  { id: 'godrej-properties', name: 'Godrej Properties', match: /\bgodrej\b/i },
  { id: 'mantri-developers', name: 'Mantri Developers', match: /\bmantri\b/i },
  { id: 'brigade-group', name: 'Brigade Group', match: /\bbrigade\b/i },
  { id: 'shriram-properties', name: 'Shriram Properties', match: /\bshriram\b/i },
  { id: 'century-real-estate', name: 'Century Real Estate', match: /\bcentury\b/i },
];

/** Every partner record for dropdowns: visible ones first, then alphabetical. */
export function partnerOptions(developers: Developer[]): { id: string; name: string; hidden: boolean }[] {
  return [...developers]
    .sort((a, b) => Number(a.hidden) - Number(b.hidden) || a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name, hidden: d.hidden }));
}

/**
 * A placeholder partner for a name that is not on the Partners page yet (from an Excel sheet or the
 * "Add new partner" option). Known brands keep their usual ID; the details are filled in later.
 */
export function placeholderPartner(name: string, developers: Developer[]): Developer {
  const clean = name.trim().replace(/\s+/g, ' ');
  const brand = APPROVED_PARTNERS.find((p) => p.match.test(clean));
  const base = brand?.id ?? (clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `partner-${Date.now().toString(36)}`);
  let id = base;
  for (let n = 2; developers.some((d) => d.id === id); n++) id = `${base}-${n}`;
  const display = brand?.name ?? clean;
  return { id, name: display, legalName: display, about: '', yearsActive: null, sqftDelivered: null, constructionTech: null, projectsDelivered: null,
    headquarters: null, hidden: false, showOnLogoWall: true, sources: [], website: null, logo: null };
}

/** Profile fields still empty, so the Partners page can flag partners that need details. */
export function missingPartnerDetails(d: Developer): string[] {
  const missing: string[] = [];
  if (!d.about.trim()) missing.push('about');
  if (!d.logo) missing.push('logo');
  if (!d.website) missing.push('website');
  if (!d.yearsActive && !d.projectsDelivered && !d.sqftDelivered) missing.push('track record');
  return missing;
}

/** Finds a partner by ID, exact name, or a known brand name typed in a spreadsheet (e.g. "Sobha"). */
export function findPartner(key: string, developers: Developer[]): Developer | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const direct = developers.find((d) => d.id === k) ?? developers.find((d) => d.name.toLowerCase() === k || d.legalName.toLowerCase() === k);
  if (direct) return direct;
  const brand = APPROVED_PARTNERS.find((p) => p.id === k || p.match.test(key));
  return brand ? developers.find((d) => d.id === brand.id || brand.match.test(d.name) || brand.match.test(d.legalName)) ?? null : null;
}
