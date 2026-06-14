'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarContext, useSidebar } from './sidebar-context';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearTokens, getUser } from '@/lib/auth';
import { useOrganization } from '@/hooks/use-organization';
import { useMe } from '@/hooks/use-auth';
import { PlanBadge } from '@/components/plan-badge';
import type { Plan } from '@saas-platform/shared';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Organizations', href: '/organizations', icon: Building2 },
];

const SETTINGS_ITEMS = [
  { label: 'Profile', href: '/settings/profile' },
  { label: 'Billing', href: '/settings/billing' },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  organizations: 'Organizations',
  settings: 'Settings',
  billing: 'Billing',
  members: 'Members',
  profile: 'Profile',
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

function WorkspaceSwitcher() {
  const router = useRouter();
  const { currentOrg, organizations, switchOrg } = useOrganization();
  const { close: closeSidebar } = useSidebar();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!currentOrg) return null;

  const plan = ((currentOrg as unknown as { plan?: Plan }).plan ?? 'free') as Plan;

  return (
    <div ref={ref} className="relative px-3 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/[0.04] transition-colors duration-150 cursor-pointer"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold text-indigo-300 flex-shrink-0"
          style={{ background: 'rgba(55,48,163,0.6)' }}
        >
          {currentOrg.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-white truncate">{currentOrg.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PlanBadge plan={plan} />
          <ChevronDown
            size={12}
            className={cn('text-zinc-500 transition-transform duration-150', open && 'rotate-180')}
          />
        </div>
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 top-full mt-1 rounded-lg overflow-hidden z-60 py-1"
          style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                switchOrg(org.id);
                setOpen(false);
                closeSidebar();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors duration-150"
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold text-indigo-300 flex-shrink-0"
                style={{ background: 'rgba(55,48,163,0.6)' }}
              >
                {org.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-left text-zinc-300 truncate">{org.name}</span>
              {org.id === currentOrg.id && (
                <Check size={10} className="text-indigo-400 flex-shrink-0" />
              )}
            </button>
          ))}
          <div className="mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => {
                setOpen(false);
                closeSidebar();
                router.push('/organizations');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors duration-150"
            >
              <Plus size={10} />
              New organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const localUser = getUser();
  const { data: meData } = useMe();

  const displayName = meData?.name ?? localUser?.name ?? 'My Account';
  const displayEmail = meData?.email ?? localUser?.email ?? '';

  const isOnSettings = pathname.startsWith('/settings');

  const handleLogout = () => {
    clearTokens();
    router.push('/auth/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 flex flex-col z-50 transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{
        width: 240,
        background: '#111113',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: '#6366F1' }}
          >
            <Building2 size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">SaaS Platform</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-zinc-500 hover:text-white transition-colors"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Workspace Switcher */}
      <WorkspaceSwitcher />

      {/* Separator */}
      <div className="mx-3 mb-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 py-2 rounded-lg text-sm transition-all duration-150 border-l-2',
                isActive
                  ? 'text-white border-indigo-500 pl-[10px] pr-3'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent px-3 hover:bg-[rgba(255,255,255,0.04)]',
              )}
              style={isActive ? { background: 'rgba(99,102,241,0.12)' } : undefined}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Settings group */}
        <div>
          <Link
            href="/settings/profile"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2.5 py-2 rounded-lg text-sm transition-all duration-150 border-l-2',
              isOnSettings
                ? 'text-white border-indigo-500 pl-[10px] pr-3'
                : 'text-zinc-400 hover:text-zinc-200 border-transparent px-3 hover:bg-[rgba(255,255,255,0.04)]',
            )}
            style={isOnSettings ? { background: 'rgba(99,102,241,0.12)' } : undefined}
          >
            <Settings size={16} />
            Settings
            <ChevronDown
              size={12}
              className={cn(
                'ml-auto transition-transform duration-150',
                isOnSettings ? 'rotate-180' : '',
              )}
            />
          </Link>

          {isOnSettings && (
            <div className="ml-7 mt-0.5 space-y-0.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              {SETTINGS_ITEMS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'block py-1.5 px-2 text-xs rounded transition-colors duration-100',
                    pathname === href
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* User Footer */}
      <div
        className="px-3 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5 px-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-300 flex-shrink-0"
            style={{ background: 'rgba(55,48,163,0.6)' }}
          >
            {displayName[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate leading-none mb-0.5">
              {displayName}
            </p>
            <p className="text-[11px] text-zinc-500 truncate leading-none">{displayEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-red-400 transition-colors duration-150 flex-shrink-0 cursor-pointer"
            aria-label="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <header
      className="h-14 flex items-center px-6 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={onMenuClick}
        className="md:hidden mr-4 text-zinc-400 hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      <nav className="flex items-center gap-1.5 text-xs">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-700">/</span>}
            {crumb.isLast ? (
              <span className="text-white font-medium">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeSidebar = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ close: closeSidebar }}>
      <div className="min-h-screen" style={{ background: '#0A0A0B' }}>
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={closeSidebar}
          />
        )}

        <Sidebar mobileOpen={mobileOpen} onClose={closeSidebar} />

        <div className="flex flex-col min-h-screen md:ml-[240px]">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
