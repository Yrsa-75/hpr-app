'use client';

import * as React from 'react';
import { Printer, Sparkles, Loader2, ExternalLink, CheckCircle, TrendingUp, Mail, Eye, MousePointer, MessageSquare, Newspaper, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { generateReportSummaryAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/actions';
import type { EmailSendWithJoins } from '@/components/campaigns/sending-tab';
import type { ThreadWithJoins } from '@/components/campaigns/replies-tab';
import type { ClippingWithJoins } from '@/app/[locale]/(dashboard)/clippings/page';
import type { CampaignRow, PressReleaseRow } from '@/types/database';

interface ClientInfo {
  name: string;
  slug: string | null;
  sender_name: string | null;
  sender_email: string | null;
  email_signature_html: string | null;
}

interface ReportTabProps {
  campaign: CampaignRow;
  client: ClientInfo;
  pressRelease: PressReleaseRow | null;
  emailSends: EmailSendWithJoins[];
  threads: ThreadWithJoins[];
  clippings: ClippingWithJoins[];
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-2 print:border-gray-200 print:bg-white">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] print:bg-gray-100`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs text-muted-foreground print:text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 print:text-gray-400">{sub}</p>}
    </div>
  );
}

function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground print:text-gray-600">{label}</span>
        <span className="font-medium text-foreground print:text-gray-900">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden print:bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'Positif', neutral: 'Neutre', negative: 'Négatif', mixed: 'Mixte',
};

