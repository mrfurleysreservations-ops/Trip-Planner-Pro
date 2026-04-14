-- Migration: Create trip_members table for the group/invitation system (Phase 1)
-- Replaces trip_families as the primary people tracker for trips.

CREATE TABLE IF NOT EXISTS trip_members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id          uuid        REFERENCES auth.users(id),
  family_member_id uuid        REFERENCES family_members(id),
  name             text        NOT NULL,
  email            text,
  role             text        NOT NULL DEFAULT 'member'
                               CHECK (role IN ('host', 'member')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by       uuid        NOT NULL REFERENCES auth.users(id),
  invite_token     text        UNIQUE,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trip_members_trip    ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user    ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_token   ON trip_members(invite_token) WHERE invite_token IS NOT NULL;

-- Enable RLS
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see trip_members for any trip they belong to
CREATE POLICY "Users can view members of their trips"
  ON trip_members FOR SELECT
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- INSERT: Only hosts of the trip can add new members
CREATE POLICY "Hosts can invite members to their trips"
  ON trip_members FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
    -- Also allow the trip owner to insert the first member (themselves as host)
    OR trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  );

-- UPDATE: Hosts can update any member; members can update their own row (accept/decline)
CREATE POLICY "Hosts can update any member in their trips"
  ON trip_members FOR UPDATE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );

CREATE POLICY "Members can update their own row"
  ON trip_members FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Only hosts can remove members
CREATE POLICY "Hosts can remove members from their trips"
  ON trip_members FOR DELETE
  USING (
    trip_id IN (
      SELECT tm.trip_id FROM trip_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'host'
    )
  );
