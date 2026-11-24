import { getSession } from '@/lib/auth/session';
import { buildPartnerPrompt } from '@/lib/import/partners';

export const runtime = 'nodejs';

/** The AI fill-in prompt for the partner template (the Partners page's "Copy AI prompt" button). */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  return new Response(buildPartnerPrompt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
