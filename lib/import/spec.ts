import {
  chargeBasisSchema,
  documentKindSchema,
  lensSchema,
  nearbyCategorySchema,
  planAuthoritySchema,
  propertyTypeSchema,
  unitAvailabilitySchema,
  unitKindSchema,
} from '@/lib/data/schemas';

/**
 * The bulk-import workbook, described once. The template, its Guide sheet, the parser and the
 * AI fill-in prompt all read this file, so a column added here appears everywhere.
 *
 * Layout: one "Projects" row per project (or per phase with its own K-RERA number) plus child
 * sheets keyed by project_key, one row per item. Nothing is squeezed into a single cell, so a
 * project with five unit sizes, twelve charges or forty nearby places loses nothing.
 */

export type ColumnType = 'text' | 'longtext' | 'number' | 'int' | 'money' | 'area' | 'date' | 'bool' | 'enum' | 'list' | 'url' | 'media' | 'medialist';

export interface Column {
  key: string;
  type: ColumnType;
  required?: boolean;
  /** Allowed values for enum columns (shown as a dropdown in the template). */
  options?: readonly string[];
  /** What to write, for people and for the AI. */
  help: string;
  /** An example value, shown only on the Guide sheet (never as a data row). */
  example?: string;
  width?: number;
}

export interface SheetSpec {
  name: string;
  purpose: string;
  columns: Column[];
}

const YES_NO = ['yes', 'no'] as const;
export const REGIONS = ['north', 'east', 'south-east', 'south', 'west', 'central'] as const;

