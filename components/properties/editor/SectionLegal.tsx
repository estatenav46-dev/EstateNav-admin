'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { Field, SubSection, toNullableText } from '@/components/ui/form';
import { AddCustom, Chip, SectionCard, useDraft } from './ui';

const BANKS = ['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'LIC Housing Finance', 'PNB Housing', 'Canara Bank', 'Union Bank of India', 'IDFC First Bank', 'Bajaj Housing Finance'];
const K_RERA = 'https://rera.karnataka.gov.in/';

const monthLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.valueOf()) ? '' : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export function SectionLegal() {
  const { register, watch, setValue, getValues, formState } = useDraft();
  const { errors } = formState;
  const status = watch('possession.status');
  const date = watch('possession.date');
  const banks = watch('bankApprovals') ?? [];
  const verifyUrl = watch('rera.verifyUrl');
  const autoLabel = useRef<string | null>(null);

  // Possession label follows the date/status until someone types their own.
  useEffect(() => {
    const current = getValues('possession.label');
    const next = status === 'ready' ? 'Ready to move' : date ? monthLabel(date) : status === 'pre-launch' ? 'Pre-launch' : '';
    if (next && (!current || current === autoLabel.current)) {
      setValue('possession.label', next, { shouldDirty: true, shouldValidate: Boolean(current) });
      autoLabel.current = next;
    }
  }, [status, date, getValues, setValue]);

  const toggleBank = (bank: string) => setValue('bankApprovals', banks.includes(bank) ? banks.filter((b) => b !== bank) : [...banks, bank], { shouldDirty: true });
  const customBanks = banks.filter((b) => !BANKS.includes(b));

  return (
    <SectionCard id="legal">
      <SubSection title="Possession">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Status">
            <select {...register('possession.status')} className="field">
              <option value="pre-launch">Pre-launch</option>
              <option value="under-construction">Under construction</option>
              <option value="ready">Ready to move</option>
            </select>
          </Field>
          <Field label="Developer's target date">
            <input type="date" {...register('possession.date', toNullableText)} className="field" />
          </Field>
          <Field label="RERA completion date" hint="From the K-RERA certificate, if different.">
            <input type="date" {...register('possession.reraDate', toNullableText)} className="field" />
          </Field>
          <Field label="Label shown" required error={errors.possession?.label ? 'Add the possession label.' : undefined} hint="Fills from the date; edit freely.">
            <input {...register('possession.label')} className="field" placeholder="e.g. Dec 2028" />
          </Field>
        </div>
      </SubSection>

      <SubSection title="K-RERA registration" description="Buyers can verify the number on the Karnataka RERA portal. Leave it blank if you have not checked it yet.">
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Field label="Project registration number" error={errors.rera?.number?.message}>
            <input {...register('rera.number', toNullableText)} className="field font-mono text-xs" placeholder="PRM/KA/RERA/1251/446/PR/…" />
          </Field>
          <Field
            label="Verify link"
            error={errors.rera?.verifyUrl ? 'Enter a full link (https://…) or leave it blank.' : undefined}
            hint={
              verifyUrl ? (
                <a href={verifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                  Open link <ExternalLink className="h-3 w-3" />
                </a>
              ) : undefined
            }
          >
            <input type="url" {...register('rera.verifyUrl', toNullableText)} className="field text-xs" placeholder={K_RERA} />
          </Field>
          <Field label="Checked?" hint="Tick once you have verified it on the portal.">
            <label className="flex min-h-[2.625rem] cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" {...register('rera.registered')} className="h-4 w-4 accent-[rgb(var(--accent))]" />
              Number checked
            </label>
          </Field>
        </div>
        {!verifyUrl && (
          <button type="button" onClick={() => setValue('rera.verifyUrl', K_RERA, { shouldDirty: true })} className="text-2xs font-medium text-accent-ink hover:underline">
            Use the Karnataka RERA portal link
          </button>
        )}
      </SubSection>

      <SubSection title="Approvals" description="Only fill what you have seen in documents. The website shows “Ask advisor” for anything left blank.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Khata">
            <select {...register('approvals.khata', toNullableText)} className="field">
              <option value="">Not confirmed</option>
              <option value="A">A Khata</option>
              <option value="B">B Khata</option>
              <option value="E">E Khata</option>
            </select>
          </Field>
          <Field label="Plan sanctioned by">
            <select {...register('approvals.planAuthority', toNullableText)} className="field">
              <option value="">Not confirmed</option>
              <option value="BBMP">BBMP</option>
              <option value="BDA">BDA</option>
              <option value="BMRDA">BMRDA</option>
              <option value="BIAAPA">BIAAPA</option>
            </select>
          </Field>
          <Field label="Title check">
            <select {...register('approvals.titleCheck', toNullableText)} className="field">
              <option value="">Not confirmed</option>
              <option value="clear">Clear title (verified)</option>
              <option value="pending">Check in progress</option>
            </select>
          </Field>
          <Field label="Approval notes" className="sm:col-span-3" hint="e.g. “OC received for Phase 1 (towers A–D)”.">
            <input {...register('approvals.notes')} className="field" />
          </Field>
        </div>
      </SubSection>

      <SubSection title="Home loan partners" description="Banks that have approved the project.">
        <div className="flex flex-wrap gap-2">
          {[...BANKS, ...customBanks].map((bank) => (
            <Chip key={bank} active={banks.includes(bank)} onClick={() => toggleBank(bank)}>
              {bank}
            </Chip>
          ))}
        </div>
        <AddCustom placeholder="Another bank or lender" onAdd={(bank) => !banks.includes(bank) && setValue('bankApprovals', [...banks, bank], { shouldDirty: true })} />
      </SubSection>
    </SectionCard>
  );
}
