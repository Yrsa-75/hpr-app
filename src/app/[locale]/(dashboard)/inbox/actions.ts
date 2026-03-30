'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { analyzeJournalistReply, type ReplyAnalysis } from '@/lib/ai/inbox';
import type { EmailThreadStatus } from '@/types/database';

export async function replyToThreadAction(
  threadId: string,
  replyText: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Fetch thread + journalist + campaign + client
  const { data: thread } = await supabase
    .from('email_threads')
    .select(`
      id, campaign_id, journalist_id,
      journalists(first_name, last_name, email),
      campaigns(name, clients(sender_name, sender_email, email_signature_html))
    `)
    .eq('id', threadId)
    .single();

  if (!thread) return { success: false, error: 'Fil introuvable' };

  const journalist = (thread as any).journalists;
  const client = (thread as any).campaigns?.clients;

  if (!journalist?.email) return { success: false, error: 'Email journaliste introuvable' };
  if (!client?.sender_email) return { success: false, error: 'Email expéditeur non configuré' };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'Clé Resend non configurée' };

  const signature = client.email_signature_html ?? '';
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; }
  p { font-size: 15px; line-height: 1.75; margin: 0 0 14px; }
  .signature { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
</style></head><body>
  <p>${replyText.replace(/\n/g, '</p><p>')}</p>
  ${signature ? `<div class="signature">${signature}</div>` : ''}
</body></html>`;

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const fromName = client.sender_name ?? 'Hermès Press Room';
  const subject = `Re: ${(thread as any).campaigns?.name ?? 'Votre communiqué'}`;

  const result = await resend.emails.send({
    from: `${fromName} <${client.sender_email}>`,
    to: journalist.email,
    subject,
    html,
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  // Record outbound message
  await supabase.from('email_messages').insert({
    thread_id: threadId,
    direction: 'outbound',
    from_email: client.sender_email,
    to_email: journalist.email,
    subject,
    body_plain: replyText,
    body_html: html,
  });

  // Mark thread as responded
  await supabase
    .from('email_threads')
    .update({ status: 'responded', updated_at: new Date().toISOString() })
    .eq('id', threadId);

  revalidatePath('/[locale]/(dashboard)/inbox', 'page');
  return { success: true };
}

export async function updateThreadStatusAction(
  threadId: string,
  status: EmailThreadStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('email_threads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/inbox', 'page');
  return { success: true };
}

export async function reAnalyzeThreadAction(
  threadId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Fetch thread context + last inbound message
  const { data: thread } = await supabase
    .from('email_threads')
    .select(`
      id, campaign_id,
      journalists(first_name, last_name, media_outlet),
      campaigns(name, press_releases(title))
    `)
    .eq('id', threadId)
    .single();

  if (!thread) return { success: false, error: 'Fil introuvable' };

  const { data: messages } = await supabase
    .from('email_messages')
    .select('body_plain')
    .eq('thread_id', threadId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1);

  const lastReply = messages?.[0]?.body_plain;
  if (!lastReply) return { success: false, error: 'Aucun message entrant' };

  const journalist = (thread as any).journalists;
  const campaignContext =
    (thread as any).campaigns?.press_releases?.[0]?.title ??
    (thread as any).campaigns?.name ??
    '';

  let analysis: ReplyAnalysis | null = null;
  try {
    analysis = await analyzeJournalistReply(
      lastReply,
      `${journalist.first_name} ${journalist.last_name}`,
      journalist.media_outlet,
      campaignContext
    );
  } catch (err) {
    return { success: false, error: `Analyse IA échouée: ${String(err)}` };
  }

  if (!analysis) return { success: false, error: 'Analyse IA échouée: réponse vide' };

  const { sentiment, priority_score, ai_suggested_response, ai_response_strategy } = analysis;
  const serviceClient = createServiceClient();
  await serviceClient
    .from('email_threads')
    .update({
      sentiment,
      priority_score,
      ai_suggested_response,
      ai_response_strategy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId);

  revalidatePath('/[locale]/(dashboard)/inbox', 'page');
  return { success: true };
}
