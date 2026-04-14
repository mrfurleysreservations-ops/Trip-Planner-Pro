-- Migration: Create trip_notes table for the research/ideas system (Phase 2)
-- Each note captures one idea that can be finalized into an itinerary event.

CREATE TABLE IF NOT EXISTS trip_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  title        text        NOT NULL,
  body         text,
  link_url     text,
  photo_url    text,
  status       text        NOT NULL DEFAULT 'idea'
                           CHECK (status IN ('idea', 'finalized')),
  event_id     uuid,       -- populated when finalized into an itinerary event (FK added in Phase 3)
  sort_order   integer     DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trip_notes_trip       ON trip_notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_notes_created_by ON trip_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_notes_status     ON trip_notes(trip_id, status);

-- Enable RLS
ALTER TABLE trip_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: any trip_member of this trip can read notes
CREATE POLICY "Trip members can view notes"
  ON trip_notes FOR SELECT
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- INSERT: any trip_member of this trip can create notes
CREATE POLICY "Trip members can create notes"
  ON trip_notes FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- UPDATE: note creator can edit their own, OR any host can edit any note
CREATE POLICY "Note creators can update their own notes"
  ON trip_notes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Hosts can update any note in their trips"
  ON trip_notes FOR UPDATE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );

-- DELETE: note creator can delete their own, OR any host can delete any
CREATE POLICY "Note creators can delete their own notes"
  ON trip_notes FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Hosts can delete any note in their trips"
  ON trip_notes FOR DELETE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );
