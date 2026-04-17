-- Fix: the original outfit_groups / outfit_group_events RLS only allowed a
-- user to manage rows where trip_member_id matched their own trip_members
-- row (user_id = auth.uid()). That silently blocked the trip owner from
-- creating outfit_groups for family members (wife, kids) whose trip_members
-- row is linked via family_member_id and has user_id = NULL.
--
-- Symptom: Claire's Packing page showed the "Events are being automatically
-- grouped by dress code… Re-Group Events" empty state and tapping the button
-- did nothing — the insert returned an RLS error that the client swallowed
-- with `continue`.
--
-- Fix: widen the policy so the trip owner can manage outfit_groups and
-- outfit_group_events for ANY trip_member in a trip they own. Keep the
-- self-manage clause so outside invitees (separate accounts) can still
-- manage their own groups.

-- ─── outfit_groups ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage their own outfit groups" ON outfit_groups;

CREATE POLICY "Manage outfit groups: self or trip owner"
  ON outfit_groups FOR ALL
  USING (
    -- Your own outfit_group (separate-account member)
    trip_member_id IN (
      SELECT id FROM trip_members WHERE user_id = auth.uid()
    )
    -- Or you own the trip (host can manage family members' groups)
    OR trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    trip_member_id IN (
      SELECT id FROM trip_members WHERE user_id = auth.uid()
    )
    OR trip_id IN (
      SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
    )
  );

-- ─── outfit_group_events ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage their own outfit group events" ON outfit_group_events;

CREATE POLICY "Manage outfit group events: self or trip owner"
  ON outfit_group_events FOR ALL
  USING (
    outfit_group_id IN (
      SELECT og.id FROM outfit_groups og
      WHERE og.trip_member_id IN (
              SELECT id FROM trip_members WHERE user_id = auth.uid()
            )
         OR og.trip_id IN (
              SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
            )
    )
  )
  WITH CHECK (
    outfit_group_id IN (
      SELECT og.id FROM outfit_groups og
      WHERE og.trip_member_id IN (
              SELECT id FROM trip_members WHERE user_id = auth.uid()
            )
         OR og.trip_id IN (
              SELECT t.id FROM trips t WHERE t.owner_id = auth.uid()
            )
    )
  );
