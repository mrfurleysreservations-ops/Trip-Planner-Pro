-- Migration: Add outfit_groups and outfit_group_events tables

CREATE TABLE outfit_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_member_id uuid NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  date date NOT NULL,
  label text,
  dress_code text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE outfit_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outfit groups for their trips"
  ON outfit_groups FOR SELECT
  USING (trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own outfit groups"
  ON outfit_groups FOR ALL
  USING (trip_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid()));

CREATE TABLE outfit_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_group_id uuid NOT NULL REFERENCES outfit_groups(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
  UNIQUE(outfit_group_id, event_id)
);

ALTER TABLE outfit_group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outfit group events for their trips"
  ON outfit_group_events FOR SELECT
  USING (outfit_group_id IN (SELECT id FROM outfit_groups WHERE trip_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can manage their own outfit group events"
  ON outfit_group_events FOR ALL
  USING (outfit_group_id IN (SELECT id FROM outfit_groups WHERE trip_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())));

ALTER TABLE packing_outfits ADD COLUMN outfit_group_id uuid REFERENCES outfit_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_outfit_groups_trip_member ON outfit_groups(trip_id, trip_member_id);
CREATE INDEX idx_outfit_group_events_group ON outfit_group_events(outfit_group_id);
CREATE INDEX idx_outfit_group_events_event ON outfit_group_events(event_id);
CREATE INDEX idx_packing_outfits_group ON packing_outfits(outfit_group_id);
