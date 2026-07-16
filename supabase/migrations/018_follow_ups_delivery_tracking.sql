-- ============================================
-- 018 — Tracking Resend sur les relances (appliquée en base via MCP le
-- 2026-07-16, migration `follow_ups_delivery_tracking`). Miroir pour le dépôt.
--
-- Jusqu'ici l'ID Resend des relances n'était pas conservé à l'envoi : les
-- événements delivered/opened/clicked du webhook ne matchaient aucune ligne
-- et étaient perdus. On ajoute les colonnes de suivi ; `delivery_status` est
-- volontairement séparé de `status` (workflow scheduled/sent/cancelled).
-- ============================================

ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS resend_email_id text;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS delivery_status text
  CONSTRAINT follow_ups_delivery_status_check
  CHECK (delivery_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'));
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_follow_ups_resend_email_id
  ON public.follow_ups(resend_email_id) WHERE resend_email_id IS NOT NULL;

-- Les relances déjà parties : au minimum 'sent', le backfill Resend affinera.
UPDATE public.follow_ups SET delivery_status = 'sent'
WHERE status = 'sent' AND delivery_status IS NULL;
