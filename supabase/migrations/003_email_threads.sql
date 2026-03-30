-- Migration 003: Email threads and messages for inbox

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  journalist_id uuid REFERENCES journalists(id) ON DELETE CASCADE NOT NULL,
  email_send_id uuid REFERENCES email_sends(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'needs_response', 'responded', 'follow_up_scheduled', 'closed', 'positive', 'negative')),
  sentiment text
    CHECK (sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested')),
  ai_suggested_response text,
  ai_response_strategy text,
  priority_score numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES email_threads(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email text,
  to_email text,
  subject text,
  body_html text,
  body_plain text,
  is_auto_reply boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_campaign ON email_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_journalist ON email_threads(journalist_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);

-- RLS
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_threads_org_access" ON email_threads
  FOR ALL USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN users u ON c.organization_id = u.organization_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "email_messages_org_access" ON email_messages
  FOR ALL USING (
    thread_id IN (
      SELECT t.id FROM email_threads t
      JOIN campaigns c ON t.campaign_id = c.id
      JOIN users u ON c.organization_id = u.organization_id
      WHERE u.id = auth.uid()
    )
  );
