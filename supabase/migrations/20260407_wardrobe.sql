-- ─── Wardrobe System Migration ───
-- Per-person persistent wardrobe items with optional photos

-- 1. Wardrobe items table
CREATE TABLE IF NOT EXISTS wardrobe_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name text        NOT NULL,
  item_name   text        NOT NULL,
  category    text,
  photo_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_owner ON wardrobe_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_person ON wardrobe_items(owner_id, person_name);

ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wardrobe items"
  ON wardrobe_items FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own wardrobe items"
  ON wardrobe_items FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own wardrobe items"
  ON wardrobe_items FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own wardrobe items"
  ON wardrobe_items FOR DELETE USING (owner_id = auth.uid());

-- 2. Link suitcase items to wardrobe
ALTER TABLE suitcase_items ADD COLUMN IF NOT EXISTS wardrobe_item_id uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL;
