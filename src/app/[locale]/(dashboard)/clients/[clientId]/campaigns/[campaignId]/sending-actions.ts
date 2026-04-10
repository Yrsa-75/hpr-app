'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type SendCampaignResult = {
  success: boolean;
  error?: string;
  sent?: number;
  failed?: number;
};

export async function sendCampaignAction(
  campaignId: string,
  pressReleaseId: string
): Promise<SendCampaignResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Fetch campaign + client sender info
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, clients(name, slug, sender_name, sender_email, email_signature_html)')
    .eq('id', campaignId)
    .single();

  if (!campaign) return { success: false, error: 'Campagne introuvable' };

  const client = (campaign as any).clients;
  const fromEmail = client?.sender_email;
  const fromName = client?.sender_name ?? client?.name;

  if (!fromEmail) {
    return { success: false, error: "Email expéditeur non configuré pour ce client. Allez dans la fiche client pour le configurer." };
  }

  // Fetch press release by ID
  const { data: pr } = await supabase
    .from('press_releases')
    .select('*')
    .eq('id', pressReleaseId)
    .single();

  if (!pr) return { success: false, error: 'Communiqué introuvable' };
  if (!pr.email_subject) return { success: false, error: "Objet de l'email non renseigné dans le communiqué" };

  // Fetch queued sends with journalist info
  const { data: sends } = await supabase
    .from('email_sends')
    .select('*, journalists(first_name, last_name, email)')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  if (!sends || sends.length === 0) {
    return { success: false, error: 'Aucun journaliste ciblé' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'Clé API Resend non configurée' };

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  let sent = 0;
  let failed = 0;

  for (const send of sends) {
    const journalist = (send as any).journalists;
    if (!journalist?.email) {
      failed++;
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      continue;
    }

    const subject = send.personalized_subject ?? pr.email_subject;
    const intro = send.personalized_intro ? `<p>${send.personalized_intro}</p>` : '';
    const signature = client?.email_signature_html ?? '';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hermespressroom.com';
    const mediaPackUrl = client?.slug ? `${appUrl}/media/${client.slug}` : null;
    const mediaPackBlock = mediaPackUrl
      ? `<div class="media-pack">
           <a href="${mediaPackUrl}">⬇ Télécharger le pack média associé à ce communiqué</a>
         </div>`
      : '';

    const html = `
<!DOCTYPE html>
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
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
    .signature { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
    .media-pack { margin-top: 28px; padding: 14px 18px; background: #fafaf7; border: 1px solid #e8e0c8; border-radius: 6px; text-align: center; }
    .media-pack a { font-size: 13px; font-weight: 600; color: #b8860b; text-decoration: none; letter-spacing: 0.01em; }
  </style>
</head>
<body>
  ${intro ? `<div class="intro">${intro}</div>` : ''}
  <h1>${pr.title}</h1>
  ${pr.subtitle ? `<p class="subtitle">${pr.subtitle}</p>` : ''}
  <hr class="separator">
  <div class="body-content">${pr.body_html ?? ''}</div>
  ${mediaPackBlock}
  ${signature ? `<div class="signature">${signature}</div>` : ''}
  <div class="footer">
    Vous recevez ce communiqué de presse en tant que journaliste professionnel.
    Pour ne plus recevoir nos communiqués, répondez à cet email avec "STOP".
  </div>
</body>
</html>`;

    try {
      const inboundDomain = process.env.RESEND_INBOUND_DOMAIN ?? 'intvare.resend.app';
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
        await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
      } else {
        sent++;
        await supabase.from('email_sends').update({
          status: 'sent',
          resend_email_id: result.data?.id ?? null,
          sent_at: new Date().toISOString(),
        }).eq('id', send.id);
      }
    } catch {
      failed++;
      await supabase.from('email_sends').update({ status: 'failed' }).eq('id', send.id);
    }
  }

  // Update campaign status to 'active' if at least one email sent
  if (sent > 0) {
    await supabase.from('campaigns').update({
      status: 'active',
      total_sent: (campaign.total_sent ?? 0) + sent,
    }).eq('id', campaignId);
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true, sent, failed };
}
