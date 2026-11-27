import { requireAuth } from '@/lib/auth/session';
import { listDevelopers, listProperties } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { DevelopersManager } from '@/components/developers/DevelopersManager';

export const dynamic = 'force-dynamic';

export default async function DevelopersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await requireAuth();
  const [developers, properties] = await Promise.all([listDevelopers(), listProperties({ status: 'all' })]);
  const listingCounts: Record<string, number> = {};
  for (const p of properties) listingCounts[p.developerId] = (listingCounts[p.developerId] ?? 0) + 1;

  return (
    <AdminShell userEmail={session.email}>
      <DevelopersManager initialDevelopers={developers} listingCounts={listingCounts} initialFilter={searchParams.filter === 'incomplete' ? 'incomplete' : 'all'} />
    </AdminShell>
  );
}
