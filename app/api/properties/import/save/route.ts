import { dbErrorMessage } from '@/lib/data/dbErrors';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createCorridor, ensurePartnerRecord, getPropertyBySlug, listCorridors, listDevelopers, saveDeveloper, saveProperty } from '@/lib/data/api';
import { imageRefSchema, propertyDocumentSchema } from '@/lib/data/schemas';
import type { ParsedProject } from '@/lib/import/parse';
import { lookupProject } from '@/lib/import/lookup';
import { buildDraft, type ImportedMedia } from '@/lib/import/build';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mediaSchema = z.object({
  cover: imageRefSchema.nullable(),
  gallery: z.array(imageRefSchema).max(40),
  masterPlan: imageRefSchema.nullable(),
  floorPlans: z.array(z.object({ image: imageRefSchema, unitIndex: z.number().int().nonnegative().optional() })).max(60),
  documents: z.array(propertyDocumentSchema).max(30),
  videoUrl: z.string().url().optional(),
  replaced: z.boolean(),
});

/** Step 4: saves one project (create or update by project_key). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  try {
    const body = (await request.json()) as { project: ParsedProject; media: unknown; developerId?: string };
    const project = body.project;
    if (!project?.key || !project.fields) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
    if (project.errors?.length) return NextResponse.json({ message: project.errors.join(' ') }, { status: 400 });
    const media = mediaSchema.parse(body.media) as ImportedMedia;

    const [developers, corridors, existing] = await Promise.all([listDevelopers(), listCorridors(), getPropertyBySlug(project.key)]);
    project.warnings = [];
    const found = lookupProject(project, developers, corridors, body.developerId || undefined);
    if (found.errors.length || !found.developer || !found.corridor) return NextResponse.json({ message: found.errors.join(' ') || 'Partner or area missing.' }, { status: 400 });

    // A partner named in the sheet but not on the Partners page is added as a placeholder to fill in later.
    let partner = await ensurePartnerRecord(found.developer.id);
    if (!partner && found.newDeveloper) partner = { developer: await saveDeveloper(found.newDeveloper), created: true };
    if (!partner) return NextResponse.json({ message: `Partner "${found.developer.name}" could not be found.` }, { status: 400 });
    let corridor = found.corridor;
    if (found.newCorridor) {
      try {
        corridor = await createCorridor(found.newCorridor);
      } catch {
        // Another row created it a moment ago.
        corridor = (await listCorridors()).find((c) => c.id === found.newCorridor!.id) ?? found.newCorridor;
      }
    }

    const { draft, warnings } = buildDraft({ project, existing, developer: partner.developer, corridor, media });
    const saved = await saveProperty(draft, session.email);
    return NextResponse.json({
      ok: true,
      id: saved.id,
      slug: saved.slug,
      status: saved.status,
      created: !existing,
      areaCreated: Boolean(found.newCorridor),
      partnerCreated: partner.created,
      partnerName: partner.developer.name,
      warnings: [...project.warnings, ...warnings],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: `Some values are not valid: ${error.issues.slice(0, 6).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` }, { status: 400 });
    }
    return NextResponse.json({ message: dbErrorMessage(error, 'The project could not be saved.') }, { status: 500 });
  }
}
