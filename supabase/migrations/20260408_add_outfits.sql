-- Migration: Add outfits and outfit_items tables for the outfit system

CREATE TABLE IF NOT EXISTS outfits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name text        NOT NULL,
  name        text        NOT NULL,
  photo_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outfits_owner ON outfits(owner_id);
CREATE INDEX IF NOT EXISTS idx_outfits_person ON outfits(owner_id, person_name);

ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outfits"
  ON outfits FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own outfits"
  ON outfits FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own outfits"
  ON outfits FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own outfits"
  ON outfits FOR DELETE USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS outfit_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id        uuid NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  wardrobe_item_id uuid NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  sort_order       int  DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);

ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outfit items"
  ON outfit_items FOR SELECT
  USING (outfit_id IN (SELECT id FROM outfits WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert their own outfit items"
  ON outfit_items FOR INSERT
  WITH CHECK (outfit_id IN (SELECT id FROM outfits WHERE owner_id = auth.uid()));
CREATE POLICY "Users can delete their own outfit items"
  ON outfit_items FOR DELETE
  USING (outfit_id IN (SELECT id FROM outfits WHERE owner_id = auth.uid()));
