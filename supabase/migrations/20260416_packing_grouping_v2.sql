-- ─────────────────────────────────────────────────────────────
-- Packing Grouping V2: weather cache + outfit_groups extensions
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1. Extend outfit_groups with time_of_day + weather_bucket
alter table public.outfit_groups
  add column if not exists time_of_day text
    check (time_of_day in ('morning','afternoon','evening','night')),
  add column if not exists weather_bucket text
    check (weather_bucket in ('hot_sunny','warm_sunny','mild','cold','rainy','snowy','unknown'));

-- Backfill existing rows so the UI can still render them
update public.outfit_groups
set time_of_day = coalesce(time_of_day, 'afternoon'),
    weather_bucket = coalesce(weather_bucket, 'unknown')
where time_of_day is null or weather_bucket is null;

-- 2. Trip weather cache
create table if not exists public.trip_weather_forecast (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  forecast_date date not null,
  time_of_day text not null
    check (time_of_day in ('morning','afternoon','evening','night','all_day')),
  temperature_high_f numeric,
  temperature_low_f numeric,
  weather_code int,
  precipitation_probability int,
  weather_bucket text not null
    check (weather_bucket in ('hot_sunny','warm_sunny','mild','cold','rainy','snowy','unknown')),
  fetched_at timestamptz not null default now(),
  unique (trip_id, forecast_date, time_of_day)
);

create index if not exists trip_weather_forecast_trip_date_idx
  on public.trip_weather_forecast (trip_id, forecast_date);

-- 3. RLS on trip_weather_forecast: trip members can read, host can write
alter table public.trip_weather_forecast enable row level security;

drop policy if exists "members_read_weather" on public.trip_weather_forecast;
create policy "members_read_weather"
on public.trip_weather_forecast for select
to authenticated
using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_weather_forecast.trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'accepted'
  )
);

drop policy if exists "host_write_weather" on public.trip_weather_forecast;
create policy "host_write_weather"
on public.trip_weather_forecast for all
to authenticated
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_weather_forecast.trip_id
      and t.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_weather_forecast.trip_id
      and t.owner_id = auth.uid()
  )
);
