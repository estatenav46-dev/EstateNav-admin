'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Users,
  Map,
  Settings,
  LogOut,
  ExternalLink,
  Shield,
  ChevronRight,
  Layers3,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { href: '/properties', label: 'Properties', icon: Building2, group: 'Catalogue' },
  { href: '/developers', label: 'Partners', icon: Users, group: 'Catalogue' },
  { href: '/corridors', label: 'Regions & areas', icon: Map, group: 'Catalogue' },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox, group: 'Operations' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'Operations' },
];

const NAV_GROUPS = ['Workspace', 'Catalogue', 'Operations'] as const;

export function AdminShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logoutAction();
    }
  };

  return (
    <div className="flex min-h-screen bg-bg text-ink text-sm">
      {/* Sidebar (Desktop) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface shadow-[8px_0_24px_rgb(15_23_42/0.025)] md:flex">
        {/* Logo / Brand */}
        <div className="flex h-14 items-center border-b border-line px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm"><Layers3 className="h-4 w-4" /></span>
            <span>
              <span className="block text-lg font-bold leading-none tracking-tight text-ink">Estate<span className="text-accent-ink">Nav</span></span>
              <span className="mt-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Control centre</span>
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted/80">{group}</p>
              <div className="space-y-1">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href} className={`group flex min-h-[36px] items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-all ${active ? 'bg-accent text-white shadow-sm' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer / User Profile */}
        <div className="border-t border-line bg-surface-2/40 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-accent-soft text-accent-ink flex items-center justify-center font-bold text-xs">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xs text-ink-muted leading-none">Authenticated</p>
              <p className="truncate text-xs font-mono font-medium text-ink mt-0.5">{userEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary min-h-[34px] w-full text-xs flex items-center justify-center gap-1.5 text-danger hover:bg-danger/10 hover:border-danger/20"
          >
            <LogOut className="h-3.5 w-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header Bar */}
        <header className="sticky top-0 z-30 flex min-h-[56px] flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:px-6 md:h-14 md:flex-nowrap md:py-0">
          {/* Mobile nav */}
          <nav className="no-scrollbar order-2 flex w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2/50 p-1 md:order-1 md:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) ? 'bg-accent-soft text-accent-ink font-semibold' : 'text-ink-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 text-2xs text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_rgb(var(--accent)/0.12)]" />
            <span>Live catalogue workspace</span>
          </div>

          {/* Right Header Controls */}
          <div className="order-1 ml-auto flex items-center gap-3 md:order-2">
            <a
              href={process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost min-h-[36px] px-3 text-xs flex items-center gap-1.5 text-ink-muted hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Live Portal
            </a>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-6"><div className="admin-content">{children}</div></main>
      </div>
    </div>
  );
}
