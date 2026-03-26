'use client';

import { useTranslations } from 'next-intl';
import { Bell, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/app/[locale]/(auth)/actions';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  user?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  const t = useTranslations('nav');

  const displayName = user?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.06] bg-background px-6">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder={t('search')}
            className="w-full h-9 rounded-md border border-white/10 bg-white/5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-hpr-gold/50 focus:border-hpr-gold/30 transition-colors"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-hpr-gold" />
          <span className="sr-only">{t('notifications')}</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 hover:bg-white/5"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-hpr-gold/20 text-hpr-gold text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground/80 hidden sm:block">
                {user?.full_name || user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/fr/settings">{t('profile')}</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/fr/settings">{t('settings')}</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400 cursor-pointer"
              onSelect={async () => {
                await signOut();
              }}
            >
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
