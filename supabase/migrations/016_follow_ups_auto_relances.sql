-- ============================================
-- 016 — Relances automatiques J+4/J+8 (appliquée en base via MCP le 2026-07-09,
-- migration `follow_ups_auto_relances`). Miroir pour le dépôt.
-- ============================================

-- Les follow-ups ciblent des NON-répondants, qui par définition n'ont pas
-- de thread → thread_id devient nullable.
ALTER TABLE public.follow_ups ALTER COLUMN thread_id DROP NOT NULL;

-- Lien vers l'envoi d'origine (pour le Re:, le replyTo threadé et la séquence)
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS email_send_id uuid REFERENCES public.email_sends(id);

-- Rang de la relance : 1 = J+4, 2 = J+8 (max 2)
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS sequence smallint NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_follow_ups_campaign_journalist ON public.follow_ups(campaign_id, journalist_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status_scheduled ON public.follow_ups(status, scheduled_at);
