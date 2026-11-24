import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { listDevelopers, saveDeveloper } from '@/lib/data/api';
import { imageRefSchema } from '@/lib/data/schemas';
import { buildPartner, type ParsedPartner } from '@/lib/import/partners';
import { copyImageFromLink } from '@/lib/import/media';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Saves one partner from the workbook (create, or update the matching partner). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  try {
    const body = (await request.json()) as { partner: ParsedPartner; logo?: unknown };
    const p = body.partner;
    if (!p?.id || !p.name || p.errors?.length) return NextResponse.json({ message: p?.errors?.join(' ') || 'Invalid partner row.' }, { status: 400 });
    const developers = await listDevelopers();
    const existing = developers.find((d) => d.id === (p.existingId ?? p.id)) ?? null;
    const warnings: string[] = [];

    // Logo: uploaded by the browser (attached file), copied here from a link, or left as it is.
    let logo: z.infer<typeof imageRefSchema> | undefined;
    if (body.logo) logo = imageRefSchema.parse(body.logo);
    else if (p.logo && /^https?:\/\//i.test(p.logo)) {
      try {
        logo = await copyImageFromLink(p.logo, `developers/${existing?.id ?? p.id}`, `${p.name} logo`);
      } catch (error) {
        warnings.push(`Logo not added: ${error instanceof Error ? error.message : 'could not be copied'}.`);
      }
    }

    const saved = await saveDeveloper(buildPartner(p, existing, logo));
    revalidatePath('/developers');
    return NextResponse.json({ ok: true, id: saved.id, name: saved.name, created: !existing, warnings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: `Some values are not valid: ${error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'The partner could not be saved.' }, { status: 500 });
  }
}
