-- Migration: Role-based density (RSVP Energy)
-- Adds per-trip role_preference + chat_notification_level on trip_members,
-- and default_role_preference on user_profiles. Backfills existing rows.

-- ─── trip_members.role_preference ────────────────────────────────────────
ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS role_preference text
    NOT NULL
    DEFAULT 'helping_out'
    CHECK (role_preference IN ('all_in', 'helping_out', 'just_here', 'vibes_only'));

-- ─── trip_members.chat_notification_level ────────────────────────────────
ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS chat_notification_level text
    NOT NULL
    DEFAULT 'all'
    CHECK (chat_notification_level IN ('all', 'mentions', 'muted'));

-- ─── user_profiles.default_role_preference ───────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS default_role_preference text
    CHECK (default_role_preference IN ('all_in', 'helping_out', 'just_here', 'vibes_only'));

-- ─── Backfill existing trip_members ──────────────────────────────────────
-- Hosts default to 'all_in', everyone else stays at the column default 'helping_out'.
UPDATE trip_members
   SET role_preference = 'all_in'
 WHERE role = 'host'
   AND role_preference = 'helping_out';  -- only touch rows still at default

-- Indexes for common lookups (role-based filtering + default tab routing)
CREATE INDEX IF NOT EXISTS idx_trip_members_role_pref
  ON trip_members(trip_id, role_preference);
