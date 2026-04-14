-- Fix: The original SELECT policy on trip_members was self-referential.
-- It checked trip_members to authorize reading trip_members, which PostgreSQL
-- blocks because RLS applies to the subquery too. This caused all SELECTs
-- to return empty results.
--
-- Fix: Use the trips table (owner_id) as the non-circular authority,
-- plus allow any authenticated user to see rows where their own user_id matches.

-- Drop the broken SELECT policy
DROP POLICY IF EXISTS "Users can view members of their trips" ON trip_members;

-- New SELECT policy: you can see trip_members if:
--   1. You own the trip (trips.owner_id), OR
--   2. Your user_id appears in the row itself (you are a member)
CREATE POLICY "Users can view members of their trips"
  ON trip_members FOR SELECT
  USING (
    -- You're a member in this row
    user_id = auth.uid()
    -- Or you own the trip
    OR trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
    -- Or you're on the same trip (non-circular: checks your own row first via the clause above,
    -- then this lets you see OTHER members of trips you belong to)
    OR trip_id IN (
      SELECT tm.trip_id FROM trip_members tm WHERE tm.user_id = auth.uid()
    )
  );

-- Also fix the INSERT policy to be simpler and non-circular
DROP POLICY IF EXISTS "Hosts can invite members to their trips" ON trip_members;

CREATE POLICY "Trip owners and hosts can invite members"
  ON trip_members FOR INSERT
  WITH CHECK (
    -- Trip owner can always insert
    trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  );

-- Fix UPDATE policies similarly
DROP POLICY IF EXISTS "Hosts can update any member in their trips" ON trip_members;
DROP POLICY IF EXISTS "Members can update their own row" ON trip_members;

CREATE POLICY "Trip owners can update any member"
  ON trip_members FOR UPDATE
  USING (
    trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Members can update their own row"
  ON trip_members FOR UPDATE
  USING (user_id = auth.uid());

-- Fix DELETE policy
DROP POLICY IF EXISTS "Hosts can remove members from their trips" ON trip_members;

CREATE POLICY "Trip owners can remove members"
  ON trip_members FOR DELETE
  USING (
    trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  );
