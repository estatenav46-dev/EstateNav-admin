import { getDb } from './db';
import {
  corridorConverter,
  developerConverter,
  enquiryConverter,
  officeHubConverter,
  propertyConverter,
  settingsConverter,
} from './converters';
import {
  corridorSchema,
  developerSchema,
  enquirySchema,
  propertySchema,
  siteSettingsSchema,
} from './schemas';
import type { Corridor, Developer, Enquiry, OfficeHub, Property, PublishStatus, SiteSettings } from './types';

export type PropertyDraft = Omit<Property, 'createdAt' | 'updatedAt' | 'publishedAt' | 'createdBy' | 'updatedBy'> & {
  publishedAt?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export async function getDashboardCounts() {
  const db = getDb();
  const [propsSnap, devsSnap, corrSnap, enqSnap] = await Promise.all([
    db.collection('properties').get(),
    db.collection('developers').get(),
    db.collection('corridors').get(),
    db.collection('enquiries').get(),
  ]);

  const properties = propsSnap.docs.map((d) => d.data() as Property);
  const enquiries = enqSnap.docs.map((d) => d.data() as Enquiry);

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
    totalDevelopers: devsSnap.size,
    totalCorridors: corrSnap.size,
    totalEnquiries: enquiries.length,
    newEnquiries,
    recentEnquiriesCount,
    recentEnquiries: enquiries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  };
}

export async function listProperties(filter?: { status?: string; segment?: string; corridorId?: string }): Promise<Property[]> {
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
  const items = snap.docs.map((d) => d.data());
  items.sort((a, b) => a.featuredRank - b.featuredRank);
  return items;
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const db = getDb();
  const doc = await db.collection('properties').doc(id).withConverter(propertyConverter).get();
  return doc.exists ? doc.data()! : null;
}

export async function isSlugAvailable(slug: string, exceptId?: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection('properties').where('slug', '==', slug).limit(2).get();
  if (snap.empty) return true;
  return snap.docs.every((d) => d.id === exceptId);
}

export async function saveProperty(draft: PropertyDraft, actor: string): Promise<Property> {
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
  const db = getDb();
  await db.collection('properties').doc(id).delete();
}

export async function listDevelopers(): Promise<Developer[]> {
  const db = getDb();
  const snap = await db.collection('developers').withConverter(developerConverter).get();
  return snap.docs.map((d) => d.data());
}

export async function saveDeveloper(input: unknown): Promise<Developer> {
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

export async function listCorridors(): Promise<Corridor[]> {
  const db = getDb();
  const snap = await db.collection('corridors').withConverter(corridorConverter).get();
  const results = snap.docs.map((d) => d.data());
  results.sort((a, b) => a.order - b.order);
  return results;
}

export async function saveCorridor(input: unknown): Promise<Corridor> {
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

export async function listOfficeHubs(): Promise<OfficeHub[]> {
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

export async function getSettings(): Promise<SiteSettings> {
  const db = getDb();
  const doc = await db.collection('settings').doc('site').withConverter(settingsConverter).get();
  if (!doc.exists) {
    throw new Error('Site settings document not found in Firestore.');
  }
  const { id: _id, ...rest } = doc.data()!;
  return rest;
}

export async function saveSettings(input: unknown): Promise<SiteSettings> {
  const db = getDb();
  const record = siteSettingsSchema.parse(input);
  await db.collection('settings').doc('site').withConverter(settingsConverter).set({ ...record, id: 'site' });
  return record;
}

