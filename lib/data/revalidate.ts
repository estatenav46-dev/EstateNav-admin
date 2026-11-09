export async function triggerWebsiteRevalidation(tag?: string, path?: string) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (path) params.set('path', path);

    const secret = process.env.REVALIDATION_SECRET;
    if (secret) params.set('secret', secret);

    await fetch(`${siteUrl}/api/revalidate?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    }).catch(() => {
      // Non-blocking if website is currently offline during local dev
    });
  } catch {
    // Non-blocking
  }
}

