import type { Corridor, Developer } from '@/lib/data/types';
import { findPartner } from '@/lib/partners';
import type { ParsedProject } from './parse';
import { slugify } from './values';

export type AreaMatch = { corridor: Corridor; created: false } | { corridor: Corridor; created: true } | null;

const norm = (s: string) => s.toLowerCase().replace(/bengaluru|bangalore|road|rd\.?|main|\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');

/** Finds the area by ID, name or a close spelling ("Sarjapur Rd" = "Sarjapur Road"). */
export function findArea(value: string, corridors: Corridor[]): Corridor | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return (
    corridors.find((c) => c.id === v || c.slug === v || c.name.toLowerCase() === v) ??
    corridors.find((c) => c.id === slugify(v)) ??
    corridors.find((c) => norm(c.name) === norm(v) && norm(v).length >= 4) ??
    null
  );
}

/** A new area record for a name that is not in the list yet (needs the region). */
export function newArea(name: string, region: NonNullable<ParsedProject['fields']['region']>, corridors: Corridor[]): Corridor {
  const id = slugify(name);
  return {
    id,
    name: name.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slug: id,
    description: '',
    svgPathId: id,
    heroImage: null,
    order: corridors.reduce((max, c) => Math.max(max, c.order), 0) + 1,
    zone: region,
  };
}

export interface ProjectLookup {
  developer: Developer | null;
  corridor: Corridor | null;
  /** Area that will be created on save. */
  newCorridor: Corridor | null;
  errors: string[];
}

export function lookupProject(project: ParsedProject, developers: Developer[], corridors: Corridor[], scopedDeveloperId?: string): ProjectLookup {
  const errors: string[] = [];
  const key = scopedDeveloperId || project.fields.partner;
  const developer = key ? findPartner(key, developers) : null;
  if (key && !developer) errors.push(`Partner "${key}" is not in the partner list. Add it on the Partners page, or use one of: ${developers.filter((d) => !d.hidden).map((d) => d.name).join(', ')}.`);
  if (developer?.hidden) errors.push(`Partner "${developer.name}" is hidden; its listings would not show. Unhide it on the Partners page first.`);

  let corridor = findArea(project.fields.area, corridors);
  let newCorridor: Corridor | null = null;
  if (!corridor && project.fields.area) {
    if (project.fields.region) {
      newCorridor = newArea(project.fields.area, project.fields.region, corridors);
      corridor = newCorridor;
    } else {
      errors.push(`Area "${project.fields.area}" is not in the list. Use an area from the Lists sheet, or fill region so the new area can be created.`);
    }
  }
  if (corridor && !newCorridor && project.fields.region && corridor.zone && corridor.zone !== project.fields.region) {
    project.warnings.push(`Area ${corridor.name} is in the ${corridor.zone} region, not ${project.fields.region}; the area's region is used.`);
  }
  return { developer, corridor, newCorridor, errors };
}
