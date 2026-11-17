import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { getPropertyBySlug, listCorridors, listDevelopers, saveProperty, type PropertyDraft } from '@/lib/data/api';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';

export const runtime = 'nodejs';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80';
const allowedSegments = new Set(['residential', 'plot', 'commercial']);
const allowedTypes = new Set(['apartment', 'villa', 'row-house', 'plot', 'office', 'retail']);
const allowedStatuses = new Set(['draft', 'published', 'archived']);
const allowedPossession = new Set(['ready', 'under-construction', 'pre-launch']);

type Row = Record<string, string>;

const normaliseHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const value = (row: Row, key: string) => row[key]?.trim() || '';
const numberOrNull = (input: string) => {
  if (!input) return null;
  const parsed = Number(input.replace(/[₹,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const bool = (input: string) => ['true', 'yes', '1', 'y'].includes(input.toLowerCase());
const list = (input: string) => input.split('|').map((item) => item.trim()).filter(Boolean);
const slugify = (input: string) => input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110);
const date = (input: string) => {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
};

function toRows(sheet: ExcelJS.Worksheet): Row[] {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = normaliseHeader(cell.text);
  });

  if (!headers.includes('title')) throw new Error('The first row must include a required "title" column. Download the template to start.');

  const rows: Row[] = [];
  sheet.eachRow((worksheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    const row: Row = {};
    headers.forEach((header, column) => {
      if (header) row[header] = String(worksheetRow.getCell(column).text ?? '').trim();
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  });
  return rows;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const scopedDeveloperId = String(form.get('developerId') || '').trim();
  if (!(file instanceof File)) return NextResponse.json({ message: 'Choose an .xlsx file to import.' }, { status: 400 });
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) return NextResponse.json({ message: 'Only .xlsx Excel files are supported.' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: 'The workbook must be smaller than 10 MB.' }, { status: 400 });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('The workbook does not contain a worksheet.');
    const rows = toRows(sheet);
    if (!rows.length) throw new Error('No listing rows were found below the header row.');
    if (rows.length > 1000) throw new Error('Import at most 1,000 listings at a time.');

    const [developers, corridors] = await Promise.all([listDevelopers(), listCorridors()]);
    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      try {
        const title = value(row, 'title');
        if (!title) throw new Error('title is required');
        const developerKey = scopedDeveloperId || value(row, 'developer_id') || value(row, 'developer');
        const developer = developers.find((item) => item.id === developerKey || item.name.toLowerCase() === developerKey.toLowerCase());
        if (!developer) throw new Error(`partner/developer "${developerKey || 'missing'}" was not found`);
        const corridorKey = value(row, 'corridor_id') || value(row, 'corridor') || value(row, 'region');
        const corridor = corridors.find((item) => item.id === corridorKey || item.name.toLowerCase() === corridorKey.toLowerCase());
        if (!corridor) throw new Error(`region/corridor "${corridorKey || 'missing'}" was not found`);

        const slug = slugify(value(row, 'slug') || title);
        if (!slug) throw new Error('title must contain letters or numbers for the URL slug');
        const priceMin = numberOrNull(value(row, 'price_min'));
        if (!priceMin || priceMin <= 0) throw new Error('price_min must be a positive number');
        const statusValue = value(row, 'status').toLowerCase() || 'draft';
        const segment = value(row, 'segment').toLowerCase() || 'residential';
        const propertyType = value(row, 'property_type').toLowerCase() || 'apartment';
        const possessionStatus = value(row, 'possession_status').toLowerCase() || 'under-construction';
        if (!allowedStatuses.has(statusValue)) throw new Error('status must be draft, published, or archived');
        if (!allowedSegments.has(segment)) throw new Error('segment must be residential, plot, or commercial');
        if (!allowedTypes.has(propertyType)) throw new Error('property_type is not recognised');
        if (!allowedPossession.has(possessionStatus)) throw new Error('possession_status is not recognised');

        const existing = await getPropertyBySlug(slug);
        const id = existing?.id || `p-${slug}`;
        const coverUrl = value(row, 'cover_image_url') || existing?.media.cover.url || FALLBACK_COVER;
        const galleryUrls = list(value(row, 'gallery_image_urls'));
        const makeImage = (url: string, order: number) => ({
          id: `${id}-image-${order}`,
          storagePath: '', url, alt: value(row, 'cover_alt') || `${title} property image`, width: 1600, height: 1060, blurDataURL: '', order,
        });
        const parsedBhk = list(value(row, 'bhk_options')).map(Number).filter((item) => Number.isFinite(item) && item > 0);
        const bhkOptions = parsedBhk.length ? parsedBhk : existing?.bhkOptions || [];
        const sizeMin = numberOrNull(value(row, 'size_min')) ?? existing?.sizeMin ?? null;
        const sizeMax = numberOrNull(value(row, 'size_max')) ?? existing?.sizeMax ?? null;
        const priceMax = numberOrNull(value(row, 'price_max')) ?? existing?.priceMax ?? null;
        const configurations = parsedBhk.length ? bhkOptions.map((bhk, configIndex) => ({
          id: `${id}-config-${configIndex + 1}`, label: `${bhk} BHK`, bhk, carpetSqftMin: sizeMin, carpetSqftMax: sizeMax, superSqftMin: null, superSqftMax: null, priceMin, priceMax, floorPlanImageId: null,
        })) : existing?.configurations || [];
        const latitude = numberOrNull(value(row, 'latitude'));
        const longitude = numberOrNull(value(row, 'longitude'));
        const draft: PropertyDraft = {
          id, slug, status: statusValue as PropertyDraft['status'], featured: bool(value(row, 'featured')), featuredRank: numberOrNull(value(row, 'featured_rank')) || 99,
          segment: segment as PropertyDraft['segment'], transaction: value(row, 'transaction').toLowerCase() === 'rent' ? 'rent' : 'sale', isNewLaunch: bool(value(row, 'is_new_launch')), propertyType: propertyType as PropertyDraft['propertyType'],
          title, tagline: value(row, 'tagline') || existing?.tagline || '', description: value(row, 'description') || existing?.description || '', highlights: list(value(row, 'highlights')).length ? list(value(row, 'highlights')) : existing?.highlights || [],
          developerId: developer.id, developerName: developer.name, corridorId: corridor.id, corridorName: corridor.name, locality: value(row, 'locality') || existing?.locality || corridor.name, address: value(row, 'address') || existing?.address || '', geo: latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : existing?.geo || null, geohash: existing?.geohash || null,
          configurations, bhkOptions, priceMin, priceMax, sizeMin, sizeMax, pricePerSqft: numberOrNull(value(row, 'price_per_sqft')), rentPerMonth: numberOrNull(value(row, 'rent_per_month')),
          possession: { status: possessionStatus as 'ready' | 'under-construction' | 'pre-launch', date: date(value(row, 'possession_date')), label: value(row, 'possession_label') || possessionStatus.replace('-', ' ') },
          rera: { number: value(row, 'rera_number') || existing?.rera.number || null, verifyUrl: value(row, 'rera_verify_url') || existing?.rera.verifyUrl || null, registered: value(row, 'rera_registered') ? bool(value(row, 'rera_registered')) : existing?.rera.registered || false },
          approvals: { ...(existing?.approvals || { khata: null, planAuthority: null, titleCheck: null, notes: '' }), notes: value(row, 'approval_notes') || existing?.approvals.notes || '' }, bankApprovals: list(value(row, 'bank_approvals')).length ? list(value(row, 'bank_approvals')) : existing?.bankApprovals || [],
          amenities: list(value(row, 'amenities')).length ? list(value(row, 'amenities')) : existing?.amenities || [], lenses: existing?.lenses || [], media: { cover: makeImage(coverUrl, 0), gallery: galleryUrls.length ? galleryUrls.map((url, imageIndex) => makeImage(url, imageIndex + 1)) : existing?.media.gallery || [], floorPlans: existing?.media.floorPlans || [], brochure: existing?.media.brochure || null },
          metrics: existing?.metrics || null, commute: existing?.commute || [], seo: { title: value(row, 'seo_title') || existing?.seo.title || title, description: value(row, 'seo_description') || existing?.seo.description || value(row, 'tagline') || title, ogImageId: existing?.seo.ogImageId || null },
        };
        await saveProperty(draft, session.email);
        if (existing) updated += 1; else created += 1;
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'could not be imported'}`);
      }
    }

    await triggerWebsiteRevalidation('properties', '/');
    return NextResponse.json({ created, updated, failed: errors.length, errors: errors.slice(0, 30) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'The workbook could not be imported.' }, { status: 400 });
  }
}
