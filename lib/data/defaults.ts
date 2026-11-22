import type { ProjectFacts, Property, SiteSettings } from './types';

export type ListingDetailKey = 'priceOnRequest' | 'priceNote' | 'facts' | 'specifications' | 'nearby' | 'documents' | 'extraDetails' | 'offer' | 'hidden' | 'phase' | 'charges' | 'paymentPlan';

export const EMPTY_FACTS: ProjectFacts = {
  landAcres: null,
  totalUnits: null,
  towers: null,
  floors: null,
  openSpacePct: null,
  clubhouseSqft: null,
  launchDate: null,
  clubhouseDetails: null,
  facing: null,
};

/** The listing-detail fields with nothing filled in (same shape as the schema defaults). */
export function emptyListingDetails(): Pick<Property, ListingDetailKey> {
  return {
    priceOnRequest: false,
    priceNote: '',
    facts: { ...EMPTY_FACTS },
    specifications: [],
    nearby: [],
    documents: [],
    extraDetails: [],
    offer: null,
    hidden: false,
    phase: '',
    charges: [],
    paymentPlan: { type: '', bookingPct: null, stages: [] },
  };
}


const CONSENT_TEXT =
  'By submitting this form, you consent to registering your inquiry through SV Praveen, K-RERA registered agent and authorised channel partner. Communication will be coordinated under direct-developer pricing terms.';

/** Used when settings/site has not been created yet (matches the website's built-in defaults). */
export const DEFAULT_SETTINGS: SiteSettings = {
  contact: { phone: '+919740609562', phoneDisplay: '+91 97406 09562', whatsapp: '919740609562', email: 'advisory@estatenav.in' },
  agent: {
    name: 'SV Praveen',
    title: 'K-RERA registered real estate agent',
    reraNumber: 'PRM/KA/RERA/1251/310/AG/260916/007810',
    validFrom: '16-09-2026',
    validTo: '16-09-2031',
    verifyUrl: 'https://rera.karnataka.gov.in/',
  },
  partnerDeveloper: '',
  costs: {
    stampDutyPct: 5.6,
    registrationPct: 2,
    source: 'Department of Stamps and Registration, Karnataka',
    asOf: '2025-09-01',
    note: 'Indicative only. Duty is charged on the higher of agreement value and guidance value, and can vary by transaction.',
  },
  disclaimers: {
    portal: 'EstateNav is an independent advisory portal, not the official developer website.',
    listing:
      'Prices are developer guide prices and change with unit, floor and availability. Verify title, approvals, RERA registration and all transaction documents with the relevant authorities and the developer.',
    costs: 'Illustrative estimate. Lender terms, guidance value and statutory charges vary — confirm before you commit.',
    commute: 'Drive times vary with traffic and route. Bands shown are measurements from the source and date noted, not guarantees.',
  },
  consentVersion: '2026-11-v1',
  consentText: CONSENT_TEXT,
  privacyNote: 'Zero-spam privacy: your details are used only to answer this enquiry. No marketing lists, no sharing with other brokers.',
};
