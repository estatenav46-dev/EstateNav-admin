// Copy of EstateNav/lib/partnerLogos.ts (and the files in public/partners): the admin's
// Channel partner logos page shows the same logo the website's logo wall shows. Keep in step.

// Partner logos kept with the site (public/partners), used when no logo has been uploaded for a
// partner on the admin's Partners page; an uploaded logo always wins. Files were taken from each
// developer's own website on 2026-11-23, trimmed of empty margins; Century, Mantri and DSR's
// white-only artwork was given a dark version so it reads on the wall's white tiles.
//   abheeventures.com, bren.com, brigadegroup.com, centuryrealestate.in, dsrinfra.com,
//   godrejproperties.com, manaprojects.com, mantri.in, prestigeconstructions.com,
//   puravankara.com, sattvagroup.com, shriramproperties.com, snnrajcorp.com,
//   sumadhuragroup.com, total-environment.com, vaswanigroup.com
// Logos belong to their owners; the wall says so.

export type StaticLogo = { src: string; /** Mark only, no wordmark: the tile adds the name. */ withName?: boolean };

const LOGOS: { ids: string[]; match: RegExp; logo: StaticLogo }[] = [
  { ids: ['abhee-ventures'], match: /\babhee\b/i, logo: { src: '/partners/abhee-ventures.png' } },
  { ids: ['bren-corporation'], match: /\bbren\b/i, logo: { src: '/partners/bren-corporation.png' } },
  { ids: ['brigade-group', 'brigade-enterprises'], match: /\bbrigade\b/i, logo: { src: '/partners/brigade.png' } },
  { ids: ['century-real-estate'], match: /\bcentury\b/i, logo: { src: '/partners/century-real-estate.png' } },
  { ids: ['dsr-infrastructure'], match: /\bdsr\b/i, logo: { src: '/partners/dsr.png' } },
  { ids: ['godrej-properties'], match: /\bgodrej\b/i, logo: { src: '/partners/godrej-properties.svg' } },
  { ids: ['mana-projects'], match: /\bmana\b/i, logo: { src: '/partners/mana-projects.png' } },
  { ids: ['mantri-developers'], match: /\bmantri\b/i, logo: { src: '/partners/mantri-developers.png' } },
  { ids: ['prestige-group'], match: /\bprestige\b/i, logo: { src: '/partners/prestige-group.svg' } },
  { ids: ['puravankara'], match: /\bpurav?ankara\b|\bprovident\b|\bpurva\b/i, logo: { src: '/partners/puravankara.svg' } },
  { ids: ['sattva-group'], match: /\bsattva\b/i, logo: { src: '/partners/sattva-group.png' } },
  { ids: ['shriram-properties'], match: /\bshriram\b/i, logo: { src: '/partners/shriram-properties.png' } },
  { ids: ['snn-raj-corp'], match: /\bsnn\b/i, logo: { src: '/partners/snn-raj-corp.png' } },
  { ids: ['sumadhura-group'], match: /\bsumadhura\b/i, logo: { src: '/partners/sumadhura-group.svg' } },
  { ids: ['total-environment'], match: /\btotal environment\b/i, logo: { src: '/partners/total-environment.png', withName: true } },
  { ids: ['vaswani-group'], match: /\bvaswani\b/i, logo: { src: '/partners/vaswani-group.svg' } },
];

/** The bundled logo for a partner, by its ID or its name ("Brigade Enterprises" finds Brigade). */
export function partnerLogo(id: string, name: string): StaticLogo | null {
  return LOGOS.find((l) => l.ids.includes(id))?.logo ?? LOGOS.find((l) => l.match.test(name))?.logo ?? null;
}
