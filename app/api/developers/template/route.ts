import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { PARTNERS_SHEET } from '@/lib/import/partners';

export const runtime = 'nodejs';

const GREEN = 'FF047857';
const DARK = 'FF065F46';

/** Empty partner template: the Add partner form's fields as columns, plus a Guide sheet. No sample rows. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EstateNav Admin';
  const sheet = workbook.addWorksheet(PARTNERS_SHEET.name, { properties: { tabColor: { argb: DARK } }, views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  sheet.columns = PARTNERS_SHEET.columns.map((c) => ({ header: c.key, key: c.key, width: c.width ?? Math.max(16, c.key.length + 4) }));
  const header = sheet.getRow(1);
  header.height = 22;
  PARTNERS_SHEET.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? DARK : GREEN } };
    cell.note = { texts: [{ text: `${c.required ? 'Required. ' : ''}${c.help}${c.example ? `\nExample: ${c.example}` : ''}` }] };
    const col = sheet.getColumn(i + 1);
    if (c.type === 'int') col.numFmt = '#,##0';
    if (c.type === 'date' || c.key === 'partner_id') col.numFmt = '@';
    if (c.type === 'longtext') col.alignment = { wrapText: true, vertical: 'top' };
  });

  const guide = workbook.addWorksheet('Guide', { properties: { tabColor: { argb: GREEN } } });
  guide.columns = [{ width: 30 }, { width: 10 }, { width: 90 }, { width: 34 }];
  guide.addRow(['EstateNav partner import']).font = { bold: true, size: 16, color: { argb: DARK } };
  [
    'Fill one row per partner on the "Partners" sheet, save as .xlsx and upload it on the Partners page (Bulk add partners). You see a preview before anything is saved.',
    'A row whose partner_id or brand name matches an existing partner updates it: filled cells overwrite, empty cells keep the current value. Other rows create new partners.',
    'Track-record figures appear on the website only with a source; numbers are digits only. Logos: a direct image link, a Google Drive file link shared with anyone with the link, or the file name of a logo attached on upload.',
    'Using an AI tool: attach this template and paste the prompt from the Partners page (Copy AI prompt).',
  ].forEach((line) => {
    const row = guide.addRow([line]);
    guide.mergeCells(`A${row.number}:D${row.number}`);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 32;
  });
  guide.addRow([]);
  const head = guide.addRow(['Column', 'Required', 'What to write', 'Example']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }));
  for (const c of PARTNERS_SHEET.columns) {
    const row = guide.addRow([c.key, c.required ? 'yes' : '', c.help, c.example ?? '']);
    row.alignment = { wrapText: true, vertical: 'top' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="estatenav-partners-template-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
