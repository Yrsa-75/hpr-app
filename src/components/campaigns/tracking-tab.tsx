'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Eye, MousePointer, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import type { EmailSendWithJoins } from '@/components/campaigns/sending-tab';

interface TrackingTabProps {
  emailSends: EmailSendWithJoins[];
}

function StatCard({
  icon: Icon,
  label,
  count,
  total,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const rate = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className={`text-2xl font-bold font-display ${color}`}>{count}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Taux</span>
          <span className="font-medium text-foreground">{rate}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TrackingTab({ emailSends }: TrackingTabProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  const sent = emailSends.filter((s) => s.status !== 'queued');
  const total = sent.length;

  // Has any email that hasn't been opened yet (could receive an open event)
  const hasPending = sent.some((s) => s.status === 'sent' || s.status === 'delivered');

  const refresh = React.useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  // Auto-refresh every 30s while there are pending (sent/delivered) emails
  React.useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [hasPending, refresh]);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Mail className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-sm font-medium text-foreground mb-1">Aucun envoi encore</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Les statistiques de suivi apparaîtront ici une fois les emails envoyés.
        </p>
      </div>
    );
  }

  const counts = {
    delivered: sent.filter((s) => ['delivered', 'opened', 'clicked'].includes(s.status)).length,
    opened: sent.filter((s) => ['opened', 'clicked'].includes(s.status)).length,
    clicked: sent.filter((s) => s.status === 'clicked').length,
    bounced: sent.filter((s) => s.status === 'bounced').length,
    complained: sent.filter((s) => s.status === 'complained').length,
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Mis à jour à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {hasPending && <span className="ml-1 text-hpr-gold/70">· actualisation auto toutes les 30s</span>}
        </p>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Mail} label="Envoyés" count={total} total={total} color="text-blue-400" />
        <StatCard icon={Eye} label="Ouverts" count={counts.opened} total={total} color="text-emerald-400" />
        <StatCard icon={MousePointer} label="Cliqués" count={counts.clicked} total={total} color="text-hpr-gold" />
        <StatCard icon={XCircle} label="Bounces" count={counts.bounced} total={total} color="text-red-400" />
      </div>

      {counts.complained > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {counts.complained} signalement{counts.complained > 1 ? 's' : ''} comme spam — vérifiez votre liste de contacts.
        </div>
      )}

      {/* Per-journalist table */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Détail par journaliste</h3>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs text-muted-foreground bg-white/[0.02] px-4 py-2 border-b border-white/[0.06]">
            <span>Journaliste</span>
            <span className="w-24 text-center">Envoyé le</span>
            <span className="w-20 text-center">Ouverture</span>
            <span className="w-20 text-center">Statut</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {sent.map((s) => {
              const j = s.journalists;
              const statusConfig: Record<string, { label: string; color: string }> = {
                sent: { label: 'Envoyé', color: 'text-blue-400' },
                delivered: { label: 'Délivré', color: 'text-blue-400' },
                opened: { label: 'Ouvert', color: 'text-emerald-400' },
                clicked: { label: 'Cliqué', color: 'text-hpr-gold' },
                bounced: { label: 'Rejeté', color: 'text-red-400' },
                complained: { label: 'Spam', color: 'text-red-400' },
                failed: { label: 'Échec', color: 'text-red-400' },
              };
              const cfg = statusConfig[s.status] ?? statusConfig.sent;

              return (
                <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {j ? `${j.first_name} ${j.last_name}` : '—'}
                    </p>
                    {j?.media_outlet && (
                      <p className="text-[11px] text-muted-foreground/70 truncate">{j.media_outlet}</p>
                    )}
                  </div>
                  <div className="w-24 text-center">
                    {s.sent_at ? (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(s.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        {' '}
                        {new Date(s.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </div>
                  <div className="w-20 text-center">
                    {s.opened_at ? (
                      <span className="text-[11px] text-emerald-400 flex items-center justify-center gap-1">
                        <Eye className="h-3 w-3" />
                        {new Date(s.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/40 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        —
                      </span>
                    )}
                  </div>
                  <div className="w-20 text-center">
                    <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
