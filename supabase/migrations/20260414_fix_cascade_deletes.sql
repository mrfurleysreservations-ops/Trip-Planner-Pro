-- Fix foreign keys referencing auth.users that are missing ON DELETE behavior.
-- Without this, deleting a user from auth.users is blocked by these constraints.

-- itinerary_events.created_by → CASCADE (user's events should be removed)
ALTER TABLE itinerary_events
  DROP CONSTRAINT itinerary_events_created_by_fkey,
  ADD CONSTRAINT itinerary_events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- saved_gear.owner_id → CASCADE (user's saved gear should be removed)
ALTER TABLE saved_gear
  DROP CONSTRAINT saved_gear_owner_id_fkey,
  ADD CONSTRAINT saved_gear_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- suitcases.owner_id → CASCADE (user's suitcases should be removed)
ALTER TABLE suitcases
  DROP CONSTRAINT suitcases_owner_id_fkey,
  ADD CONSTRAINT suitcases_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- trip_bookings.added_by → SET NULL (booking stays for other members)
ALTER TABLE trip_bookings
  DROP CONSTRAINT trip_bookings_added_by_fkey,
  ADD CONSTRAINT trip_bookings_added_by_fkey
    FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- trip_expenses.created_by → SET NULL (expense stays for other members)
ALTER TABLE trip_expenses
  DROP CONSTRAINT trip_expenses_created_by_fkey,
  ADD CONSTRAINT trip_expenses_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- trip_members.user_id → CASCADE (membership should be removed with user)
ALTER TABLE trip_members
  DROP CONSTRAINT trip_members_user_id_fkey,
  ADD CONSTRAINT trip_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- trip_members.invited_by → SET NULL (member stays, just lose who invited them)
ALTER TABLE trip_members
  DROP CONSTRAINT trip_members_invited_by_fkey,
  ADD CONSTRAINT trip_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- trip_notes.created_by → CASCADE (user's notes should be removed)
ALTER TABLE trip_notes
  DROP CONSTRAINT trip_notes_created_by_fkey,
  ADD CONSTRAINT trip_notes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
