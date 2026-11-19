import type { Developer } from './data/types';

/**
 * The partners EstateNav lists for. Only these appear in the property editor's partner list.
 * A partner's Firestore record is created the first time it is used (or set up on the
 * Partners page); an existing record is matched by ID or by name, so older data is reused.
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

export type ResolvedPartner = {
  /** The ID listings store: the existing record's ID when one matches, otherwise the default. */
  id: string;
  name: string;
  /** The Firestore record, or null until the partner is first used. */
  developer: Developer | null;
};

function findRecord(partner: (typeof APPROVED_PARTNERS)[number], developers: Developer[]): Developer | null {
  return developers.find((d) => d.id === partner.id) ?? developers.find((d) => partner.match.test(d.name) || partner.match.test(d.legalName)) ?? null;
}

/** The approved partners in list order, each paired with its database record if there is one. */
export function resolvePartners(developers: Developer[]): ResolvedPartner[] {
  return APPROVED_PARTNERS.map((p) => {
    const developer = findRecord(p, developers);
    return { id: developer?.id ?? p.id, name: developer?.name ?? p.name, developer };
  });
}

/** Records in the database that are not one of the approved partners (kept for older listings). */
export function otherDevelopers(developers: Developer[]): Developer[] {
  const used = new Set(resolvePartners(developers).map((p) => p.developer?.id).filter(Boolean));
  return developers.filter((d) => !used.has(d.id));
}

/** Finds an approved partner by stored ID, default ID, or a name typed in a spreadsheet. */
export function approvedPartnerFor(key: string, developers: Developer[]): ResolvedPartner | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  return resolvePartners(developers).find((p, i) => p.id === k || APPROVED_PARTNERS[i].id === k || p.name.toLowerCase() === k || APPROVED_PARTNERS[i].match.test(key)) ?? null;
}
