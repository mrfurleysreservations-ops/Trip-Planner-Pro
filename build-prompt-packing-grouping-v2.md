# Build Prompt: Packing Grouping V2 — Time-of-Day + Weather, Timeline Cards (Group + Outfit)

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Context

The packing page's "grouping" view currently buckets itinerary events into outfit groups by **date + dress_code** only. This is too coarse: a morning run and an evening dinner can end up in the same group when they share a dress code, and weather differences are ignored entirely.

We're doing three things in this pass:
1. Rebuilding the auto-grouping logic to factor in time of day and weather.
2. Redesigning the grouping-view card with a "timeline" treatment (Variant D).
3. Reskinning the walkthrough outfit-build card to match the same visual language so the two views feel like one system.

Reference file: `app/trip/[id]/packing/packing-page.tsx`
- `autoGroupEvents` — currently around line 368
- Grouping view render block — `{activeView === "grouping" && …}`, currently around line 1215
- Standard outfit card render — `currentStepType === "outfitGroup" && …`, currently around line 1428

Reference mockup: `mockup-grouping-and-outfit-cards.html` (side-by-side, both cards).

---

## Part 1 — New grouping logic

Replace the current bucketing in `autoGroupEvents` with a composite key in this priority order:

1. **Time of day** (splits first). Buckets derived from `itinerary_events.start_time`:
   - `morning` — 05:00–10:59
   - `afternoon` — 11:00–15:59
   - `evening` — 16:00–20:59
   - `night` — 21:00–04:59
   - Fallback when `start_time` is null: use `time_slot` if it already matches one of the four buckets; otherwise default to `afternoon`.

2. **Weather bucket** (splits next). Per date, per time-of-day. Buckets:
   - `hot_sunny` — ≥85°F, clear/partly cloudy
   - `warm_sunny` — 70–84°F, clear/partly cloudy
   - `mild` — 55–69°F, any non-precipitation
   - `cold` — <55°F, any non-precipitation
   - `rainy` — any temperature with rain/drizzle/thunderstorm
   - `snowy` — any temperature with snow/sleet
   - When forecast unavailable (trip >16 days out, location missing, or API error): bucket as `unknown`. Treat `unknown` as a wildcard — it groups with any other bucket on the same date/time-of-day/dress-code.

3. **Hard-split dress codes** (never merge across, even if other factors match): `swimwear`, `formal`, `active`. Each gets its own group regardless of what else is happening.

4. **Dress code** is the final filter. Same code + all above matching = same group.

**Grouping key** = `date || '_' || time_of_day || '_' || weather_bucket || '_' || dress_code`. One key = one `outfit_groups` row.

Preserve existing idempotent/incremental behavior: only group events that aren't already in an `outfit_group_events` junction. Existing groups stay untouched.

Update `outfit_groups.label` generation to: `"{Dress code} · {Time of day}"` (e.g. `"Casual · Evening"`). Drop the date from the label — it's shown in the day pill above the cards and is now redundant.

---

## Part 2 — Weather data

Use **Open-Meteo** (`https://api.open-meteo.com`) — free, no API key, includes free geocoding.

### Fetcher: create `lib/weather.ts`

Export:
- `geocodeLocation(locationString: string): Promise<{ lat: number; lon: number; timezone: string } | null>` — calls `https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1`.
- `fetchForecast(lat: number, lon: number, startDate: string, endDate: string): Promise<DailyForecast[]>` — calls `https://api.open-meteo.com/v1/forecast` with `daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&temperature_unit=fahrenheit`. If trip dates are within 16 days, also fetch hourly to derive per-time-of-day buckets.
- `bucketWeather(highF: number, lowF: number, weatherCode: number, precipProb: number): WeatherBucket` — maps Open-Meteo WMO weather codes to our six buckets (`hot_sunny | warm_sunny | mild | cold | rainy | snowy`).
- WMO code reference: 0–3 = clear/cloudy, 45–48 = fog (treat as mild), 51–67 = drizzle/rain, 71–77 = snow, 80–82 = rain showers, 85–86 = snow showers, 95–99 = thunderstorm.

