# Gear — Phase 2: Gear tab in the packing pill + car visualization

> **Preamble**
> You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.
>
> Read `CLAUDE.md` before starting. Follow: Next.js 14 App Router, Supabase + RLS, inline CSS (no Tailwind), server/client component split, types in `types/database.types.ts`, constants in `lib/constants.ts`, tab layout per `docs/tab-layout-standard.md`, modals are bottom-sheets (maxW 480px, 20px top radius, slideUp) per the Add Booking Modal pattern.

## Context

Phase 1 shipped the gear **library** at `/gear` (tables `gear_bins` and `gear_items`, with an "Imported Gear" migration). This phase wires that library into a trip and adds the visual planner inside the Packing pill.

**Prerequisites** — Phase 1 must be live. Confirm before starting:

- `public.gear_bins` and `public.gear_items` exist with RLS.
- `CAR_LOCATIONS` and `GEAR_ICONS` are exported from `lib/constants.ts`.
- `/gear` renders the library UI.

The visual target for this phase is `/mockups/gear-tab.html`.

## Goal

Inside a trip's Packing tab, add a fourth pill option — **Gear** — that shows:

1. The user's vehicle + a top-down car visualization with 5 tappable zones.
2. A legend row summarizing bin counts per zone.
3. A trip-scoped bin list, filterable by zone, with a "loaded" checkbox per bin.
4. An "＋ Add from library" bottom-sheet modal that pulls the user's saved bins into the trip.

Gear is **family-shared, not per-person** (one person packs the car), so the person tabs that appear on Outfits / Pack & Go are suppressed on this view. For Phase 2, Gear is **host-only** — non-host members don't see the pill option. Opening it up to read-only member viewing is a later pass.

## Data model

Paste exactly as written into the Supabase SQL Editor:

```sql
-- ─── trip_gear_bins: which library bins are on this trip ───
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

-- ─── user_profiles.primary_vehicle_name ───
-- Single-vehicle model for Phase 2. We'll promote to a vehicles table in Phase 3 if needed.
alter table public.user_profiles
  add column if not exists primary_vehicle_name text;
```

After running the SQL, regenerate / hand-edit `types/database.types.ts` to include `trip_gear_bins` and the `primary_vehicle_name` column on `user_profiles`. Export `TripGearBin`, `TripGearBinInsert`, `TripGearBinUpdate`.

## Packing page wiring

Modify `app/trip/[id]/packing/page.tsx` (server) to additionally fetch:

- `trip_gear_bins` for this trip, ordered by `added_at`.
- The trip owner's `gear_bins` (library), with an aggregate `item_count` — needed to render names/icons/default_location on the trip-scoped list without a second round-trip. Only fetch when the viewer IS the trip owner; otherwise skip.
- `user_profiles.primary_vehicle_name` for the viewer.

Modify `app/trip/[id]/packing/packing-page.tsx` (client):

1. Add `"gear"` to the `activeView` union type.
2. Extend the view pill so it renders a fourth button, `Gear`, **only when `currentMember?.role === 'host'` or the viewer is the trip owner**. Order: Group → Outfits → Pack & Go → Gear. Spontaneous mode also gets the Gear button (after Pack & Go) — gear is orthogonal to clothing style.
3. When `activeView === 'gear'`, suppress the person-tabs block entirely. Gear is trip-wide.
4. Render a new `<GearView />` component (see below) as the body.

## New components

Create all of these under `app/trip/[id]/packing/`:

### `gear-view.tsx` (client)

Props: `{ trip, tripGearBins, libraryBins, primaryVehicleName, supabase, currentUserId }`.

State:

- `selectedLocation: CarLocation | null` (filters the bins list + future photo strip)
- `addModalOpen: boolean`
- Optimistic `tripGearBins` for loaded-toggle UX

Layout (follow `/mockups/gear-tab.html` exactly):

1. **Car card** (calls `<CarViz />`):
   - Header row: "Your car" label + `primaryVehicleName` (fallback: "Tap to name your vehicle"). Small "Change ›" affordance opens a tiny inline prompt to rename (updates `user_profiles.primary_vehicle_name`).
   - `<CarViz counts={...} selected={selectedLocation} onSelect={setSelectedLocation} />`.
   - Legend row (5 pills) beneath the SVG; clicking a pill behaves identically to clicking the SVG zone.

2. **Zone-focus banner** (only when `selectedLocation !== null`): light tinted card using that zone's color, "Showing {Label} · N bins · M items", with a "Show all ✕" clear button.

