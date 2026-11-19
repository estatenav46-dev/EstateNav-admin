import { requireAuth } from '@/lib/auth/session';
import { listCorridors, listProperties } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { CorridorsManager } from '@/components/corridors/CorridorsManager';

export const dynamic = 'force-dynamic';

export default async function CorridorsPage() {
  const session = await requireAuth();
  const [corridors, properties] = await Promise.all([listCorridors(), listProperties({ status: 'all' })]);
  const listingCounts: Record<string, number> = {};
  for (const p of properties) listingCounts[p.corridorId] = (listingCounts[p.corridorId] ?? 0) + 1;

  return (
    <AdminShell userEmail={session.email}>
      <CorridorsManager initialCorridors={corridors} listingCounts={listingCounts} />
    </AdminShell>
  );
}
