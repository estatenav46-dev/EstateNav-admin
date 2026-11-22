import { getDb } from './db';
import {
  blogConverter,
  corridorConverter,
  developerConverter,
  enquiryConverter,
  officeHubConverter,
  propertyConverter,
  settingsConverter,
} from './converters';
import {
  blogPostSchema,
  corridorSchema,
  developerSchema,
  enquirySchema,
  propertySchema,
  siteSettingsSchema,
} from './schemas';
import type { BlogPost, Corridor, Developer, Enquiry, OfficeHub, Property, PublishStatus, SiteSettings } from './types';
import { DEFAULT_SETTINGS } from './defaults';
import { APPROVED_PARTNERS } from '../partners';

export type PropertyDraft = Omit<Property, 'createdAt' | 'updatedAt' | 'publishedAt' | 'createdBy' | 'updatedBy'> & {
  publishedAt?: string | null;
};


// ---- Short-lived read cache ----
// Admin pages re-read the same lists on every click; keep them for a few seconds per server
// instance. Every write clears it, so edits show at once. Enquiries are never cached.
const CACHE_MS = 10_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    memo.delete(key);
    throw error;
  });
  memo.set(key, { at: Date.now(), value });
  return value;
}
export function clearReadCache() {
  memo.clear();
}

const today = () => new Date().toISOString().slice(0, 10);

export async function getDashboardCounts() {
  const [properties, developers, corridors, enquiries] = await Promise.all([
    listProperties({ status: 'all' }),
    listDevelopers(),
    listCorridors(),
    getDb().collection('enquiries').get().then((snap) => snap.docs.map((d) => d.data() as Enquiry)),
  ]);

  const incomplete = properties
    .filter((p) => p.status !== 'archived')
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      missing: [
        !p.media.gallery.length && 'photos',
        !p.configurations.length && 'unit types',
        p.configurations.length > 0 && !p.configurations.some((c) => c.floorPlanImageId) && !p.media.floorPlans.length && 'floor plans',
        !p.rera.number && 'K-RERA number',
        !p.documents.length && 'brochure',
        p.nearby.length < 3 && 'nearby places',
      ].filter((m): m is string => Boolean(m)),
    }))
    .filter((p) => p.missing.length > 0)
    .sort((a, b) => (a.status === b.status ? b.missing.length - a.missing.length : a.status === 'published' ? -1 : 1));

  const published = properties.filter((p) => p.status === 'published').length;
  const drafts = properties.filter((p) => p.status === 'draft').length;
  const archived = properties.filter((p) => p.status === 'archived').length;

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const newEnquiries = enquiries.filter((e) => e.status === 'new').length;
  const recentEnquiriesCount = enquiries.filter((e) => e.createdAt >= weekAgo).length;

  return {
    totalProperties: properties.length,
    publishedProperties: published,
    draftProperties: drafts,
    archivedProperties: archived,
    totalDevelopers: developers.length,
    totalCorridors: corridors.length,
    totalEnquiries: enquiries.length,
    newEnquiries,
    recentEnquiriesCount,
    recentEnquiries: enquiries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    incomplete: incomplete.slice(0, 8),
    incompleteCount: incomplete.length,
  };
}

export const listProperties = (filter?: { status?: string; segment?: string; corridorId?: string }) => cached(`properties:${JSON.stringify(filter ?? {})}`, () => loadProperties(filter));

async function loadProperties(filter?: { status?: string; segment?: string; corridorId?: string }): Promise<Property[]> {
  const db = getDb();
  let q: FirebaseFirestore.Query<Property> = db.collection('properties').withConverter(propertyConverter);

  if (filter?.status && filter.status !== 'all') {
    q = q.where('status', '==', filter.status);
  }
  if (filter?.segment) {
    q = q.where('segment', '==', filter.segment);
  }
  if (filter?.corridorId) {
    q = q.where('corridorId', '==', filter.corridorId);
  }

  const snap = await q.get();
  const items = snap.docs.flatMap((d) => {
    try {
      return [d.data()];
    } catch (error) {
      console.error(`[properties] invalid listing ${d.id}:`, error instanceof Error ? error.message.slice(0, 400) : error);
      return [];
    }
  });
  items.sort((a, b) => a.featuredRank - b.featuredRank);
  return items;
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const db = getDb();
  const doc = await db.collection('properties').doc(id).withConverter(propertyConverter).get();
  return doc.exists ? doc.data()! : null;
}

