/**
 * Alerte "un journaliste a répondu" (brief RP 2026-07-09 §6f).
 * L'heure de réaction compte : toute réponse doit être traitée dans l'heure.
 *
 * Pour chaque utilisateur de l'organisation dont la préférence
 * `journalist_replied` n'est pas désactivée :
 * - crée une notification in-app (cloche du header)
 * - envoie un email d'alerte immédiat via Resend
 *
 * L'expéditeur de l'alerte : ALERT_FROM_EMAIL si défini, sinon l'expéditeur
 * du client de la campagne (domaine déjà vérifié dans Resend).
 */

export interface ReplyAlertParams {
  organizationId: string | null;
  campaignId: string;
  threadId: string;
  journalistName: string;
  journalistMediaOutlet: string | null;
  replySubject: string;
  replyExcerpt: string;
  sentiment: string | null;
  clientSenderEmail: string | null;
  clientSenderName: string | null;
  campaignName: string | null;
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: '🟢 Positif',
  interested: '🟢 Intéressé',
  neutral: '⚪ Neutre',
  negative: '🔴 Négatif',
  not_interested: '🔴 Pas intéressé',
};

function buildAlertHtml(params: ReplyAlertParams, inboxUrl: string): string {
  const sentimentLabel = params.sentiment ? (SENTIMENT_LABELS[params.sentiment] ?? params.sentiment) : null;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p style="font-size: 16px; margin: 0 0 4px;"><strong>${params.journalistName}</strong>${params.journalistMediaOutlet ? ` (${params.journalistMediaOutlet})` : ''} vient de répondre.</p>
  <p style="font-size: 13px; color: #666; margin: 0 0 16px;">Campagne : ${params.campaignName ?? '—'}${sentimentLabel ? ` · Sentiment : ${sentimentLabel}` : ''}</p>
  <div style="border-left: 3px solid #b8860b; background: #fefce8; padding: 12px 16px; margin: 0 0 20px;">
    <p style="font-size: 13px; color: #888; margin: 0 0 6px;">${params.replySubject}</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #333;">${params.replyExcerpt}</p>
  </div>
  <a href="${inboxUrl}" style="display: inline-block; background: #b8860b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">Répondre depuis la boîte de réception</a>
  <p style="font-size: 12px; color: #999; margin-top: 24px;">Le premier arrivé sur une réponse chaude gagne l'article — visez une réponse dans l'heure.</p>
</body>
</html>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyJournalistReply(supabase: any, params: ReplyAlertParams): Promise<void> {
  try {
    // Utilisateurs de l'organisation à alerter
    let query = supabase.from('users').select('id, email, full_name, preferences');
    if (params.organizationId) {
      query = query.eq('organization_id', params.organizationId);
    }
    const { data: users } = await query;
    if (!users || users.length === 0) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hermespressroom.com';
    const inboxUrl = `${appUrl}/inbox`;

    const title = `${params.journalistName} a répondu`;
    const message = `${params.journalistMediaOutlet ? `${params.journalistMediaOutlet} — ` : ''}${params.replyExcerpt.slice(0, 140)}`;

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const alertFrom = process.env.ALERT_FROM_EMAIL
      ?? (params.clientSenderEmail ? `HPR Alertes <${params.clientSenderEmail}>` : null);

    for (const user of users) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefs = ((user.preferences as any)?.notifications ?? {}) as Record<string, boolean>;
      if (prefs.journalist_replied === false) continue;

      // 1. Notification in-app (cloche du header)
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'journalist_replied',
        title,
        message,
        data: {
          thread_id: params.threadId,
          campaign_id: params.campaignId,
        },
        is_read: false,
      });

      // 2. Email d'alerte immédiat
      if (apiKey && alertFrom && user.email) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(apiKey);
          await resend.emails.send({
            from: alertFrom,
            to: user.email,
            subject: `🔔 ${params.journalistName}${params.journalistMediaOutlet ? ` (${params.journalistMediaOutlet})` : ''} a répondu`,
            html: buildAlertHtml(params, inboxUrl),
          });
        } catch (err) {
          // L'échec de l'email ne doit pas casser le webhook
          console.error('[reply-alert] Échec envoi email alerte:', err);
        }
      }
    }
  } catch (err) {
    console.error('[reply-alert] Erreur:', err);
  }
}
