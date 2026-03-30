import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { analyzeJournalistReply } from '@/lib/ai/inbox';

interface ResendInboundEvent {
  type: string;
  data: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    html: string | null;
    text: string | null;
    in_reply_to: string | null;
    headers: Array<{ name: string; value: string }>;
    created_at: string;
  };
}

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.toLowerCase().trim();
}

function isAutoReply(subject: string, headers: Array<{ name: string; value: string }>): boolean {
  const autoReplyHeaders = ['x-autoreply', 'x-autorespond', 'auto-submitted'];
  if (headers.some((h) => autoReplyHeaders.includes(h.name.toLowerCase()))) return true;
  const s = subject.toLowerCase();
  return s.includes('out of office') || s.includes('absence') || s.includes('auto:');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResendInboundEvent;
    if (body.type !== 'inbound.email') {
      return NextResponse.json({ ok: true });
    }

    const { data } = body;
    const supabase = createServiceClient();

    const fromEmail = extractEmail(data.from);
    const subject = data.subject ?? '';
    const bodyPlain = data.text ?? '';
    const bodyHtml = data.html ?? '';
    const auto = isAutoReply(subject, data.headers ?? []);

    // 1. Find journalist by email
    const { data: journalist } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, organization_id, media_outlet')
      .eq('email', fromEmail)
      .maybeSingle();

    if (!journalist) {
      // Unknown sender — ignore
      return NextResponse.json({ ok: true });
    }

    // 2. Find the matching email_send
    let emailSendId: string | null = null;
    let campaignId: string | null = null;
    let pressReleaseTitle = '';

    // Primary: parse send ID from reply+{send_id}@... address in the `to` field
    const toAddress = Array.isArray(data.to) ? data.to[0] : data.to ?? '';
    const replyPlusMatch = toAddress.match(/reply\+([a-f0-9-]{36})@/i);
    if (replyPlusMatch) {
      const { data: send } = await supabase
        .from('email_sends')
        .select('id, campaign_id, press_releases(title)')
        .eq('id', replyPlusMatch[1])
        .maybeSingle();
      if (send) {
        emailSendId = send.id;
        campaignId = send.campaign_id;
        pressReleaseTitle = (send as any).press_releases?.title ?? '';
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
        pressReleaseTitle = (send as any).press_releases?.title ?? '';
      }
    }

    if (!campaignId) {
      // Can't link to any campaign — skip
      return NextResponse.json({ ok: true });
    }

    // 3. Find or create thread
    let threadId: string;
    const { data: existingThread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('journalist_id', journalist.id)
      .maybeSingle();

    if (existingThread) {
      threadId = existingThread.id;
      // Update status to needs_response unless closed
      await supabase
        .from('email_threads')
        .update({ status: 'needs_response', updated_at: new Date().toISOString() })
        .eq('id', threadId)
        .neq('status', 'closed');
    } else {
      const { data: newThread, error } = await supabase
        .from('email_threads')
        .insert({
          campaign_id: campaignId,
          journalist_id: journalist.id,
          email_send_id: emailSendId,
          status: 'new',
        })
        .select('id')
        .single();

      if (error || !newThread) {
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
      }
      threadId = newThread.id;
    }

    // 4. Create message record
    await supabase.from('email_messages').insert({
      thread_id: threadId,
      direction: 'inbound',
      from_email: fromEmail,
      to_email: data.to?.[0] ?? null,
      subject,
      body_html: bodyHtml || null,
      body_plain: bodyPlain || null,
      is_auto_reply: auto,
    });

    // 5. AI analysis (skip for auto-replies)
    if (!auto && bodyPlain.trim()) {
      const journalistName = `${journalist.first_name} ${journalist.last_name}`;
      const analysis = await analyzeJournalistReply(
        bodyPlain,
        journalistName,
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

        // Update email_send status
        if (emailSendId) {
          await supabase
            .from('email_sends')
            .update({ status: 'clicked' }) // best available status for "replied"
            .eq('id', emailSendId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
