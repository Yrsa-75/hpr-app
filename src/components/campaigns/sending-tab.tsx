'use client';

import * as React from 'react';
import { Send, AlertCircle, CheckCircle2, XCircle, Mail, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { sendCampaignAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/sending-actions';
import type { PressReleaseRow, EmailSendRow } from '@/types/database';

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
  const BATCH_LIMIT = 100;
  const [isSending, setIsSending] = React.useState(false);
  const [result, setResult] = React.useState<{ sent: number; failed: number; remaining: number } | null>(null);

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
        setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0, remaining: res.remaining ?? 0 });
        const remainingMsg = (res.remaining ?? 0) > 0
          ? ` ${res.remaining} restant${(res.remaining ?? 0) > 1 ? 's' : ''} — envoi automatique demain.`
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
      {/* Batching notice */}
      {queued.length > BATCH_LIMIT && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Envoi échelonné sur plusieurs jours</span>
            <p className="mt-0.5 text-amber-400/70">
              Votre campagne compte {queued.length} journalistes. Les {BATCH_LIMIT} premiers seront envoyés maintenant,
              les {queued.length - BATCH_LIMIT} restants seront traités automatiquement (100 par jour à 9h).
            </p>
          </div>
        </div>
      )}

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
        <EmailPreview pressRelease={pressRelease} client={client} />
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
            : queued.length > BATCH_LIMIT
            ? `Envoyer les ${BATCH_LIMIT} premiers (${queued.length} au total)`
            : `Envoyer à ${queued.length} journaliste${queued.length !== 1 ? 's' : ''}`}
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
                {result.remaining} restant{result.remaining !== 1 ? 's' : ''} — envoi automatique demain à 9h
              </p>
            )}
          </div>
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
