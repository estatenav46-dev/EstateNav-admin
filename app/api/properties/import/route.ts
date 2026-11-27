import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listCorridors, listDevelopers, listProperties } from '@/lib/data/api';
import { parseWorkbook, type ParsedProject } from '@/lib/import/parse';
import { lookupProject } from '@/lib/import/lookup';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface PreviewProject extends ParsedProject {
  partnerId: string | null;
  partnerName: string | null;
  partnerIsNew: boolean;
  areaId: string | null;
  areaName: string | null;
  areaIsNew: boolean;
  existingId: string | null;
  existingPhotos: number;
}

/** Step 1 of the import: reads the workbook and reports what will happen. Nothing is saved. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const scopedDeveloperId = String(form.get('developerId') || '').trim();
  if (!(file instanceof File)) return NextResponse.json({ message: 'Choose an .xlsx file to import.' }, { status: 400 });
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) return NextResponse.json({ message: 'Only .xlsx Excel files are supported. In Google Sheets use File → Download → Microsoft Excel.' }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ message: 'The workbook must be smaller than 4 MB. Keep photos out of the sheet: use links or attach them.' }, { status: 400 });

  try {
    const { projects, notes } = await parseWorkbook(await file.arrayBuffer());
    const [developers, corridors, properties] = await Promise.all([listDevelopers(), listCorridors(), listProperties({ status: 'all' })]);
    const bySlug = new Map(properties.map((p) => [p.slug, p]));
    const newAreas = new Map<string, string>();

    const preview: PreviewProject[] = projects.map((project) => {
      const found = lookupProject(project, developers, corridors, scopedDeveloperId || undefined);
      const existing = bySlug.get(project.key) ?? null;
      // Two rows creating the same new area must agree on it.
      if (found.newCorridor) {
        const prior = newAreas.get(found.newCorridor.id);
        if (prior && prior !== found.newCorridor.zone) found.errors.push(`New area "${found.newCorridor.name}" is given two different regions in this workbook.`);
        newAreas.set(found.newCorridor.id, found.newCorridor.zone ?? '');
      }
      return {
        ...project,
        errors: [...project.errors, ...found.errors],
        partnerId: found.developer?.id ?? null,
        partnerName: found.developer?.name ?? null,
        partnerIsNew: Boolean(found.newDeveloper),
        areaId: found.corridor?.id ?? null,
        areaName: found.corridor?.name ?? null,
        areaIsNew: Boolean(found.newCorridor),
        existingId: existing?.id ?? null,
        existingPhotos: existing?.media.gallery.length ?? 0,
      };
    });
    return NextResponse.json({ projects: preview, notes });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'The workbook could not be read.' }, { status: 400 });
  }
}
