-- ============================================
-- TRIP PLANNER PRO — Schema Update Phase 1
-- Run this in Supabase SQL Editor
-- This ADDS to your existing schema — safe to run
-- ============================================

-- ─── UPDATE USER PROFILES (add new fields) ───
alter table public.user_profiles
  add column if not exists phone text default '',
  add column if not exists city text default '',
  add column if not exists bio text default '',
  add column if not exists avatar_url text default '';

-- ─── FAMILY MEMBERSHIPS (user ↔ family linking) ───
create table if not exists public.family_memberships (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  family_id uuid references public.families on delete cascade not null,
  role text default 'member' check (role in ('owner', 'member')),
  status text default 'active' check (status in ('pending', 'active', 'declined')),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique(user_id, family_id)
);

alter table public.family_memberships enable row level security;
create policy "Users see own memberships" on public.family_memberships
  for select using (auth.uid() = user_id or auth.uid() = invited_by);
create policy "Users can insert memberships" on public.family_memberships
  for insert with check (auth.uid() = invited_by or auth.uid() = user_id);
create policy "Users can update own memberships" on public.family_memberships
  for update using (auth.uid() = user_id or auth.uid() = invited_by);
create policy "Owners can delete memberships" on public.family_memberships
  for delete using (auth.uid() = invited_by);