/** Used by imports to make the public URL slug the stable upsert key. */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const db = getDb();
  const snap = await db.collection('properties').where('slug', '==', slug).limit(1).withConverter(propertyConverter).get();
  return snap.empty ? null : snap.docs[0].data();
}

export async function isSlugAvailable(slug: string, exceptId?: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection('properties').where('slug', '==', slug).limit(2).get();
  if (snap.empty) return true;
  return snap.docs.every((d) => d.id === exceptId);
}

export async function saveProperty(draft: PropertyDraft, actor: string): Promise<Property> {
  clearReadCache();
  const db = getDb();
  const docRef = db.collection('properties').doc(draft.id).withConverter(propertyConverter);
  const snap = await docRef.get();
  const existing = snap.exists ? snap.data() : null;

  const now = today();
  const record = propertySchema.parse({
    ...draft,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? actor,
    updatedAt: now,
    updatedBy: actor,
    publishedAt: draft.status === 'published' ? existing?.publishedAt ?? now : existing?.publishedAt ?? null,
  });

  await docRef.set(record);
  return record;
}

export async function setPropertyStatus(id: string, status: PublishStatus, actor: string): Promise<Property> {
  const property = await getPropertyById(id);
  if (!property) throw new Error(`Property ${id} not found`);
  return saveProperty({ ...property, status }, actor);
}

export async function setPropertyFeatured(id: string, featured: boolean, actor: string): Promise<Property> {
  const property = await getPropertyById(id);
  if (!property) throw new Error(`Property ${id} not found`);
  return saveProperty({ ...property, featured }, actor);
}

export async function duplicateProperty(id: string, actor: string): Promise<Property> {
  const current = await getPropertyById(id);
  if (!current) throw new Error(`Property ${id} not found`);

  let n = 2;
  while (!(await isSlugAvailable(`${current.slug}-copy-${n}`))) {
    n += 1;
  }
  const slug = `${current.slug}-copy-${n}`;
  const newId = `${current.id}-copy-${Date.now().toString(36)}`;

  return saveProperty(
    {
      ...current,
      id: newId,
      slug,
      title: `${current.title} (copy)`,
      status: 'draft',
      featured: false,
      publishedAt: null,
    },
    actor
  );
}

export async function deleteProperty(id: string): Promise<void> {
  clearReadCache();
  const db = getDb();
  await db.collection('properties').doc(id).delete();
}

export const listDevelopers = () => cached('developers', loadDevelopers);

