'use client';

import * as React from 'react';
import { Send, AlertCircle, CheckCircle2, XCircle, Mail, ChevronDown, ChevronUp, Clock, CalendarClock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  sendCampaignAction,
  scheduleCampaignSendAction,
  cancelScheduledSendAction,
} from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/sending-actions';
import type { PressReleaseRow, EmailSendRow, CampaignRow } from '@/types/database';

interface ClientInfo {
  name: string;
  slug: string | null;
  sender_name: string | null;
  sender_email: string | null;
  email_signature_html: string | null;
}

// Extended type with joined data from the page query
export interface EmailSendWithJoins extends EmailSendRow {
  journalists?: { first_name: string; last_name: string; email: string; media_outlet: string | null } | null;
  press_releases?: { title: string } | null;
  bounce_reason?: string | null;
}

interface SendingTabProps {
  campaignId: string;
  campaign: Pick<CampaignRow, 'scheduled_send_at' | 'scheduled_send_started_at'>;
  pressRelease: PressReleaseRow | null;
  emailSends: EmailSendWithJoins[];
  client: ClientInfo;
}

/** Valeur par défaut du sélecteur : demain 9h (heure locale du navigateur). */
function defaultScheduleValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocal(d);
}

/** Formate une Date pour un <input type="datetime-local"> (heure locale). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatParis(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export function SendingTab({ campaignId, campaign, pressRelease, emailSends, client }: SendingTabProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = React.useState(false);
  const [result, setResult] = React.useState<{ sent: number; failed: number; remaining: number } | null>(null);

  // Programmation de l'envoi
  const [scheduledAt, setScheduledAt] = React.useState<string | null>(
    campaign.scheduled_send_at && !campaign.scheduled_send_started_at ? campaign.scheduled_send_at : null
  );
  const [scheduleInput, setScheduleInput] = React.useState<string>(defaultScheduleValue);
  const [isScheduling, setIsScheduling] = React.useState(false);

  const handleSchedule = async () => {
    if (!canSend || !scheduleInput) return;
    const when = new Date(scheduleInput); // interprété en heure locale du navigateur
    if (Number.isNaN(when.getTime())) {
      toast({ title: 'Date invalide', variant: 'destructive' });
      return;
    }
    setIsScheduling(true);
    try {
      const res = await scheduleCampaignSendAction(campaignId, when.toISOString());
      if (res.success && res.scheduledAt) {
        setScheduledAt(res.scheduledAt);
        toast({
          title: 'Envoi programmé',
          description: `${pendingCount} email${pendingCount > 1 ? 's' : ''} partiront le ${formatParis(res.scheduledAt)} (heure de Paris).`,
        });
      } else {
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    setIsScheduling(true);
    try {
      const res = await cancelScheduledSendAction(campaignId);
      if (res.success) {
        setScheduledAt(null);
        toast({ title: 'Programmation annulée', description: 'Les contacts restent ciblés, rien ne partira.' });
      } else {
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsScheduling(false);
    }
  };

  const targeted = emailSends.filter((s) => s.status === 'targeted');
  const queued = emailSends.filter((s) => s.status === 'queued');
  const pendingCount = targeted.length + queued.length;
  const alreadySent = emailSends.filter((s) => s.status !== 'queued' && s.status !== 'targeted');

  const canSend =
    pressRelease &&
    pressRelease.email_subject &&
    pressRelease.body_html &&
    client.sender_email &&
    pendingCount > 0;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setResult(null);
    try {
      const res = await sendCampaignAction(campaignId, pressRelease!.id);
      if (res.success) {
        setScheduledAt(null); // l'envoi immédiat rend la programmation caduque
        setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0, remaining: res.remaining ?? 0 });
        const remainingMsg = (res.remaining ?? 0) > 0
          ? ` ${res.remaining} restant${(res.remaining ?? 0) > 1 ? 's' : ''}, repris automatiquement par le cron quotidien.`
          : '';
        toast({
          title: 'Envoi terminé',
          description: `${res.sent} email${(res.sent ?? 0) > 1 ? 's' : ''} envoyé${(res.sent ?? 0) > 1 ? 's' : ''}${res.failed ? `, ${res.failed} échec(s)` : ''}.${remainingMsg}${res.lastError ? ` Erreur : ${res.lastError}` : ''}`,
          variant: (res.failed ?? 0) > 0 && (res.sent ?? 0) === 0 ? 'destructive' : 'default',
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
            ok={pendingCount > 0}
            label="Journalistes ciblés"
            detail={pendingCount > 0 ? `${pendingCount} journaliste${pendingCount > 1 ? 's' : ''} prêts à l'envoi` : undefined}
            errorDetail="Sélectionnez des journalistes dans l'onglet Ciblage"
          />
        </div>
      </div>

      {/* Preview */}
      {pressRelease && (
        <EmailPreview pressRelease={pressRelease} client={client} />
      )}

      {/* Programmation */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Programmer l&apos;envoi
        </h3>

        {scheduledAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              <span className="text-hpr-gold">Envoi programmé</span> le {formatParis(scheduledAt)}{' '}
              <span className="text-muted-foreground">(heure de Paris)</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {pendingCount} journaliste{pendingCount !== 1 ? 's' : ''} recevront le communiqué automatiquement. Vous pouvez encore modifier le texte d&apos;ici là.
              </span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelSchedule}
              disabled={isScheduling}
              className="gap-1.5 text-muted-foreground hover:text-red-400"
            >
              <Ban className="h-3.5 w-3.5" />
              Annuler la programmation
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Date et heure (heure de Paris)
              <input
                type="datetime-local"
                value={scheduleInput}
                min={toDatetimeLocal(new Date())}
                onChange={(e) => setScheduleInput(e.target.value)}
                className="h-9 rounded-md border border-white/[0.1] bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-hpr-gold/50"
              />
            </label>
            <Button
              variant="outline"
              onClick={handleSchedule}
              disabled={!canSend || isScheduling || isSending || !scheduleInput}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {isScheduling ? 'Programmation...' : `Programmer pour ${pendingCount} journaliste${pendingCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="flex items-center gap-4">
        <Button
          variant="gold"
          onClick={handleSend}
          disabled={!canSend || isSending || isScheduling}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isSending
            ? 'Envoi en cours...'
            : scheduledAt
              ? `Envoyer maintenant sans attendre (${pendingCount})`
              : `Envoyer maintenant à ${pendingCount} journaliste${pendingCount !== 1 ? 's' : ''}`}
        </Button>
        {result && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>
              <span className="text-emerald-400">{result.sent} envoyé{result.sent !== 1 ? 's' : ''}</span>
              {result.failed > 0 && (
                <span className="text-red-400 ml-2">{result.failed} échec{result.failed !== 1 ? 's' : ''}</span>
              )}
            </p>
            {result.remaining > 0 && (
              <p className="flex items-center gap-1.5 text-amber-400/80">
                <Clock className="h-3 w-3" />
                {result.remaining} restant{result.remaining !== 1 ? 's' : ''} (envoi interrompu, repris automatiquement demain à 9h)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Already sent — one accordion per batch day */}
      {alreadySent.length > 0 && (
        <SendHistory sends={alreadySent} />
      )}
    </div>
  );
}

function SendHistory({ sends }: { sends: EmailSendWithJoins[] }) {
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

  // Group by date of sent_at (YYYY-MM-DD), newest first
  const groupMap = sends.reduce<Record<string, EmailSendWithJoins[]>>((acc, send) => {
    const key = send.sent_at
      ? send.sent_at.slice(0, 10)
      : 'sans-date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(send);
    return acc;
  }, {});

  const groups = Object.entries(groupMap).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        Historique des envois ({sends.length} email{sends.length > 1 ? 's' : ''})
      </h3>
      <div className="space-y-2">
        {groups.map(([dateKey, groupSends]) => {
          const isExpanded = expandedKey === dateKey;

          const label = dateKey === 'sans-date'
            ? 'Date inconnue'
            : new Date(dateKey).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              });

          const statusCounts = groupSends.reduce<Record<string, number>>((acc, s) => {
            acc[s.status] = (acc[s.status] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <div key={dateKey} className="rounded-xl border border-white/[0.08] overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground capitalize">{label}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
                  onClick={() => setExpandedKey(isExpanded ? null : dateKey)}
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
                            {j ? `${j.first_name} ${j.last_name}` : (send.journalist_id ?? send.prospect_id ?? '').slice(0, 8) + '…'}
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

function buildEmailHtml(pressRelease: PressReleaseRow, client: ClientInfo): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hermespressroom.com';
  const mediaPackUrl = client.slug ? `${appUrl}/media/${client.slug}` : null;
  const mediaPackBlock = mediaPackUrl
    ? `<div class="media-pack">
         <a href="${mediaPackUrl}">⬇ Télécharger le pack média associé à ce communiqué</a>
       </div>`
    : '';

  const signature = client.email_signature_html ?? '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; background: #ffffff; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px; line-height: 1.3; color: #111; }
    h2 { font-size: 18px; font-weight: 600; margin: 24px 0 8px; color: #111; }
    h3 { font-size: 16px; font-weight: 600; margin: 20px 0 6px; color: #222; }
    p { font-size: 15px; line-height: 1.75; margin: 0 0 14px; color: #333; }
    .subtitle { font-size: 16px; color: #555; margin: 0 0 24px; font-style: italic; }
    .separator { border: none; border-top: 2px solid #b8860b; margin: 24px 0; }
    ul, ol { padding-left: 20px; margin: 0 0 14px; }
    li { font-size: 15px; line-height: 1.75; color: #333; margin-bottom: 4px; }
    strong { font-weight: 700; color: #111; }
    em { font-style: italic; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
    .unsubscribe-btn { display: inline-block; margin-top: 8px; padding: 6px 16px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; color: #6b7280; text-decoration: none; }
    .signature { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
    .media-pack { margin-top: 28px; padding: 14px 18px; background: #fafaf7; border: 1px solid #e8e0c8; border-radius: 6px; text-align: center; }
    .media-pack a { font-size: 13px; font-weight: 600; color: #b8860b; text-decoration: none; letter-spacing: 0.01em; }
  </style>
</head>
<body>
  <h1>${pressRelease.title ?? ''}</h1>
  ${pressRelease.subtitle ? `<p class="subtitle">${pressRelease.subtitle}</p>` : ''}
  <hr class="separator">
  <div class="body-content">${pressRelease.body_html ?? ''}</div>
  ${mediaPackBlock}
  ${signature ? `<div class="signature">${signature}</div>` : ''}
  <div class="footer">
    Vous recevez ce communiqué en tant que journaliste professionnel.<br>
    <a href="#" class="unsubscribe-btn">Se désinscrire</a>
  </div>
</body>
</html>`;
}

function EmailPreview({ pressRelease, client }: { pressRelease: PressReleaseRow; client: ClientInfo }) {
  const [expanded, setExpanded] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const html = buildEmailHtml(pressRelease, client);

  function resizeIframe() {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
  }

  // Resize whenever expanded toggles — onLoad alone ne suffit pas car l'iframe est déjà chargée
  React.useEffect(() => {
    if (expanded) {
      resizeIframe();
    } else if (iframeRef.current) {
      iframeRef.current.style.height = '480px';
    }
  }, [expanded]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Aperçu de l&apos;email</h3>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Réduire' : 'Agrandir'}
        </button>
      </div>

      {/* En-tête email */}
      <div className="rounded-t-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 space-y-1">
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

      {/* Corps email en iframe */}
      <div className={`border-x border-b border-white/[0.08] rounded-b-xl overflow-hidden bg-white ${!expanded ? 'max-h-[480px]' : ''}`}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="Aperçu email"
          className="w-full border-0"
          style={{ minHeight: 200, height: 480 }}
          onLoad={resizeIframe}
          sandbox="allow-same-origin"
        />
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
