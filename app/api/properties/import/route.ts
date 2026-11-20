import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { getPropertyBySlug, listCorridors, listDevelopers, saveProperty, type PropertyDraft } from '@/lib/data/api';
import { findPartner } from '@/lib/partners';
import { triggerWebsiteRevalidation } from '@/lib/data/revalidate';
import { emptyListingDetails } from '@/lib/data/defaults';
import { lensSchema, nearbyCategorySchema, propertyTypeSchema } from '@/lib/data/schemas';
import type { ImageRef, Lens, NearbyPlace, PropertyDocument } from '@/lib/data/types';
import { cloudinaryServerReady, copyRemoteToCloudinary } from '@/lib/cloudinaryServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PLACEHOLDER_COVER = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80';
const allowedSegments = new Set(['residential', 'plot', 'commercial']);
const allowedStatuses = new Set(['draft', 'published', 'archived']);
const allowedPossession = new Set(['ready', 'under-construction', 'pre-launch']);

type Row = Record<string, string>;

const normaliseHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const value = (row: Row, key: string) => row[key]?.trim() || '';
const numberOrNull = (input: string) => {
  if (!input) return null;
  const parsed = Number(input.replace(/[₹,\s%]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const intOrNull = (input: string) => {
  const n = numberOrNull(input);
  return n == null || n <= 0 ? null : Math.round(n);
};
const bool = (input: string) => ['true', 'yes', '1', 'y'].includes(input.toLowerCase());
const list = (input: string) => input.split('|').map((item) => item.trim()).filter(Boolean);
const slugify = (input: string) => input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110);
const date = (input: string) => {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
};
const isUrl = (input: string) => /^https?:\/\/\S+$/i.test(input);
const uid = (prefix: string, i: number) => `${prefix}-${Date.now().toString(36)}-${i}`;

/** "Label: value | Label: value" → pairs. */
const pairs = (input: string) =>
  list(input)
    .map((item) => {
      const at = item.indexOf(':');
      return at > 0 ? { label: item.slice(0, at).trim(), value: item.slice(at + 1).trim() } : null;
    })
    .filter((p): p is { label: string; value: string } => Boolean(p && p.label && p.value));

/** "metro:Kadubeesanahalli Metro:2.5:8 | school:…" → nearby places. */
function nearbyFrom(input: string): NearbyPlace[] {
  return list(input)
    .map((item, i) => {
      const [category, name, km, mins] = item.split(':').map((s) => s.trim());
      const cat = nearbyCategorySchema.safeParse(category?.toLowerCase());
      if (!cat.success || !name) return null;
      return { id: uid('near', i), category: cat.data, name, distanceKm: numberOrNull(km ?? ''), travelMins: intOrNull(mins ?? '') };
    })
    .filter((n): n is NearbyPlace => Boolean(n));
}

function toRows(sheet: ExcelJS.Worksheet): Row[] {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = normaliseHeader(cell.text);
  });
  if (!headers.includes('title')) throw new Error('The first row must include a "title" column. Download the template to start.');

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
  const copyImages = String(form.get('copyImages') || '') === 'true' && cloudinaryServerReady();
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
    if (copyImages && rows.length > 40) throw new Error('Copying images into Cloudinary works for up to 40 rows at a time. Split the sheet, or untick the copy option.');

    const [developers, corridors] = await Promise.all([listDevelopers(), listCorridors()]);
    const errors: string[] = [];
    const warnings: string[] = [];
    let created = 0;
    let updated = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      try {
        const title = value(row, 'title');
        if (!title) throw new Error('title is required');
        const developerKey = scopedDeveloperId || value(row, 'developer_id') || value(row, 'developer');
        const developer = findPartner(developerKey, developers);
        if (!developer) throw new Error(`partner "${developerKey || 'missing'}" was not found — add it on the Partners page or use one of: ${developers.map((d) => d.id).join(', ')}`);
        const corridorKey = value(row, 'corridor_id') || value(row, 'corridor') || value(row, 'area');
        const corridor = corridors.find((item) => item.id === corridorKey || item.name.toLowerCase() === corridorKey.toLowerCase());
        if (!corridor) throw new Error(`area "${corridorKey || 'missing'}" was not found — add it under Regions & areas first`);

        const slug = slugify(value(row, 'slug') || title);
        if (!slug) throw new Error('title must contain letters or numbers for the web address');
        const priceMin = numberOrNull(value(row, 'price_min'));
        if (!priceMin || priceMin <= 0) throw new Error('price_min must be a positive number (use an indicative figure with price_on_request = yes)');
        let statusValue = value(row, 'status').toLowerCase() || 'draft';
        const segment = value(row, 'segment').toLowerCase() || 'residential';
        const propertyType = propertyTypeSchema.safeParse(value(row, 'property_type').toLowerCase() || 'apartment');
        const possessionStatus = value(row, 'possession_status').toLowerCase() || 'under-construction';
        if (!allowedStatuses.has(statusValue)) throw new Error('status must be draft, published or archived');
        if (!allowedSegments.has(segment)) throw new Error('segment must be residential, plot or commercial');
        if (!propertyType.success) throw new Error(`property_type must be one of: ${propertyTypeSchema.options.join(', ')}`);
        if (!allowedPossession.has(possessionStatus)) throw new Error('possession_status must be ready, under-construction or pre-launch');

        const existing = await getPropertyBySlug(slug);
        const id = existing?.id || `p-${slug}`;
        const details = existing ?? { ...emptyListingDetails() };
        const alt = value(row, 'cover_alt') || `${title}, ${corridor.name}, Bengaluru`;

        // Images: copy into Cloudinary when asked, otherwise keep the links as given.
        const toImage = async (url: string, order: number): Promise<ImageRef> => {
          if (copyImages && !url.includes('res.cloudinary.com')) {
            const up = await copyRemoteToCloudinary(url, `properties/${id}/gallery`);
            return { id: up.publicId, storagePath: up.publicId, url: up.url, alt: order === 0 ? alt : `${title} photo ${order + 1}`, width: up.width, height: up.height, blurDataURL: '', order };
          }
          return { id: `${id}-image-${order}`, storagePath: '', url, alt: order === 0 ? alt : `${title} photo ${order + 1}`, width: 1600, height: 1060, blurDataURL: '', order };
        };
        const imageUrls = [value(row, 'cover_image_url'), ...list(value(row, 'gallery_image_urls'))].filter(isUrl);
        const uniqueUrls = Array.from(new Set(imageUrls)).slice(0, 25);
        const gallery = uniqueUrls.length ? await Promise.all(uniqueUrls.map((url, i) => toImage(url, i))) : existing?.media.gallery || [];
        const cover = gallery[0] ?? existing?.media.cover ?? { id: 'placeholder', storagePath: '', url: PLACEHOLDER_COVER, alt: 'Photo coming soon', width: 1600, height: 1060, blurDataURL: '', order: 0 };
        if (statusValue === 'published' && gallery.length === 0) {
          statusValue = 'draft';
          warnings.push(`Row ${rowNumber} (${title}): saved as draft because it has no photos.`);
        }

        const parsedBhk = list(value(row, 'bhk_options')).map(Number).filter((item) => Number.isFinite(item) && item > 0);
        const bhkOptions = parsedBhk.length ? parsedBhk : existing?.bhkOptions || [];
        const sizeMin = numberOrNull(value(row, 'size_min')) ?? existing?.sizeMin ?? null;
        const sizeMax = numberOrNull(value(row, 'size_max')) ?? existing?.sizeMax ?? null;
        const priceMax = numberOrNull(value(row, 'price_max')) ?? existing?.priceMax ?? null;
        const configurations = parsedBhk.length
          ? bhkOptions.map((bhk, configIndex) => ({
              id: `${id}-config-${configIndex + 1}`,
              label: `${bhk} BHK`,
              bhk,
              carpetSqftMin: sizeMin,
              carpetSqftMax: sizeMax,
              superSqftMin: null,
              superSqftMax: null,
              priceMin: null,
              priceMax: null,
              floorPlanImageId: null,
              availability: 'available' as const,
            }))
          : existing?.configurations || [];
        const latitude = numberOrNull(value(row, 'latitude'));
        const longitude = numberOrNull(value(row, 'longitude'));

        const docs: PropertyDocument[] = [];
        const docColumns: [string, PropertyDocument['kind'], string][] = [
          ['brochure_url', 'brochure', 'Brochure'],
          ['floor_plans_pdf_url', 'floor-plans', 'Floor plans'],
          ['master_plan_pdf_url', 'master-plan', 'Master plan'],
        ];
        for (const [column, kind, label] of docColumns) {
          const url = value(row, column);
          if (!isUrl(url)) continue;
          if (copyImages) {
            try {
              const up = await copyRemoteToCloudinary(url, `properties/${id}/documents`, /\.(jpe?g|png|webp)($|\?)/i.test(url) ? 'image' : 'raw');
              docs.push({ id: uid('doc', docs.length), kind, label: `${title} ${label.toLowerCase()}`, url: up.url, storagePath: up.publicId, format: /\.(jpe?g|png|webp)($|\?)/i.test(url) ? 'image' : 'pdf', sizeBytes: up.bytes, access: 'public' });
              continue;
            } catch (error) {
              warnings.push(`Row ${rowNumber} (${title}): ${label} kept as a link — ${error instanceof Error ? error.message : 'copy failed'}.`);
            }
          }
          docs.push({ id: uid('doc', docs.length), kind, label: `${title} ${label.toLowerCase()}`, url, storagePath: '', format: 'link', sizeBytes: null, access: 'public' });
        }

        const lenses = list(value(row, 'lenses'))
          .map((l) => lensSchema.safeParse(l.toLowerCase()))
          .filter((r) => r.success)
          .map((r) => (r as { data: Lens }).data);
        const specs = pairs(value(row, 'specifications')).map((p, i) => ({ id: uid('spec', i), category: p.label, detail: p.value }));
        const extras = pairs(value(row, 'extra_details')).map((p, i) => ({ id: uid('x', i), group: 'More details', label: p.label, value: p.value }));
        const nearby = nearbyFrom(value(row, 'nearby'));
        const facts = {
          landAcres: numberOrNull(value(row, 'land_acres')) ?? details.facts.landAcres,
          totalUnits: intOrNull(value(row, 'total_units')) ?? details.facts.totalUnits,
          towers: intOrNull(value(row, 'towers')) ?? details.facts.towers,
          floors: value(row, 'floors') || details.facts.floors,
          openSpacePct: numberOrNull(value(row, 'open_space_pct')) ?? details.facts.openSpacePct,
          clubhouseSqft: intOrNull(value(row, 'clubhouse_sqft')) ?? details.facts.clubhouseSqft,
          launchDate: date(value(row, 'launch_date')) ?? details.facts.launchDate,
        };

        const draft: PropertyDraft = {
          id,
          slug,
          status: statusValue as PropertyDraft['status'],
          featured: bool(value(row, 'featured')),
          featuredRank: numberOrNull(value(row, 'featured_rank')) || 99,
          segment: segment as PropertyDraft['segment'],
          transaction: value(row, 'transaction').toLowerCase() === 'rent' ? 'rent' : 'sale',
          isNewLaunch: bool(value(row, 'is_new_launch')),
          propertyType: propertyType.data,
          title,
          tagline: value(row, 'tagline') || existing?.tagline || '',
          description: value(row, 'description') || existing?.description || '',
          highlights: list(value(row, 'highlights')).length ? list(value(row, 'highlights')) : existing?.highlights || [],
          developerId: developer.id,
          developerName: developer.name,
          corridorId: corridor.id,
          corridorName: corridor.name,
          locality: value(row, 'locality') || existing?.locality || corridor.name,
          address: value(row, 'address') || existing?.address || '',
          geo: latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : existing?.geo || null,
          geohash: existing?.geohash || null,
          configurations,
          bhkOptions,
          priceMin,
          priceMax,
          sizeMin,
          sizeMax,
          pricePerSqft: numberOrNull(value(row, 'price_per_sqft')) ?? existing?.pricePerSqft ?? null,
          rentPerMonth: numberOrNull(value(row, 'rent_per_month')) ?? existing?.rentPerMonth ?? null,
          priceOnRequest: value(row, 'price_on_request') ? bool(value(row, 'price_on_request')) : details.priceOnRequest,
          priceNote: value(row, 'price_note') || details.priceNote,
          possession: {
            status: possessionStatus as 'ready' | 'under-construction' | 'pre-launch',
            date: date(value(row, 'possession_date')),
            label: value(row, 'possession_label') || (possessionStatus === 'ready' ? 'Ready to move' : possessionStatus.replace('-', ' ')),
            reraDate: date(value(row, 'rera_completion_date')) ?? existing?.possession.reraDate ?? null,
          },
          rera: {
            number: value(row, 'rera_number') || existing?.rera.number || null,
            verifyUrl: value(row, 'rera_verify_url') || existing?.rera.verifyUrl || 'https://rera.karnataka.gov.in/',
            registered: value(row, 'rera_registered') ? bool(value(row, 'rera_registered')) : existing?.rera.registered || false,
          },
          approvals: { ...(existing?.approvals || { khata: null, planAuthority: null, titleCheck: null, notes: '' }), notes: value(row, 'approval_notes') || existing?.approvals.notes || '' },
          bankApprovals: list(value(row, 'bank_approvals')).length ? list(value(row, 'bank_approvals')) : existing?.bankApprovals || [],
          amenities: list(value(row, 'amenities')).length ? list(value(row, 'amenities')) : existing?.amenities || [],
          lenses: lenses.length ? lenses : existing?.lenses || [],
          media: {
            cover,
            gallery,
            floorPlans: existing?.media.floorPlans || [],
            brochure: existing?.media.brochure || null,
            masterPlan: existing?.media.masterPlan ?? null,
            videoUrl: isUrl(value(row, 'video_url')) ? value(row, 'video_url') : existing?.media.videoUrl ?? null,
            virtualTourUrl: isUrl(value(row, 'virtual_tour_url')) ? value(row, 'virtual_tour_url') : existing?.media.virtualTourUrl ?? null,
          },
          facts,
          specifications: specs.length ? specs : details.specifications,
          nearby: nearby.length ? nearby : details.nearby,
          documents: docs.length ? [...details.documents.filter((d) => !docs.some((n) => n.kind === d.kind)), ...docs] : details.documents,
          extraDetails: extras.length ? extras : details.extraDetails,
          offer: details.offer,
          hidden: existing?.hidden ?? false,
          metrics: existing?.metrics || null,
          commute: existing?.commute || [],
          seo: {
            title: value(row, 'seo_title') || existing?.seo.title || `${title} | ${corridor.name}, Bengaluru`,
            description: value(row, 'seo_description') || existing?.seo.description || value(row, 'tagline') || title,
            ogImageId: existing?.seo.ogImageId || null,
          },
        };
        await saveProperty(draft, session.email);
        if (existing) updated += 1;
        else created += 1;
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'could not be imported'}`);
      }
    }

    await triggerWebsiteRevalidation('properties', '/');
    return NextResponse.json({ created, updated, failed: errors.length, errors: [...errors, ...warnings].slice(0, 40) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'The workbook could not be imported.' }, { status: 400 });
  }
}
