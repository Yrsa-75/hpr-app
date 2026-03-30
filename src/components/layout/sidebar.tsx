'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  UserSearch,
  Inbox,
  Newspaper,
  RefreshCw,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HprLogo } from '@/components/logo';

interface NavItem {
  key: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

const navItemDefs: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { key: 'clients', path: '/clients', icon: Users },
  { key: 'journalists', path: '/journalists', icon: UserSearch },
  { key: 'inbox', path: '/inbox', icon: Inbox },
  { key: 'clippings', path: '/clippings', icon: Newspaper },
  { key: 'improvements', path: '/improvements', icon: RefreshCw },
];

const bottomNavItemDefs: NavItem[] = [
  { key: 'settings', path: '/settings', icon: Settings },
];

function NavLink({
  item,
  locale,
  isActive,
}: {
  item: NavItem;
  locale: string;
  isActive: boolean;
}) {
  const t = useTranslations('nav');
  const Icon = item.icon;

  return (
    <Link
      href={`/${locale}${item.path}`}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-hpr-gold/10 text-hpr-gold border border-hpr-gold/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-hpr-gold' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />
      <span className="flex-1">{t(item.key)}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-hpr-gold text-[10px] font-bold text-black">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      {isActive && (
        <ChevronRight className="h-3 w-3 text-hpr-gold/60 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-white/[0.06] bg-background">
      {/* Logo area */}
      <div className="flex h-16 items-center px-4 border-b border-white/[0.06]">
        <HprLogo variant="full" size="sm" />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItemDefs.map((item) => {
            const href = `/${locale}${item.path}`;
            return (
              <NavLink
                key={item.key}
                item={item}
                locale={locale}
                isActive={
                  pathname === href ||
                  (item.path !== '/dashboard' && pathname.startsWith(href))
                }
              />
            );
          })}
        </div>
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="space-y-1">
          {bottomNavItemDefs.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              locale={locale}
              isActive={pathname.startsWith(`/${locale}${item.path}`)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
