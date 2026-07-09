-- ============================================
-- 015 — Miroir des migrations appliquées DIRECTEMENT en base le 2026-07-08/09
-- par la session Claude desktop (via MCP apply_migration), pendant la
-- campagne presse Tour de France. NE PAS ré-appliquer aveuglément : ces
-- objets existent déjà en production (la base fait autorité). Ce fichier
-- documente l'état déployé pour le dépôt.
--
-- Migrations d'origine en base :
--   - guard_block_unverified_email_sends
--   - guard_v2_strict_email_verification (version actuelle, ci-dessous)
--   - fix_journalists_default_organization
-- ============================================

-- --------------------------------------------
-- 1. RÈGLE MÉTIER ABSOLUE : aucun email ne part vers une adresse non vérifiée.
--    Incident du 2026-07-08 : 38 bounces sur 85 envois (adresses scrapées non
--    vérifiées), risque de sanction Resend. NE PAS supprimer ni contourner.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.block_unverified_email_sends()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  j_tags text[];
BEGIN
  SELECT COALESCE(tags, '{}') INTO j_tags FROM public.journalists WHERE id = NEW.journalist_id;

  -- adresse morte connue : refus absolu
  IF j_tags && ARRAY['email-bounced','non-existent'] THEN
    RAISE EXCEPTION 'Envoi bloqué : adresse en bounce ou inexistante (journalist_id=%)', NEW.journalist_id;
  END IF;

  -- adresse issue de l'automatisation : vérification obligatoire
  IF (j_tags && ARRAY['auto-source','via-hunter','email-pattern'])
     AND NOT (j_tags && ARRAY['email-verified','email-public-site']) THEN
    RAISE EXCEPTION 'Envoi bloqué : email automatisé non vérifié (journalist_id=%)', NEW.journalist_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_unverified_email_sends ON public.email_sends;
CREATE TRIGGER trg_block_unverified_email_sends
  BEFORE INSERT ON public.email_sends
  FOR EACH ROW EXECUTE FUNCTION block_unverified_email_sends();

-- --------------------------------------------
-- 2. organization_id par défaut sur journalists : le scraper-worker créait
--    des journalistes sans organization_id, invisibles dans le ciblage.
--    (Correctif durable aussi côté code du scraper — cf. backlog handoff §5.3.)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_default_journalist_org()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := '6fb47293-2274-4c1d-95c5-cc80de757521';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_default_journalist_org ON public.journalists;
CREATE TRIGGER trg_default_journalist_org
  BEFORE INSERT ON public.journalists
  FOR EACH ROW EXECUTE FUNCTION set_default_journalist_org();
