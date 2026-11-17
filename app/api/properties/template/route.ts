import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Property listings');
  sheet.addRow(['title', 'slug', 'developer_id', 'corridor_id', 'locality', 'segment', 'property_type', 'transaction', 'price_min', 'price_max', 'size_min', 'size_max', 'bhk_options', 'status', 'is_new_launch', 'cover_image_url', 'cover_alt', 'gallery_image_urls', 'highlights', 'amenities', 'rera_number', 'rera_verify_url', 'rera_registered', 'possession_status', 'possession_date', 'possession_label', 'address', 'latitude', 'longitude', 'featured', 'featured_rank', 'seo_title', 'seo_description']);
  sheet.addRow(['Example Residences', 'example-residences', 'partner-id', 'corridor-id', 'Locality / landmark', 'residential', 'apartment', 'sale', 12500000, 14500000, 1100, 1300, '2|3', 'draft', 'no', 'https://images.example.com/cover.jpg', 'Example Residences exterior', 'https://images.example.com/1.jpg|https://images.example.com/2.jpg', 'Near metro|Clubhouse', 'Pool|Gym|Security', 'RERA-NUMBER', 'https://rera.example.com/verify', 'yes', 'under-construction', '2028-12-01', 'Dec 2028', 'Full address', 17.385, 78.4867, 'no', 99, 'Example Residences in Locality', 'Short listing description']);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column) => { column.width = 20; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="estatenav-property-import-template.xlsx"' } });
}
