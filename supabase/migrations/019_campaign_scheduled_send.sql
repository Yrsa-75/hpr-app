-- 019 — Programmation de l'envoi d'une campagne à une date/heure précise
-- Appliquée en production via MCP Supabase le 2026-10-12.
-- scheduled_send_at : moment choisi par l'utilisateur (NULL = pas de programmation)
-- scheduled_send_started_at : renseigné quand le déclencheur a lancé l'envoi
alter table public.campaigns
  add column if not exists scheduled_send_at timestamptz,
  add column if not exists scheduled_send_started_at timestamptz;

create index if not exists idx_campaigns_scheduled_send
  on public.campaigns (scheduled_send_at)
  where scheduled_send_at is not null and scheduled_send_started_at is null;

comment on column public.campaigns.scheduled_send_at is 'Envoi programmé : date/heure choisie (UTC). Les email_sends restent targeted jusque-là.';
comment on column public.campaigns.scheduled_send_started_at is 'Horodatage du déclenchement effectif de l''envoi programmé (par /api/cron/batch-sender?mode=scheduled).';

-- Déclencheur : pg_cron toutes les 5 min, appelle la route Vercel uniquement
-- si une campagne est due (voir cron.job 'hpr-scheduled-sender').
