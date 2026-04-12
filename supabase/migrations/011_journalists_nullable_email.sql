-- Make email nullable on journalists table
-- Journalists sourced without an email had a fake noemail_* placeholder.
-- We now treat NULL as "no email known" instead.

-- 1. Drop NOT NULL constraint
ALTER TABLE journalists ALTER COLUMN email DROP NOT NULL;

-- 2. Clear fake placeholder emails
UPDATE journalists
SET email = NULL
WHERE email LIKE 'noemail_%';
