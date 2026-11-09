'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SiteSettings } from '@/lib/data/types';
import { saveSettingsAction } from '@/app/actions/settings';
import { ShieldCheck, Phone, DollarSign, AlertCircle, CheckCircle2, Save, Sparkles, Scale } from 'lucide-react';

interface Props {
  initialSettings: SiteSettings;
}

export function SettingsEditor({ initialSettings }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const res = await saveSettingsAction(settings);
    setSaving(false);

    if (res.ok) {
      setSettings(res.data);
      setStatus({ ok: true, message: 'Site & advisory settings updated successfully.' });
      router.refresh();
    } else {
      setStatus({ ok: false, message: res.message });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Site & Advisory Settings</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Configure SV Praveen RERA registration, official advisor contact numbers, and statutory Telangana fees.
          </p>
        </div>
      </div>

      {status && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs ${
            status.ok ? 'bg-accent-soft text-accent-ink border border-accent/20' : 'bg-danger/10 text-danger border border-danger/20'
          }`}
        >
          {status.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{status.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Info */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Phone className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-ink">Advisory Contact Channels</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Direct Phone (E.164) *</label>
              <input
                type="text"
                required
                value={settings.contact.phone}
                onChange={(e) =>
                  setSettings({ ...settings, contact: { ...settings.contact, phone: e.target.value } })
                }
                placeholder="+919876543210"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Phone Display Label *</label>
              <input
                type="text"
                required
                value={settings.contact.phoneDisplay}
                onChange={(e) =>
                  setSettings({ ...settings, contact: { ...settings.contact, phoneDisplay: e.target.value } })
                }
                placeholder="+91 98765 43210"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">WhatsApp Number (with country code) *</label>
              <input
                type="text"
                required
                value={settings.contact.whatsapp}
                onChange={(e) =>
                  setSettings({ ...settings, contact: { ...settings.contact, whatsapp: e.target.value } })
                }
                placeholder="+919876543210"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Official Advisory Email *</label>
              <input
                type="email"
                required
                value={settings.contact.email}
                onChange={(e) =>
                  setSettings({ ...settings, contact: { ...settings.contact, email: e.target.value } })
                }
                placeholder="praveen@estatenav.in"
                className="field"
              />
            </div>
          </div>
        </div>

        {/* Advisor & RERA Credentials */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-ink">Principal Advisor & RERA Registration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Advisor Full Name *</label>
              <input
                type="text"
                required
                value={settings.agent.name}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, name: e.target.value } })
                }
                placeholder="SV Praveen"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Title / Designation *</label>
              <input
                type="text"
                required
                value={settings.agent.title}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, title: e.target.value } })
                }
                placeholder="Principal Advisory & RERA Registered Agent"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Agent RERA Number *</label>
              <input
                type="text"
                required
                value={settings.agent.reraNumber}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, reraNumber: e.target.value } })
                }
                placeholder="A02500000000 / TS RERA"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Official RERA Verify URL *</label>
              <input
                type="url"
                required
                value={settings.agent.verifyUrl}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, verifyUrl: e.target.value } })
                }
                placeholder="https://rera.telangana.gov.in"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Registration Valid From</label>
              <input
                type="date"
                value={settings.agent.validFrom}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, validFrom: e.target.value } })
                }
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Registration Valid To</label>
              <input
                type="date"
                value={settings.agent.validTo}
                onChange={(e) =>
                  setSettings({ ...settings, agent: { ...settings.agent, validTo: e.target.value } })
                }
                className="field"
              />
            </div>
          </div>
        </div>

        {/* Telangana Statutory Purchase Costs */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <DollarSign className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-ink">Telangana Statutory Purchase Costs (Estimated)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Stamp Duty Percentage (%) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={settings.costs.stampDutyPct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costs: { ...settings.costs, stampDutyPct: parseFloat(e.target.value) || 0 },
                  })
                }
                placeholder="5.5"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Registration Fee Percentage (%) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={settings.costs.registrationPct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costs: { ...settings.costs, registrationPct: parseFloat(e.target.value) || 0 },
                  })
                }
                placeholder="2.0"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Statutory Authority / Source *</label>
              <input
                type="text"
                required
                value={settings.costs.source}
                onChange={(e) =>
                  setSettings({ ...settings, costs: { ...settings.costs, source: e.target.value } })
                }
                placeholder="Registration and Stamps Department, Government of Telangana"
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Rate Verified As-Of Date *</label>
              <input
                type="date"
                required
                value={settings.costs.asOf}
                onChange={(e) =>
                  setSettings({ ...settings, costs: { ...settings.costs, asOf: e.target.value } })
                }
                className="field"
              />
            </div>
          </div>
        </div>

        {/* Statutory Disclaimers */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Scale className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-ink">Legal Disclaimers & Consumer Consent</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Portal RERA Disclaimer</label>
              <textarea
                rows={2}
                value={settings.disclaimers.portal}
                onChange={(e) =>
                  setSettings({ ...settings, disclaimers: { ...settings.disclaimers, portal: e.target.value } })
                }
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Property Listing Disclaimer</label>
              <textarea
                rows={2}
                value={settings.disclaimers.listing}
                onChange={(e) =>
                  setSettings({ ...settings, disclaimers: { ...settings.disclaimers, listing: e.target.value } })
                }
                className="field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Lead Consent Text</label>
              <textarea
                rows={2}
                value={settings.consentText}
                onChange={(e) => setSettings({ ...settings, consentText: e.target.value })}
                className="field"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6">
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

