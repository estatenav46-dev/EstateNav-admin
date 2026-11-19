'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Check, Plus } from 'lucide-react';
import { SECTIONS, type Draft, type SectionId } from './model';

export const useDraft = () => useFormContext<Draft>();

/** One numbered panel in the long editor form. */
export function SectionCard({ id, children, aside }: { id: SectionId; children: React.ReactNode; aside?: React.ReactNode }) {
  const index = SECTIONS.findIndex((s) => s.id === id);
  const section = SECTIONS[index];
  const Icon = section.icon;
  return (
    <section id={`section-${id}`} aria-labelledby={`section-${id}-title`} className="panel scroll-mt-24 p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Step {index + 1}</p>
            <h2 id={`section-${id}-title`} className="text-base font-semibold text-ink">
              {section.label}
            </h2>
            <p className="mt-0.5 text-2xs text-ink-muted">{section.description}</p>
          </div>
        </div>
        {aside}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** Toggle chip for multi-select lists (amenities, banks, lenses). */
export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-accent-ink bg-accent-soft font-semibold text-accent-ink' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
      }`}
    >
      {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {children}
    </button>
  );
}

/** Text input that adds a custom value to a list on Enter or click (not a nested form). */
export function AddCustom({ placeholder, onAdd, label = 'Add' }: { placeholder: string; onAdd: (value: string) => void; label?: string }) {
  const [value, setValue] = useState('');
  const add = () => {
    const v = value.trim();
    if (v) onAdd(v);
    setValue('');
  };
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        className="field min-h-[36px] flex-1 text-xs"
      />
      <button type="button" onClick={add} disabled={!value.trim()} className="btn-secondary min-h-[36px] px-3 text-xs">
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
    </div>
  );
}
