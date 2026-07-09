-- ============================================
-- 017 — Accroche de relance par campagne (appliquée en base via MCP le
-- 2026-07-09, migration `campaigns_follow_up_intro`). Miroir pour le dépôt.
-- ============================================

-- Accroche personnalisée par campagne, injectée en tête des relances
-- automatiques J+4/J+8 (ex : "Le Tour roule encore jusqu'à dimanche…").
-- Vide → template sobre par défaut.
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS follow_up_intro text;
