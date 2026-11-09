import { requireAuth } from '@/lib/auth/session';
import { listDevelopers, listCorridors, listOfficeHubs } from '@/lib/data/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { PropertyEditor } from '@/components/properties/PropertyEditor';

export const dynamic = 'force-dynamic';

export default async function NewPropertyPage() {
  const session = await requireAuth();
  const [developers, corridors, hubs] = await Promise.all([
    listDevelopers(),
    listCorridors(),
    listOfficeHubs(),
  ]);

  return (
    <AdminShell userEmail={session.email}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Post New Property Listing</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Create an audited listing with verified pricing, RERA registry, and high-res Cloudinary media.
          </p>
        </div>

        <PropertyEditor
          initial={null}
          developers={developers}
          corridors={corridors}
          hubs={hubs}
        />
      </div>
    </AdminShell>
  );
}

