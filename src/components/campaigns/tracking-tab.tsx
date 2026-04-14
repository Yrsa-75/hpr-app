'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Eye, MousePointer, XCircle, AlertTriangle, Clock,
  RefreshCw, Trash2, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import type { EmailSendWithJoins } from '@/components/campaigns/sending-tab';
import { deleteEmailSendsAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/actions';
import { useToast } from '@/components/ui/use-toast';

interface TrackingTabProps {
  emailSends: EmailSendWithJoins[];
  campaignId: string;
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

// ─── Per-group accordion ────────────────────────────────────────────────────

interface SendGroupProps {
  prId: string;
  sends: EmailSendWithJoins[];
  campaignId: string;
}

function SendGroup({ prId, sends, campaignId }: SendGroupProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sortCol, setSortCol] = React.useState<'sent_at' | 'opened_at' | 'status' | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const sent = sends.filter((s) => s.status !== 'queued');
  const total = sent.length;
  const prTitle = sends[0]?.press_releases?.title ?? 'Communiqué';
  const sentAt = sends.find((s) => s.sent_at)?.sent_at;

  const counts = {
    opened: sent.filter((s) => s.opened_at != null || s.clicked_at != null).length,
    clicked: sent.filter((s) => s.clicked_at != null).length,
    bounced: sent.filter((s) => s.status === 'bounced').length,
    complained: sent.filter((s) => s.status === 'complained').length,
  };

  const handleSort = (col: 'sent_at' | 'opened_at' | 'status') => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedSent = React.useMemo(() => {
    if (!sortCol) return sent;
    return [...sent].sort((a, b) => {
      let valA: string | null = null;
      let valB: string | null = null;
      if (sortCol === 'sent_at') { valA = a.sent_at; valB = b.sent_at; }
      else if (sortCol === 'opened_at') {
        valA = a.opened_at ?? (a.status === 'clicked' ? a.clicked_at : null);
        valB = b.opened_at ?? (b.status === 'clicked' ? b.clicked_at : null);
      }
      else if (sortCol === 'status') { valA = a.status; valB = b.status; }
      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sent, sortCol, sortDir]);

  const allSelected = selectedIds.size === sent.length && sent.length > 0;
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sent.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sent.map((s) => s.id)));
  };

  const handleDelete = async () => {
    if (!selectedIds.size) return;
    setIsDeleting(true);
    const result = await deleteEmailSendsAction(campaignId, Array.from(selectedIds));
    setIsDeleting(false);
    if (result.success) {
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} envoi${selectedIds.size > 1 ? 's' : ''} supprimé${selectedIds.size > 1 ? 's' : ''}` });
      router.refresh();
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    sent: { label: 'Envoyé', color: 'text-blue-400' },
    delivered: { label: 'Délivré', color: 'text-blue-400' },
    opened: { label: 'Ouvert', color: 'text-emerald-400' },
    clicked: { label: 'Cliqué', color: 'text-hpr-gold' },
    bounced: { label: 'Rejeté', color: 'text-red-400' },
    complained: { label: 'Spam', color: 'text-red-400' },
    failed: { label: 'Échec', color: 'text-red-400' },
  };

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      {/* ── Group header ── */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
        <p className="text-sm font-medium text-foreground">{prTitle}</p>
        {sentAt && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Envoyé le {new Date(sentAt).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })} · {total} destinataire{total > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Mail}         label="Envoyés"  count={total}          total={total} color="text-blue-400"    />
        <StatCard icon={Eye}          label="Ouverts"  count={counts.opened}  total={total} color="text-emerald-400" />
        <StatCard icon={MousePointer} label="Cliqués"  count={counts.clicked} total={total} color="text-hpr-gold"    />
        <StatCard icon={XCircle}      label="Bounces"  count={counts.bounced} total={total} color="text-red-400"     />
      </div>

      {/* ── Complaints warning ── */}
      {counts.complained > 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {counts.complained} signalement{counts.complained > 1 ? 's' : ''} comme spam — vérifiez votre liste de contacts.
        </div>
      )}

      {/* ── Toggle detail ── */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setIsDetailOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isDetailOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isDetailOpen ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      </div>

      {/* ── Journalist detail table ── */}
      {isDetailOpen && (
        <div className="border-t border-white/[0.06]">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Détail par journaliste</span>
            {someSelected && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-xs text-muted-foreground bg-white/[0.02] px-4 py-2 border-y border-white/[0.06] items-center gap-3">
              <div
                onClick={toggleSelectAll}
                className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                  allSelected
                    ? 'bg-red-500/80 border-red-500/80'
                    : someSelected
                    ? 'bg-red-500/30 border-red-500/50'
                    : 'border-white/20 bg-transparent hover:border-white/40'
                }`}
              >
                {(allSelected || someSelected) && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    {allSelected
                      ? <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      : <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
                  </svg>
                )}
              </div>
              <span>Journaliste</span>
              {(['sent_at', 'opened_at', 'status'] as const).map((col) => {
                const labels = { sent_at: 'Envoyé le', opened_at: 'Ouverture', status: 'Statut' };
                const widths = { sent_at: 'w-24', opened_at: 'w-32', status: 'w-20' };
                const active = sortCol === col;
                const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                return (
                  <button
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`${widths[col]} flex items-center justify-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
                  >
                    {labels[col]}
                    <Icon className="h-3 w-3 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
              {sortedSent.map((s) => {
                const j = s.journalists;
                const isSelected = selectedIds.has(s.id);
                const cfg = statusConfig[s.status] ?? statusConfig.sent;

                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-3 transition-colors gap-3 ${
                      isSelected ? 'bg-red-500/5' : 'bg-white/[0.01] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div
                      onClick={() => toggleSelect(s.id)}
                      className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                        isSelected ? 'bg-red-500/80 border-red-500/80' : 'border-white/20 bg-transparent hover:border-white/40'
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {j ? `${j.first_name} ${j.last_name}` : '—'}
                      </p>
                      {j?.media_outlet && (
                        <p className="text-[13px] text-muted-foreground/70 truncate">{j.media_outlet}</p>
                      )}
                    </div>

                    <div className="w-24 text-center">
                      {s.sent_at ? (
                        <span className="text-[13px] text-muted-foreground">
                          {new Date(s.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          {' '}
                          {new Date(s.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </div>

                    <div className="w-32 text-center">
                      {(() => {
                        const dt = s.opened_at ?? (s.status === 'clicked' ? s.clicked_at : null);
                        const isFallback = !s.opened_at && !!s.clicked_at;
                        if (!dt) return (
                          <span className="text-[13px] text-muted-foreground/40 flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" />—
                          </span>
                        );
                        return (
                          <span className={`text-[13px] flex flex-col items-center gap-0 ${isFallback ? 'text-hpr-gold/70' : 'text-emerald-400'}`}>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="text-[12px] opacity-80">
                              {new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              {isFallback && <span className="ml-0.5 opacity-60">(clic)</span>}
                            </span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="w-20 text-center">
                      <span className={`text-[13px] font-medium ${cfg.color}`}>{cfg.label}</span>
                      {s.status === 'bounced' && (s as { bounce_reason?: string | null }).bounce_reason && (
                        <p className="text-[12px] text-red-400/60 mt-0.5 leading-tight">
                          {(s as { bounce_reason?: string | null }).bounce_reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function TrackingTab({ emailSends, campaignId }: TrackingTabProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  const sent = emailSends.filter((s) => s.status !== 'queued');
  const hasPending = sent.some((s) => s.status === 'sent' || s.status === 'delivered');

  const refresh = React.useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  React.useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [hasPending, refresh]);

  // Group by press_release_id + send date (day), so two sends of the same
  // press release on different days produce separate accordions.
  const groups = React.useMemo(() => {
    const map = new Map<string, EmailSendWithJoins[]>();
    for (const s of emailSends) {
      const day = s.sent_at ? new Date(s.sent_at).toISOString().slice(0, 10) : 'pending';
      const key = `${s.press_release_id}_${day}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Sort groups by their earliest sent_at
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const dateA = a.find((s) => s.sent_at)?.sent_at ?? '';
      const dateB = b.find((s) => s.sent_at)?.sent_at ?? '';
      return dateA < dateB ? 1 : dateA > dateB ? -1 : 0;
    });
  }, [emailSends]);

  if (sent.length === 0) {
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

  return (
    <div className="space-y-4 py-4">
      {/* ── Refresh header ── */}
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

      {/* ── One accordion per send group ── */}
      {groups.map(([prId, groupSends]) => (
        <SendGroup key={prId} prId={prId} sends={groupSends} campaignId={campaignId} />
      ))}
    </div>
  );
}
