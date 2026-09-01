/**
 * Déclenchement manuel du batch-sender (session du 2026-09-01).
 * Le CP « Rentrée 2026 : COMPAGNON » est parti à 100/320 (ancienne limite
 * DAILY_BATCH_LIMIT, supprimée ce jour suite au passage au compte Resend pro).
 * Ce script envoie immédiatement les 220 email_sends 'queued' restants en
 * réutilisant exactement le code du cron (processCampaignBatch sans limite),
 * la route Vercel exigeant un CRON_SECRET non disponible localement.
 * Pas de runFollowUps ici : envois initiaux uniquement.
 *
 * Usage : npx tsx --env-file=.env.local --env-file=.env.batch.local scripts/run-batch-local-20260901.ts
 *
 * ISSUE RÉELLE DU 2026-09-01 : la RESEND_API_KEY de .env.local est invalide
 * (constat déjà fait le 15/07, la clé valide n'existe que dans l'env Vercel).
 * Le run local a marqué 220 envois 'failed' (remis en 'queued' via SQL), puis
 * l'envoi a été déclenché avec succès via le bouton Envoi de l'app déployée
 * (nouveau code sans limite). Ne pas relancer ce script sans clé locale valide.
 */

import { createClient } from '@supabase/supabase-js';
import { processCampaignBatch } from '../src/lib/email/send-batch';

const COMPAGNON_CAMPAIGN_ID = '33b5ba06-385c-4375-994c-5d0f38d6e347';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Env Supabase manquante');
  if (!process.env.NEXT_PUBLIC_APP_URL?.includes('hpr-app.vercel.app')) {
    throw new Error('NEXT_PUBLIC_APP_URL doit pointer sur hpr-app.vercel.app (aligné prod)');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const batch = await processCampaignBatch(supabase, COMPAGNON_CAMPAIGN_ID);
  console.log('[CP COMPAGNON]', JSON.stringify(batch));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('ERREUR:', err);
  process.exit(1);
});
