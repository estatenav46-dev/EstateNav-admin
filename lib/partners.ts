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
  { id: 'puravankara', name: 'Puravankara', match: /\bpurav?ankara\b/i },
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

/** Finds a partner by ID, exact name, or a known brand name typed in a spreadsheet (e.g. "Sobha"). */
export function findPartner(key: string, developers: Developer[]): Developer | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const direct = developers.find((d) => d.id === k) ?? developers.find((d) => d.name.toLowerCase() === k || d.legalName.toLowerCase() === k);
  if (direct) return direct;
  const brand = APPROVED_PARTNERS.find((p) => p.id === k || p.match.test(key));
  return brand ? developers.find((d) => d.id === brand.id || brand.match.test(d.name) || brand.match.test(d.legalName)) ?? null : null;
}
