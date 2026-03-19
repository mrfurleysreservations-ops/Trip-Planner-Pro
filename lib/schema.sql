-- ============================================
-- TRIP PLANNER PRO — Database Schema
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → paste → Run)
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── USER PROFILES ───
create table public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  age_type text default 'adult',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
create policy "Users can read own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── FAMILIES (reusable profiles) ───
create table public.families (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  car_snack_pref text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.families enable row level security;
create policy "Owner can CRUD families" on public.families for all using (auth.uid() = owner_id);

-- ─── FAMILY MEMBERS ───
create table public.family_members (
  id uuid default uuid_generate_v4() primary key,
  family_id uuid references public.families on delete cascade not null,
  name text not null,
  age_type text default 'adult',
  appetite text default 'normal',
  linked_user_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table public.family_members enable row level security;
create policy "Owner can CRUD members" on public.family_members for all
  using (exists (select 1 from public.families where id = family_members.family_id and owner_id = auth.uid()));

-- ─── INVENTORY BINS (on family profiles) ───
create table public.inventory_bins (
  id uuid default uuid_generate_v4() primary key,
  family_id uuid references public.families on delete cascade not null,
  name text not null default 'New Bin',
  zone text default 'none',
  created_at timestamptz default now()
);

alter table public.inventory_bins enable row level security;
create policy "Owner can CRUD bins" on public.inventory_bins for all
  using (exists (select 1 from public.families where id = inventory_bins.family_id and owner_id = auth.uid()));

-- ─── INVENTORY ITEMS (inside bins or loose) ───
create table public.inventory_items (
  id uuid default uuid_generate_v4() primary key,
  family_id uuid references public.families on delete cascade not null,
  bin_id uuid references public.inventory_bins on delete set null,
  name text not null default '',
  category text default 'gear',
  is_consumable boolean default false,
  qty_needed integer default 1,
  zone text default 'none',
  created_at timestamptz default now()
);

alter table public.inventory_items enable row level security;
create policy "Owner can CRUD items" on public.inventory_items for all
  using (exists (select 1 from public.families where id = inventory_items.family_id and owner_id = auth.uid()));

-- ─── TRIPS ───
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null default 'New Trip',
  trip_type text not null default 'camping',
  location text default '',
  notes text default '',
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trips enable row level security;
create policy "Owner can CRUD trips" on public.trips for all using (auth.uid() = owner_id);

-- ─── TRIP FAMILIES (which families are on a trip, with copied data) ───
create table public.trip_families (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  source_family_id uuid references public.families on delete set null,
  name text not null,
  members jsonb default '[]',
  created_at timestamptz default now()
);

alter table public.trip_families enable row level security;
create policy "Trip owner can CRUD trip_families" on public.trip_families for all
  using (exists (select 1 from public.trips where id = trip_families.trip_id and owner_id = auth.uid()));

-- ─── TRIP DATA (attendance, meals, snacks, drinks, baby items — stored as JSON) ───
create table public.trip_data (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null unique,
  attendance jsonb default '{}',
  meals jsonb default '{}',
  car_snacks jsonb default '{}',
  camp_snacks text default '',
  camp_snack_family text default '',
  drinks jsonb default '{"na":"","alc":""}',
  drink_family jsonb default '{"na":"","alc":""}',
  baby_items jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trip_data enable row level security;
create policy "Trip owner can CRUD trip_data" on public.trip_data for all
  using (exists (select 1 from public.trips where id = trip_data.trip_id and owner_id = auth.uid()));

-- ─── TRIP INVENTORY (copied from profiles per trip) ───
create table public.trip_inventory (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  trip_family_id uuid references public.trip_families on delete cascade not null,
  bins jsonb default '[]',
  loose_items jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trip_inventory enable row level security;
create policy "Trip owner can CRUD inventory" on public.trip_inventory for all
  using (exists (select 1 from public.trips where id = trip_inventory.trip_id and owner_id = auth.uid()));

-- ─── FRIEND CONNECTIONS ───
create table public.friend_links (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  friend_id uuid references auth.users on delete cascade not null,
  status text default 'pending',
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

alter table public.friend_links enable row level security;
create policy "Users can see own friend links" on public.friend_links for select
  using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users can insert friend links" on public.friend_links for insert
  with check (auth.uid() = user_id);
create policy "Users can update friend links" on public.friend_links for update
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- ─── TRIP INVITATIONS ───
create table public.trip_invitations (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  invited_by uuid references auth.users on delete cascade not null,
  invited_email text,
  invited_user_id uuid references auth.users on delete set null,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table public.trip_invitations enable row level security;
create policy "Inviter or invitee can see invitations" on public.trip_invitations for select
  using (auth.uid() = invited_by or auth.uid() = invited_user_id);
create policy "Users can create invitations" on public.trip_invitations for insert
  with check (auth.uid() = invited_by);
create policy "Invitee can update status" on public.trip_invitations for update
  using (auth.uid() = invited_user_id);

-- ─── INDEXES ───
create index idx_families_owner on public.families(owner_id);
create index idx_trips_owner on public.trips(owner_id);
create index idx_trip_families_trip on public.trip_families(trip_id);
create index idx_trip_data_trip on public.trip_data(trip_id);
create index idx_inventory_bins_family on public.inventory_bins(family_id);
create index idx_inventory_items_family on public.inventory_items(family_id);
create index idx_inventory_items_bin on public.inventory_items(bin_id);
create index idx_friend_links_user on public.friend_links(user_id);
create index idx_trip_invitations_trip on public.trip_invitations(trip_id);
