import type { DocumentKind, NearbyCategory, Property } from './data/types';

// Labels and groupings shared by the admin and the public site (keep both copies identical:
// EstateNav/lib/listingMeta.ts and EstateNav-admin/lib/listingMeta.ts).

export const PROPERTY_TYPE_LABEL: Record<Property['propertyType'], string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  'row-house': 'Row house',
  villament: 'Villament',
  penthouse: 'Penthouse',
  'independent-house': 'Independent house',
  plot: 'Plot',
  office: 'Office space',
  retail: 'Retail space',
};

export const NEARBY_CATEGORY_LABEL: Record<NearbyCategory, string> = {
  metro: 'Metro station',
  railway: 'Railway station',
  airport: 'Airport',
  bus: 'Bus stop / depot',
  highway: 'Highway / main road',
  'it-park': 'IT park / office hub',
  school: 'School',
  college: 'College / university',
  hospital: 'Hospital',
  mall: 'Mall',
  market: 'Market / supermarket',
  park: 'Park / lake',
  landmark: 'Landmark',
};

export const NEARBY_GROUPS: { id: string; label: string; categories: NearbyCategory[] }[] = [
  { id: 'transit', label: 'Transit', categories: ['metro', 'railway', 'airport', 'bus', 'highway'] },
  { id: 'work', label: 'Work', categories: ['it-park'] },
  { id: 'education', label: 'Education', categories: ['school', 'college'] },
  { id: 'health', label: 'Healthcare', categories: ['hospital'] },
  { id: 'leisure', label: 'Shopping & leisure', categories: ['mall', 'market', 'park', 'landmark'] },
];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  brochure: 'Brochure',
  'floor-plans': 'Floor plans',
  'master-plan': 'Master plan',
  'price-sheet': 'Price sheet',
  'payment-plan': 'Payment plan',
  specifications: 'Specifications',
  'rera-certificate': 'RERA certificate',
  approval: 'Approval document',
  other: 'Document',
};

export const AMENITY_GROUPS: { id: string; label: string; items: string[]; match: RegExp }[] = [
  {
    id: 'safety',
    label: 'Safety & security',
    items: ['24x7 Security', 'CCTV Surveillance', 'Security & RFID', 'Video Door Phone / Intercom', 'Fire Fighting System', 'Gated Community'],
    match: /secur|cctv|intercom|door phone|fire|gated|rfid|surveil/i,
  },
  {
    id: 'family',
    label: 'Kids & family',
    items: ['Children Play Area', 'Creche / Day Care', 'Senior Citizen Area', 'Pet Park', 'Barbecue Area'],
    match: /child|kid|toddler|play area|creche|day ?care|senior|pet|barbecue|bbq/i,
  },
  {
    id: 'sports',
    label: 'Sports & fitness',
    items: ['Swimming Pool', 'Gymnasium', 'Jogging / Walking Track', 'Cycling Track', 'Badminton Court', 'Tennis Court', 'Squash Court', 'Basketball Court', 'Cricket Practice Net', 'Yoga / Meditation Deck', 'Table Tennis', 'Skating Rink'],
    match: /pool|gym|jog|walking|cycl|court|cricket|yoga|medita|tennis|badminton|squash|basketball|skating|sport|fitness|aerobic/i,
  },
  {
    id: 'convenience',
    label: 'Convenience',
    items: ['Power Backup', '24x7 Water Supply', 'Lifts', 'Covered Car Parking', 'Visitor Parking', 'EV Charging Bays', 'Convenience Store', 'ATM', 'Laundry', 'Piped Gas'],
    match: /power|water supply|lift|elevator|parking|\bev\b|charging|store|shop|atm|laundry|gas|wifi|wi-fi/i,
  },
  {
    id: 'leisure',
    label: 'Clubhouse & leisure',
    items: ['Clubhouse', 'Party Hall', 'Indoor Games', 'Library / Reading Room', 'Mini Theatre', 'Amphitheatre', 'Spa / Sauna', 'Café', 'Rooftop Lounge', 'Co-working Space', 'Guest Rooms'],
    match: /club|party|banquet|hall|indoor|game|library|reading|theatre|theater|amphi|spa|sauna|jacuzzi|caf|lounge|co-?working|guest/i,
  },
  {
    id: 'green',
    label: 'Green & sustainability',
    items: ['Landscaped Gardens', 'Rainwater Harvesting', 'Sewage Treatment Plant', 'Solar Lighting', 'Organic Waste Converter', 'Water Treatment Plant'],
    match: /garden|green|landscap|rain|sewage|stp|solar|waste|treatment|lake|park|tree|forest/i,
  },
];

/** Puts each amenity under a heading; anything unrecognised lands in "Other amenities". */
export function groupAmenities(amenities: string[]): { id: string; label: string; items: string[] }[] {
  const groups = AMENITY_GROUPS.map((g) => ({ id: g.id, label: g.label, items: [] as string[] }));
  const other: string[] = [];
  for (const amenity of amenities) {
    const exact = AMENITY_GROUPS.findIndex((g) => g.items.some((item) => item.toLowerCase() === amenity.toLowerCase()));
    const index = exact >= 0 ? exact : AMENITY_GROUPS.findIndex((g) => g.match.test(amenity));
    if (index >= 0) groups[index].items.push(amenity);
    else other.push(amenity);
  }
  const result = groups.filter((g) => g.items.length > 0);
  if (other.length) result.push({ id: 'other', label: 'Other amenities', items: other });
  return result;
}

export const SPEC_CATEGORIES = [
  'Structure',
  'Flooring – living & dining',
  'Flooring – bedrooms',
  'Flooring – balconies',
  'Kitchen',
  'Bathrooms',
  'Doors',
  'Windows',
  'Electrical',
  'Painting',
  'Lifts',
  'Power backup',
  'Water supply',
  'Security',
];

export const EXTRA_DETAIL_SUGGESTIONS: { group: string; label: string; placeholder: string }[] = [
  { group: 'Charges', label: 'Maintenance charges', placeholder: 'e.g. ₹4.5 per sq.ft per month, 2 years in advance' },
  { group: 'Charges', label: 'Corpus fund', placeholder: 'e.g. ₹100 per sq.ft' },
  { group: 'Charges', label: 'Floor rise charges', placeholder: 'e.g. ₹50 per sq.ft from the 5th floor' },
  { group: 'Charges', label: 'Car parking charges', placeholder: 'e.g. One covered car park included' },
  { group: 'Charges', label: 'Club membership', placeholder: 'e.g. ₹2.5 L, payable at possession' },
  { group: 'Payment', label: 'Payment plan', placeholder: 'e.g. 10% booking, 80% construction-linked, 10% at possession' },
  { group: 'Payment', label: 'Booking amount', placeholder: 'e.g. ₹5 L' },
  { group: 'Project', label: 'Car parking', placeholder: 'e.g. Basement + stilt, 1 per 2 BHK, 2 per 3 BHK' },
  { group: 'Project', label: 'Facing options', placeholder: 'e.g. East, North, West' },
  { group: 'Project', label: 'Loading factor', placeholder: 'e.g. 32%' },
  { group: 'Project', label: 'Water source', placeholder: 'e.g. BWSSB + borewell, WTP on site' },
  { group: 'Project', label: 'Vastu', placeholder: 'e.g. Vastu-compliant layouts' },
  { group: 'Project', label: 'Architect', placeholder: 'e.g. Firm name' },
];
