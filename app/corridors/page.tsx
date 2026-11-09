import { requireAuth } from '@/lib/auth/session';
import { listCorridors } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { CorridorsManager } from '@/components/corridors/CorridorsManager';

export const dynamic = 'force-dynamic';

export default async function CorridorsPage() {
  const session = await requireAuth();
  const corridors = await listCorridors();

  return (
    <AdminShell userEmail={session.email}>
      <CorridorsManager initialCorridors={corridors} />
    </AdminShell>
  );
}

