import { AdminShell } from '@/components/layout/AdminShell';

// Shown instantly on every navigation while the page's data loads, so clicks never feel stuck.
export default function Loading() {
  return (
    <AdminShell userEmail="">
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-20 rounded-xl border border-line bg-surface" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-surface-2" />
          ))}
        </div>
        <div className="h-12 rounded-xl border border-line bg-surface" />
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-14 rounded-md bg-surface-2" />
              <div className="h-3 flex-1 rounded bg-surface-2" />
              <div className="h-3 w-24 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