export const PROJECTS: SheetSpec = {
  name: 'Projects',
  purpose:
    'One row per project. If a project has phases with different K-RERA numbers, prices or possession dates, give each phase its own row and its own project_key.',
  columns: [
    // Identity
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'Short unique ID in lowercase with hyphens. Links this project to its rows on every other sheet and becomes the web address. Re-importing the same key updates the listing.', example: 'sattva-songbird-phase-2' },
    { key: 'project_name', type: 'text', required: true, width: 28, help: 'Project name as the developer markets it, without the phase.', example: 'Sattva Songbird' },
    { key: 'phase', type: 'text', help: 'Phase, tower group or edition, when the row is one phase of a bigger project.', example: 'Phase 2' },
    { key: 'partner', type: 'text', required: true, width: 22, help: 'Developer name or partner ID from the Lists sheet. Only listed partners are accepted.', example: 'Sattva Group' },
    { key: 'city', type: 'text', required: true, help: 'Must be Bengaluru. Rows for any other city are skipped. Devanahalli, Hoskote, Nelamangala, Bidadi, Anekal, Sarjapur and Attibele count as Bengaluru.', example: 'Bengaluru' },
    { key: 'region', type: 'enum', options: REGIONS, help: 'Bengaluru region. Required when the area is new (the area is then created in this region).', example: 'east' },
    { key: 'area', type: 'text', required: true, width: 22, help: 'Area (micro-market) name or ID from the Lists sheet, e.g. Whitefield, Sarjapur Road, North Bengaluru. A new name together with a region creates the area.', example: 'Old Madras Road' },
    { key: 'locality', type: 'text', required: true, width: 28, help: 'Locality or landmark shown on cards.', example: 'Budigere Main Road, off Old Madras Road' },
    { key: 'address', type: 'longtext', width: 36, help: 'Full site address as printed on the brochure or RERA certificate.', example: 'Sy. No. 12, Cheemasandra, Budigere Road, Bengaluru 560049' },
    { key: 'pincode', type: 'text', help: '6-digit PIN code.', example: '560049' },
    { key: 'google_maps_link', type: 'url', width: 30, help: 'Google Maps link to the site. Coordinates are read from it when latitude/longitude are blank.', example: 'https://maps.google.com/?q=13.0412,77.7318' },
    { key: 'latitude', type: 'number', help: 'Decimal latitude (Bengaluru is about 12.7 to 13.4).', example: '13.0412' },
    { key: 'longitude', type: 'number', help: 'Decimal longitude (Bengaluru is about 77.3 to 77.9).', example: '77.7318' },

    // Type & status
    { key: 'property_type', type: 'enum', options: propertyTypeSchema.options, help: 'Main type of the project. Mixed projects use the main type; each unit row has its own unit_kind.', example: 'apartment' },
    { key: 'segment', type: 'enum', options: ['residential', 'plot', 'commercial'], help: 'Leave blank to derive it from property_type (plot → plot, office/retail → commercial, else residential).', example: 'residential' },
    { key: 'transaction', type: 'enum', options: ['sale', 'rent'], help: 'sale (default) or rent.', example: 'sale' },
    { key: 'listing_status', type: 'enum', options: ['draft', 'published'], help: 'draft keeps it hidden for review (default). published shows it on the website; it needs at least one photo.', example: 'draft' },
    { key: 'new_launch', type: 'enum', options: YES_NO, help: 'yes for a new launch or pre-launch.', example: 'no' },
    { key: 'featured', type: 'enum', options: YES_NO, help: 'yes to feature on the home page.', example: 'no' },
    { key: 'buyer_types', type: 'list', help: `Who it suits, separated by |. Any of: ${lensSchema.options.join(', ')}.`, example: 'first-home|investor' },

    // Story
    { key: 'tagline', type: 'text', width: 34, help: 'One line under the name, about 60–110 characters.', example: '2 & 2.5 BHK homes on 4 acres off Old Madras Road' },
    { key: 'description', type: 'longtext', width: 50, help: 'Full description in your own words from the brochure. Separate paragraphs with a blank line. 120–300 words. No phone numbers or broker details.', example: 'Sattva Songbird Phase 2 brings …' },
    { key: 'highlights', type: 'list', width: 40, help: 'Key selling points, one per line or separated by |. Up to 12.', example: '80% open space|3-level clubhouse|Next to 8-lane NH 75' },

    // Project facts
    { key: 'land_acres', type: 'number', help: 'Land area in acres (number only).', example: '4.13' },
    { key: 'total_units', type: 'int', help: 'Total units in this project or phase.', example: '381' },
    { key: 'towers', type: 'int', help: 'Number of towers or blocks.', example: '2' },
    { key: 'floors', type: 'text', help: 'Floor count as written, e.g. 2B + G + 48.', example: '2B + G + 48' },
    { key: 'open_space_pct', type: 'number', help: 'Open space in % (number only).', example: '80' },
    { key: 'clubhouse_sqft', type: 'int', help: 'Clubhouse size in sq.ft (number only).', example: '15000' },
    { key: 'clubhouse_details', type: 'text', help: 'Anything else about the clubhouse, e.g. levels or a second kids’ clubhouse.', example: 'G + 2, rooftop pool' },
    { key: 'facing_options', type: 'text', help: 'Facings available.', example: 'East & North' },
    { key: 'launch_date', type: 'date', help: 'Launch month, YYYY-MM or YYYY-MM-DD.', example: '2026-03' },

    // Price summary
    { key: 'price_on_request', type: 'enum', options: YES_NO, help: 'yes hides every price on the website (prices are still used for budget filters).', example: 'no' },
    { key: 'starting_price', type: 'money', help: 'Lowest price in ₹. Only needed when the Units sheet has no prices. Full rupees (15000000), or 1.5 Cr / 85 L.', example: '15000000' },
    { key: 'max_price', type: 'money', help: 'Highest price in ₹. Only needed when the Units sheet has no prices.', example: '22000000' },
    { key: 'avg_rate_per_sqft', type: 'money', help: 'Base rate in ₹ per sq.ft (on super built-up, or on plot area for plots).', example: '10800' },
    { key: 'price_includes', type: 'text', width: 30, help: 'What the quoted prices include or exclude, printed beside the price.', example: 'Basic + 1 car park + GST; registration extra' },
    { key: 'rent_per_month', type: 'money', help: 'Monthly rent in ₹, for rental listings only.', example: '' },
    { key: 'offer_text', type: 'text', help: 'A running offer shown as a badge, only if the source states it.', example: 'No floor-rise charges till 31 Dec' },
    { key: 'offer_valid_until', type: 'date', help: 'Last day of the offer, YYYY-MM-DD.', example: '2026-12-31' },
    { key: 'payment_plan_type', type: 'text', help: 'e.g. Construction linked, Time linked, 20:80, Down payment.', example: 'Construction linked' },
    { key: 'booking_amount_pct', type: 'number', help: 'Booking amount as % of agreement value.', example: '10' },

    // Possession & legal
    { key: 'possession_status', type: 'enum', options: ['ready', 'under-construction', 'pre-launch'], help: 'ready (RTMI / ready to move), under-construction or pre-launch.', example: 'under-construction' },
    { key: 'possession_date', type: 'date', help: 'Developer’s possession month, YYYY-MM.', example: '2031-06' },
    { key: 'possession_label', type: 'text', help: 'Optional label; written from the date if blank (e.g. Jun 2031).', example: '' },
    { key: 'rera_number', type: 'text', width: 34, help: 'K-RERA project registration number exactly as printed (e.g. PRM/KA/RERA/1251/446/PR/060924/007008).', example: 'PRM/KA/RERA/1251/446/PR/060924/007008' },
    { key: 'rera_completion_date', type: 'date', help: 'Completion date on the RERA registration, when shown.', example: '2031-12' },
    { key: 'rera_verified', type: 'enum', options: YES_NO, help: 'yes only after checking the number on rera.karnataka.gov.in.', example: 'no' },
    { key: 'khata', type: 'enum', options: ['A', 'B', 'E'], help: 'Khata type, only if stated.', example: '' },
    { key: 'plan_authority', type: 'enum', options: planAuthoritySchema.options, help: 'Authority that sanctioned the plan, only if stated. BBMP/GBA city, BDA, BMRDA, BIAAPA (airport area), APA (Anekal), HPA (Hoskote), NPA (Nelamangala), KIADB, DTCP, Panchayat, Other.', example: 'BMRDA' },
    { key: 'title_check', type: 'enum', options: ['clear', 'pending'], help: 'Title status, only if stated.', example: '' },
    { key: 'oc_status', type: 'enum', options: ['received', 'applied', 'not-yet'], help: 'Occupancy certificate, for ready or nearly ready projects.', example: '' },
    { key: 'approval_notes', type: 'longtext', help: 'Other approvals or legal notes (BWSSB, BESCOM, fire NOC, environment clearance…).', example: '' },
    { key: 'bank_approvals', type: 'list', help: 'Banks that have approved the project, separated by |.', example: 'SBI|HDFC Bank|ICICI Bank' },

    // Amenities
    { key: 'amenities', type: 'list', width: 50, help: 'Every amenity, one per line or separated by |. Use short names (Swimming pool, Gym, Co-working space…). Do not use commas as separators.', example: 'Swimming pool|Gymnasium|Mini theatre|Jogging track' },

    // Media
    { key: 'media_folder_link', type: 'url', width: 36, help: 'Fills the photos, floor plans, master plan and brochures automatically. Accepts a public Google Drive folder (anyone with the link), a ZIP download link, or the developer’s project page. Images are copied to EstateNav.', example: 'https://drive.google.com/drive/folders/1h69l6DpkQdeOtHVXQDn11Fg3qLd9ADrm' },
    { key: 'cover_image', type: 'media', width: 30, help: 'Main photo (best exterior render). An image URL, a Google Drive file link, or the file name of an image attached on upload.', example: 'elevation.jpg' },
    { key: 'gallery_images', type: 'medialist', width: 36, help: 'More photos, separated by | (URLs, Drive links or attached file names). Combined with the folder above.', example: 'https://…/clubhouse.jpg|pool.jpg' },
    { key: 'master_plan_image', type: 'media', help: 'Master plan or site layout image (URL, Drive link or file name).', example: 'master-plan.jpg' },
    { key: 'video_url', type: 'url', help: 'Walkthrough video link (YouTube or Drive).', example: '' },
    { key: 'virtual_tour_url', type: 'url', help: '360° / virtual tour link.', example: '' },

    // Search
    { key: 'seo_title', type: 'text', help: 'Google title, under 60 characters. Written automatically if blank.', example: '' },
    { key: 'seo_description', type: 'text', help: 'Google description, 140–160 characters. Written automatically if blank.', example: '' },
  ],
};

