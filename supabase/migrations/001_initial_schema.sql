-- ============================================
-- HPR — Hermès Press Room
-- Initial Schema Migration
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search on journalists

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (linked to auth.users)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'client_viewer')),
  full_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  logo_url TEXT,
  description TEXT,
  website TEXT,
  sender_name TEXT,
  sender_email TEXT,
  email_signature_html TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOURNALISTS
-- ============================================
CREATE TABLE journalists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  media_outlet TEXT,
  media_type TEXT CHECK (media_type IN ('presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur')),
  beat TEXT[] DEFAULT '{}',
  location TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  -- Scoring
  response_rate NUMERIC DEFAULT 0 CHECK (response_rate >= 0 AND response_rate <= 100),
  publication_rate NUMERIC DEFAULT 0 CHECK (publication_rate >= 0 AND publication_rate <= 100),
  avg_response_time_hours NUMERIC,
  quality_score NUMERIC DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  last_contacted_at TIMESTAMPTZ,
  last_responded_at TIMESTAMPTZ,
  -- Enrichissement
  enrichment_data JSONB,
  enrichment_last_run TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  is_opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- ============================================
-- JOURNALIST INTERACTIONS
-- ============================================
CREATE TABLE journalist_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journalist_id UUID NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
  campaign_id UUID, -- FK added after campaigns table
  type TEXT NOT NULL CHECK (type IN ('email_sent', 'email_opened', 'email_clicked', 'replied', 'bounced', 'meeting', 'call', 'published', 'opted_out')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preparing', 'review', 'approved', 'sending', 'active', 'paused', 'completed', 'archived')),
  tags TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  target_date DATE,
  embargo_until TIMESTAMPTZ,
  -- Métriques agrégées
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_publications INTEGER DEFAULT 0,
  estimated_reach BIGINT DEFAULT 0,
  -- IA
  ai_performance_analysis JSONB,
  ai_recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK for journalist_interactions → campaigns
ALTER TABLE journalist_interactions
  ADD CONSTRAINT fk_interactions_campaign
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- ============================================
-- PRESS RELEASES
-- ============================================
CREATE TABLE press_releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_html TEXT,
  body_plain TEXT,
  email_subject TEXT,
  email_preview_text TEXT,
  -- IA
  ai_quality_score NUMERIC CHECK (ai_quality_score >= 0 AND ai_quality_score <= 100),
  ai_quality_analysis JSONB,
  ai_suggestions JSONB,
  -- Versioning
  is_current BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE press_release_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  press_release_id UUID NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL SENDS & TRACKING
-- ============================================
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  press_release_id UUID NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  journalist_id UUID NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  -- Personnalisation
  personalized_subject TEXT,
  personalized_intro TEXT,
  ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL THREADS & REPLIES
-- ============================================
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  journalist_id UUID NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
  email_send_id UUID REFERENCES email_sends(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'needs_response', 'responded', 'follow_up_scheduled', 'closed', 'positive', 'negative')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested')),
  -- IA
  ai_suggested_response TEXT,
  ai_response_strategy TEXT,
  priority_score NUMERIC CHECK (priority_score >= 0 AND priority_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_plain TEXT,
  is_auto_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  journalist_id UUID NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('auto_scheduled', 'manual', 'ai_suggested')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  content_html TEXT,
  ai_rationale TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRESS CLIPPINGS
-- ============================================
CREATE TABLE press_clippings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  journalist_id UUID REFERENCES journalists(id) ON DELETE SET NULL,
  -- Contenu
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'social_media')),
  published_at TIMESTAMPTZ,
  excerpt TEXT,
  screenshot_url TEXT,
  -- Métriques
  estimated_reach BIGINT,
  estimated_ave NUMERIC,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  -- Détection
  detection_method TEXT NOT NULL DEFAULT 'manual' CHECK (detection_method IN ('manual', 'google_news', 'monitoring', 'journalist_shared')),
  is_verified BOOLEAN DEFAULT FALSE,
  -- IA
  ai_summary TEXT,
  ai_key_messages_found TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MONITORING
-- ============================================
CREATE TABLE monitoring_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  query_terms TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  check_interval_hours INTEGER DEFAULT 6,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE monitoring_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES monitoring_queries(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  source TEXT,
  published_at TIMESTAMPTZ,
  is_relevant BOOLEAN,
  is_converted_to_clipping BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IMPROVEMENT CYCLES
-- ============================================
CREATE TABLE improvement_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email_timing', 'subject_lines', 'journalist_targeting', 'content_quality', 'follow_up_strategy', 'database_enrichment')),
  status TEXT NOT NULL DEFAULT 'collecting_data' CHECK (status IN ('collecting_data', 'analyzing', 'recommending', 'testing', 'validating', 'applied')),
  data_snapshot JSONB,
  analysis JSONB,
  recommendations JSONB,
  test_config JSONB,
  test_results JSONB,
  validation_notes TEXT,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- A/B TESTS
-- ============================================
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('subject_line', 'content_angle', 'send_time', 'personalization')),
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
  winner TEXT CHECK (winner IN ('A', 'B', 'inconclusive')),
  results JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('press_release', 'follow_up', 'response', 'pitch')),
  content_html TEXT,
  variables JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('journalist_replied', 'article_published', 'campaign_milestone', 'approval_needed', 'system_alert', 'improvement_ready')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalists ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalist_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_release_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_clippings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper function to get the user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ORGANIZATIONS
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "org_update_admin" ON organizations
  FOR UPDATE USING (id = get_user_org_id() AND get_user_role() = 'admin');

