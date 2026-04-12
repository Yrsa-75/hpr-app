-- ============================================
-- Migration 012 — Cron jobs Hunter + Source Discoverer
-- ============================================

-- hunter-enricher : toutes les 2h
-- Enrichit les journalistes sans email via Hunter.io
SELECT cron.schedule(
  'hpr-hunter-enricher',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdvbqqndlblfyocxysxr.supabase.co/functions/v1/hunter-enricher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);

-- source-discoverer (fix) : toutes les 6h
-- Répare les sources de journalistes cassées (404/403)
SELECT cron.schedule(
  'hpr-source-discoverer-fix',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdvbqqndlblfyocxysxr.supabase.co/functions/v1/source-discoverer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{"mode":"fix"}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);

-- source-discoverer (discover) : 1x/jour à 3h du matin
-- Découvre de nouvelles sources de journalistes via Claude
SELECT cron.schedule(
  'hpr-source-discoverer-discover',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdvbqqndlblfyocxysxr.supabase.co/functions/v1/source-discoverer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{"mode":"discover"}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);
