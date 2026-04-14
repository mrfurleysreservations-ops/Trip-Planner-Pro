-- ─── Packing System Upgrade Migration ───
-- Adds: suitcase identity photo, organization photos table

-- 1. Suitcase identity photo
ALTER TABLE suitcases ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Organization photos table
CREATE TABLE IF NOT EXISTS suitcase_photos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  suitcase_id uuid       NOT NULL REFERENCES suitcases(id) ON DELETE CASCADE,
  photo_url  text        NOT NULL,
  label      text,
  sort_order int         DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by suitcase
CREATE INDEX IF NOT EXISTS idx_suitcase_photos_suitcase_id ON suitcase_photos(suitcase_id);

-- RLS policies (match existing suitcases pattern — owner-based access)
ALTER TABLE suitcase_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suitcase photos"
  ON suitcase_photos FOR SELECT
  USING (
    suitcase_id IN (SELECT id FROM suitcases WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert their own suitcase photos"
  ON suitcase_photos FOR INSERT
  WITH CHECK (
    suitcase_id IN (SELECT id FROM suitcases WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update their own suitcase photos"
  ON suitcase_photos FOR UPDATE
  USING (
    suitcase_id IN (SELECT id FROM suitcases WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete their own suitcase photos"
  ON suitcase_photos FOR DELETE
  USING (
    suitcase_id IN (SELECT id FROM suitcases WHERE owner_id = auth.uid())
  );