3. **Bins section:**
   - Header: "Bins on this trip" + "＋ Add from library" primary button.
   - List grouped by effective location (`location_override ?? default_location`). When a zone is selected, filter to that zone only (hide groups).
   - Each row: loaded checkbox (toggles `loaded` in `trip_gear_bins`, sets `loaded_at` + `loaded_by` on check, clears on uncheck), icon, name, meta line (`{item_count} items · {loaded ? 'loaded' : 'not loaded'}`), right chevron.
   - Tapping the row body navigates to `/gear/[binId]` (existing from Phase 1) — this is the edit surface.
   - Long-press or a small overflow menu offers: "Change location for this trip" (sets `location_override`), "Remove from trip" (deletes the row).

4. **Pack Photos placeholder** (stub for Phase 3):
   - Section header "Pack Photos" with a muted "Coming soon" chip.
   - Render an empty-state card: "Photo memory comes in the next update — you'll be able to snap how you packed and pull last trip's photos as reference." Do NOT build the photo strip yet.

### `car-viz.tsx` (client)

Pure SVG component. No DB access.

Props:

```ts
type CarVizProps = {
  counts: Record<CarLocation, number>;
  selected: CarLocation | null;
  onSelect: (loc: CarLocation | null) => void;
};
```

Implementation notes:

- Render the SVG from `/mockups/gear-tab.html` as-is, as a JSX tree. Do NOT embed the mockup HTML — convert it. Keep `viewBox="0 0 220 360"` and the same path coordinates.
- Each of the 5 zones is a `<g>` with an onClick that calls `onSelect(zone === selected ? null : zone)`.
- Selected zone: stroke becomes solid 2.5px in the zone's accent color; unselected zones keep the dashed stroke.
- Count badges: a colored circle with the count number, or a grey circle with `0` when the zone has no bins.
- Keyboard accessibility: each zone group gets `role="button"` + `tabindex="0"` + an `onKeyDown` that activates on Enter/Space.

### `add-gear-modal.tsx` (client)

Bottom-sheet modal (maxW 480px, 20px top radius, slideUp — match the Add Booking Modal).

Shows the host's full `libraryBins`, with:

- A search input at the top.
- Each bin row: icon, name, item count, default-location badge, plus a checkbox.
- Bins already on the trip appear with a disabled "Already added" label.
- Footer: "Add N bins" primary button that inserts `trip_gear_bins` rows (one per checked bin) with `added_by = currentUserId` and `location_override = null` (uses the bin's default). Closes on success.

If the library is empty, show an empty-state card with a CTA linking to `/gear`.

## Styling

- Match the existing trip theme (`th` from `THEME_MAP[trip.trip_type]`). All accents and card borders come from the theme; location colors come from `CAR_LOCATIONS`.
- Use inline styles. Do not introduce a CSS framework. Reuse fonts (`DM Sans`) and the glass-morphism card pattern from the existing packing views.
- The gear view lives inside the same scrolling container as the other views — do not create a new sticky region.

## Family-link RLS sanity

The tables we added here are keyed by `trip_id`, not `trip_member_id`, so the family-member RLS gotcha in your memory (where host needs an OR trip-owner clause) doesn't apply. Still, manually verify:

- Host can insert, read, update, delete `trip_gear_bins`.
- A non-host member cannot read `trip_gear_bins` (expected for Phase 2).

## Do NOT build in this phase

- Pack photos (Phase 3)
- Multi-vehicle support / `vehicles` table (defer until there's a clear need)
- Read-only gear visibility for non-host members
- Drag-to-reassign on the SVG (tap-to-select only for v1)
- Removing the legacy `saved_gear` table

## Acceptance

1. Trip host opens Packing → sees a fourth "Gear" pill. Non-host member opens the same trip and does NOT see the Gear pill.
2. Selecting Gear: the person-tabs block disappears, the car viz renders, counts are accurate.
3. Tapping a zone on the SVG filters the bins list and the legend item highlights; tapping again or "Show all ✕" clears.
4. "＋ Add from library" opens a bottom-sheet modal, lists the user's bins, and adds selected ones to the trip. Adding is idempotent (unique constraint on `trip_id, bin_id` — don't throw on dupes, just no-op).
5. Loaded checkbox flips optimistically and persists; `loaded_at` / `loaded_by` populate on check.
6. Changing a bin's location-for-this-trip updates `location_override` and the UI rebuckets the bin without a full refetch.
7. Renaming the vehicle persists to `user_profiles.primary_vehicle_name` and appears on reload.
8. `npm run build` + `npm run lint` both pass. No React key warnings. No Supabase policy errors.
9. The Phase 3 "Pack Photos" placeholder renders but makes it clear nothing is clickable yet.

## Delivery

Commit and push straight to `main`. Verify on prod:

- Create a new test trip, add a few bins from your library, toggle locations and loaded states.
- Open the same trip as a non-host member (or a second account) — confirm no Gear pill.
