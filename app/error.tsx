'use client';

import { useEffect, useState } from 'react';

type Cause = 'checking' | 'quota' | 'database' | 'session' | 'unknown';

// Shown instead of Next's bare "Application error" when a page fails to load. Production hides
// the server error, so a small health check tells the admin whether the database is the cause.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [cause, setCause] = useState<Cause>('checking');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    console.error(error);
    let active = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; message?: string };
        if (!active) return;
        if (data.ok) return setCause('unknown');
        if (data.reason === 'quota') {
          setDetail(data.message ?? '');
          return setCause('quota');
        }
        setCause(data.reason === 'session' ? 'session' : 'database');
      })
      .catch(() => active && setCause('unknown'));
    return () => {
      active = false;
    };
  }, [error]);

  const title =
    cause === 'quota' ? 'Database limit reached for today'
    : cause === 'database' ? 'The database could not be reached'
    : cause === 'session' ? 'Your session has expired'
    : 'This page could not be loaded';

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-ink">{cause === 'checking' ? 'Something went wrong' : title}</h1>
        <p className="mt-2 text-sm text-ink/80">
          {cause === 'checking' && 'Checking what happened…'}
          {cause === 'quota' && detail}
          {cause === 'database' && 'Firestore did not answer. Check the Firebase project and the FIREBASE_ADMIN_* settings, then try again.'}
          {cause === 'session' && 'Please sign in again.'}
          {cause === 'unknown' && 'An unexpected error occurred while loading this page. Try again; if it keeps happening, check the server logs for the code below.'}
        </p>
        {cause === 'quota' && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/80">
            <li>Your data is safe; only reading and saving are paused.</li>
            <li>Firebase console → Usage and billing shows which limit (reads or writes) was hit.</li>
          </ul>
        )}
        {error.digest && <p className="mt-3 text-xs text-ink/60">Error code: {error.digest}</p>}
        <div className="mt-5 flex gap-2">
          {cause === 'session' ? (
            <a href="/login" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Sign in</a>
          ) : (
            <button type="button" onClick={reset} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Try again</button>
          )}
          <a href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">Dashboard</a>
        </div>
      </div>
    </main>
  );
}
