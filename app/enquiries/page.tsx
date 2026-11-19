import { requireAuth } from '@/lib/auth/session';
import { listEnquiries } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { EnquiriesInbox } from '@/components/enquiries/EnquiriesInbox';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'visit-scheduled', 'closed', 'spam'];

export default async function EnquiriesPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await requireAuth();
  const enquiries = await listEnquiries();

  return (
    <AdminShell userEmail={session.email}>
      <EnquiriesInbox initialEnquiries={enquiries} initialStatus={STATUSES.includes(searchParams.status ?? '') ? searchParams.status : 'all'} />
    </AdminShell>
  );
}

