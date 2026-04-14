-- Migration: Create itinerary_events + event_participants tables (Phase 3)
-- Also adds the FK from trip_notes.event_id → itinerary_events.id.

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 1: itinerary_events
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS itinerary_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by         uuid        NOT NULL REFERENCES auth.users(id),
  date               date        NOT NULL,
  time_slot          text        NOT NULL
                                 CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
  start_time         time,
  end_time           time,
  title              text        NOT NULL,
  description        text,
  location           text,
  event_type         text        NOT NULL
                                 CHECK (event_type IN (
                                   'travel', 'activity', 'dining', 'outdoors',
                                   'nightlife', 'downtime', 'shopping', 'other'
                                 )),
  dress_code         text
                                 CHECK (dress_code IN (
                                   'casual', 'smart_casual', 'formal', 'active',
                                   'swimwear', 'outdoor', 'business'
                                 )),
  reservation_number text,
  confirmation_code  text,
  cost_per_person    numeric,
  external_link      text,
  is_optional        boolean     DEFAULT false,
  note_id            uuid        REFERENCES trip_notes(id) ON DELETE SET NULL,
  sort_order         integer     DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_itinerary_events_trip     ON itinerary_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_events_date     ON itinerary_events(trip_id, date, time_slot);
CREATE INDEX IF NOT EXISTS idx_itinerary_events_note     ON itinerary_events(note_id) WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_itinerary_events_creator  ON itinerary_events(created_by);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 2: event_participants
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_participants (
  id              uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid   NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
  trip_member_id  uuid   NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  status          text   NOT NULL DEFAULT 'attending'
                         CHECK (status IN ('attending', 'skipping')),
  UNIQUE(event_id, trip_member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_participants_event  ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_member ON event_participants(trip_member_id);

-- ═══════════════════════════════════════════════════════════════════
-- ALTER: Add FK from trip_notes.event_id → itinerary_events.id
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE trip_notes
  ADD CONSTRAINT fk_trip_notes_event
  FOREIGN KEY (event_id) REFERENCES itinerary_events(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════
-- RLS: itinerary_events
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE itinerary_events ENABLE ROW LEVEL SECURITY;

-- SELECT: any trip member can view events for their trips
CREATE POLICY "Trip members can view itinerary events"
  ON itinerary_events FOR SELECT
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- INSERT: any trip member can suggest events (hosts + members)
CREATE POLICY "Trip members can create itinerary events"
  ON itinerary_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- UPDATE: hosts can update any event in their trips
CREATE POLICY "Hosts can update any itinerary event"
  ON itinerary_events FOR UPDATE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );

-- UPDATE: event creator can update their own event
CREATE POLICY "Event creators can update their own events"
  ON itinerary_events FOR UPDATE
  USING (created_by = auth.uid());

-- DELETE: hosts can delete any event
CREATE POLICY "Hosts can delete itinerary events"
  ON itinerary_events FOR DELETE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );

-- DELETE: event creator can delete their own event
CREATE POLICY "Event creators can delete their own events"
  ON itinerary_events FOR DELETE
  USING (created_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- RLS: event_participants
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: any trip member can view participants for events in their trips
CREATE POLICY "Trip members can view event participants"
  ON event_participants FOR SELECT
  USING (
    event_id IN (
      SELECT ie.id FROM itinerary_events ie
      WHERE ie.trip_id IN (
        SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
      )
    )
  );

-- INSERT: hosts can insert participant rows (for auto-populating on event creation)
CREATE POLICY "Hosts can insert event participants"
  ON event_participants FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT ie.id FROM itinerary_events ie
      WHERE ie.trip_id IN (
        SELECT tm.trip_id FROM trip_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'host'
      )
    )
  );

-- INSERT: event creator can also insert participants (they just created the event)
CREATE POLICY "Event creators can insert participants"
  ON event_participants FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT ie.id FROM itinerary_events ie
      WHERE ie.created_by = auth.uid()
    )
  );

-- UPDATE: each person can update their own status (opt in/out)
CREATE POLICY "Members can update their own participation status"
  ON event_participants FOR UPDATE
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- UPDATE: hosts can update any participant status
CREATE POLICY "Hosts can update any participant status"
  ON event_participants FOR UPDATE
  USING (
    event_id IN (
      SELECT ie.id FROM itinerary_events ie
      WHERE ie.trip_id IN (
        SELECT tm.trip_id FROM trip_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'host'
      )
    )
  );

-- DELETE: hosts can delete participant rows
CREATE POLICY "Hosts can delete event participants"
  ON event_participants FOR DELETE
  USING (
    event_id IN (
      SELECT ie.id FROM itinerary_events ie
      WHERE ie.trip_id IN (
        SELECT tm.trip_id FROM trip_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'host'
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: Auto-populate event_participants on event creation
-- All accepted trip_members get an 'attending' row when an event is created.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_populate_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO event_participants (event_id, trip_member_id, status)
  SELECT NEW.id, tm.id, 'attending'
  FROM trip_members tm
  WHERE tm.trip_id = NEW.trip_id
    AND tm.status = 'accepted';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_populate_event_participants
  AFTER INSERT ON itinerary_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_event_participants();
