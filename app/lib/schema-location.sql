-- Add lat/lng to trips for weather integration
-- Run in Supabase SQL Editor

alter table public.trips
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_place_id text;
