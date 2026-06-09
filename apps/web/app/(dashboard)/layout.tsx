'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearTokens, getUser } from '@/lib/auth';
import { useOrganization } from '@/hooks/use-organization';
import { PlanBadge } from '@/components/plan-badge';
import type { Plan } from '@saas-platform/shared';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Settings', href: '/settings/billing', icon: Settings },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  organizations: 'Organizations',
  settings: 'Settings',
  billing: 'Billing',
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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/[0.04] transition-colors duration-150"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold text-indigo-400 flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)' }}
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
          className="absolute left-3 right-3 top-full mt-1 rounded-lg overflow-hidden z-50 py-1"
          style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                switchOrg(org.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors duration-150"
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold text-indigo-400 flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)' }}
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

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  const handleLogout = () => {
    clearTokens();
    router.push('/auth/login');
  };

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col z-40"
      style={{
        width: 240,
        background: '#111113',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: '#6366F1' }}
        >
          <Building2 size={12} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-white">SaaS Platform</span>
      </div>

      {/* Workspace Switcher */}
      <WorkspaceSwitcher />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 py-2 rounded-lg text-sm transition-all duration-150 border-l-2',
                isActive
                  ? 'text-white border-indigo-500 pl-[10px] pr-3'
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent px-3 hover:bg-[rgba(255,255,255,0.04)]',
              )}
              style={isActive ? { background: 'rgba(99,102,241,0.12)' } : undefined}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div
        className="px-3 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5 px-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-400 flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)' }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate leading-none mb-0.5">
              {user?.name ?? 'My Account'}
            </p>
            <p className="text-[11px] text-zinc-500 truncate leading-none">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-red-400 transition-colors duration-150 flex-shrink-0"
            aria-label="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const breadcrumbs = useBreadcrumbs();

  return (
    <header
      className="h-14 flex items-center px-6 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
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
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0B' }}>
      <Sidebar />
      <div style={{ marginLeft: 240 }} className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
