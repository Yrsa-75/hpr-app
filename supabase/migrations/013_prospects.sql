-- ============================================
-- Migration 013 — Prospection comm
-- Nouvelle table prospects + adaptations email_sends/campaigns
-- ============================================

-- TABLE PROSPECTS
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT NOT NULL,
  role TEXT,
  sector TEXT,
  linkedin_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  is_opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index unique partiel : email unique par org seulement si email fourni
-- (NULL != NULL en PostgreSQL, donc plusieurs rows sans email sont OK)
CREATE UNIQUE INDEX idx_prospects_org_email_unique
  ON prospects(organization_id, email)
  WHERE email IS NOT NULL;

-- RLS
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_org" ON prospects
  FOR ALL USING (organization_id = get_user_org_id());

-- Index de performance
CREATE INDEX idx_prospects_org ON prospects(organization_id);
CREATE INDEX idx_prospects_company ON prospects(company);
CREATE INDEX idx_prospects_sector ON prospects(sector);
CREATE INDEX idx_prospects_opted_out ON prospects(is_opted_out) WHERE is_opted_out = FALSE;

-- Index recherche plein texte
CREATE INDEX idx_prospects_search ON prospects USING gin(
  to_tsvector('french',
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(company, '') || ' ' ||
    coalesce(role, '') || ' ' ||
    coalesce(sector, '')
  )
);

-- Trigger updated_at (réutilise la fonction existante)
CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AJOUT campaign_type SUR campaigns
-- ============================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'journalists'
  CHECK (campaign_type IN ('journalists', 'prospects'));

-- ============================================
-- MODIFICATION email_sends
-- journalist_id devient nullable + ajout prospect_id
-- ============================================
ALTER TABLE email_sends
  ALTER COLUMN journalist_id DROP NOT NULL;

ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE;

-- Contrainte : exactement l'un des deux doit être défini
-- Les lignes existantes (journalist_id NOT NULL, prospect_id NULL) satisfont la condition 1
ALTER TABLE email_sends
  ADD CONSTRAINT email_sends_target_check CHECK (
    (journalist_id IS NOT NULL AND prospect_id IS NULL) OR
    (journalist_id IS NULL AND prospect_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_email_sends_prospect ON email_sends(prospect_id);
