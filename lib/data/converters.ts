import type { FirestoreDataConverter, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import {
  corridorSchema,
  developerSchema,
  enquirySchema,
  officeHubSchema,
  propertySchema,
  siteSettingsSchema,
} from './schemas';
import type { Corridor, Developer, Enquiry, OfficeHub, Property, SiteSettings } from './types';

type TimestampLike = { toDate(): Date };

const isTimestamp = (value: unknown): value is TimestampLike =>
  typeof value === 'object' && value !== null && typeof (value as TimestampLike).toDate === 'function';

function timestampsToIso(data: DocumentData): DocumentData {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (isTimestamp(value)) return [key, value.toDate().toISOString()];
      if (value && typeof value === 'object' && !Array.isArray(value)) return [key, timestampsToIso(value as DocumentData)];
      return [key, value];
    }),
  );
}

function makeConverter<T extends { id: string }>(parse: (input: unknown) => T): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      const { id: _id, ...rest } = model;
      return rest as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return parse({ id: snapshot.id, ...timestampsToIso(snapshot.data() || {}) });
    },
  };
}

export const propertyConverter = makeConverter<Property>((input) => propertySchema.parse(input));
export const developerConverter = makeConverter<Developer>((input) => developerSchema.parse(input));
export const corridorConverter = makeConverter<Corridor>((input) => corridorSchema.parse(input));
export const officeHubConverter = makeConverter<OfficeHub>((input) => officeHubSchema.parse(input));
export const enquiryConverter = makeConverter<Enquiry>((input) => enquirySchema.parse(input));
export const settingsConverter: FirestoreDataConverter<SiteSettings & { id: string }> = makeConverter((input) => ({
  ...siteSettingsSchema.parse(input),
  id: 'site',
}));

