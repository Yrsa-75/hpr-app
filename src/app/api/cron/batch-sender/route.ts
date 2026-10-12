/**
 * Cron: Email Batch Sender
 *
 * Mode par défaut (cron Vercel quotidien, 9h, vercel.json) :
 * 1. Déclenche les envois programmés arrivés à échéance (filet de sécurité
 *    si le déclencheur pg_cron n'a pas tourné).
 * 2. Reprend les envois en attente (status='queued') pour toutes les campagnes.
 *    Tout part en un seul run (compte Resend pro depuis le 2026-09-01, plus de
 *    plafond quotidien) ; le débit est lissé dans processCampaignBatch.
 * 3. Planifie et envoie les relances automatiques J+4/J+8 aux non-répondants
 *    délivrés (l'envoi effectif requiert FOLLOW_UPS_AUTOSEND=true).
 *
 * Mode `?mode=scheduled` (pg_cron Supabase toutes les 5 min, uniquement quand
 * une campagne est due, cf. migration 019) : ne traite QUE les envois
 * programmés arrivés à échéance. Le plan Vercel Hobby limite les crons à un
 * passage par jour, d'où ce déclencheur externe pour respecter l'heure choisie.
 *
 * Auth : Bearer CRON_SECRET (cron Vercel), SCHEDULER_SECRET ou la clé service
 * Supabase (pg_cron). Le mode scheduled est de toute façon idempotent : chaque
 * campagne est réservée atomiquement avant envoi (processDueScheduledCampaigns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processCampaignBatch, processDueScheduledCampaigns } from '@/lib/email/send-batch';
import { runFollowUps, backfillFollowUpTracking } from '@/lib/email/follow-ups';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const accepted = [
    process.env.CRON_SECRET,
    process.env.SCHEDULER_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((s): s is string => !!s && s.length > 0);

  // Aucun secret configuré : on reste permissif (comportement historique)
  if (accepted.length === 0) return true;
  return accepted.some((secret) => authHeader === `Bearer ${secret}`);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const mode = req.nextUrl.searchParams.get('mode') ?? 'daily';

  // 1. Envoi programmé arrivé à échéance (dans les deux modes)
  const scheduled = await processDueScheduledCampaigns(supabase);
  if (scheduled.due > 0) {
    console.log(`[batch-sender] Envois programmés : ${scheduled.started.length}/${scheduled.due} déclenché(s).`);
  }

  if (mode === 'scheduled') {
    return NextResponse.json({
      mode,
      message: `Programmés : ${scheduled.started.length} campagne(s) déclenchée(s) sur ${scheduled.due} due(s)`,
      scheduled,
    });
  }

  // 2. Reprise des envois en attente (campagnes sans programmation future)
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
      const result = await processCampaignBatch(supabase, campaignId);
      results[campaignId] = { sent: result.sent, failed: result.failed, remaining: result.remaining };
      totalSent += result.sent;
      console.log(
        `[batch-sender] Campagne ${campaignId}: envoyés=${result.sent}, échecs=${result.failed}, restants=${result.remaining}`
      );
    }
  }

  // 3. Relances automatiques J+4/J+8 (après les envois initiaux pour partager
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
    mode,
    message: `Batch terminé : ${totalSent} email${totalSent !== 1 ? 's' : ''} envoyé${totalSent !== 1 ? 's' : ''}, ${followUps.scheduled} relance${followUps.scheduled !== 1 ? 's' : ''} planifiée${followUps.scheduled !== 1 ? 's' : ''}, ${followUps.sent} envoyée${followUps.sent !== 1 ? 's' : ''}`,
    campaigns: campaignIds.length,
    scheduled,
    results,
    followUps,
    backfill,
  });
}