export function ReportTab({ campaign, client, pressRelease, emailSends, threads, clippings }: ReportTabProps) {
  const { toast } = useToast();
  const [summary, setSummary] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const sends = emailSends.filter(s => s.status !== 'queued');
  const total = sends.length;
  const delivered = sends.filter(s => ['delivered', 'opened', 'clicked'].includes(s.status)).length;
  const opened = sends.filter(s => s.opened_at != null || s.clicked_at != null).length;
  const clicked = sends.filter(s => s.clicked_at != null).length;
  const bounced = sends.filter(s => s.status === 'bounced').length;
  const failed = sends.filter(s => s.status === 'failed').length;
  const replied = threads.length;
  const verifiedClippings = clippings.filter(c => c.is_verified);

  const pct = (n: number) => total > 0 ? `${Math.round(n / total * 100)}%` : '—';

  const sentAt = sends.map(s => s.sent_at).filter(Boolean).sort();
  const firstSent = sentAt[0] ? new Date(sentAt[0]).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const lastSent = sentAt[sentAt.length - 1] ? new Date(sentAt[sentAt.length - 1]!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  const handleExportCsv = () => {
    const rows = [
      ['Prénom', 'Nom', 'Média', 'Email', 'Envoyé le', 'Ouvert le', 'Statut'],
      ...sends.map(s => {
        const j = s.journalists;
        return [
          j?.first_name ?? '',
          j?.last_name ?? '',
          j?.media_outlet ?? '',
          j?.email ?? '',
          s.sent_at ? new Date(s.sent_at).toLocaleDateString('fr-FR') : '',
          s.opened_at ? new Date(s.opened_at).toLocaleDateString('fr-FR') : '',
          s.status,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_rapport.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await generateReportSummaryAction(campaign.id);
    setIsGenerating(false);
    if (result.success && result.summary) {
      setSummary(result.summary);
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8 py-4">
      {/* Actions */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-sm font-medium text-foreground">Rapport de campagne</h2>
        <div className="flex items-center gap-2">
          {sends.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCsv}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="text-xs text-hpr-gold hover:text-hpr-gold/80 gap-1.5 border border-hpr-gold/20 hover:border-hpr-gold/40"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {summary ? 'Regénérer' : 'Analyse IA'}
          </Button>
        </div>
      </div>

      {/* Report header (visible at print) */}
      <div className="space-y-1 hidden print:block">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Hermès Press Room — Rapport de campagne</p>
        <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
        <p className="text-sm text-gray-500">Client : {client.name}{firstSent ? ` · ${firstSent}${lastSent && lastSent !== firstSent ? ` → ${lastSent}` : ''}` : ''}</p>
      </div>

      {/* Période */}
      {firstSent && (
        <p className="text-xs text-muted-foreground print:hidden">
          Envois du {firstSent}{lastSent && lastSent !== firstSent ? ` au ${lastSent}` : ''}
          {pressRelease && <span className="ml-2 text-muted-foreground/50">· {pressRelease.title}</span>}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Mail} label="Envoyés" value={total} color="text-blue-400" />
        <KpiCard icon={CheckCircle} label="Délivrés" value={delivered} sub={pct(delivered)} color="text-sky-400" />
        <KpiCard icon={Eye} label="Ouverts" value={opened} sub={pct(opened)} color="text-emerald-400" />
        <KpiCard icon={MousePointer} label="Cliqués" value={clicked} sub={pct(clicked)} color="text-hpr-gold" />
        <KpiCard icon={MessageSquare} label="Réponses" value={replied} sub={pct(replied)} color="text-violet-400" />
        <KpiCard icon={Newspaper} label="Retombées" value={verifiedClippings.length} color="text-amber-400" />
      </div>

      {bounced > 0 || failed > 0 ? (
        <div className="flex items-center gap-4 text-xs text-muted-foreground border border-white/[0.06] rounded-lg px-4 py-2.5 bg-white/[0.01]">
          {bounced > 0 && <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-400" />{bounced} bounce{bounced > 1 ? 's' : ''}</span>}
          {failed > 0 && <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-400/60" />{failed} échec{failed > 1 ? 's' : ''} d'envoi</span>}
        </div>
      ) : null}

      {/* Funnel */}
      {total > 0 && (
        <div className="border border-white/[0.08] rounded-xl p-5 space-y-4 print:border-gray-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Entonnoir de conversion</h3>
          </div>
          <div className="space-y-3">
            <FunnelBar label="Délivrés" count={delivered} total={total} color="bg-sky-400" />
            <FunnelBar label="Ouverts" count={opened} total={total} color="bg-emerald-400" />
            <FunnelBar label="Cliqués" count={clicked} total={total} color="bg-[#B8860B]" />
            <FunnelBar label="Réponses" count={replied} total={total} color="bg-violet-400" />
            <FunnelBar label="Retombées validées" count={verifiedClippings.length} total={total} color="bg-amber-400" />
          </div>
        </div>
      )}

      {/* AI Summary */}
      {summary && (
        <div className="border border-hpr-gold/20 rounded-xl p-5 space-y-3 bg-hpr-gold/[0.03] print:border-gray-200 print:bg-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-hpr-gold" />
            <h3 className="text-sm font-medium text-foreground">Analyse IA</h3>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line print:text-gray-600">
            {summary}
          </div>
        </div>
      )}

      {/* Per-journalist detail */}
      {sends.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Détail par journaliste</h3>
          <div className="rounded-xl border border-white/[0.08] overflow-hidden print:border-gray-200">
            <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs text-muted-foreground bg-white/[0.02] px-4 py-2 border-b border-white/[0.06] print:bg-gray-50 print:border-gray-200">
              <span>Journaliste</span>
              <span className="w-28 text-center">Envoyé le</span>
              <span className="w-20 text-center">Ouverture</span>
              <span className="w-20 text-center">Statut</span>
            </div>
            <div className="divide-y divide-white/[0.04] print:divide-gray-100">
              {sends.map((s) => {
                const j = s.journalists;
                const statusConfig: Record<string, { label: string; color: string }> = {
                  sent: { label: 'Envoyé', color: 'text-blue-400' },
                  delivered: { label: 'Délivré', color: 'text-sky-400' },
                  opened: { label: 'Ouvert', color: 'text-emerald-400' },
                  clicked: { label: 'Cliqué', color: 'text-hpr-gold' },
                  bounced: { label: 'Rejeté', color: 'text-red-400' },
                  complained: { label: 'Spam', color: 'text-red-400' },
                  failed: { label: 'Échec', color: 'text-red-400' },
                };
                const cfg = statusConfig[s.status] ?? statusConfig.sent;
                return (
                  <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 print:py-2">
                    <div>
                      <p className="text-xs font-medium text-foreground print:text-gray-900">
                        {j ? `${j.first_name} ${j.last_name}` : '—'}
                      </p>
                      {j?.media_outlet && <p className="text-[13px] text-muted-foreground/60 print:text-gray-400">{j.media_outlet}</p>}
                    </div>
                    <div className="w-28 text-center text-[13px] text-muted-foreground print:text-gray-500">
                      {s.sent_at ? new Date(s.sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                    </div>
                    <div className="w-20 text-center text-[13px] text-muted-foreground print:text-gray-500">
                      {s.opened_at ? new Date(s.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div className="w-20 text-center">
                      <span className={`text-[13px] font-medium ${cfg.color} print:text-gray-700`}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Clippings */}
      {verifiedClippings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Retombées presse validées</h3>
          <div className="space-y-2">
            {verifiedClippings.map((c) => (
              <div key={c.id} className="flex items-start gap-3 border border-white/[0.06] rounded-xl px-4 py-3 bg-white/[0.01] print:border-gray-200">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-hpr-gold transition-colors print:text-gray-900"
                  >
                    <span className="truncate">{c.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 print:hidden" />
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground print:text-gray-500">
                    <span className="font-medium">{c.source_name}</span>
                    {c.published_at && (
                      <><span>·</span><span>{new Date(c.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span></>
                    )}
                    {c.sentiment && (
                      <><span>·</span><span>{SENTIMENT_LABEL[c.sentiment] ?? c.sentiment}</span></>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Aucun email envoyé pour cette campagne.
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block border-t border-gray-200 pt-4 text-center">
        <p className="text-xs text-gray-400">Rapport généré via Hermès Press Room · hermespressroom.com</p>
      </div>
    </div>
  );
}
