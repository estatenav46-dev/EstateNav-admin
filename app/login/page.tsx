'use client';

import Image from 'next/image';
import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary group w-full min-h-[2.75rem]"
    >
      {pending ? (
        <>
          <div className="w-4 h-4 border-2 border-on border-t-transparent rounded-full animate-spin" />
          <span>Signing in…</span>
        </>
      ) : (
        <>
          <span>Sign in</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[26rem]">
        {/* Branding header */}
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="relative mb-4 h-14 w-14 overflow-hidden rounded-full border border-line bg-surface">
            <Image src="/logo.png" alt="" fill sizes="56px" className="object-cover" priority />
          </span>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">EstateNav admin</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage listings, partners, the blog and enquiries.</p>
        </div>

        {/* Card */}
        <div className="panel p-7 shadow-[0_30px_60px_-40px_rgb(0_0_0/0.35)]">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-ink">Sign in</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Use the admin email and password set for this site.</p>
          </div>

          {state?.ok === false && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-[10px] border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <span>{state.message}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-ink">
                Email
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="admin@estatenav.in"
                  className="field !pl-11"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-ink">
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="field !pl-11 !pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-ink-muted hover:text-ink focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>

          <p className="mt-5 border-t border-line pt-4 text-center text-xs text-ink-muted">For EstateNav staff only.</p>
        </div>
      </div>
    </div>
  );
}
