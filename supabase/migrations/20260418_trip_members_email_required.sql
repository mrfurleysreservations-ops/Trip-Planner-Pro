-- Migration: Require email on external trip invites.
-- External invite = trip_members row with no user_id AND no family_member_id.
-- For those rows, email must be set so /api/send-invite can deliver a link.
-- App users (user_id set) still don't need email on this row — their email
-- lives on auth.users / user_profiles. Family members (family_member_id set)
-- are dependents auto-attending via the host; they don't get invite emails.
--
-- Before applying: audit + patch any existing external rows with null email.

-- 1) Audit: show external rows that would violate the new constraint.
--    (Safe to run — read-only.)
-- SELECT id, trip_id, name, email FROM trip_members
-- WHERE user_id IS NULL AND family_member_id IS NULL AND email IS NULL;

-- 2) If the audit returns rows, either delete them (stale drafts) or set an
--    email before continuing. Example hard-delete:
-- DELETE FROM trip_members
-- WHERE user_id IS NULL AND family_member_id IS NULL AND email IS NULL;

-- 3) Enforce going forward.
ALTER TABLE trip_members
  DROP CONSTRAINT IF EXISTS trip_members_email_required_for_externals;

ALTER TABLE trip_members
  ADD CONSTRAINT trip_members_email_required_for_externals
  CHECK (
    email IS NOT NULL
    OR user_id IS NOT NULL
    OR family_member_id IS NOT NULL
  );
