-- Add avatar_url and bio columns to family_members
-- Run this in the Supabase SQL Editor

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS bio text;