export const UNITS: SheetSpec = {
  name: 'Units',
  purpose:
    'One row per unit type or size: each BHK (1, 1.5, 2, 2.5, 3, 3.5, 4, 5 BHK), studio, duplex, penthouse, row house, villa, plot size or office. A project with two 3 BHK sizes gets two 3 BHK rows. Copy every size from the cost sheet or floor-plan book; do not merge them into one range.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'unit_kind', type: 'enum', options: unitKindSchema.options, help: 'apartment (default), studio, duplex, penthouse, villa, row-house, villament, independent-house, plot, office or retail.', example: 'apartment' },
    { key: 'bhk', type: 'number', help: 'Bedrooms as a number: 1, 1.5, 2, 2.5, 3, 3.5, 4, 5. Blank for studios, plots and offices.', example: '2.5' },
    { key: 'unit_label', type: 'text', width: 22, help: 'Optional name; written automatically if blank (e.g. "2.5 BHK", "4 BHK Row house", "30 × 40 plot"). Add the developer’s type name if any, e.g. "3 BHK + Study" or "Type A".', example: '2.5 BHK' },
    { key: 'carpet_sqft_min', type: 'area', help: 'RERA carpet area in sq.ft. For plots, the plot area. One size → fill min only.', example: '1085' },
    { key: 'carpet_sqft_max', type: 'area', help: 'Largest carpet area when this row covers a small range.', example: '' },
    { key: 'super_builtup_sqft_min', type: 'area', help: 'Super built-up / saleable area in sq.ft.', example: '1660' },
    { key: 'super_builtup_sqft_max', type: 'area', help: 'Largest super built-up area for a range.', example: '' },
    { key: 'balcony_sqft', type: 'area', help: 'Balcony area in sq.ft.', example: '146' },
    { key: 'terrace_garden_sqft', type: 'area', help: 'Private terrace or garden area in sq.ft (row houses, penthouses).', example: '' },
    { key: 'uds_sqft', type: 'area', help: 'Undivided share of land in sq.ft, when stated.', example: '' },
    { key: 'plot_dimensions', type: 'text', help: 'Plot or villa dimensions, e.g. 30 × 40 ft.', example: '' },
    { key: 'bathrooms', type: 'int', help: 'Number of bathrooms.', example: '3' },
    { key: 'car_parks', type: 'int', help: 'Car parks included with the unit.', example: '1' },
    { key: 'facing', type: 'text', help: 'Facing of this unit type, if stated.', example: 'East' },
    { key: 'tower_block', type: 'text', help: 'Tower, block, wing or series, if the size belongs to one.', example: 'Tower 5' },
    { key: 'units_count', type: 'int', help: 'How many units of this type, if stated.', example: '' },
    { key: 'rate_per_sqft', type: 'money', help: 'Base rate in ₹ per sq.ft for this unit.', example: '10800' },
    { key: 'price_min', type: 'money', help: 'Price in ₹ as quoted (basic or agreement value). Full rupees, or 1.5 Cr / 85 L.', example: '17928000' },
    { key: 'price_max', type: 'money', help: 'Highest price for this row when it is a range.', example: '' },
    { key: 'all_inclusive_price_min', type: 'money', help: 'All-inclusive total from the cost sheet (basic + charges + GST, before registration).', example: '19850000' },
    { key: 'all_inclusive_price_max', type: 'money', help: 'Highest all-inclusive total for a range.', example: '' },
    { key: 'availability', type: 'enum', options: unitAvailabilitySchema.options, help: 'available (default), limited or sold-out.', example: 'available' },
    { key: 'floor_plan_image', type: 'media', width: 28, help: 'Floor plan image for this unit (URL, Drive file link or attached file name).', example: '2.5BHK-1660.jpg' },
    { key: 'notes', type: 'text', width: 28, help: 'Short note, e.g. "with study", "duplex", "corner units".', example: '' },
  ],
};

