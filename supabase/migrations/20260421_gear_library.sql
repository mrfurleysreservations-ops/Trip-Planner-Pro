-- Migration: Gear Library (Phase 1)
-- Introduces a user-owned library of reusable gear bins and the items inside them.
-- Migrates existing saved_gear rows into a single "Imported Gear" bin per user.
-- Leaves public.saved_gear intact until Phase 2.

-- ─── gear_bins: user-owned library of reusable bins ───
create table if not exists public.gear_bins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  default_location text check (default_location in ('frunk','cabin','trunk','roofbox','tow_hitch')),
  color text default '#5a9a2f',
  icon text default '📦',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gear_bins_owner on public.gear_bins(owner_id) where archived_at is null;

alter table public.gear_bins enable row level security;

drop policy if exists "owners manage their bins" on public.gear_bins;
create policy "owners manage their bins" on public.gear_bins
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- keep updated_at honest
create or replace function public.touch_gear_bins_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_gear_bins_updated_at on public.gear_bins;
create trigger trg_gear_bins_updated_at
  before update on public.gear_bins
  for each row execute function public.touch_gear_bins_updated_at();

-- ─── gear_items: items that live inside a bin ───
create table if not exists public.gear_items (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.gear_bins(id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gear_items_bin on public.gear_items(bin_id);

alter table public.gear_items enable row level security;

drop policy if exists "bin owners manage items" on public.gear_items;
create policy "bin owners manage items" on public.gear_items
  for all
  using (exists (select 1 from public.gear_bins b where b.id = bin_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.gear_bins b where b.id = bin_id and b.owner_id = auth.uid()));

-- ─── Migrate existing saved_gear rows (non-destructive) ───
-- Create one "Imported Gear" bin per user that has old rows.
insert into public.gear_bins (owner_id, name, description, default_location, icon)
select distinct sg.owner_id,
       'Imported Gear',
       'Auto-created from your old saved gear list. Rename, recolor, or split into specialized bins as you like.',
       'trunk',
       '📥'
from public.saved_gear sg
where not exists (
  select 1 from public.gear_bins b
  where b.owner_id = sg.owner_id and b.name = 'Imported Gear'
);

-- Copy items into those bins.
insert into public.gear_items (bin_id, name, notes, sort_order)
select b.id, sg.name, sg.category, 0
from public.saved_gear sg
join public.gear_bins b
  on b.owner_id = sg.owner_id
 and b.name = 'Imported Gear'
where not exists (
  select 1 from public.gear_items gi
  where gi.bin_id = b.id and gi.name = sg.name
);

-- Leave public.saved_gear intact for now. Phase 2 removes it after we've verified nothing regresses.
