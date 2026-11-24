'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, Building2, ExternalLink, Inbox, LayoutDashboard, LogOut, Map, Newspaper, Settings, Users } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { href: '/properties', label: 'Properties', icon: Building2, group: 'Catalogue' },
  { href: '/developers', label: 'Partners', icon: Users, group: 'Catalogue' },
  { href: '/partner-logos', label: 'Channel partner logos', icon: BadgeCheck, group: 'Catalogue' },
  { href: '/corridors', label: 'Regions & areas', icon: Map, group: 'Catalogue' },
  { href: '/blogs', label: 'Blog', icon: Newspaper, group: 'Content' },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox, group: 'Operations' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'Operations' },
];

const NAV_GROUPS = ['Workspace', 'Catalogue', 'Content', 'Operations'] as const;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://estatenav.in';

const isActive = (href: string, pathname: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export function AdminShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActive(item.href, pathname));

  const handleLogout = async () => {
    if (confirm('Log out of the EstateNav admin?')) {
      await logoutAction();
    }
  };

  return (
    <div className="flex min-h-screen bg-bg text-sm text-ink">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="EstateNav admin overview">
            <span className="relative h-9 w-9 overflow-hidden rounded-full border border-line bg-surface">
              <Image src="/logo.png" alt="" fill sizes="36px" className="object-cover" priority />
            </span>
            <span className="leading-tight">
              <span className="block text-[1.05rem] font-bold tracking-tight text-ink">EstateNav</span>
              <span className="block text-xs text-ink-muted">Admin</span>
            </span>
          </Link>
        </div>

        <nav aria-label="Admin sections" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 pb-1.5 text-xs font-medium text-ink-muted/80">{group}</p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors ${
                        active ? 'bg-accent-soft font-semibold text-accent-ink' : 'font-medium text-ink-muted hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" />}
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.8} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold uppercase text-accent-ink">{userEmail.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">Signed in as</p>
              <p className="truncate text-xs font-medium text-ink" title={userEmail}>{userEmail}</p>
            </div>
            <button type="button" onClick={handleLogout} className="icon-btn hover:!bg-danger/10 hover:!text-danger" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main body */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-line md:hidden" aria-label="EstateNav admin overview">
              <Image src="/logo.png" alt="" fill sizes="32px" className="object-cover" />
            </Link>
            <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
              <span className="hidden sm:inline">EstateNav admin</span>
              {current && (
                <>
                  <span aria-hidden="true" className="mx-2 hidden text-line-strong sm:inline">/</span>
                  <span className="font-semibold text-ink">{current.label}</span>
                </>
              )}
            </p>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-[36px] px-3 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View website</span><span className="sm:hidden">Website</span>
            </a>
            <button type="button" onClick={handleLogout} className="icon-btn md:hidden" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav aria-label="Admin sections" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-2 md:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${active ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink-muted'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:py-7">
          <div className="admin-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
