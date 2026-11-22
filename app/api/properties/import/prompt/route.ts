import { getSession } from '@/lib/auth/session';
import { buildAiPrompt } from '@/lib/import/prompt';

export const runtime = 'nodejs';

/** The AI fill-in prompt as plain text (the admin's "Copy AI prompt" button reads this). */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  return new Response(buildAiPrompt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
