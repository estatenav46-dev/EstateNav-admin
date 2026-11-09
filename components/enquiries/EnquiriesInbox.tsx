'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Enquiry } from '@/lib/data/types';
import { updateEnquiryAction } from '@/app/actions/enquiries';
import {
  Inbox,
  Search,
  Phone,
  Mail,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';

interface Props {
  initialEnquiries: Enquiry[];
}

export function EnquiriesInbox({ initialEnquiries }: Props) {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialEnquiries);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = enquiries.filter((enq) => {
    if (filterStatus !== 'all' && enq.status !== filterStatus) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      enq.name.toLowerCase().includes(term) ||
      enq.phone.toLowerCase().includes(term) ||
      (enq.email && enq.email.toLowerCase().includes(term)) ||
      (enq.propertyTitle && enq.propertyTitle.toLowerCase().includes(term))
    );
  });

  const handleStatusChange = async (id: string, status: Enquiry['status']) => {
    setUpdatingId(id);
    const res = await updateEnquiryAction(id, { status });
    setUpdatingId(null);
    if (res.ok) {
      setEnquiries(enquiries.map((e) => (e.id === id ? res.data : e)));
      router.refresh();
    }
  };

  const handleSaveNotes = async (id: string) => {
    setUpdatingId(id);
    const currentNotes = notes[id] !== undefined ? notes[id] : enquiries.find((e) => e.id === id)?.notes || '';
    const res = await updateEnquiryAction(id, { notes: currentNotes });
    setUpdatingId(null);
    if (res.ok) {
      setEnquiries(enquiries.map((e) => (e.id === id ? res.data : e)));
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Customer Leads & Advisory Inquiries</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Real-time inquiries received from the EstateNav website with consent timestamps and attribution.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="field pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-line pb-3 overflow-x-auto text-xs">
        {['all', 'new', 'contacted', 'visit-scheduled', 'closed', 'spam'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
              filterStatus === st
                ? 'bg-accent text-on'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
          >
            {st} ({st === 'all' ? enquiries.length : enquiries.filter((e) => e.status === st).length})
          </button>
        ))}
      </div>

      {/* Leads List */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center text-ink-muted">
          <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="font-semibold text-ink">No inquiries match the current filter.</p>
          <p className="text-xs mt-1">Try selecting a different status or clearing your search query.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((enq) => {
            const isExpanded = expandedId === enq.id;
            return (
              <div key={enq.id} className="panel overflow-hidden transition-all border-line">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : enq.id)}
                  className="p-4 hover:bg-surface-2/40 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        enq.status === 'new'
                          ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                          : enq.status === 'contacted'
                          ? 'bg-blue-500'
                          : enq.status === 'visit-scheduled'
                          ? 'bg-purple-500'
                          : 'bg-ink-muted/40'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">{enq.name}</span>
                        <span className="text-2xs bg-surface-2 border border-line px-2 py-0.5 rounded-full text-ink-muted font-medium uppercase">
                          {enq.intent}
                        </span>
                        <span className="text-2xs text-ink-muted">
                          {enq.createdAt ? new Date(enq.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{enq.phone}</span>
                        </span>
                        {enq.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            <span>{enq.email}</span>
                          </span>
                        )}
                        {enq.propertyTitle && (
                          <span className="flex items-center gap-1 text-ink font-medium">
                            <Building2 className="w-3.5 h-3.5 text-accent" />
                            <span>{enq.propertyTitle}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center self-end">
                    <select
                      value={enq.status}
                      disabled={updatingId === enq.id}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleStatusChange(enq.id, e.target.value as Enquiry['status'])}
                      className="field py-1 px-2.5 text-xs capitalize w-auto font-medium"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="visit-scheduled">Visit Scheduled</option>
                      <option value="closed">Closed</option>
                      <option value="spam">Spam</option>
                    </select>

                    <button className="text-ink-muted hover:text-ink p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-line bg-surface-2/30 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold text-ink uppercase tracking-wider text-2xs block mb-1">
                          Buyer Message / Inquiry
                        </span>
                        <p className="p-3 rounded-lg bg-surface border border-line text-ink whitespace-pre-wrap">
                          {enq.message || 'No additional message provided.'}
                        </p>

                        {enq.preferredDate && (
                          <div className="mt-2 text-ink-muted flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-accent" />
                            <span>
                              Requested Visit Date:{' '}
                              <strong className="text-ink">{new Date(enq.preferredDate).toLocaleDateString()}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="font-semibold text-ink uppercase tracking-wider text-2xs block mb-1">
                            Consent & Attribution Audit
                          </span>
                          <div className="p-3 rounded-lg bg-surface border border-line space-y-1 text-2xs text-ink-muted">
                            <div>
                              Source form: <strong className="text-ink capitalize">{enq.source}</strong>
                            </div>
                            <div>
                              Consent text version: <strong className="text-ink">{enq.consentVersion || 'v1.0'}</strong>
                            </div>
                            {enq.consentAt && (
                              <div>
                                Timestamp: <strong className="text-ink">{new Date(enq.consentAt).toISOString()}</strong>
                              </div>
                            )}
                            {enq.utm && (enq.utm.source || enq.utm.campaign) && (
                              <div>
                                UTM:{' '}
                                <strong className="text-ink">
                                  {enq.utm.source || 'direct'} / {enq.utm.medium || 'organic'} / {enq.utm.campaign || 'none'}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Internal Advisor Notes */}
                        <div>
                          <span className="font-semibold text-ink uppercase tracking-wider text-2xs block mb-1">
                            Internal Advisor Notes
                          </span>
                          <textarea
                            rows={2}
                            value={notes[enq.id] !== undefined ? notes[enq.id] : enq.notes || ''}
                            onChange={(e) => setNotes({ ...notes, [enq.id]: e.target.value })}
                            placeholder="Add notes from phone call, buyer budget, specific requirements..."
                            className="field text-xs mb-1.5"
                          />
                          <button
                            type="button"
                            disabled={updatingId === enq.id}
                            onClick={() => handleSaveNotes(enq.id)}
                            className="btn-secondary py-1 px-3 text-2xs"
                          >
                            {updatingId === enq.id ? 'Saving...' : 'Save Notes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

