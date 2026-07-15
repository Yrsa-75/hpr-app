/**
 * Déclenchement manuel du batch-sender (session du 2026-07-15).
 * Regroupement du calendrier demandé par Julien : envoie immédiatement
 * les email_sends 'queued' de la campagne TDF nationale + les relances
 * dues (relances 2 TDF avancées). Réutilise exactement le code du cron
 * (processCampaignBatch + runFollowUps) — seul le déclencheur diffère,
 * la route Vercel exigeant un CRON_SECRET non disponible localement.
 *
 * Usage : variables d'env de .env.local + NEXT_PUBLIC_APP_URL aligné
 * sur la prod (hpr-app.vercel.app) + FOLLOW_UPS_AUTOSEND=true.
 */

import { createClient } from '@supabase/supabase-js';
import { processCampaignBatch } from '../src/lib/email/send-batch';
import { runFollowUps } from '../src/lib/email/follow-ups';

const TDF_NATIONALE_CAMPAIGN_ID = '85dcd5eb-8178-40d4-8ad9-a5ccc2cfed4f';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Env Supabase manquante');
  if (process.env.FOLLOW_UPS_AUTOSEND !== 'true') throw new Error('FOLLOW_UPS_AUTOSEND doit être true');
  if (!process.env.NEXT_PUBLIC_APP_URL?.includes('hpr-app.vercel.app')) {
    throw new Error('NEXT_PUBLIC_APP_URL doit pointer sur hpr-app.vercel.app (aligné prod)');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const batch = await processCampaignBatch(supabase, TDF_NATIONALE_CAMPAIGN_ID, 100);
  console.log('[CP initiaux]', JSON.stringify(batch));

  const followUps = await runFollowUps(supabase);
  console.log('[Relances]', JSON.stringify(followUps));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('ERREUR:', err);
  process.exit(1);
});