/** Writes the starting partners to Firestore once; a marker stops deleted ones coming back. */
async function seedStartingPartners(existing: Developer[]): Promise<boolean> {
  const db = getDb();
  const meta = db.collection('settings').doc('admin');
  const snap = await meta.get();
  if (snap.exists && snap.data()?.partnersSeeded) return false;
  const missing = APPROVED_PARTNERS.filter((p) => !existing.some((d) => d.id === p.id || p.match.test(d.name) || p.match.test(d.legalName)));
  const batch = db.batch();
  for (const p of missing) {
    const record = developerSchema.parse({ id: p.id, name: p.name, legalName: p.name, about: '', yearsActive: null, sqftDelivered: null, constructionTech: null, sources: [], website: null, logo: null });
    batch.set(db.collection('developers').doc(p.id).withConverter(developerConverter), record);
  }
  batch.set(meta, { partnersSeeded: true, partnersSeededAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
  return missing.length > 0;
}

async function readDevelopers(): Promise<Developer[]> {
  const snap = await getDb().collection('developers').withConverter(developerConverter).get();
  return snap.docs.map((d) => d.data());
}

async function loadDevelopers(): Promise<Developer[]> {
  const list = await readDevelopers();
  return (await seedStartingPartners(list)) ? readDevelopers() : list;
}

/** Deletes a partner that no listing uses; otherwise explains what to do instead. */
export async function deleteDeveloper(id: string): Promise<void> {
  clearReadCache();
  const used = await getDb().collection('properties').where('developerId', '==', id).get();
  if (!used.empty) throw new Error(`This partner still has ${used.size} listing${used.size === 1 ? '' : 's'}. Hide the partner instead, or move or delete those listings first.`);
  await getDb().collection('developers').doc(id).delete();
}

export async function setDeveloperHidden(id: string, hidden: boolean): Promise<void> {
  clearReadCache();
  await getDb().collection('developers').doc(id).update({ hidden });
}

export async function setPropertyHidden(id: string, hidden: boolean, actor: string): Promise<Property> {
  const property = await getPropertyById(id);
  if (!property) throw new Error(`Property ${id} not found`);
  return saveProperty({ ...property, hidden }, actor);
}

/**
 * Returns the partner record for a listing, creating it first when it is one of the approved
 * partners that has not been used yet. Unknown IDs that are not in the database return null.
 */
export async function ensurePartnerRecord(id: string): Promise<{ developer: Developer; created: boolean } | null> {
  const db = getDb();
  const snap = await db.collection('developers').doc(id).withConverter(developerConverter).get();
  if (snap.exists) return { developer: snap.data()!, created: false };
  const approved = APPROVED_PARTNERS.find((p) => p.id === id);
  if (!approved) return null;
  const developer = await saveDeveloper({
    id: approved.id,
    name: approved.name,
    legalName: approved.name,
    about: '',
    yearsActive: null,
    sqftDelivered: null,
    constructionTech: null,
    projectsDelivered: null,
    headquarters: null,
    hidden: false,
    sources: [],
    website: null,
    logo: null,
  });
  return { developer, created: true };
}

/** Creates a partner; refuses to overwrite an existing id (used by the inline "add partner" flow). */
export async function createDeveloper(input: unknown): Promise<Developer> {
  const record = developerSchema.parse(input);
  const existing = await getDb().collection('developers').doc(record.id).get();
  if (existing.exists) throw new Error(`A partner with the ID "${record.id}" already exists. Pick it from the list or use another ID.`);
  return saveDeveloper(record);
}

export async function saveDeveloper(input: unknown): Promise<Developer> {
  clearReadCache();
  const db = getDb();
  const record = developerSchema.parse(input);
  await db.collection('developers').doc(record.id).withConverter(developerConverter).set(record);

  // Update denormalized developerName in properties
  const props = await db.collection('properties').where('developerId', '==', record.id).get();
  const batch = db.batch();
  props.docs.forEach((doc) => {
    batch.update(doc.ref, { developerName: record.name });
  });
  if (!props.empty) {
    await batch.commit();
  }

  return record;
}

export const listCorridors = () => cached('corridors', loadCorridors);

async function loadCorridors(): Promise<Corridor[]> {
  const db = getDb();
  const snap = await db.collection('corridors').withConverter(corridorConverter).get();
  const results = snap.docs.map((d) => d.data());
  results.sort((a, b) => a.order - b.order);
  return results;
}

/** Creates an area; refuses to overwrite an existing id (used by the inline "add area" flow). */
export async function createCorridor(input: unknown): Promise<Corridor> {
  const record = corridorSchema.parse(input);
  const existing = await getDb().collection('corridors').doc(record.id).get();
  if (existing.exists) throw new Error(`An area with the ID "${record.id}" already exists. Pick it from the list or use another ID.`);
  return saveCorridor(record);
}

export async function saveCorridor(input: unknown): Promise<Corridor> {
  clearReadCache();
  const db = getDb();
  const record = corridorSchema.parse(input);
  await db.collection('corridors').doc(record.id).withConverter(corridorConverter).set(record);

  // Update denormalized corridorName in properties
  const props = await db.collection('properties').where('corridorId', '==', record.id).get();
  const batch = db.batch();
  props.docs.forEach((doc) => {
    batch.update(doc.ref, { corridorName: record.name });
  });
  if (!props.empty) {
    await batch.commit();
  }

  return record;
}

export const listOfficeHubs = () => cached('officeHubs', loadOfficeHubs);

async function loadOfficeHubs(): Promise<OfficeHub[]> {
  const db = getDb();
  const snap = await db.collection('officeHubs').withConverter(officeHubConverter).get();
  return snap.docs.map((d) => d.data());
}

export async function listEnquiries(status?: string): Promise<Enquiry[]> {
  const db = getDb();
  const snap = await db.collection('enquiries').withConverter(enquiryConverter).get();
  let results = snap.docs.map((d) => d.data());
  if (status && status !== 'all') {
    results = results.filter((e) => e.status === status);
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

export async function updateEnquiry(id: string, patch: Partial<Pick<Enquiry, 'status' | 'notes' | 'assignedTo'>>): Promise<Enquiry> {
  const db = getDb();
  const docRef = db.collection('enquiries').doc(id).withConverter(enquiryConverter);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error(`Enquiry ${id} not found`);

  const updated = enquirySchema.parse({ ...snap.data()!, ...patch });
  await docRef.set(updated);
  return updated;
}

export const getSettings = () => cached('settings', loadSettings);

async function loadSettings(): Promise<SiteSettings> {
  const db = getDb();
  const doc = await db.collection('settings').doc('site').withConverter(settingsConverter).get();
  // A fresh database has no settings yet: start from the built-in Karnataka defaults.
  if (!doc.exists) return DEFAULT_SETTINGS;
  const { id: _id, ...rest } = doc.data()!;
  return rest;
}

export async function saveSettings(input: unknown): Promise<SiteSettings> {
  clearReadCache();
  const db = getDb();
  const record = siteSettingsSchema.parse(input);
  await db.collection('settings').doc('site').withConverter(settingsConverter).set({ ...record, id: 'site' });
  return record;
}

// ---- Blog ----

export type BlogDraft = Omit<BlogPost, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'publishedAt'> & { publishedAt?: string | null };

export const listBlogs = () => cached('blogs', loadBlogs);

async function loadBlogs(): Promise<BlogPost[]> {
  const snap = await getDb().collection('blogs').withConverter(blogConverter).get();
  return snap.docs.map((d) => d.data()).sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
}

export async function getBlogById(id: string): Promise<BlogPost | null> {
  const doc = await getDb().collection('blogs').doc(id).withConverter(blogConverter).get();
  return doc.exists ? doc.data()! : null;
}

export async function isBlogSlugAvailable(slug: string, exceptId?: string): Promise<boolean> {
  const snap = await getDb().collection('blogs').where('slug', '==', slug).limit(2).get();
  return snap.docs.every((d) => d.id === exceptId);
}

/** Saves a post. The first publish stamps publishedAt; it is kept on later edits unless set explicitly. */
export async function saveBlog(draft: BlogDraft, actor: string): Promise<BlogPost> {
  clearReadCache();
  const ref = getDb().collection('blogs').doc(draft.id).withConverter(blogConverter);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data()! : null;
  const now = new Date().toISOString();
  const record = blogPostSchema.parse({
    ...draft,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? actor,
    updatedAt: now,
    updatedBy: actor,
    publishedAt: draft.status === 'published' ? draft.publishedAt || existing?.publishedAt || now : existing?.publishedAt ?? draft.publishedAt ?? null,
  });
  await ref.set(record);
  return record;
}

export async function deleteBlog(id: string): Promise<void> {
  clearReadCache();
  await getDb().collection('blogs').doc(id).delete();
}
