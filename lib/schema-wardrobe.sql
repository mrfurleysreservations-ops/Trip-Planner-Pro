-- Wardrobe items (per person, saved permanently, reusable across trips)
create table if not exists public.wardrobe_items (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  member_name text not null,
  item_type text not null,
  item_label text not null,
  category text not null,
  quantity integer default 1,
  notes text default '',
  created_at timestamptz default now()
);

alter table public.wardrobe_items enable row level security;
create policy "wardrobe_owner" on public.wardrobe_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Trip itinerary (activities per day)
create table if not exists public.trip_itinerary (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  day_date text not null,
  activity_type text not null,
  activity_name text default '',
  notes text default '',
  time_slot text default '',
  created_at timestamptz default now()
);

alter table public.trip_itinerary enable row level security;
create policy "itinerary_read" on public.trip_itinerary for select using (auth.uid() is not null);
create policy "itinerary_write" on public.trip_itinerary for insert with check (auth.uid() is not null);
create policy "itinerary_update" on public.trip_itinerary for update using (auth.uid() is not null);
create policy "itinerary_delete" on public.trip_itinerary for delete using (auth.uid() is not null);

-- Trip packing (per person per trip, links to wardrobe)
create table if not exists public.trip_packing (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  member_name text not null,
  family_id uuid,
  items jsonb default '[]',
  created_at timestamptz default now()
);

alter table public.trip_packing enable row level security;
create policy "packing_read" on public.trip_packing for select using (auth.uid() is not null);
create policy "packing_write" on public.trip_packing for insert with check (auth.uid() is not null);
create policy "packing_update" on public.trip_packing for update using (auth.uid() is not null);
create policy "packing_delete" on public.trip_packing for delete using (auth.uid() is not null);
