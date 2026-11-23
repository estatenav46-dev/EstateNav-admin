import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/session';
import { listProperties, listCorridors, listDevelopers } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertiesTable, type TableFilters } from '@/components/properties/PropertiesTable';
import { BulkPropertyUpload } from '@/components/properties/BulkPropertyUpload';

export const dynamic = 'force-dynamic';

const pick = (value: string | string[] | undefined, allowed?: string[]) => {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return 'all';
  return !allowed || allowed.includes(v) ? v : 'all';
};

export default async function PropertiesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await requireAuth();
  const [properties, corridors, developers] = await Promise.all([listProperties({ status: 'all' }), listCorridors(), listDevelopers()]);
  const initialFilters: TableFilters = {
    status: pick(searchParams.status, ['published', 'draft', 'archived']),
    region: pick(searchParams.region, ['north', 'east', 'south-east', 'south', 'west', 'central']),
    developer: pick(searchParams.developer),
    corridor: pick(searchParams.corridor),
    segment: pick(searchParams.segment, ['residential', 'plot', 'commercial']),
    q: typeof searchParams.q === 'string' ? searchParams.q : '',
  };

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">Property listings</h1>
            <p className="mt-0.5 text-sm text-ink-muted">Bengaluru projects: pricing, unit types, floor plans, documents and verification details.</p>
          </div>
          <Link href="/properties/new" className="btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Post new property</span>
          </Link>
        </div>

        <BulkPropertyUpload developers={developers} />
        <PropertiesTable properties={properties} corridors={corridors} developers={developers} initialFilters={initialFilters} />
      </div>
    </AdminShell>
  );
}
