'use server';

import { redirect } from 'next/navigation';
import { createSessionToken, setSessionCookie, clearSessionCookie } from '@/lib/auth/session';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

function cleanEnv(val: string | undefined): string | null {
  if (!val) return null;
  const cleaned = val.trim().replace(/^["']|["']$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function loginAction(prevState: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString().trim();

  if (!email || !password) {
    return { ok: false, message: 'Please enter both email and password.' };
  }

  const expectedEmail = cleanEnv(process.env.ADMIN_EMAIL);
  const expectedPassword = cleanEnv(process.env.ADMIN_PASSWORD);

  if (!expectedEmail || !expectedPassword) {
    return {
      ok: false,
      message: 'Server configuration error: ADMIN_EMAIL or ADMIN_PASSWORD is not set in environment.',
    };
  }

  const emailMatches = email.toLowerCase() === expectedEmail.toLowerCase();
  const passwordMatches = password === expectedPassword;

  if (!emailMatches || !passwordMatches) {
    return {
      ok: false,
      message: 'Invalid email or password.',
    };
  }

  const token = createSessionToken(email);
  await setSessionCookie(token);

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
