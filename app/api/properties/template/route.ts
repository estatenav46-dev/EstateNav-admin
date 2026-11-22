import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { listCorridors, listDevelopers } from '@/lib/data/api';
import { partnerOptions } from '@/lib/partners';
import { ALL_SHEETS, type Column } from '@/lib/import/spec';

export const runtime = 'nodejs';

const GREEN = 'FF047857';
const DARK = 'FF065F46';
const GREY = 'FF6B7280';
const DATA_ROWS = 500;

const colLetter = (n: number) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

const FORMAT_HINT: Record<Column['type'], string> = {
  text: 'Text',
  longtext: 'Text (several lines allowed)',
  number: 'Number',
  int: 'Whole number',
  money: '₹ full rupees, digits only (e.g. 17928000)',
  area: 'sq.ft, digits only',
  date: 'YYYY-MM or YYYY-MM-DD',
  bool: 'yes / no',
  enum: 'Pick from the list',
  list: 'Items separated by |',
  url: 'Web link (https://…)',
  media: 'Link or attached file name',
  medialist: 'Links or file names separated by |',
};

/**
 * The bulk-import workbook: empty data sheets with headers, notes and dropdowns, a Guide sheet
 * that documents every column, and a Lists sheet with the current partners, areas and allowed values.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  const [developers, corridors] = await Promise.all([listDevelopers(), listCorridors()]);
  const partners = partnerOptions(developers).filter((p) => !p.hidden);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EstateNav Admin';
  workbook.created = new Date();

  // ---- Guide ----
  const guide = workbook.addWorksheet('Guide', { properties: { tabColor: { argb: GREEN } } });
  guide.columns = [{ width: 18 }, { width: 26 }, { width: 10 }, { width: 34 }, { width: 90 }, { width: 36 }];
  const title = guide.addRow(['EstateNav property import']);
  title.font = { bold: true, size: 16, color: { argb: DARK } };
  const intro = [
    'How it works: fill the data sheets (Projects, Units, Charges, Payment_Plan, Nearby, Specifications, Documents, More_Details), save as .xlsx, then upload it under Properties → Bulk upload. You see a preview before anything is saved.',
    'Projects has one row per project (or per phase when phases have their own K-RERA number). Every other sheet links back with project_key and has one row per item: one row per unit size, per charge, per payment stage, per nearby place, per specification.',
    'Units: give every BHK and every size its own row (Studio, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5 BHK, row houses, villas, plot sizes). Two 3 BHK sizes = two 3 BHK rows.',
    'Money: full rupees as digits (17928000). Areas: sq.ft as digits. Dates: YYYY-MM. Lists: separate with |. Leave a cell empty when the source does not say; never guess.',
    'Photos: put a public Google Drive folder (Anyone with the link), a ZIP link or the developer’s project page in media_folder_link, and photos, floor plans, the master plan and brochures are fetched automatically. You can also attach image files when uploading and write their file names in cover_image, gallery_images, master_plan_image and floor_plan_image.',
    'Only Bengaluru projects are imported; rows for other cities are skipped. Re-uploading a project_key updates that listing: filled cells overwrite, empty cells keep the current value, and a child sheet with rows for the project replaces that list.',
    'Using an AI tool: attach this template and the developer’s files, and paste the prompt from the admin (Bulk upload → Copy AI prompt).',
  ];
  intro.forEach((line) => {
    const row = guide.addRow([line]);
    guide.mergeCells(`A${row.number}:F${row.number}`);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 34;
  });
  guide.addRow([]);
  const head = guide.addRow(['Sheet', 'Column', 'Required', 'Format / allowed values', 'What to write', 'Example']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }));
  for (const sheet of ALL_SHEETS) {
    const sheetRow = guide.addRow([sheet.name, '', '', '', sheet.purpose, '']);
    sheetRow.font = { bold: true };
    sheetRow.alignment = { wrapText: true, vertical: 'top' };
    sheetRow.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }));
    for (const c of sheet.columns) {
      const row = guide.addRow([sheet.name, c.key, c.required ? 'yes' : '', c.options ? c.options.join(', ') : FORMAT_HINT[c.type], c.help, c.example ?? '']);
      row.alignment = { wrapText: true, vertical: 'top' };
      if (c.required) row.getCell(2).font = { bold: true };
    }
  }
  guide.views = [{ state: 'frozen', ySplit: 0 }];

  // ---- Lists (dropdown sources) ----
  const lists = workbook.addWorksheet('Lists', { properties: { tabColor: { argb: GREY } } });
  const listColumns: { title: string; values: string[] }[] = [
    { title: 'partner', values: partners.map((p) => p.name) },
    { title: 'partner_id', values: partners.map((p) => p.id) },
    { title: 'area', values: corridors.map((c) => c.name) },
    { title: 'area_id', values: corridors.map((c) => c.id) },
    { title: 'area_region', values: corridors.map((c) => c.zone ?? '') },
  ];
  const enumRange = new Map<string, string>();
  for (const sheet of ALL_SHEETS) {
    for (const c of sheet.columns) {
      if (!c.options || listColumns.some((l) => l.title === c.key)) continue;
      listColumns.push({ title: c.key, values: [...c.options] });
    }
  }
  listColumns.forEach((col, i) => {
    const letter = colLetter(i + 1);
    lists.getCell(`${letter}1`).value = col.title;
    col.values.forEach((v, r) => (lists.getCell(`${letter}${r + 2}`).value = v));
    lists.getColumn(i + 1).width = Math.max(14, Math.min(34, col.title.length + 4, ...col.values.map((v) => v.length + 2)));
    if (col.values.length) enumRange.set(col.title, `Lists!$${letter}$2:$${letter}$${col.values.length + 1}`);
  });
  lists.getRow(1).font = { bold: true };
  lists.views = [{ state: 'frozen', ySplit: 1 }];

  // ---- Data sheets (empty: headers only) ----
  for (const spec of ALL_SHEETS) {
    const sheet = workbook.addWorksheet(spec.name, { properties: { tabColor: { argb: spec.name === 'Projects' ? DARK : GREEN } }, views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
    sheet.columns = spec.columns.map((c) => ({ header: c.key, key: c.key, width: c.width ?? Math.max(14, c.key.length + 4) }));
    const header = sheet.getRow(1);
    header.height = 22;
    spec.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? DARK : GREEN } };
      cell.alignment = { vertical: 'middle' };
      cell.note = { texts: [{ text: `${c.required ? 'Required. ' : ''}${c.help}${c.options ? `\nAllowed: ${c.options.join(', ')}` : ''}${c.example ? `\nExample: ${c.example}` : ''}` }] };

      const letter = colLetter(i + 1);
      const range = `${letter}2:${letter}${DATA_ROWS + 1}`;
      const source = c.key === 'partner' ? enumRange.get('partner') : c.key === 'area' ? enumRange.get('area') : c.options ? enumRange.get(c.key) : undefined;
      if (source) {
        // Partner and area suggest the list but still accept a typed value (new areas, IDs).
        const strict = c.key !== 'partner' && c.key !== 'area';
        (sheet as unknown as { dataValidations: { add: (r: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(range, {
          type: 'list',
          allowBlank: true,
          formulae: [source],
          showErrorMessage: strict,
          errorStyle: 'warning',
          errorTitle: 'Not in the list',
          error: `Use one of the allowed values for ${c.key} (see the Lists sheet).`,
        });
      }
      if (c.type === 'money' || c.type === 'area' || c.type === 'int') sheet.getColumn(i + 1).numFmt = '#,##0';
      if (c.type === 'longtext' || c.type === 'list' || c.type === 'medialist') sheet.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' };
      if (c.type === 'date' || c.key === 'pincode' || c.key === 'rera_number' || c.key === 'floors' || c.key === 'project_key') sheet.getColumn(i + 1).numFmt = '@';
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };
  }

  // Data sheets first so the file opens on Projects; Guide and Lists follow.
  const order = ['Projects', 'Units', 'Charges', 'Payment_Plan', 'Nearby', 'Specifications', 'Documents', 'More_Details', 'Guide', 'Lists'];
  workbook.worksheets.forEach((ws) => {
    (ws as unknown as { orderNo: number }).orderNo = order.indexOf(ws.name);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="estatenav-property-import-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
