import type { z } from 'zod';
import type {
  configurationSchema,
  corridorSchema,
  developerSchema,
  documentKindSchema,
  enquiryIntentSchema,
  enquirySchema,
  enquirySourceSchema,
  enquiryStatusSchema,
  extraDetailSchema,
  fileRefSchema,
  imageRefSchema,
  lensSchema,
  nearbyCategorySchema,
  nearbyPlaceSchema,
  officeHubSchema,
  projectFactsSchema,
  propertyDocumentSchema,
  propertySchema,
  publishStatusSchema,
  segmentSchema,
  siteSettingsSchema,
  specificationSchema,
} from './schemas';

export type ImageRef = z.infer<typeof imageRefSchema>;
export type FileRef = z.infer<typeof fileRefSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Lens = z.infer<typeof lensSchema>;
export type PublishStatus = z.infer<typeof publishStatusSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type ProjectFacts = z.infer<typeof projectFactsSchema>;
export type Specification = z.infer<typeof specificationSchema>;
export type NearbyCategory = z.infer<typeof nearbyCategorySchema>;
export type NearbyPlace = z.infer<typeof nearbyPlaceSchema>;
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type PropertyDocument = z.infer<typeof propertyDocumentSchema>;
export type ExtraDetail = z.infer<typeof extraDetailSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Developer = z.infer<typeof developerSchema>;
export type Corridor = z.infer<typeof corridorSchema>;
export type OfficeHub = z.infer<typeof officeHubSchema>;
export type EnquiryIntent = z.infer<typeof enquiryIntentSchema>;
export type EnquirySource = z.infer<typeof enquirySourceSchema>;
export type EnquiryStatus = z.infer<typeof enquiryStatusSchema>;
export type Enquiry = z.infer<typeof enquirySchema>;
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
