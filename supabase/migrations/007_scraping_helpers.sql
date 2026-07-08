-- ============================================
-- HPR — Migration 007
-- Fonctions helper pour le scraper + pg_cron
-- ============================================

-- ============================================
-- Incrémenter le budget mensuel de scraping
-- Fonction appelée par l'Edge Function via RPC
-- ============================================
CREATE OR REPLACE FUNCTION increment_scraping_budget(
  p_month TEXT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_cost_eur NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO scraping_budget_tracking (month, api_calls, input_tokens, output_tokens, estimated_cost_eur)
  VALUES (p_month, 1, p_input_tokens, p_output_tokens, p_cost_eur)
  ON CONFLICT (month) DO UPDATE SET
    api_calls = scraping_budget_tracking.api_calls + 1,
    input_tokens = scraping_budget_tracking.input_tokens + p_input_tokens,
    output_tokens = scraping_budget_tracking.output_tokens + p_output_tokens,
    estimated_cost_eur = scraping_budget_tracking.estimated_cost_eur + p_cost_eur,
    updated_at = NOW();
END;
$$;

-- ============================================
-- Incrémenter le compteur de scraping d'une source
-- ============================================
CREATE OR REPLACE FUNCTION increment_scrape_count(p_source_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scraping_sources
  SET scrape_count = scrape_count + 1
  WHERE id = p_source_id;
END;
$$;

-- ============================================
-- Vue de monitoring du scraper (pour le dashboard)
-- ============================================
CREATE OR REPLACE VIEW scraping_dashboard AS
SELECT
  -- Statistiques des sources
  (SELECT COUNT(*) FROM scraping_sources) AS total_sources,
  (SELECT COUNT(*) FROM scraping_sources WHERE status = 'done') AS sources_done,
  (SELECT COUNT(*) FROM scraping_sources WHERE status = 'pending') AS sources_pending,
  (SELECT COUNT(*) FROM scraping_sources WHERE status = 'error') AS sources_error,
  -- Journalistes globaux
  (SELECT COUNT(*) FROM journalists WHERE is_global = true) AS global_journalists,
  (SELECT COUNT(*) FROM journalists WHERE is_global = true AND 'auto-source' = ANY(tags)) AS auto_sourced,
  -- Budget du mois courant
  (
    SELECT COALESCE(estimated_cost_eur, 0)
    FROM scraping_budget_tracking
    WHERE month = TO_CHAR(NOW(), 'YYYY-MM')
  ) AS current_month_cost_eur,
  (
    SELECT COALESCE(budget_limit_eur, 200)
    FROM scraping_budget_tracking
    WHERE month = TO_CHAR(NOW(), 'YYYY-MM')
  ) AS budget_limit_eur,
  -- Dernière activité
  (SELECT MAX(created_at) FROM scraping_log WHERE status = 'success') AS last_successful_scrape;

-- ============================================
-- Planification pg_cron
-- Déclenche l'Edge Function toutes les 30 minutes
-- IMPORTANT : remplacer <YOUR_SUPABASE_PROJECT_ID> par gdvbqqndlblfyocxysxr
-- et <SERVICE_ROLE_KEY> par la vraie clé (à faire via le dashboard Supabase)
-- ============================================

-- Activer l'extension pg_net si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Planification du job cron (toutes les 30 minutes)
-- NOTE : Cette commande nécessite que pg_cron soit activé dans le projet Supabase
-- Activer via : Dashboard Supabase → Database → Extensions → pg_cron
SELECT cron.schedule(
  'hpr-scraper-worker',          -- nom unique du job
  '*/30 * * * *',                -- toutes les 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://gdvbqqndlblfyocxysxr.supabase.co/functions/v1/scraper-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ============================================
-- Alternative : stocker la service_role_key dans app.settings
-- À exécuter UNE FOIS manuellement dans le SQL editor Supabase :
-- ALTER DATABASE postgres SET app.service_role_key = 'votre_service_role_key_ici';
-- ============================================

-- ============================================
-- RLS : Les tables de scraping ne sont accessibles
-- qu'en service_role (pas d'accès utilisateur direct)
-- Pas de RLS = accessible uniquement via service_role key
-- (Edge Function bypass RLS car service_role)
-- ============================================
-- scraping_sources, scraping_budget_tracking, scraping_log
-- n'ont pas de RLS activé intentionnellement car :
-- 1. L'Edge Function utilise service_role (bypass RLS)
-- 2. Ces données ne doivent pas être accessibles aux utilisateurs finaux via le client Supabase

-- Activer RLS mais sans policy = personne ne peut accéder via anon key
ALTER TABLE scraping_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_log ENABLE ROW LEVEL SECURITY;

-- Optionnel : permettre aux admins de voir les stats de scraping
-- CREATE POLICY "Admins can view scraping stats" ON scraping_sources
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
--   );
