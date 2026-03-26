-- Add phone_direct column to journalists table
ALTER TABLE journalists ADD COLUMN IF NOT EXISTS phone_direct TEXT;
