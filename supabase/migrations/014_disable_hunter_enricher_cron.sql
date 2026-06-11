-- ============================================
-- Migration 014 — Désactivation temporaire du cron Hunter
-- ============================================
-- Contexte : crédits Hunter réservés à un autre projet pour l'instant.
-- On désactive le cron 100%-Hunter `hpr-hunter-enricher` (cf. migration 012).
--
-- Les crons `hpr-scraper-worker` et `hpr-email-verifier` n'utilisent Hunter
-- qu'en renfort/cross-check : ils restent ACTIFS et sont privés de Hunter via
-- le retrait du secret HUNTER_API_KEY (dégradation propre, early-return).
--
-- Pour RÉACTIVER plus tard :
--   SELECT cron.alter_job(
--     (SELECT jobid FROM cron.job WHERE jobname = 'hpr-hunter-enricher'),
--     active := true
--   );
-- ============================================

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'hpr-hunter-enricher'),
  active := false
);
