import { requireAuth } from '@/lib/auth/session';
import { listDevelopers } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { DevelopersManager } from '@/components/developers/DevelopersManager';

export const dynamic = 'force-dynamic';

export default async function DevelopersPage() {
  const session = await requireAuth();
  const developers = await listDevelopers();

  return (
    <AdminShell userEmail={session.email}>
      <DevelopersManager initialDevelopers={developers} />
    </AdminShell>
  );
}

