/**
 * Shared email batch sending logic.
 * Used by both the Server Action (user-triggered) and the daily cron job.
 */

export const DAILY_BATCH_LIMIT = 100;

export type BatchResult = {
  sent: number;
  failed: number;
  /** Number of queued sends still remaining after this batch */
  remaining: number;
  lastError?: string;
};

interface PressReleaseData {
  title: string | null;
  subtitle: string | null;
  body_html: string | null;
  email_subject: string | null;
}

interface BuildEmailParams {
  intro: string;
  pr: PressReleaseData;
  mediaPackBlock: string;
  signature: string;
  unsubscribeUrl: string;
}

function buildEmailHtml({ intro, pr, mediaPackBlock, signature, unsubscribeUrl }: BuildEmailParams): string {
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
    .intro { font-size: 15px; color: #444; margin-bottom: 20px; padding: 12px 16px; border-left: 3px solid #b8860b; background: #fefce8; }
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
  ${intro ? `<div class="intro">${intro}</div>` : ''}
  <h1>${pr.title ?? ''}</h1>
  ${pr.subtitle ? `<p class="subtitle">${pr.subtitle}</p>` : ''}
  <hr class="separator">
  <div class="body-content">${pr.body_html ?? ''}</div>
  ${mediaPackBlock}
  ${signature ? `<div class="signature">${signature}</div>` : ''}
  <div class="footer">
    Vous recevez ce communiqué en tant que journaliste professionnel.<br>
    <a href="${unsubscribeUrl}" class="unsubscribe-btn">Se désinscrire</a>
  </div>
</body>
</html>`;
}

/**
 * Sends up to `limit` queued emails for a campaign (FIFO order).
 * Works with any Supabase client (user session or service role).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processCampaignBatch(supabase: any, campaignId: string, limit = DAILY_BATCH_LIMIT): Promise<BatchResult> {
  // Fetch campaign + client sender info
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, clients(name, slug, sender_name, sender_email, email_signature_html)')
    .eq('id', campaignId)
    .single();

  if (!campaign) return { sent: 0, failed: 0, remaining: 0, lastError: 'Campagne introuvable' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (campaign as any).clients;
  const fromEmail = client?.sender_email;
  const fromName = client?.sender_name ?? client?.name;

  if (!fromEmail) return { sent: 0, failed: 0, remaining: 0, lastError: 'Email expéditeur non configuré' };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: 0, failed: 0, remaining: 0, lastError: 'Clé API Resend non configurée' };

  // Count total queued to compute how many will remain after this batch
  const { count: totalQueued } = await supabase
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  if (!totalQueued || totalQueued === 0) return { sent: 0, failed: 0, remaining: 0 };

  // Fetch the batch — oldest first (FIFO), joined with journalist + press_release
  const { data: sends } = await supabase
    .from('email_sends')
    .select('*, journalists(first_name, last_name, email), press_releases(title, subtitle, body_html, email_subject)')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!sends || sends.length === 0) return { sent: 0, failed: 0, remaining: 0 };

  const remaining = Math.max(0, totalQueued - sends.length);

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hermespressroom.com';
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN ?? 'intvare.resend.app';

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const send of sends) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const journalist = (send as any).journalists;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = (send as any).press_releases as PressReleaseData | null;

    if (!journalist?.email) {
      failed++;
      lastError = `Email manquant pour le journaliste (send_id: ${send.id})`;
      console.error('[HPR batch]', lastError);
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      continue;
    }

    if (!pr) {
      failed++;
      lastError = `Communiqué introuvable (send_id: ${send.id})`;
      console.error('[HPR batch]', lastError);
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      continue;
    }

    const subject = send.personalized_subject ?? pr.email_subject;
    if (!subject) {
      failed++;
      lastError = "Objet de l'email manquant";
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      continue;
    }

    const intro = send.personalized_intro ? `<p>${send.personalized_intro}</p>` : '';
    const signature = client?.email_signature_html ?? '';
    const mediaPackUrl = client?.slug ? `${appUrl}/media/${client.slug}` : null;
    const mediaPackBlock = mediaPackUrl
      ? `<div class="media-pack">
           <a href="${mediaPackUrl}">⬇ Télécharger le pack média associé à ce communiqué</a>
         </div>`
      : '';
    const unsubscribeUrl = `${appUrl}/unsubscribe?send=${send.id}`;

    const html = buildEmailHtml({ intro, pr, mediaPackBlock, signature, unsubscribeUrl });

    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: journalist.email,
        replyTo: `reply+${send.id}@${inboundDomain}`,
        subject: subject!,
        html,
        headers: {
          'X-Campaign-Id': campaignId,
          'X-Send-Id': send.id,
        },
      });

      if (result.error) {
        failed++;
        lastError = `Resend error: ${JSON.stringify(result.error)}`;
        console.error('[HPR batch] Resend error:', JSON.stringify(result.error), { to: journalist.email, from: fromEmail });
        await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      } else {
        sent++;
        await supabase.from('email_sends').update({
          status: 'sent',
          resend_email_id: result.data?.id ?? null,
          sent_at: new Date().toISOString(),
        }).eq('id', send.id);
      }
    } catch (err: unknown) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
      console.error('[HPR batch] Exception:', lastError, { to: journalist.email, from: fromEmail });
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
    }
  }

  // Update campaign status and total_sent counter
  if (sent > 0) {
    await supabase.from('campaigns').update({
      status: 'active',
      total_sent: (campaign.total_sent ?? 0) + sent,
    }).eq('id', campaignId);
  }

  return { sent, failed, remaining, lastError };
}
