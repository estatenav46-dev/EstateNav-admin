'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 group shadow-md hover:shadow transition-all"
    >
      {pending ? (
        <>
          <div className="w-4 h-4 border-2 border-on border-t-transparent rounded-full animate-spin" />
          <span>Authenticating...</span>
        </>
      ) : (
        <>
          <span>Sign In to Admin</span>
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
    <div className="min-h-screen bg-gradient-to-b from-bg to-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-on shadow-lg shadow-accent/20 mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">EstateNav Control Plane</h1>
          <p className="text-sm text-ink-muted mt-1">
            Secure admin authentication for property intelligence & listings
          </p>
        </div>

        {/* Card */}
        <div className="panel p-8 shadow-xl bg-surface border-line">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-ink">Admin Sign In</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Enter your authorized credentials configured in the environment.
            </p>
          </div>

          {state?.ok === false && (
            <div className="mb-5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
              <span className="font-semibold">Error:</span>
              <span>{state.message}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="admin@estatenav.in"
                  className="w-full !pl-11 !pr-4 py-2.5 bg-surface text-ink placeholder:text-ink-muted/40 border border-line rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Admin Password
                </label>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-ink-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full !pl-11 !pr-11 py-2.5 bg-surface text-ink placeholder:text-ink-muted/40 border border-line rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
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

          <div className="mt-6 pt-5 border-t border-line text-center">
            <p className="text-2xs text-ink-muted">
              EstateNav Intelligence System &bull; Strictly authorized personnel only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
