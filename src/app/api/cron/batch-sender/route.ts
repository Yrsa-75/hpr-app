/**
 * Cron: Email Batch Sender
 * 1. Reprend les envois en attente (status='queued') pour toutes les campagnes actives.
 *    Limite à 100 emails par campagne par run (contrainte Resend plan gratuit).
 * 2. Planifie et envoie les relances automatiques J+4/J+8 aux non-répondants
 *    délivrés (l'envoi effectif requiert FOLLOW_UPS_AUTOSEND=true — cf. lib/email/follow-ups).
 * Planifié tous les jours à 9h dans vercel.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processCampaignBatch, DAILY_BATCH_LIMIT } from '@/lib/email/send-batch';
import { runFollowUps, backfillFollowUpTracking } from '@/lib/email/follow-ups';

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

  // Dédupliquer les campaign_id
  const campaignIds = [...new Set((queuedSends ?? []).map((s) => s.campaign_id as string))];

  const results: Record<string, { sent: number; failed: number; remaining: number }> = {};
  let totalSent = 0;

  if (campaignIds.length === 0) {
    console.log('[batch-sender] Aucun envoi en attente.');
  } else {
    console.log(`[batch-sender] ${campaignIds.length} campagne(s) avec envois en attente.`);

    for (const campaignId of campaignIds) {
      const result = await processCampaignBatch(supabase, campaignId, DAILY_BATCH_LIMIT);
      results[campaignId] = { sent: result.sent, failed: result.failed, remaining: result.remaining };
      totalSent += result.sent;
      console.log(
        `[batch-sender] Campagne ${campaignId}: envoyés=${result.sent}, échecs=${result.failed}, restants=${result.remaining}`
      );
    }
  }

  // Relances automatiques J+4/J+8 (après les envois initiaux pour partager
  // le quota Resend ; l'envoi effectif requiert FOLLOW_UPS_AUTOSEND=true)
  const followUps = await runFollowUps(supabase);
  console.log(
    `[batch-sender] Relances: planifiées=${followUps.scheduled}, envoyées=${followUps.sent}, ignorées=${followUps.skipped}, autosend=${followUps.autosend}`
  );
  if (followUps.errors.length > 0) {
    console.error('[batch-sender] Erreurs relances:', followUps.errors);
  }

  // Rattrapage : relances envoyées sans resend_email_id (avant 2026-07-16),
  // re-matchées depuis le journal Resend. No-op quand il n'y a plus d'orpheline.
  const backfill = await backfillFollowUpTracking(supabase);
  if (backfill.orphans > 0) {
    console.log(
      `[batch-sender] Backfill tracking relances: orphelines=${backfill.orphans}, matchées=${backfill.matched}, mises à jour=${backfill.updated}, pages Resend=${backfill.pages}`
    );
    if (backfill.errors.length > 0) {
      console.error('[batch-sender] Erreurs backfill relances:', backfill.errors);
    }
  }

  return NextResponse.json({
    message: `Batch terminé : ${totalSent} email${totalSent !== 1 ? 's' : ''} envoyé${totalSent !== 1 ? 's' : ''}, ${followUps.scheduled} relance${followUps.scheduled !== 1 ? 's' : ''} planifiée${followUps.scheduled !== 1 ? 's' : ''}, ${followUps.sent} envoyée${followUps.sent !== 1 ? 's' : ''}`,
    campaigns: campaignIds.length,
    results,
    followUps,
    backfill,
  });
}
