import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth/session';
import { getPropertyById, listDevelopers, listCorridors, listOfficeHubs } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertyEditor } from '@/components/properties/PropertyEditor';

export const dynamic = 'force-dynamic';

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const session = await requireAuth();
  const [property, developers, corridors, hubs] = await Promise.all([getPropertyById(params.id), listDevelopers(), listCorridors(), listOfficeHubs()]);
  if (!property) notFound();

  return (
    <AdminShell userEmail={session.email}>
      <Link href="/properties" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> All properties
      </Link>
      <PropertyEditor initial={property} developers={developers} corridors={corridors} hubs={hubs} />
    </AdminShell>
  );
}