-- USERS
CREATE POLICY "users_select_org" ON users
  FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_manage_admin" ON users
  FOR ALL USING (
    organization_id = get_user_org_id() AND get_user_role() = 'admin'
  );

CREATE POLICY "users_insert_trigger" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- CLIENTS
CREATE POLICY "clients_org" ON clients
  FOR ALL USING (organization_id = get_user_org_id());

-- JOURNALISTS
CREATE POLICY "journalists_org" ON journalists
  FOR ALL USING (organization_id = get_user_org_id());

-- JOURNALIST INTERACTIONS
CREATE POLICY "interactions_via_journalist" ON journalist_interactions
  FOR ALL USING (
    journalist_id IN (
      SELECT id FROM journalists WHERE organization_id = get_user_org_id()
    )
  );

-- CAMPAIGNS
CREATE POLICY "campaigns_org" ON campaigns
  FOR ALL USING (organization_id = get_user_org_id());

-- PRESS RELEASES
CREATE POLICY "press_releases_via_campaign" ON press_releases
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
  );

-- PRESS RELEASE ATTACHMENTS
CREATE POLICY "attachments_via_press_release" ON press_release_attachments
  FOR ALL USING (
    press_release_id IN (
      SELECT pr.id FROM press_releases pr
      JOIN campaigns c ON c.id = pr.campaign_id
      WHERE c.organization_id = get_user_org_id()
    )
  );

-- EMAIL SENDS
CREATE POLICY "email_sends_via_campaign" ON email_sends
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
  );

-- EMAIL THREADS
CREATE POLICY "email_threads_via_campaign" ON email_threads
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
  );

-- EMAIL MESSAGES
CREATE POLICY "email_messages_via_thread" ON email_messages
  FOR ALL USING (
    thread_id IN (
      SELECT et.id FROM email_threads et
      JOIN campaigns c ON c.id = et.campaign_id
      WHERE c.organization_id = get_user_org_id()
    )
  );

-- FOLLOW UPS
CREATE POLICY "follow_ups_via_campaign" ON follow_ups
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
  );

-- PRESS CLIPPINGS
CREATE POLICY "clippings_via_client" ON press_clippings
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients WHERE organization_id = get_user_org_id()
    )
  );

-- MONITORING
CREATE POLICY "monitoring_queries_org" ON monitoring_queries
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "monitoring_results_via_query" ON monitoring_results
  FOR ALL USING (
    query_id IN (
      SELECT id FROM monitoring_queries WHERE organization_id = get_user_org_id()
    )
  );

-- IMPROVEMENT CYCLES
CREATE POLICY "improvement_cycles_org" ON improvement_cycles
  FOR ALL USING (organization_id = get_user_org_id());

-- AB TESTS
CREATE POLICY "ab_tests_via_campaign" ON ab_tests
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organization_id = get_user_org_id()
    )
  );

-- TEMPLATES
CREATE POLICY "templates_org" ON templates
  FOR ALL USING (organization_id = get_user_org_id());

-- NOTIFICATIONS
CREATE POLICY "notifications_self" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- AUDIT LOG
CREATE POLICY "audit_log_org" ON audit_log
  FOR SELECT USING (organization_id = get_user_org_id());

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journalists_updated_at
  BEFORE UPDATE ON journalists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Clients
CREATE INDEX idx_clients_organization ON clients(organization_id);

-- Journalists
CREATE INDEX idx_journalists_org ON journalists(organization_id);
CREATE INDEX idx_journalists_email ON journalists(email);
CREATE INDEX idx_journalists_quality ON journalists(quality_score DESC NULLS LAST);
CREATE INDEX idx_journalists_opted_out ON journalists(is_opted_out) WHERE is_opted_out = FALSE;
CREATE INDEX idx_journalists_media_type ON journalists(media_type);
-- Full-text search index
CREATE INDEX idx_journalists_search ON journalists
  USING gin(to_tsvector('french', COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(media_outlet,'')));

-- Campaigns
CREATE INDEX idx_campaigns_client ON campaigns(client_id);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Email sends
CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX idx_email_sends_journalist ON email_sends(journalist_id);
CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_email_sends_resend_id ON email_sends(resend_email_id) WHERE resend_email_id IS NOT NULL;

-- Email threads
CREATE INDEX idx_email_threads_campaign ON email_threads(campaign_id);
CREATE INDEX idx_email_threads_journalist ON email_threads(journalist_id);
CREATE INDEX idx_email_threads_status ON email_threads(status);

-- Press clippings
CREATE INDEX idx_press_clippings_campaign ON press_clippings(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_press_clippings_client ON press_clippings(client_id);

-- Monitoring
CREATE INDEX idx_monitoring_results_query ON monitoring_results(query_id);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- Audit log
CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
