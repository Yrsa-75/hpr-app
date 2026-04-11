'use client';

import { useTranslations } from 'next-intl';
import { Bell, Search, CheckCheck, Megaphone, FileText, Star, AlertCircle, Info } from 'lucide-react';
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
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/[locale]/(dashboard)/notifications/actions';
import { getInitials } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

interface HeaderProps {
  user?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  notifications?: Notification[];
}

function notificationIcon(type: string) {
  switch (type) {
    case 'journalist_replied': return <Megaphone className="h-3.5 w-3.5 text-hpr-gold" />;
    case 'article_published': return <Star className="h-3.5 w-3.5 text-green-400" />;
    case 'campaign_milestone': return <FileText className="h-3.5 w-3.5 text-blue-400" />;
    case 'system_alert': return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    default: return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function Header({ user, notifications = [] }: HeaderProps) {
  const t = useTranslations('nav');

  const displayName = user?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-hpr-gold" />
              )}
              <span className="sr-only">{t('notifications')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-[11px] bg-hpr-gold/20 text-hpr-gold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsReadAction()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-6 w-6 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Aucune notification</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.is_read) markNotificationReadAction(notif.id);
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-border/50 last:border-0 ${
                      !notif.is_read ? 'bg-hpr-gold/[0.04]' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5">
                      {notificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-tight ${notif.is_read ? 'text-foreground/70' : 'text-foreground'}`}>
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {timeAgo(notif.created_at)}
                      </span>
                      {!notif.is_read && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-hpr-gold shrink-0" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
