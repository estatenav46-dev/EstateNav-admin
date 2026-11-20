/**
 * Asks the public website to refresh its cached pages (its /api/revalidate route).
 * Targets WEBSITE_URL or NEXT_PUBLIC_SITE_URL, plus http://localhost:3000 while developing, so
 * a locally running website updates too. Returns true when at least one website confirmed.
 */
export async function triggerWebsiteRevalidation(tag?: string, path?: string): Promise<boolean> {
  const targets = new Set<string>();
  const configured = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) targets.add(configured.replace(/\/$/, ''));
  if (process.env.NODE_ENV === 'development' || !configured) targets.add('http://localhost:3000');

  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (path) params.set('path', path);
  const secret = process.env.REVALIDATION_SECRET;
  if (secret) params.set('secret', secret);

  const results = await Promise.all(
    Array.from(targets).map(async (base) => {
      try {
        const res = await fetch(`${base}/api/revalidate?${params.toString()}`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (res.ok) return true;
        console.warn(`[revalidate] ${base} answered ${res.status}${res.status === 401 ? ' — REVALIDATION_SECRET differs between the admin and the website' : ''}`);
      } catch (error) {
        // A local website that is not running is expected while developing.
        if (!base.includes('localhost')) console.warn(`[revalidate] ${base} could not be reached:`, error instanceof Error ? error.message : error);
      }
      return false;
    }),
  );
  return results.some(Boolean);
}

export const REFRESH_WARNING =
  'Saved. The website did not confirm the refresh, so the change can take up to a minute to appear there. If this keeps happening, check WEBSITE_URL / NEXT_PUBLIC_SITE_URL and that REVALIDATION_SECRET matches on both apps.';
