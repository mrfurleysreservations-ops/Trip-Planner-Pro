-- ============================================================================
-- Gear Phase 2b — standalone items
--
-- Some gear (tents, chairs, tables) isn't packed inside a bin — it just goes
-- into a car zone directly. Rather than add a parallel "standalone_items"
-- table, we model these as a variant of gear_bins:
--
--   • is_standalone=true  → row represents a single item (or N copies)
--                           — cannot have child bins
--                           — cannot hold gear_items
--                           — quantity is shown as ×N
--   • is_standalone=false → normal bin (current behavior)
--
-- The `quantity` column applies only to standalone rows; non-standalone bins
-- ignore it (defaults to 1 but is unused).
--
-- Reuses the existing trip_gear_bins join unchanged — standalone rows get
-- added to a trip exactly like regular bins.
--
-- Run this in the Supabase SQL Editor AFTER gear_phase_2.sql.
-- ============================================================================

alter table public.gear_bins
  add column if not exists is_standalone boolean not null default false,
  add column if not exists quantity       integer not null default 1;

-- Guard: standalone rows may not be nested or hold children.
-- (We can't cheaply enforce "no gear_items" at DB level without a trigger;
-- the UI is the source of truth for that.)
alter table public.gear_bins
  drop constraint if exists gear_bins_standalone_no_parent_chk;
alter table public.gear_bins
  add constraint gear_bins_standalone_no_parent_chk
  check (not (is_standalone = true and parent_bin_id is not null));

-- Quantity must be ≥ 1 for standalone rows.
alter table public.gear_bins
  drop constraint if exists gear_bins_standalone_quantity_chk;
alter table public.gear_bins
  add constraint gear_bins_standalone_quantity_chk
  check (quantity >= 1);
