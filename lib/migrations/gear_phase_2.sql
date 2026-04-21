-- ============================================================================
-- Gear Phase 2 migration
--
-- Adds:
--   • gear_bins.parent_bin_id  — arbitrary-depth nesting (self-FK, nullable)
--   • trip_gear_bins           — join table: which library bins are on a trip
--   • user_profiles.primary_vehicle_name — single vehicle label for Phase 2
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- ─── gear_bins.parent_bin_id ────────────────────────────────────────────────
-- Self-referential FK. ON DELETE CASCADE so archiving/deleting a parent bin
-- takes its descendants with it.
alter table public.gear_bins
  add column if not exists parent_bin_id uuid references public.gear_bins(id) on delete cascade;

create index if not exists idx_gear_bins_parent on public.gear_bins(parent_bin_id);


-- ─── trip_gear_bins ────────────────────────────────────────────────────────
create table if not exists public.trip_gear_bins (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  bin_id uuid not null references public.gear_bins(id) on delete cascade,
  location_override text check (location_override in ('frunk','cabin','trunk','roofbox','tow_hitch')),
  loaded boolean not null default false,
  loaded_at timestamptz,
  loaded_by uuid references auth.users(id),
  notes text,
  added_by uuid not null references auth.users(id),
  added_at timestamptz not null default now(),
  unique (trip_id, bin_id)
);

create index if not exists idx_trip_gear_bins_trip on public.trip_gear_bins(trip_id);
create index if not exists idx_trip_gear_bins_bin  on public.trip_gear_bins(bin_id);

alter table public.trip_gear_bins enable row level security;

-- Only the trip owner manages gear for Phase 2.
drop policy if exists "trip owner manages gear" on public.trip_gear_bins;
create policy "trip owner manages gear" on public.trip_gear_bins
  for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));


-- ─── user_profiles.primary_vehicle_name ────────────────────────────────────
-- Single-vehicle model for Phase 2.
alter table public.user_profiles
  add column if not exists primary_vehicle_name text;
