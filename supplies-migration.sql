-- =============================================================
-- Trip Planner Pro — Supplies Phase 1
-- Paste into Supabase SQL Editor. Safe to re-run (idempotent).
-- =============================================================

-- ─── itinerary_events: new claimed_by column ───
-- event_type already exists (text). A meal is event_type = 'meal'.
alter table public.itinerary_events
  add column if not exists claimed_by uuid
    references public.trip_members(id) on delete set null;

create index if not exists idx_itinerary_events_event_type on public.itinerary_events(event_type);
create index if not exists idx_itinerary_events_claimed_by on public.itinerary_events(claimed_by);

-- ─── meal_items: food composition for a meal event ───
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.itinerary_events(id) on delete cascade,
  item_name text not null,
  quantity_per_person numeric not null default 1,
  unit text not null default 'each',
  grocery_section text not null default 'other'
    check (grocery_section in (
      'produce','meat','dairy','pantry','bakery',
      'frozen','beverages','snacks','other'
    )),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meal_items_event on public.meal_items(event_id);

alter table public.meal_items enable row level security;

drop policy if exists "trip members manage meal items" on public.meal_items;
create policy "trip members manage meal items" on public.meal_items
  for all
  using (
    exists (
      select 1 from public.itinerary_events e
      join public.trip_members m on m.trip_id = e.trip_id
      where e.id = meal_items.event_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  )
  with check (
    exists (
      select 1 from public.itinerary_events e
      join public.trip_members m on m.trip_id = e.trip_id
      where e.id = meal_items.event_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );

create or replace function public.touch_meal_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_meal_items_updated_at on public.meal_items;
create trigger trg_meal_items_updated_at
  before update on public.meal_items
  for each row execute function public.touch_meal_items_updated_at();

-- ─── supply_items: shared non-food supplies for this trip ───
-- Gear and Cooking are intentionally NOT in this list — owned durable gear
-- lives in the Gear Library (gear_bins / gear_items, already shipped).
create table if not exists public.supply_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text not null default 'other'
    check (category in (
      'fuel','consumables','disposables','toiletries','event','other'
    )),
  quantity integer not null default 1 check (quantity > 0),
  claimed_by uuid references public.trip_members(id) on delete set null,
  status text not null default 'needed'
    check (status in ('needed','claimed','purchased')),
  source_note_id uuid references public.trip_notes(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supply_items_trip on public.supply_items(trip_id);
create index if not exists idx_supply_items_claimed_by on public.supply_items(claimed_by);

alter table public.supply_items enable row level security;

drop policy if exists "supply_items select" on public.supply_items;
create policy "supply_items select" on public.supply_items
  for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = supply_items.trip_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );

-- claimed_by is keyed by trip_member_id — so the owner clause is required
-- or the host can't claim on behalf of family members.
drop policy if exists "supply_items insert" on public.supply_items;
create policy "supply_items insert" on public.supply_items
  for insert
  with check (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = supply_items.trip_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
    and (
      claimed_by is null
      or exists (
        select 1 from public.trip_members cm
        where cm.id = supply_items.claimed_by
          and cm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.trips t
        where t.id = supply_items.trip_id
          and t.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "supply_items update" on public.supply_items;
create policy "supply_items update" on public.supply_items
  for update
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = supply_items.trip_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  )
  with check (
    claimed_by is null
    or exists (
      select 1 from public.trip_members cm
      where cm.id = supply_items.claimed_by
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.trips t
      where t.id = supply_items.trip_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "supply_items delete" on public.supply_items;
create policy "supply_items delete" on public.supply_items
  for delete
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = supply_items.trip_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );

create or replace function public.touch_supply_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_supply_items_updated_at on public.supply_items;
create trigger trg_supply_items_updated_at
  before update on public.supply_items
  for each row execute function public.touch_supply_items_updated_at();

-- ─── grocery_checkoffs: per-user checkbox state on the derived list ───
-- Does NOT mutate meal_items. One row per (meal_item, user).
create table if not exists public.grocery_checkoffs (
  id uuid primary key default gen_random_uuid(),
  meal_item_id uuid not null references public.meal_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique(meal_item_id, user_id)
);

create index if not exists idx_grocery_checkoffs_user on public.grocery_checkoffs(user_id);

alter table public.grocery_checkoffs enable row level security;

drop policy if exists "users manage own checkoffs" on public.grocery_checkoffs;
create policy "users manage own checkoffs" on public.grocery_checkoffs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── trip_notes: supply_id parallel to existing event_id ───
-- converted_to is reused as the target_type discriminator with values
-- 'event' | 'meal' | 'supply'. No CHECK added — the column is free-text
-- today and the UI controls the enum.
alter table public.trip_notes
  add column if not exists supply_id uuid
    references public.supply_items(id) on delete set null;

create index if not exists idx_trip_notes_supply on public.trip_notes(supply_id);
