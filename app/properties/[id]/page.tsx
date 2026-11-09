import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { getPropertyById, listDevelopers, listCorridors, listOfficeHubs } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertyEditor } from '@/components/properties/PropertyEditor';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function EditPropertyPage({ params }: Props) {
  const session = await requireAuth();
  const [property, developers, corridors, hubs] = await Promise.all([
    getPropertyById(params.id),
    listDevelopers(),
    listCorridors(),
    listOfficeHubs(),
  ]);

  if (!property) {
    notFound();
  }

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Edit Listing: {property.title}
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            ID: <span className="font-mono text-xs">{property.id}</span> &bull; Slug: <span className="font-mono text-xs">{property.slug}</span>
          </p>
        </div>

        <PropertyEditor
          initial={property}
          developers={developers}
          corridors={corridors}
          hubs={hubs}
        />
      </div>
    </AdminShell>
  );
}
