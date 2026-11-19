import { AlertCircle } from 'lucide-react';

/** Label + hint + error wrapper used across admin forms. */
export function Field({
  label,
  hint,
  error,
  required,
  className = '',
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-2xs text-danger">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-2xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

/** A titled block inside an editor section. */
export function SubSection({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-2xs text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-4 py-5 text-center text-xs text-ink-muted">{children}</p>;
}

// Number inputs: empty string becomes null so optional fields stay optional.
export const toNullableInt = { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v))) };
export const toNullableFloat = { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v)) };
export const toNullableText = { setValueAs: (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v) };

export const slugify = (text: string, max = 80) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** ₹1,35,00,000 → "₹1.35 Cr" for hints under price inputs. */
export function inr(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