### Server-side cache call

Update `app/trip/[id]/packing/page.tsx` (server component) to:
1. Read `trip_weather_forecast` rows for this trip.
2. If any are missing or `fetched_at < now() - 6 hours`, geocode `trip.location`, fetch the forecast for `trip.start_date`..`trip.end_date`, bucket it, upsert.
3. Pass the resulting forecast map (`{ [date]: { [time_of_day]: WeatherBucket, ... }, ... }`) into the client `packing-page.tsx`.

If `trip.location` is null or geocoding returns nothing, skip silently. Grouping falls back to `unknown` weather bucket for every event.

---

## Part 3 — Card redesign (Variant D applied to BOTH cards)

The grouping card and the walkthrough outfit card share the same top scaffolding. Only the body below the event timeline differs.

### Shared scaffolding (top of both cards)

1. **Gradient time-of-day band** — full-width strip, ~36px tall, padding `9px 16px`. Font: Outfit, weight 800, size 11px, letter-spacing 0.15em, uppercase.
   - Morning: `linear-gradient(90deg, #f9c876, #e8943a)` · text `🌅 Morning` · white text
   - Afternoon: `linear-gradient(90deg, #e8943a, #c75a2a)` · text `☀️ Afternoon` · white text
   - Evening: `linear-gradient(90deg, #7c4a9e, #452a66)` · text `🌆 Evening` · white text
   - Night: `linear-gradient(90deg, #1a2340, #0a1020)` · text `🌙 Night` · gold text `#ffd97a`
   - Right side of band: weather chip in a translucent pill `rgba(255,255,255,0.25)`, padding `3px 9px`, radius 12px, e.g. `☀️ 74°F · clear`. For night band use `rgba(255,217,122,0.16)` for the chip background. If weather bucket is `unknown`, render `— weather pending`.

2. **Meta row** — padding `10px 16px`, bottom border `1px solid #f0ebe4`.
   - Left: dress-code pill (existing colors from `DRESS_CODE_COLORS`, existing `getDressCodeLabel`).
   - Right: muted counts. Group card: `"{N} events · {M} items packed"`. Outfit card: `"{N} events · {M} items"`.

3. **Timeline event rows** — one per event in the group.
   - Container `display: flex; align-items: flex-start; padding: 10px 16px; position: relative`.
   - Vertical line via `::before { content:''; position:absolute; left:23px; top:0; bottom:0; width:2px; background:#e8e8e8 }`. First row trims `top: 50%`, last row trims `bottom: 50%`.
   - Dot: 10px circle, fill = theme accent, 2px white border, 1px accent ring via box-shadow. `margin-left: 7px; margin-right: 14px; margin-top: 4px`.
   - Body: title 13px/700 prefixed with event-type emoji; sub-line 10px muted = `{start_time} · {location}`; description 11px `#555` line-height 1.4 from `event.description`. Omit the description line entirely when null/empty.

### Card-specific bodies

**Grouping card** (after the timeline rows):
- Action row (existing) — padding `8px 16px 10px`, top border, `#fafafa` background. Buttons: "Merge with…" (orange `#fff3e0`/`#e65100`), "Split" (blue `#e3f2fd`/`#1565c0`), "Merge here ↓" (solid `#e65100` when this card is the merge target). Keep all current visibility rules and handlers from the existing implementation.

**Outfit card** (after the timeline rows, in this order):
- "↻ Wear same outfit as…" reuse dropdown (existing logic, only when applicable).
- Inspo CTA button — full width, `padding: 12px 16px`, background `rgba(232,148,58,0.06)`, top border, color = theme accent, label `"✨ Get Outfit Inspo"` / `"Hide Inspo ▲"`.
- Saved inspo display (existing) — 48px thumb, label, "Clear" button.
- Item rows (existing) — flex row, category icon, name (click to edit), category pill, reuse pill if multi-use, delete `✕`.
- "+ Add Item" button (existing).
- Suggestions section — top border, background `rgba(232,148,58,0.04)`, padding `12px 16px`. Label `"Suggested for {dress code}"`. Suggestion chips with dashed accent border.

