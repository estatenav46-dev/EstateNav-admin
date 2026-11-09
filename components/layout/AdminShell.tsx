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
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox },
  { href: '/developers', label: 'Developers', icon: Users },
  { href: '/corridors', label: 'Corridors', icon: Map },
  { href: '/settings', label: 'Settings', icon: Settings },
];

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
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <Link href="/" className="font-semibold text-base flex items-center gap-1.5">
            <span className="font-serif text-xl tracking-tight">Estate</span>
            <span className="font-serif text-xl text-accent-ink tracking-tight font-bold">Nav</span>
            <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs uppercase text-ink-muted">
              admin
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-accent-soft text-accent-ink font-semibold'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="border-t border-line p-4 space-y-3 bg-surface-2/30">
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          {/* Mobile nav */}
          <nav className="no-scrollbar flex gap-1 overflow-x-auto md:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${
                  pathname === item.href ? 'bg-accent-soft text-accent-ink font-semibold' : 'text-ink-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 text-2xs text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>Connected to Firebase Firestore & Cloudinary</span>
          </div>

          {/* Right Header Controls */}
          <div className="ml-auto flex items-center gap-3">
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
        <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}

