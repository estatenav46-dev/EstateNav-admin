/**
 * Firestore errors that mean "the project is over its usage limit" (gRPC code 8,
 * RESOURCE_EXHAUSTED; with REST the message is just "Quota exceeded."). On the free Spark plan
 * the daily read/write quota resets at midnight Pacific time (about 1:30 PM IST).
 */
export const QUOTA_MESSAGE =
  'The database (Firestore) has used up its daily quota, so nothing can be read or saved right now. ' +
  'It resets at midnight Pacific time (about 1:30 PM IST), or upgrade the Firebase project to the Blaze plan to lift the limit.';

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  if (e.code === 8 || e.code === 'resource-exhausted' || e.code === 'RESOURCE_EXHAUSTED' || e.code === 429) return true;
  const text = `${typeof e.message === 'string' ? e.message : ''} ${typeof e.details === 'string' ? e.details : ''}`;
  return /quota exceeded|resource[_ ]exhausted/i.test(text);
}

/** Message for an error shown to an admin: a clear quota explanation, else the error's own text. */
export function dbErrorMessage(error: unknown, fallback: string): string {
  if (isQuotaError(error)) return QUOTA_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}
