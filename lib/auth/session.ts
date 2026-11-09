import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

const COOKIE_NAME = 'estatenav_admin_session';
const SECRET = process.env.ADMIN_SESSION_SECRET || 'estatenav-admin-fallback-secret-key-2026';

export interface AdminSession {
  email: string;
  expiresAt: number;
}

function sign(payload: string): string {
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  return `${payload}.${hmac.digest('hex')}`;
}

function verify(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return payload;
  }
  return null;
}

export function createSessionToken(email: string): string {
  const session: AdminSession = {
    email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return sign(payload);
}

export async function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verify(token);
    if (!payload) return null;
    const session: AdminSession = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

