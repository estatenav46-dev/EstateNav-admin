import Link from 'next/link';
import { requireAuth } from '@/lib/auth/session';
import { listProperties, listCorridors, listDevelopers } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertiesTable } from '@/components/properties/PropertiesTable';
import { BulkPropertyUpload } from '@/components/properties/BulkPropertyUpload';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  const session = await requireAuth();
  const [properties, corridors, developers] = await Promise.all([
    listProperties({ status: 'all' }),
    listCorridors(),
    listDevelopers(),
  ]);

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-6 md:space-y-7">
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface px-5 py-5 shadow-sm sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Catalogue</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Property Listings</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Manage Bengaluru project listings, pricing, configurations, and verification facts.
            </p>
          </div>
          <Link href="/properties/new" className="btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            <span>Post New Property</span>
          </Link>
        </div>

        <BulkPropertyUpload developers={developers} />
        <PropertiesTable properties={properties} corridors={corridors} developers={developers} />
      </div>
    </AdminShell>
  );
}