-- Auto-create owner membership when a family is created
create or replace function public.handle_new_family()
returns trigger as $$
begin
  insert into public.family_memberships (user_id, family_id, role, status, invited_by)
  values (new.owner_id, new.id, 'owner', 'active', new.owner_id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_family_created on public.families;
create trigger on_family_created
  after insert on public.families
  for each row execute function public.handle_new_family();

-- ─── INVITE LINKS (for non-users) ───
create table if not exists public.invite_links (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  invited_email text,
  family_id uuid references public.families on delete set null,
  trip_id uuid references public.trips on delete set null,
  used_by uuid references auth.users on delete set null,
  status text default 'pending' check (status in ('pending', 'used', 'expired')),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

alter table public.invite_links enable row level security;
create policy "Creator can manage invites" on public.invite_links
  for all using (auth.uid() = created_by);
create policy "Anyone can read by code" on public.invite_links
  for select using (true);

-- ─── UPDATE FRIEND LINKS (ensure proper structure) ───
-- Drop old policies if they exist and recreate
do $$
begin
  -- Add columns if missing
  if not exists (select 1 from information_schema.columns where table_name = 'friend_links' and column_name = 'status') then
    alter table public.friend_links add column status text default 'pending';
  end if;
end $$;

-- ─── WARDROBE TEMPLATES (per-person saved clothing) ───
create table if not exists public.wardrobe_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  family_member_id uuid references public.family_members on delete cascade,
  name text not null,
  category text default 'everyday' check (category in ('everyday', 'activity', 'weather', 'toiletry')),
  subcategory text default '',
  activity_tags text[] default '{}',
  weather_tags text[] default '{}',
  is_standard boolean default true,
  created_at timestamptz default now()
);

alter table public.wardrobe_items enable row level security;
create policy "Users manage own wardrobe" on public.wardrobe_items
  for all using (auth.uid() = user_id);

-- ─── ACTIVITY TYPES (for clothing suggestions) ───
create table if not exists public.activity_types (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  icon text default '',
  clothing_suggestions text[] default '{}',
  created_at timestamptz default now()
);

alter table public.activity_types enable row level security;
create policy "Anyone can read activities" on public.activity_types for select using (true);

-- Insert default activities
insert into public.activity_types (name, icon, clothing_suggestions) values
  ('Hiking', '🥾', '{"hiking boots","moisture-wicking shirt","hiking pants","hat","sunglasses"}'),
  ('Swimming', '🏊', '{"swimsuit","towel","flip flops","cover-up","goggles"}'),
  ('Fancy Dinner', '🍽️', '{"dress shirt or blouse","dress pants or skirt","dress shoes","belt","nice watch"}'),
  ('Pool Party', '🏖️', '{"swimsuit","towel","sandals","sunscreen","sunglasses","cover-up"}'),
  ('Camping', '🏕️', '{"layers","boots","warm jacket","beanie","gloves"}'),
  ('Fishing', '🎣', '{"rain jacket","boots","hat","sunscreen","quick-dry pants"}'),
  ('Beach Day', '🏖️', '{"swimsuit","towel","sandals","sunscreen","hat","sunglasses"}'),
  ('Sightseeing', '📸', '{"comfortable walking shoes","layers","backpack","sunglasses"}'),
  ('Skiing', '⛷️', '{"ski jacket","ski pants","thermals","gloves","goggles","beanie"}'),
  ('BBQ/Cookout', '🍖', '{"casual clothes","comfortable shoes","light jacket"}'),
  ('Boating', '⛵', '{"non-slip shoes","windbreaker","hat","sunscreen","sunglasses"}'),
  ('Rock Climbing', '🧗', '{"climbing shoes","athletic wear","chalk bag","helmet"}'),
  ('Biking', '🚴', '{"bike shorts","jersey","helmet","gloves","sunglasses"}'),
  ('Casual Outing', '👕', '{"jeans","t-shirt","sneakers","light jacket"}')
on conflict (name) do nothing;

-- ─── TRIP SUITCASES (per-person per-trip) ───
create table if not exists public.trip_suitcases (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  trip_family_id uuid references public.trip_families on delete cascade not null,
  member_name text not null,
  items jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trip_suitcases enable row level security;
create policy "Trip owner manages suitcases" on public.trip_suitcases
  for all using (exists (
    select 1 from public.trips where id = trip_suitcases.trip_id and owner_id = auth.uid()
  ));

-- ─── TRIP ACTIVITIES (planned activities per day) ───
create table if not exists public.trip_activities (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  activity_date date,
  activity_name text not null,
  activity_icon text default '',
  notes text default '',
  created_at timestamptz default now()
);

alter table public.trip_activities enable row level security;
create policy "Trip owner manages activities" on public.trip_activities
  for all using (exists (
    select 1 from public.trips where id = trip_activities.trip_id and owner_id = auth.uid()
  ));

-- ═══ FUTURE-PROOFED TABLES (empty, ready for later phases) ═══

-- Budget tracking
create table if not exists public.trip_expenses (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null default 0,
  paid_by uuid references public.trip_families on delete set null,
  split_among uuid[] default '{}',
  category text default 'general',
  expense_date date,
  created_at timestamptz default now()
);

alter table public.trip_expenses enable row level security;
create policy "Trip owner manages expenses" on public.trip_expenses
  for all using (exists (
    select 1 from public.trips where id = trip_expenses.trip_id and owner_id = auth.uid()
  ));

-- Photo sharing
create table if not exists public.trip_photos (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  uploaded_by uuid references auth.users on delete cascade not null,
  photo_url text not null,
  caption text default '',
  photo_date date,
  created_at timestamptz default now()
);

alter table public.trip_photos enable row level security;
create policy "Trip members can see photos" on public.trip_photos
  for select using (exists (
    select 1 from public.trips where id = trip_photos.trip_id and owner_id = auth.uid()
  ));
create policy "Users can upload photos" on public.trip_photos
  for insert with check (auth.uid() = uploaded_by);

-- Shared documents
create table if not exists public.trip_documents (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  uploaded_by uuid references auth.users on delete cascade not null,
  name text not null,
  file_url text,
  doc_type text default 'general',
  created_at timestamptz default now()
);

alter table public.trip_documents enable row level security;
create policy "Trip owner manages docs" on public.trip_documents
  for all using (exists (
    select 1 from public.trips where id = trip_documents.trip_id and owner_id = auth.uid()
  ));

-- Shared to-do list
create table if not exists public.trip_todos (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  task text not null,
  assigned_to uuid references public.trip_families on delete set null,
  is_done boolean default false,
  due_date date,
  created_at timestamptz default now()
);

alter table public.trip_todos enable row level security;
create policy "Trip owner manages todos" on public.trip_todos
  for all using (exists (
    select 1 from public.trips where id = trip_todos.trip_id and owner_id = auth.uid()
  ));

-- Trip reviews
create table if not exists public.trip_reviews (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  rating integer check (rating between 1 and 5),
  what_worked text default '',
  what_didnt text default '',
  notes text default '',
  created_at timestamptz default now(),
  unique(trip_id, user_id)
);

alter table public.trip_reviews enable row level security;
create policy "Users manage own reviews" on public.trip_reviews
  for all using (auth.uid() = user_id);
create policy "Trip members can read reviews" on public.trip_reviews
  for select using (exists (
    select 1 from public.trips where id = trip_reviews.trip_id and owner_id = auth.uid()
  ));

-- ─── NEW INDEXES ───
create index if not exists idx_family_memberships_user on public.family_memberships(user_id);
create index if not exists idx_family_memberships_family on public.family_memberships(family_id);
create index if not exists idx_invite_links_code on public.invite_links(invite_code);
create index if not exists idx_wardrobe_user on public.wardrobe_items(user_id);
create index if not exists idx_trip_suitcases_trip on public.trip_suitcases(trip_id);
create index if not exists idx_trip_activities_trip on public.trip_activities(trip_id);
create index if not exists idx_trip_expenses_trip on public.trip_expenses(trip_id);

-- ─── STORAGE BUCKET for profile pictures ───
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Anyone can view avatars" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