export const CHARGES: SheetSpec = {
  name: 'Charges',
  purpose:
    'Every line of the cost sheet beyond the basic price: amenities/clubhouse, corpus fund, maintenance, BESCOM/BWSSB or electricity & water, generator, gas piping, legal fee, car park, floor rise, preferential location (PLC), GST, infrastructure, registration notes. One row per charge.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'charge', type: 'text', required: true, width: 32, help: 'Name of the charge as printed.', example: 'One-time corpus fund' },
    { key: 'amount', type: 'money', help: 'Number only, in ₹ (or the % for a percent charge). Blank for "at actuals" or "as applicable".', example: '100' },
    { key: 'basis', type: 'enum', options: chargeBasisSchema.options, help: 'lumpsum (fixed ₹), per-sqft (₹ per sq.ft), percent (%), per-month (₹/month), per-sqft-month (₹ per sq.ft per month), actuals (at actuals), included (included in price).', example: 'per-sqft' },
    { key: 'payable_when', type: 'text', help: 'When it is paid.', example: 'At possession' },
    { key: 'note', type: 'text', width: 36, help: 'Conditions, e.g. "per floor from the 4th floor", "corner plots 10%", "12 months in advance".', example: '' },
  ],
};

export const PAYMENT_PLAN: SheetSpec = {
  name: 'Payment_Plan',
  purpose: 'The payment schedule, one row per stage in order, as a % of the agreement value.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'stage', type: 'text', required: true, width: 44, help: 'The milestone.', example: 'On completion of basement roof slab' },
    { key: 'percent', type: 'number', help: 'Percentage of the agreement value (number only).', example: '10' },
    { key: 'note', type: 'text', width: 30, help: 'Optional note, e.g. "within 30 days of booking".', example: '' },
  ],
};

