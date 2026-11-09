import Link from 'next/link';
import { requireAuth } from '@/lib/auth/session';
import { listProperties, listCorridors } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertiesTable } from '@/components/properties/PropertiesTable';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  const session = await requireAuth();
  const [properties, corridors] = await Promise.all([
    listProperties({ status: 'all' }),
    listCorridors(),
  ]);

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Property Listings</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Manage Hyderabad project listings, pricing, configurations, and verification facts.
            </p>
          </div>
          <Link href="/properties/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Post New Property</span>
          </Link>
        </div>

        <PropertiesTable properties={properties} corridors={corridors} />
      </div>
    </AdminShell>
  );
}

