import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { listCorridors, listDevelopers } from '@/lib/data/api';
import { nearbyCategorySchema, propertyTypeSchema } from '@/lib/data/schemas';
import { partnerOptions } from '@/lib/partners';

export const runtime = 'nodejs';

const COLUMNS: [string, string, string | number][] = [
  ['title', 'Required. Project name.', 'Example Residences'],
  ['slug', 'Optional web address; made from the title if blank. Rows with the same slug update the existing listing.', 'example-residences'],
  ['developer_id', 'Required unless you import for one partner. Partner ID or name from the "Partners & areas" sheet (only listed partners are accepted).', 'sobha'],
  ['corridor_id', 'Required. Area ID or exact name from the "Partners & areas" sheet.', 'sarjapur-road'],
  ['locality', 'Locality or landmark shown on cards.', 'Off Sarjapur Road, Dommasandra'],
  ['segment', 'residential, plot or commercial.', 'residential'],
  ['property_type', `One of: ${propertyTypeSchema.options.join(', ')}.`, 'apartment'],
  ['transaction', 'sale or rent.', 'sale'],
  ['price_min', 'Required. Starting price in ₹ (used for filters even when the price is on request).', 12500000],
  ['price_max', 'Highest price in ₹.', 21500000],
  ['price_on_request', 'yes to hide prices on the website.', 'no'],
  ['price_note', 'Printed beside the price.', '+ GST, registration & other charges'],
  ['price_per_sqft', '₹ per sq.ft.', 11200],
  ['size_min', 'Smallest unit size in sq.ft.', 1150],
  ['size_max', 'Largest unit size in sq.ft.', 1950],
  ['bhk_options', 'BHKs separated by |. Creates one unit type per BHK.', '2|3|4'],
  ['status', 'draft (recommended), published or archived. Published rows need at least one image.', 'draft'],
  ['is_new_launch', 'yes or no.', 'yes'],
  ['tagline', 'One line under the name.', '2, 3 & 4 BHK homes near Wipro Sarjapur campus'],
  ['description', 'Full description. Use blank lines inside the cell for paragraphs.', 'Example Residences is …'],
  ['highlights', 'Separate with |.', '80% open space|Clubhouse of 40,000 sq.ft'],
  ['amenities', 'Separate with |.', 'Swimming Pool|Gymnasium|Clubhouse|Children Play Area'],
  ['lenses', 'Buyer types, separated by |: first-home, upgrading, nri, senior, investor.', 'first-home|nri'],
  ['land_acres', 'Land area in acres.', 13.4],
  ['total_units', 'Number of units.', 1140],
  ['towers', 'Number of towers or blocks.', 9],
  ['floors', 'As written, e.g. 2B + G + 32.', '2B + G + 32'],
  ['open_space_pct', 'Open space in %.', 80],
  ['clubhouse_sqft', 'Clubhouse size in sq.ft.', 40000],
  ['launch_date', 'YYYY-MM-DD.', '2026-08-01'],
  ['possession_status', 'ready, under-construction or pre-launch.', 'under-construction'],
  ['possession_date', 'Developer target date, YYYY-MM-DD.', '2030-12-01'],
  ['possession_label', 'Label shown, e.g. Dec 2030.', 'Dec 2030'],
  ['rera_completion_date', 'Completion date on the K-RERA certificate, YYYY-MM-DD.', '2031-06-30'],
  ['rera_number', 'K-RERA project registration number.', 'PRM/KA/RERA/1251/…'],
  ['rera_verify_url', 'Link to verify.', 'https://rera.karnataka.gov.in/'],
  ['rera_registered', 'yes once you have checked the number on the portal.', 'no'],
  ['approval_notes', 'Free text.', 'BDA-approved plan'],
  ['bank_approvals', 'Separate with |.', 'SBI|HDFC Bank|ICICI Bank'],
  ['nearby', `category:name:km:minutes, separated by |. Categories: ${nearbyCategorySchema.options.join(', ')}.`, 'metro:Carmelaram (upcoming):3.5:12|it-park:Wipro Sarjapur campus:2:7|school:Greenwood High:1.5:5'],
  ['specifications', 'Category: detail, separated by |.', 'Structure: RCC framed|Flooring – living & dining: Vitrified tiles'],
  ['extra_details', 'Label: value, separated by |.', 'Maintenance charges: ₹4.5/sq.ft/month|Car parking: 1 covered'],
  ['cover_image_url', 'First photo (cover). Copied into Cloudinary if you tick the option on upload.', 'https://images.example.com/cover.jpg'],
  ['cover_alt', 'Describes the cover photo.', 'Example Residences, tower elevation'],
  ['gallery_image_urls', 'More photo links, separated by |.', 'https://images.example.com/1.jpg|https://images.example.com/2.jpg'],
  ['brochure_url', 'Brochure PDF link.', 'https://www.example.com/brochure.pdf'],
  ['floor_plans_pdf_url', 'Floor-plan PDF link.', ''],
  ['master_plan_pdf_url', 'Master-plan PDF link.', ''],
  ['video_url', 'Walkthrough video link.', ''],
  ['virtual_tour_url', 'Virtual tour link.', ''],
  ['address', 'Full site address.', 'Sy. No. 42, Dommasandra Village, Sarjapur Road, Bengaluru 562125'],
  ['latitude', 'Decimal latitude.', 12.8996],
  ['longitude', 'Decimal longitude.', 77.7414],
  ['featured', 'yes to feature on the home page.', 'no'],
  ['featured_rank', '1 = first.', 99],
  ['seo_title', 'Optional; written automatically if blank.', ''],
  ['seo_description', 'Optional.', ''],
];

export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  const [developers, corridors] = await Promise.all([listDevelopers(), listCorridors()]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Property listings');
  sheet.addRow(COLUMNS.map(([key]) => key));
  sheet.addRow(COLUMNS.map(([, , example]) => example));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const guide = workbook.addWorksheet('Column guide');
  guide.addRow(['Column', 'What to enter']);
  COLUMNS.forEach(([key, help]) => guide.addRow([key, help]));
  guide.getRow(1).font = { bold: true };
  guide.getColumn(1).width = 24;
  guide.getColumn(2).width = 110;
  guide.addRow([]);
  guide.addRow(['Note', 'Row 2 of the listings sheet is an example: replace or delete it before importing.']);

  const ids = workbook.addWorksheet('Partners & areas');
  ids.addRow(['Partner ID', 'Partner name', '', 'Area ID', 'Area name', 'Region']);
  ids.getRow(1).font = { bold: true };
  const partners = partnerOptions(developers);
  const rows = Math.max(partners.length, corridors.length);
  for (let i = 0; i < rows; i += 1) {
    const d = partners[i];
    const c = corridors[i];
    ids.addRow([d?.id ?? '', d?.name ?? '', '', c?.id ?? '', c?.name ?? '', c?.zone ?? '']);
  }
  ids.columns.forEach((column) => {
    column.width = 26;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="estatenav-property-import-template.xlsx"',
    },
  });
}
