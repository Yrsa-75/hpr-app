-- Add signature fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_logo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_text text;
