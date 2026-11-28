import { dbErrorMessage } from '@/lib/data/dbErrors';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listDevelopers } from '@/lib/data/api';
import { parsePartners } from '@/lib/import/partners';

export const runtime = 'nodejs';

/** Reads a partner workbook and reports what will happen. Nothing is saved. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Your admin session has expired. Please sign in again.' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: 'Choose an .xlsx file.' }, { status: 400 });
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) return NextResponse.json({ message: 'Only .xlsx Excel files are supported. In Google Sheets use File → Download → Microsoft Excel.' }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ message: 'The workbook must be smaller than 4 MB. Keep logos out of the sheet: use links or attach them.' }, { status: 400 });
  try {
    const result = await parsePartners(await file.arrayBuffer(), await listDevelopers());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: dbErrorMessage(error, 'The workbook could not be read.') }, { status: 400 });
  }
}
