-- Migration 004: Add resend_inbound_id to email_messages for deduplication
-- This column was missing because migration 003 used CREATE TABLE IF NOT EXISTS
-- and the table already existed from migration 001.

ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS resend_inbound_id text UNIQUE;
