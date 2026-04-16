'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { processCampaignBatch, DAILY_BATCH_LIMIT } from '@/lib/email/send-batch';

export type SendCampaignResult = {
  success: boolean;
  error?: string;
  sent?: number;
  failed?: number;
  /** Queued sends remaining after this batch (will be sent by the daily cron) */
  remaining?: number;
  lastError?: string;
};

export async function sendCampaignAction(
  campaignId: string,
  _pressReleaseId: string
): Promise<SendCampaignResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const result = await processCampaignBatch(supabase, campaignId, DAILY_BATCH_LIMIT);

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
