'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { processCampaignBatch } from '@/lib/email/send-batch';

export type SendCampaignResult = {
  success: boolean;
  error?: string;
  sent?: number;
  failed?: number;
  /** Queued sends remaining after this batch (non-zero only if the batch was interrupted; the daily cron retries them) */
  remaining?: number;
  lastError?: string;
};

export type ScheduleSendResult = {
  success: boolean;
  error?: string;
  scheduledAt?: string;
};

/**
 * Programme l'envoi de la campagne à une date/heure (ISO 8601, UTC).
 * Les contacts restent "targeted" jusqu'au déclenchement : c'est le mode
 * `scheduled` de /api/cron/batch-sender (pg_cron toutes les 5 min) qui les
 * passe en file et envoie. Le cron quotidien de 9h sert de filet de sécurité.
 */
export async function scheduleCampaignSendAction(
  campaignId: string,
  scheduledAtIso: string
): Promise<ScheduleSendResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime())) {
    return { success: false, error: 'Date invalide' };
  }
  if (when.getTime() < Date.now() + 2 * 60 * 1000) {
    return { success: false, error: "L'heure choisie doit être dans au moins 2 minutes" };
  }
  if (when.getTime() > Date.now() + 90 * 24 * 3600 * 1000) {
    return { success: false, error: 'La programmation est limitée à 90 jours' };
  }

  const { count: pending } = await supabase
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('status', ['targeted', 'queued']);

  if (!pending || pending === 0) {
    return { success: false, error: 'Aucun journaliste ciblé' };
  }

  const { error } = await supabase
    .from('campaigns')
    .update({
      scheduled_send_at: when.toISOString(),
      scheduled_send_started_at: null,
      status: 'approved',
    })
    .eq('id', campaignId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true, scheduledAt: when.toISOString() };
}

/** Annule une programmation non encore déclenchée. */
export async function cancelScheduledSendAction(campaignId: string): Promise<ScheduleSendResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('campaigns')
    .update({ scheduled_send_at: null, status: 'draft' })
    .eq('id', campaignId)
    .is('scheduled_send_started_at', null)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: "L'envoi a déjà démarré, impossible d'annuler" };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true };
}

export async function sendCampaignAction(
  campaignId: string,
  _pressReleaseId: string
): Promise<SendCampaignResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Envoi immédiat : une éventuelle programmation en attente devient caduque
  await supabase
    .from('campaigns')
    .update({ scheduled_send_at: null })
    .eq('id', campaignId)
    .is('scheduled_send_started_at', null);

  // Passer tous les envois "ciblés" en "queued" — seul ce bouton déclenche les envois
  await supabase
    .from('email_sends')
    .update({ status: 'queued' })
    .eq('campaign_id', campaignId)
    .eq('status', 'targeted');

  const result = await processCampaignBatch(supabase, campaignId);

  if (result.sent === 0 && result.failed === 0 && !result.lastError) {
    return { success: false, error: 'Aucun journaliste ciblé' };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return {
    success: true,
    sent: result.sent,
    failed: result.failed,
    remaining: result.remaining,
    lastError: result.lastError,
  };
}
