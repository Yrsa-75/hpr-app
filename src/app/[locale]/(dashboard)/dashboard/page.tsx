import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import {
  Megaphone,
  Mail,
  TrendingUp,
  Newspaper,
  ArrowUpRight,
  Clock,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  accentColor?: string;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'text-hpr-gold',
}: KPICardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className={`text-3xl font-bold font-display tracking-tight ${accentColor}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.positive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <ArrowUpRight
                className={`h-3 w-3 ${!trend.positive ? 'rotate-90' : ''}`}
              />
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/[0.05] p-2.5">
          <Icon className={`h-5 w-5 ${accentColor}`} />
        </div>
      </div>
    </div>
  );
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  time: string;
  icon: React.ElementType;
  iconColor: string;
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
          >
            <div className={`mt-0.5 rounded-md bg-white/[0.05] p-1.5`}>
              <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {item.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {item.time}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const supabase = await createClient();

  // Fetch real data
  const [
    { count: activeCampaigns },
    { count: totalJournalists },
    { count: clippingsThisMonth },
  ] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'sending']),
    supabase
      .from('journalists')
      .select('*', { count: 'exact', head: true })
      .eq('is_opted_out', false),
    supabase
      .from('press_clippings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const kpis = [
    {
      title: t('kpi.activeCampaigns'),
      value: activeCampaigns ?? 0,
      subtitle: t('kpi.activeCampaignsSubtitle'),
      icon: Megaphone,
      accentColor: 'text-hpr-gold',
    },
    {
      title: t('kpi.emailsSentWeek'),
      value: '—',
      subtitle: t('kpi.emailsSentWeekSubtitle'),
      icon: Mail,
      accentColor: 'text-blue-400',
    },
    {
      title: t('kpi.avgOpenRate'),
      value: '—',
      subtitle: t('kpi.avgOpenRateSubtitle'),
      icon: TrendingUp,
      accentColor: 'text-green-400',
    },
    {
      title: t('kpi.clippingsMonth'),
      value: clippingsThisMonth ?? 0,
      subtitle: t('kpi.clippingsMonthSubtitle'),
      icon: Newspaper,
      accentColor: 'text-purple-400',
    },
  ];

  const recentActivity: ActivityItem[] = [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t('recentActivity')}
            </h2>
          </div>

          {recentActivity.length > 0 ? (
            <ActivityFeed items={recentActivity} />
          ) : (
            <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <Megaphone className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-display text-sm font-medium text-foreground mb-1">
                {t('noActivity')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('noActivityDescription')}
              </p>
            </div>
          )}
        </div>

        {/* Quick stats sidebar */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            {t('quickStats')}
          </h2>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('totalJournalists')}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {totalJournalists ?? 0}
              </span>
            </div>

            <div className="h-px bg-white/[0.06]" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('totalClients')}
              </span>
              <span className="text-sm font-semibold text-foreground">—</span>
            </div>

            <div className="h-px bg-white/[0.06]" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('totalCampaigns')}
              </span>
              <span className="text-sm font-semibold text-foreground">—</span>
            </div>
          </div>

          {/* Getting started card */}
          <div className="rounded-xl border border-hpr-gold/20 bg-hpr-gold/5 p-5">
            <h3 className="font-display text-sm font-semibold text-hpr-gold mb-2">
              {t('gettingStarted')}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {t('gettingStartedDescription')}
            </p>
            <div className="space-y-2">
              {[
                { step: '1', label: t('step1'), href: '/fr/clients' },
                { step: '2', label: t('step2'), href: '/fr/journalists' },
                { step: '3', label: t('step3'), href: '/fr/campaigns' },
              ].map(({ step, label, href }) => (
                <a
                  key={step}
                  href={href}
                  className="flex items-center gap-3 rounded-md p-2 text-xs hover:bg-white/5 transition-colors"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hpr-gold/20 text-hpr-gold font-bold text-[10px]">
                    {step}
                  </span>
                  <span className="text-foreground/80">{label}</span>
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
