import { requireAuth } from '@/lib/auth/session';
import { listEnquiries } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { EnquiriesInbox } from '@/components/enquiries/EnquiriesInbox';

export const dynamic = 'force-dynamic';

export default async function EnquiriesPage() {
  const session = await requireAuth();
  const enquiries = await listEnquiries();

  return (
    <AdminShell userEmail={session.email}>
      <EnquiriesInbox initialEnquiries={enquiries} />
    </AdminShell>
  );
}

