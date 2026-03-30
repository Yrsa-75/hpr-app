import { createServiceClient } from '@/lib/supabase/server';
import { analyzeJournalistReply } from '@/lib/ai/inbox';

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.toLowerCase().trim();
}

function isAutoReply(subject: string): boolean {
  const s = (subject ?? '').toLowerCase();
  return s.includes('out of office') || s.includes('absence du bureau') || s.startsWith('auto:');
}

/**
 * Polls Resend for received emails and processes any not yet in the DB.
 * Called on each inbox page load.
 */
export async function processInboundEmails(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    // Fetch the 50 most recent received emails
    const { data: received, error } = await resend.emails.receiving.list();
    if (error || !received) return;

    const emails = Array.isArray(received)
      ? received
      : (received as { data?: unknown[] }).data ?? [];

    if (!emails.length) return;

    const supabase = createServiceClient();

    for (const emailMeta of emails as Array<{
      id: string;
      from: string;
      to: string | string[];
      subject: string;
      html: string | null;
      text: string | null;
      created_at: string;
    }>) {
      // Skip if already processed
      const { data: existing } = await supabase
        .from('email_messages')
        .select('id')
        .eq('resend_inbound_id', emailMeta.id)
        .maybeSingle();
      if (existing) continue;

      // Fetch full email body (list endpoint doesn't include body)
      let email = emailMeta;
      try {
        const { data: full } = await resend.emails.receiving.get(emailMeta.id);
        if (full) email = full as typeof emailMeta;
      } catch {
        // Fall back to metadata only
      }

      const fromEmail = extractEmail(email.from);
      const toAddresses = Array.isArray(email.to) ? email.to : [email.to ?? ''];
      const subject = email.subject ?? '';
      const bodyPlain = email.text ?? '';
      const bodyHtml = email.html ?? '';
      const auto = isAutoReply(subject);

      // Find journalist
      const { data: journalist } = await supabase
        .from('journalists')
        .select('id, first_name, last_name, media_outlet')
        .eq('email', fromEmail)
        .maybeSingle();
      if (!journalist) continue;

      // Find send via reply+{send_id}@ pattern in any to address
      let emailSendId: string | null = null;
      let campaignId: string | null = null;
      let pressReleaseTitle = '';

      for (const to of toAddresses) {
        const match = to.match(/reply\+([a-f0-9-]{36})@/i);
        if (match) {
          const { data: send } = await supabase
            .from('email_sends')
            .select('id, campaign_id, press_releases(title)')
            .eq('id', match[1])
            .maybeSingle();
          if (send) {
            emailSendId = send.id;
            campaignId = send.campaign_id;
            pressReleaseTitle = (send as { press_releases?: { title?: string } }).press_releases?.title ?? '';
            break;
          }
        }
      }

      // Fallback: most recent active send for this journalist
      if (!campaignId) {
        const { data: send } = await supabase
          .from('email_sends')
          .select('id, campaign_id, press_releases(title)')
          .eq('journalist_id', journalist.id)
          .in('status', ['sent', 'delivered', 'opened', 'clicked'])
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (send) {
          emailSendId = send.id;
          campaignId = send.campaign_id;
          pressReleaseTitle = (send as { press_releases?: { title?: string } }).press_releases?.title ?? '';
        }
      }

      if (!campaignId) continue;

      // Find or create thread
      let threadId: string;
      const { data: existingThread } = await supabase
        .from('email_threads')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('journalist_id', journalist.id)
        .maybeSingle();

      if (existingThread) {
        threadId = existingThread.id;
        await supabase
          .from('email_threads')
          .update({ status: 'needs_response', updated_at: new Date().toISOString() })
          .eq('id', threadId)
          .neq('status', 'closed');
      } else {
        const { data: newThread } = await supabase
          .from('email_threads')
          .insert({
            campaign_id: campaignId,
            journalist_id: journalist.id,
            email_send_id: emailSendId,
            status: 'new',
          })
          .select('id')
          .single();
        if (!newThread) continue;
        threadId = newThread.id;
      }

      // Insert message
      await supabase.from('email_messages').insert({
        thread_id: threadId,
        direction: 'inbound',
        from_email: fromEmail,
        to_email: toAddresses[0] ?? null,
        subject,
        body_html: bodyHtml || null,
        body_plain: bodyPlain || null,
        is_auto_reply: auto,
        resend_inbound_id: emailMeta.id,
        created_at: emailMeta.created_at,
      });

      // AI analysis (skip auto-replies)
      if (!auto && bodyPlain.trim()) {
        const analysis = await analyzeJournalistReply(
          bodyPlain,
          `${journalist.first_name} ${journalist.last_name}`,
          journalist.media_outlet,
          pressReleaseTitle || 'Communiqué de presse'
        );
        if (analysis) {
          await supabase
            .from('email_threads')
            .update({
              sentiment: analysis.sentiment,
              priority_score: analysis.priority_score,
              ai_suggested_response: analysis.ai_suggested_response,
              ai_response_strategy: analysis.ai_response_strategy,
              updated_at: new Date().toISOString(),
            })
            .eq('id', threadId);
        }
      }
    }
  } catch {
    // Fail silently — inbox still renders with existing data
  }
}
