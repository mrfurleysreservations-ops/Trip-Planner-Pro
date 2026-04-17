-- ─────────────────────────────────────────────────────────────
-- Packing: slot-based outfit builder — supporting migration.
-- Run this in the Supabase SQL Editor.
--
-- 1. Consolidate head / headwear categories into accessories so the new
--    2×3 slot grid (Dress, Top, Layer, Bottom, Shoes, Accessories) has a
--    single home for hats, beanies, caps, visors.
-- 2. Add trip_members.show_dress_slot so the Dress tile can be gated
--    per-member. user_profiles.gender is the upstream signal for
--    linked users; show_dress_slot lets hosts toggle it for invitees
--    with no profile and lets linked users override.
-- ─────────────────────────────────────────────────────────────

-- 1. Head / headwear → accessories ───────────────────────────
-- "accessories" (plural) is the canonical value defined in lib/constants.ts
-- (PACKING_CATEGORIES). Any legacy "head" / "hat" / "headwear" rows collapse
-- into it.

update public.packing_items
set category = 'accessories',
    updated_at = now()
where category in ('head', 'hat', 'hats', 'headwear');

-- 2. trip_members.show_dress_slot ────────────────────────────
-- Default false so the slot is hidden until explicitly enabled. Backfill to
-- true when the linked user_profile identifies as female — matches existing
-- gender-aware behavior in getDressCodeEssentials() without requiring any
-- new user action.

alter table public.trip_members
  add column if not exists show_dress_slot boolean not null default false;

update public.trip_members tm
set show_dress_slot = true
from public.user_profiles p
where tm.user_id = p.id
  and p.gender = 'female'
  and tm.show_dress_slot = false;