export const NEARBY: SheetSpec = {
  name: 'Nearby',
  purpose: 'Places near the project, as stated on the location map or brochure. One row per place.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'category', type: 'enum', required: true, options: nearbyCategorySchema.options, help: `One of: ${nearbyCategorySchema.options.join(', ')}.`, example: 'it-park' },
    { key: 'place_name', type: 'text', required: true, width: 32, help: 'Name of the place.', example: 'ITPL Whitefield' },
    { key: 'distance_km', type: 'number', help: 'Distance in km (number only).', example: '14' },
    { key: 'travel_mins', type: 'int', help: 'Drive time in minutes (number only).', example: '30' },
  ],
};

export const SPECIFICATIONS: SheetSpec = {
  name: 'Specifications',
  purpose: 'Construction and finish specifications, one row per item (structure, flooring by room, kitchen, bathrooms, doors, windows, electrical, painting, lifts, security, infrastructure for plots).',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'category', type: 'text', required: true, width: 26, help: 'What it is about.', example: 'Flooring – living & dining' },
    { key: 'detail', type: 'longtext', required: true, width: 60, help: 'The specification as written.', example: 'Vitrified tiles of 800 × 800 mm' },
  ],
};

export const DOCUMENTS: SheetSpec = {
  name: 'Documents',
  purpose: 'Brochures, floor-plan books, price sheets and certificates. One row per file. Files from media_folder_link are added automatically; list here only extra ones.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'document_type', type: 'enum', required: true, options: documentKindSchema.options, help: `One of: ${documentKindSchema.options.join(', ')}.`, example: 'brochure' },
    { key: 'label', type: 'text', width: 30, help: 'Name shown on the website; written automatically if blank.', example: 'Songbird Phase 2 brochure' },
    { key: 'file', type: 'media', required: true, width: 36, help: 'File link (PDF URL or Google Drive file link) or the name of a PDF attached on upload.', example: 'https://drive.google.com/file/d/1M1sXkUpN_qvPxtfXPEpGiby1U3qNtwfz/view' },
    { key: 'access', type: 'enum', options: ['public', 'on-request'], help: 'public = visitors download directly. on-request = visitors enquire first (default for price sheets).', example: 'public' },
  ],
};

export const MORE_DETAILS: SheetSpec = {
  name: 'More_Details',
  purpose: 'Anything useful that has no column elsewhere, so nothing from the brochure is lost (structure type, lifts per tower, units per floor, water source, power backup, EV charging, pet policy, green certification…). One row per fact.',
  columns: [
    { key: 'project_key', type: 'text', required: true, width: 26, help: 'project_key from the Projects sheet.', example: 'sattva-songbird-phase-2' },
    { key: 'group', type: 'text', width: 20, help: 'Heading to group facts under (default "More details").', example: 'Building' },
    { key: 'label', type: 'text', required: true, width: 28, help: 'The fact’s name.', example: 'Lifts per tower' },
    { key: 'value', type: 'longtext', required: true, width: 40, help: 'The fact’s value.', example: '6 passenger + 2 service' },
  ],
};

export const CHILD_SHEETS = [UNITS, CHARGES, PAYMENT_PLAN, NEARBY, SPECIFICATIONS, DOCUMENTS, MORE_DETAILS] as const;
export const ALL_SHEETS = [PROJECTS, ...CHILD_SHEETS] as const;

/** Values treated as "no data" in any cell. */
export const BLANK_VALUES = new Set(['', '-', '--', '—', 'na', 'n/a', 'nil', 'none', 'not available', 'not applicable', 'tbd', 'tba', 'null', 'undefined']);
