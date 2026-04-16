/**
 * Cron: Email Batch Sender
 * Reprend les envois en attente (status='queued') pour toutes les campagnes actives.
 * Limite à 100 emails par campagne par run (contrainte Resend plan gratuit).
 * Planifié tous les jours à 9h dans vercel.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processCampaignBatch, DAILY_BATCH_LIMIT } from '@/lib/email/send-batch';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Trouver toutes les campagnes avec des envois en attente
  const { data: queuedSends, error } = await supabase
    .from('email_sends')
    .select('campaign_id')
    .eq('status', 'queued');

  if (error) {
    console.error('[batch-sender] Erreur lecture email_sends:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!queuedSends || queuedSends.length === 0) {
    console.log('[batch-sender] Aucun envoi en attente.');
    return NextResponse.json({ message: 'Aucun envoi en attente', processed: 0 });
  }

  // Dédupliquer les campaign_id
  const campaignIds = [...new Set(queuedSends.map((s) => s.campaign_id as string))];

  console.log(`[batch-sender] ${campaignIds.length} campagne(s) avec envois en attente.`);

  const results: Record<string, { sent: number; failed: number; remaining: number }> = {};
  let totalSent = 0;

  for (const campaignId of campaignIds) {
    const result = await processCampaignBatch(supabase, campaignId, DAILY_BATCH_LIMIT);
    results[campaignId] = { sent: result.sent, failed: result.failed, remaining: result.remaining };
    totalSent += result.sent;
    console.log(
      `[batch-sender] Campagne ${campaignId}: envoyés=${result.sent}, échecs=${result.failed}, restants=${result.remaining}`
    );
  }

  return NextResponse.json({
    message: `Batch terminé : ${totalSent} email${totalSent !== 1 ? 's' : ''} envoyé${totalSent !== 1 ? 's' : ''}`,
    campaigns: campaignIds.length,
    results,
  });
}