### Removals from current implementation

- The current group-label header line (`"Casual — Friday May 22nd"` style) on both cards.
- The redundant per-card date — date stays only in the day-navigator pill above the list.
- The `currentOutfitGroup.label` text on the outfit card header. The dress code + time of day are now communicated by the band + meta row.

### Styling rules (per CLAUDE.md)

- Inline CSS only. Match existing component patterns.
- Theme accent colors keyed off `trip.trip_type` as today.
- Card shell unchanged: `background: #fff`, `borderRadius: 16`, `border: 1px solid th.cardBorder`, `boxShadow: 0 2px 12px rgba(0,0,0,0.04)`.
- No Tailwind, no CSS modules, no new styling libraries.

---

## Part 4 — Database changes

Run this SQL in the Supabase SQL Editor.

```sql
-- ─────────────────────────────────────────────────────────────
-- Packing Grouping V2: weather cache + outfit_groups extensions
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
```

After running, update `types/database.types.ts` to reflect the new columns on `outfit_groups` and the new `trip_weather_forecast` table.

---

## Part 5 — Implementation order

1. Run the SQL above in Supabase SQL Editor. Confirm the new columns and table exist.
2. Update `types/database.types.ts` with the new schema.
3. Add `lib/weather.ts` with geocoding, forecast fetch, bucketing.
4. Update server component `app/trip/[id]/packing/page.tsx` to fetch/cache weather and pass it to the client page alongside existing props.
5. Rewrite `autoGroupEvents` in `packing-page.tsx` to use the new composite key. Persist `time_of_day` and `weather_bucket` on each new `outfit_groups` row. Update label generation.
6. Replace the grouping card render block with the Variant D layout (Part 3, shared scaffolding + grouping body).
7. Replace the walkthrough outfit card header + structure with the Variant D layout (Part 3, shared scaffolding + outfit body). Keep all existing inspo/items/suggestions handlers; only the surrounding presentation changes.
8. Verify merge/split flows still work — they operate on the same `outfit_groups` / `outfit_group_events` tables, just with richer metadata.

---

## What NOT to do

- Do not introduce a weather provider that requires an API key in env vars. Use Open-Meteo only.
- Do not refetch weather on every client render. Server-side fetch on page load with a 6-hour cache check.
- Do not add Tailwind, CSS modules, or any styling framework. Inline CSS only.
- Do not break existing outfit groups. The SQL backfill handles older rows; do not force a re-grouping migration.
- Do not remove or alter the merge/split or inspo/items/suggestions handlers — only their visual containers change.
- Do not duplicate the band/meta-row/timeline markup in two places. Pull it into one shared inline render block (or a tiny local helper) used by both the grouping card and the outfit card. Keep it co-located in `packing-page.tsx`; do not create a new component file unless reuse extends beyond this page.
- Do not add a manual weather refresh affordance in this pass. Caching + lazy refetch is enough.

---

## Acceptance criteria

- A trip with events at 8am and 8pm on the same date, both tagged `casual`, produces **two** outfit groups (morning + evening), each with its own card.
- A trip whose location is a real city and whose dates are within 16 days shows a populated weather chip on each card (temp + condition icon).
- A trip whose location is null or >16 days out shows `— weather pending` and groups events normally on date/time-of-day/dress-code.
- Existing outfit groups created before this change continue to render with backfilled `afternoon` / `unknown` metadata.
- Grouping cards match the left column of `mockup-grouping-and-outfit-cards.html` — gradient TOD band, weather chip, dress-code pill + counts, timeline event rows with descriptions, merge/split actions.
- Outfit cards (walkthrough mode) match the right column — same band/meta/timeline at top, then inspo CTA, saved inspo, item rows, "+ Add Item", suggestions.
- Night TOD band uses the dark gradient with gold text and gold-tinted weather chip.
- Merge and split still function exactly as before.

If anything in the above is ambiguous against the current codebase, stop and ask before implementing.
