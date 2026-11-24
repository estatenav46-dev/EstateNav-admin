import { requireAuth } from '@/lib/auth/session';
import { listDevelopers } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { LogoWallManager } from '@/components/developers/LogoWallManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Channel partner logos' };

export default async function PartnerLogosPage() {
  const session = await requireAuth();
  const developers = await listDevelopers();
  return (
    <AdminShell userEmail={session.email}>
      <LogoWallManager initialDevelopers={developers} />
    </AdminShell>
  );
}
