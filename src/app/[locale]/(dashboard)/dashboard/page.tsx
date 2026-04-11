import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import {
  Megaphone,
  Mail,
  TrendingUp,
  MessageSquare,
  ArrowUpRight,
  Clock,
  Users,
  LayoutGrid,
  MailOpen,
  Send,
} from 'lucide-react';
import { PeriodSelector } from '@/components/dashboard/period-selector';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accentColor?: string;
}

function KPICard({ title, value, subtitle, icon: Icon, accentColor = 'text-hpr-gold' }: KPICardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className={`text-3xl font-bold font-display tracking-tight ${accentColor}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-white/[0.05] p-2.5">
          <Icon className={`h-5 w-5 ${accentColor}`} />
        </div>
      </div>
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const PERIOD_LABELS: Record<string, string> = {
  '24h': '24 dernières heures',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  'all': 'Depuis le début',
};

function getPeriodStart(period: string): string | null {
  if (period === 'all') return null;
  const ms = period === '24h' ? 24 * 3600 * 1000 : period === '7d' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const t = await getTranslations('dashboard');
  const supabase = await createClient();
  const { period: rawPeriod } = await searchParams;
  const period = ['24h', '7d', '30d', 'all'].includes(rawPeriod ?? '') ? (rawPeriod ?? '7d') : '7d';
  const periodStart = getPeriodStart(period);

  const [
    { count: activeCampaigns },
    { count: emailsInPeriod },
    { count: totalJournalists },
    { count: totalClients },
    { count: totalCampaigns },
    { count: pendingReplies },
    { data: sendStats },
    { data: recentThreads },
    { data: recentSends },
  ] = await Promise.all([
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).in('status', ['active', 'sending']),
    periodStart
      ? supabase.from('email_sends').select('*', { count: 'exact', head: true }).gte('sent_at', periodStart)
      : supabase.from('email_sends').select('*', { count: 'exact', head: true }),
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('email_threads').select('*', { count: 'exact', head: true }).in('status', ['new', 'needs_response']),
    // Open rate for selected period
    periodStart
      ? supabase.from('email_sends').select('status').gte('sent_at', periodStart)
      : supabase.from('email_sends').select('status'),
    // Recent journalist replies
    supabase
      .from('email_threads')
      .select('id, updated_at, status, journalists(first_name, last_name, media_outlet), campaigns(name, clients(name))')
      .in('status', ['new', 'needs_response', 'responded'])
      .order('updated_at', { ascending: false })
      .limit(4),
    // Recent sends
    supabase
      .from('email_sends')
      .select('id, sent_at, status, journalists(first_name, last_name), campaigns(name, clients(name))')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(4),
  ]);

  const totalSent = sendStats?.length ?? 0;
  const totalOpened = sendStats?.filter((s) => ['opened', 'clicked'].includes(s.status)).length ?? 0;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : null;
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Campagnes actives"
          value={activeCampaigns ?? 0}
          subtitle="En cours d'envoi"
          icon={Megaphone}
          accentColor="text-hpr-gold"
        />
        <KPICard
          title="Emails envoyés"
          value={emailsInPeriod ?? 0}
          subtitle={periodLabel}
          icon={Mail}
          accentColor="text-blue-400"
        />
        <KPICard
          title="Taux d'ouverture"
          value={openRate !== null ? `${openRate}%` : '—'}
          subtitle={periodLabel}
          icon={TrendingUp}
          accentColor="text-emerald-400"
        />
        <KPICard
          title="Réponses en attente"
          value={pendingReplies ?? 0}
          subtitle="À traiter dans l'inbox"
          icon={MessageSquare}
          accentColor="text-amber-400"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity feed */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-display text-base font-semibold text-foreground">Activité récente</h2>

          <div className="space-y-2">
            {/* Recent replies */}
            {(recentThreads ?? []).map((thread) => {
              const j = (thread.journalists as unknown) as { first_name: string; last_name: string; media_outlet: string | null } | null;
              const campaign = (thread.campaigns as unknown) as { name: string; clients: { name: string } | null } | null;
              const isNew = thread.status === 'new' || thread.status === 'needs_response';
              return (
                <div key={thread.id} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                  <div className="mt-0.5 rounded-md bg-amber-500/10 p-1.5">
                    <MailOpen className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {j ? `${j.first_name} ${j.last_name}` : '—'}
                      {j?.media_outlet && <span className="text-muted-foreground font-normal"> · {j.media_outlet}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {isNew ? 'Réponse en attente' : 'Répondu'} · {campaign?.name ?? ''}
                      {campaign?.clients?.name && ` · ${campaign.clients.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatRelative(thread.updated_at)}
                  </div>
                </div>
              );
            })}

            {/* Recent sends */}
            {(recentSends ?? []).map((send) => {
              const j = (send.journalists as unknown) as { first_name: string; last_name: string } | null;
              const campaign = (send.campaigns as unknown) as { name: string; clients: { name: string } | null } | null;
              return (
                <div key={send.id} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                  <div className="mt-0.5 rounded-md bg-blue-500/10 p-1.5">
                    <Send className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Email envoyé à {j ? `${j.first_name} ${j.last_name}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {campaign?.name ?? ''}
                      {campaign?.clients?.name && ` · ${campaign.clients.name}`}
                      {' · '}<span className="capitalize">{send.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {send.sent_at ? formatRelative(send.sent_at) : '—'}
                  </div>
                </div>
              );
            })}

            {!recentThreads?.length && !recentSends?.length && (
              <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <Megaphone className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-sm font-medium text-foreground mb-1">{t('noActivity')}</h3>
                <p className="text-xs text-muted-foreground">{t('noActivityDescription')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold text-foreground">{t('quickStats')}</h2>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Journalistes
              </div>
              <span className="text-sm font-semibold text-foreground">{totalJournalists ?? 0}</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                Clients
              </div>
              <span className="text-sm font-semibold text-foreground">{totalClients ?? 0}</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5" />
                Campagnes totales
              </div>
              <span className="text-sm font-semibold text-foreground">{totalCampaigns ?? 0}</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Emails ce mois
              </div>
              <span className="text-sm font-semibold text-foreground">{totalSent}</span>
            </div>
          </div>

          {/* Link to inbox if pending replies */}
          {(pendingReplies ?? 0) > 0 && (
            <a
              href="/fr/inbox"
              className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 hover:bg-amber-500/10 transition-colors group"
            >
              <div>
                <p className="text-sm font-semibold text-amber-400">
                  {pendingReplies} réponse{(pendingReplies ?? 0) > 1 ? 's' : ''} en attente
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Traiter dans la boîte de réception</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
