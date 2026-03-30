'use client';

import * as React from 'react';
import { Send, AlertCircle, CheckCircle2, XCircle, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { sendCampaignAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/sending-actions';
import type { PressReleaseRow, EmailSendRow } from '@/types/database';

interface ClientInfo {
  name: string;
  sender_name: string | null;
  sender_email: string | null;
}

// Extended type with joined data from the page query
export interface EmailSendWithJoins extends EmailSendRow {
  journalists?: { first_name: string; last_name: string; email: string; media_outlet: string | null } | null;
  press_releases?: { title: string } | null;
}

interface SendingTabProps {
  campaignId: string;
  pressRelease: PressReleaseRow | null;
  emailSends: EmailSendWithJoins[];
  client: ClientInfo;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued: { label: 'En attente', color: 'text-muted-foreground' },
  sent: { label: 'Envoyé', color: 'text-blue-400' },
  delivered: { label: 'Délivré', color: 'text-blue-400' },
  opened: { label: 'Ouvert', color: 'text-emerald-400' },
  clicked: { label: 'Cliqué', color: 'text-hpr-gold' },
  bounced: { label: 'Rejeté', color: 'text-red-400' },
  complained: { label: 'Spam', color: 'text-red-400' },
  failed: { label: 'Échec', color: 'text-red-400' },
};

export function SendingTab({ campaignId, pressRelease, emailSends, client }: SendingTabProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = React.useState(false);
  const [result, setResult] = React.useState<{ sent: number; failed: number } | null>(null);

  const queued = emailSends.filter((s) => s.status === 'queued');
  const alreadySent = emailSends.filter((s) => s.status !== 'queued');

  const canSend =
    pressRelease &&
    pressRelease.email_subject &&
    pressRelease.body_html &&
    client.sender_email &&
    queued.length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setResult(null);
    try {
      const res = await sendCampaignAction(campaignId, pressRelease!.id);
      if (res.success) {
        setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 });
        toast({
          title: 'Envoi terminé',
          description: `${res.sent} email${(res.sent ?? 0) > 1 ? 's' : ''} envoyé${(res.sent ?? 0) > 1 ? 's' : ''}${res.failed ? `, ${res.failed} échec(s)` : ''}.`,
        });
      } else {
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Vérification avant envoi</h3>
        <div className="space-y-1.5">
          <CheckItem
            ok={!!pressRelease}
            label="Communiqué enregistré"
            detail={pressRelease?.title}
          />
          <CheckItem
            ok={!!pressRelease?.email_subject}
            label="Objet de l'email renseigné"
            detail={pressRelease?.email_subject ?? undefined}
          />
          <CheckItem
            ok={!!client.sender_email}
            label="Email expéditeur configuré"
            detail={client.sender_email ? `${client.sender_name ?? client.name} <${client.sender_email}>` : undefined}
            errorDetail="Configurez l'email expéditeur dans la fiche client"
          />
          <CheckItem
            ok={queued.length > 0}
            label="Journalistes ciblés"
            detail={queued.length > 0 ? `${queued.length} journaliste${queued.length > 1 ? 's' : ''} en attente d'envoi` : undefined}
            errorDetail="Sélectionnez des journalistes dans l'onglet Ciblage"
          />
        </div>
      </div>

      {/* Preview */}
      {pressRelease && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Aperçu de l&apos;email</h3>
          <div className="border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="bg-white/[0.03] px-4 py-3 border-b border-white/[0.06] space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-14 flex-shrink-0">De :</span>
                <span className="text-foreground">
                  {client.sender_email
                    ? `${client.sender_name ?? client.name} <${client.sender_email}>`
                    : <span className="text-red-400">Non configuré</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-14 flex-shrink-0">Objet :</span>
                <span className="text-foreground font-medium">
                  {pressRelease.email_subject ?? <span className="text-amber-400">Non renseigné</span>}
                </span>
              </div>
              {pressRelease.email_preview_text && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-14 flex-shrink-0">Preview :</span>
                  <span className="text-muted-foreground/70 truncate">{pressRelease.email_preview_text}</span>
                </div>
              )}
            </div>
            {pressRelease.body_html && (
              <div
                className="p-4 text-xs text-muted-foreground max-h-48 overflow-y-auto prose prose-invert prose-xs"
                dangerouslySetInnerHTML={{
                  __html: pressRelease.body_html.slice(0, 1000) + (pressRelease.body_html.length > 1000 ? '...' : ''),
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center gap-4">
        <Button
          variant="gold"
          onClick={handleSend}
          disabled={!canSend || isSending}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isSending
            ? 'Envoi en cours...'
            : `Envoyer à ${queued.length} journaliste${queued.length !== 1 ? 's' : ''}`}
        </Button>
        {result && (
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-400">{result.sent} envoyé{result.sent !== 1 ? 's' : ''}</span>
            {result.failed > 0 && (
              <span className="text-red-400 ml-2">{result.failed} échec{result.failed !== 1 ? 's' : ''}</span>
            )}
          </p>
        )}
      </div>

      {/* Already sent — grouped by press release */}
      {alreadySent.length > 0 && (
        <SendHistory sends={alreadySent} />
      )}
    </div>
  );
}

function SendHistory({ sends }: { sends: EmailSendWithJoins[] }) {
  const [expandedPr, setExpandedPr] = React.useState<string | null>(null);

  // Group by press_release_id
  const groups = sends.reduce<Record<string, EmailSendWithJoins[]>>((acc, send) => {
    const key = send.press_release_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(send);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        Historique des envois ({sends.length} email{sends.length > 1 ? 's' : ''})
      </h3>
      <div className="space-y-2">
        {Object.entries(groups).map(([prId, groupSends]) => {
          const firstSend = groupSends[0];
          const prTitle = firstSend.press_releases?.title ?? 'Communiqué';
          const sentAt = groupSends.find(s => s.sent_at)?.sent_at;
          const isExpanded = expandedPr === prId;

          const statusCounts = groupSends.reduce<Record<string, number>>((acc, s) => {
            acc[s.status] = (acc[s.status] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <div key={prId} className="rounded-xl border border-white/[0.08] overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{prTitle}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {sentAt && (
                      <span className="text-xs text-muted-foreground/70">
                        {new Date(sentAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent;
                        return (
                          <span key={status} className={cfg.color}>
                            {count} {cfg.label.toLowerCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedPr(isExpanded ? null : prId)}
                  className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {groupSends.length} journaliste{groupSends.length > 1 ? 's' : ''}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Journalist list (expandable) */}
              {isExpanded && (
                <div className="divide-y divide-white/[0.04] border-t border-white/[0.06]">
                  {groupSends.map((send) => {
                    const cfg = STATUS_CONFIG[send.status] ?? STATUS_CONFIG.sent;
                    const j = send.journalists;
                    return (
                      <div key={send.id} className="flex items-center justify-between px-4 py-2.5 bg-white/[0.01]">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-foreground">
                            {j ? `${j.first_name} ${j.last_name}` : send.journalist_id.slice(0, 8) + '…'}
                          </span>
                          {j?.media_outlet && (
                            <span className="ml-2 text-xs text-muted-foreground">{j.media_outlet}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-shrink-0">
                          {send.sent_at && (
                            <span className="text-muted-foreground/60">
                              {new Date(send.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span className={cfg.color}>{cfg.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckItem({
  ok,
  label,
  detail,
  errorDetail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
  errorDetail?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
        {ok && detail && <span className="ml-1.5 text-muted-foreground/70">— {detail}</span>}
        {!ok && errorDetail && (
          <div className="flex items-center gap-1 mt-0.5 text-amber-400/80">
            <AlertCircle className="h-3 w-3" />
            {errorDetail}
          </div>
        )}
      </div>
    </div>
  );
}
