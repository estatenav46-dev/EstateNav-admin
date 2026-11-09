import { requireAuth } from '@/lib/auth/session';
import { getSettings } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { SettingsEditor } from '@/components/settings/SettingsEditor';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireAuth();
  const settings = await getSettings();

  return (
    <AdminShell userEmail={session.email}>
      <SettingsEditor initialSettings={settings} />
    </AdminShell>
  );
}

