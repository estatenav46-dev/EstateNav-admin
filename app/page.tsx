import Link from 'next/link';
import { requireAuth } from '@/lib/auth/session';
import { getDashboardCounts } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  Building2,
  CheckCircle2,
  FileEdit,
  Archive,
  Users,
  Compass,
  Inbox,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();
  const counts = await getDashboardCounts();

  const statCards = [
    {
      label: 'Published Listings',
      value: counts.publishedProperties,
      total: `of ${counts.totalProperties} total`,
      icon: CheckCircle2,
      color: 'text-accent',
      bg: 'bg-accent/10',
      href: '/properties?status=published',
    },
    {
      label: 'Draft Listings',
      value: counts.draftProperties,
      total: 'in progress',
      icon: FileEdit,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      href: '/properties?status=draft',
    },
    {
      label: 'Archived Listings',
      value: counts.archivedProperties,
      total: 'inactive',
      icon: Archive,
      color: 'text-ink-muted',
      bg: 'bg-surface-2',
      href: '/properties?status=archived',
    },
    {
      label: 'New Enquiries',
      value: counts.newEnquiries,
      total: `${counts.totalEnquiries} all-time`,
      icon: Inbox,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      href: '/enquiries?status=new',
    },
    {
      label: 'Active Developers',
      value: counts.totalDevelopers,
      total: 'partners on record',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
      href: '/developers',
    },
    {
      label: 'Micro-Market Corridors',
      value: counts.totalCorridors,
      total: 'Hyderabad mapped',
      icon: Compass,
      color: 'text-purple-600',
      bg: 'bg-purple-500/10',
      href: '/corridors',
    },
  ];

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard Overview</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Live snapshot of EstateNav property listings, inquiries, and market metadata.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/properties/new"
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Post New Property</span>
            </Link>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="panel p-5 hover:border-line-strong transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {card.label}
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-ink">{card.value}</span>
                      <span className="text-xs text-ink-muted">{card.total}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-ink-muted group-hover:text-accent font-medium">
                  <span>Manage</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions & Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Inquiries Panel */}
          <div className="lg:col-span-2 panel p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-ink">Recent Customer Inquiries</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  High-intent buyers requiring advisory callback or site visit scheduling
                </p>
              </div>
              <Link
                href="/enquiries"
                className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
              >
                <span>View All ({counts.totalEnquiries})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {counts.recentEnquiries.length === 0 ? (
              <div className="text-center py-12 text-ink-muted text-sm bg-surface-2/40 rounded-xl border border-dashed border-line">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No inquiries received yet.</p>
                <p className="text-xs mt-1">Lead submissions from the main website will appear here in real-time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-muted uppercase border-b border-line text-2xs tracking-wider">
                    <tr>
                      <th className="pb-2.5 font-semibold">Buyer Name</th>
                      <th className="pb-2.5 font-semibold">Contact</th>
                      <th className="pb-2.5 font-semibold">Interested Property</th>
                      <th className="pb-2.5 font-semibold">Status</th>
                      <th className="pb-2.5 font-semibold">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {counts.recentEnquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="py-3 font-medium text-ink">{enq.name}</td>
                        <td className="py-3 text-ink-muted">
                          <div>{enq.phone}</div>
                          <div className="text-2xs text-ink-muted/80">{enq.email}</div>
                        </td>
                        <td className="py-3 text-ink font-medium">
                          {enq.propertyTitle || enq.propertySlug || (
                            <span className="text-ink-muted italic">General Inquiry</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${
                              enq.status === 'new'
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : enq.status === 'contacted'
                                ? 'bg-blue-500/10 text-blue-700'
                                : enq.status === 'visit-scheduled'
                                ? 'bg-purple-500/10 text-purple-700'
                                : 'bg-surface-2 text-ink-muted'
                            }`}
                          >
                            {enq.status}
                          </span>
                        </td>
                        <td className="py-3 text-ink-muted">
                          {enq.createdAt ? new Date(enq.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Shortcuts & Database Stats */}
          <div className="space-y-6">
            <div className="panel p-6">
              <h2 className="text-base font-semibold text-ink mb-1">Quick Shortcuts</h2>
              <p className="text-xs text-ink-muted mb-4">Common administrative workflows</p>

              <div className="space-y-2">
                <Link
                  href="/properties/new"
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-line text-xs font-semibold text-ink group transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-accent" />
                    <span>Post New Property Listing</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/developers"
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-line text-xs font-semibold text-ink group transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Manage Partner Developers</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/corridors"
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-line text-xs font-semibold text-ink group transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-purple-600" />
                    <span>Manage Micro-Markets</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/settings"
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-line text-xs font-semibold text-ink group transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Site & Advisor Contact Settings</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* System Status */}
            <div className="panel p-6 bg-gradient-to-br from-surface to-surface-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
                System Integrations
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Database</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    Firestore (estatenav-706e1)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Image Storage</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Cloudinary (dqcdzoi3)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Admin Mode</span>
                  <span className="font-mono text-2xs bg-surface-2 px-2 py-0.5 rounded border border-line text-ink">
                    Fixed Env Auth
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
