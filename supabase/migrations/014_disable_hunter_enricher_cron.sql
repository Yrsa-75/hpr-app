-- ============================================
-- Migration 014 — Désactivation temporaire des crons Hunter
-- ============================================
-- Contexte : crédits Hunter réservés à un autre projet (HPR en pause).
-- On désactive les 3 crons pg_cron qui consomment des crédits Hunter :
--   - hpr-hunter-enricher  : 100% Hunter (email-finder)        cf. migration 012
--   - hpr-scraper-worker   : Hunter en renfort (email-finder)  cf. migration 007
--   - hpr-email-verifier   : Hunter en cross-check (verifier)
--
-- Côté Vercel : les 4 crons Hunter sont retirés de vercel.json et le secret
-- HUNTER_API_KEY a été supprimé de l'env Vercel (commit chore Hunter).
--
-- Les crons hpr-source-discoverer-* restent ACTIFS (ils utilisent Claude,
-- pas Hunter). scraper-worker / email-verifier sont seulement mis en pause :
-- leur travail utile (scraping, vérif SMTP) reprendra à la réactivation.
--
-- Pour RÉACTIVER plus tard (à la reprise de HPR) :
--   SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-hunter-enricher'), active := true);
--   SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-scraper-worker'),  active := true);
--   SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-email-verifier'),   active := true);
--   -- + remettre HUNTER_API_KEY dans l'env Vercel et restaurer les crons Hunter dans vercel.json
-- ============================================

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-hunter-enricher'), active := false);
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-scraper-worker'),  active := false);
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'hpr-email-verifier'),   active := false);
