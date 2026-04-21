# Gear — Phase 1: Library upgrade on `/gear`

> **Preamble**
> You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.
>
> Read `CLAUDE.md` before starting. Follow: Next.js 14 App Router, Supabase + RLS, inline CSS (no Tailwind), server/client component split, types in `types/database.types.ts`, constants in `lib/constants.ts`, tab layout per `docs/tab-layout-standard.md`, modals are bottom-sheets (maxW 480px, 20px top radius, slideUp) per the Add Booking Modal pattern.

## Context

This is Phase 1 of a 3-phase Gear rollout:

- **Phase 1 (this prompt):** Upgrade `/gear` from a flat `saved_gear` list to a structured **library of reusable bins**. No trip integration yet.
- **Phase 2 (next chat):** Add a **Gear** option to the packing pill inside a trip, with the car-visualization SVG and trip-scoped bin list.
- **Phase 3 (later):** Pack photos — per-vehicle, per-trip, per-location with cross-trip reference lookup.

The visual target for this phase is `/mockups/gear-library.html`.

## Goal

A user owns a reusable library of gear **bins**. Each bin has a name, an icon, a default car location, notes, and a list of items inside it. The `/gear` page lets the user manage this library end-to-end. Existing `saved_gear` rows get migrated into a single "Imported Gear" bin per user so nothing is lost.

## Data model

Paste this into the Supabase SQL Editor exactly as written:

```sql
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
```

## Type + constants changes

**`types/database.types.ts`** — add rows for `gear_bins` and `gear_items`, following the existing conventions in the file. Export:

- `GearBin`, `GearBinInsert`, `GearBinUpdate`
- `GearItem`, `GearItemInsert`, `GearItemUpdate`

**`lib/constants.ts`** — add:

```ts
export const CAR_LOCATIONS = [
  { value: 'frunk',     label: 'Frunk',     color: '#4a7bc8' },
  { value: 'cabin',     label: 'Cabin',     color: '#9b59b6' },
  { value: 'trunk',     label: 'Trunk',     color: '#e65100' },
  { value: 'roofbox',   label: 'Roofbox',   color: '#0097a7' },
  { value: 'tow_hitch', label: 'Tow hitch', color: '#c8503a' },
] as const;

export type CarLocation = typeof CAR_LOCATIONS[number]['value'];

export const GEAR_ICONS = [
  '📦','🏕️','🔥','💧','🛌','🧰','🩹','🎣','🧺','🔦',
  '🚴','🧗','❄️','🌞','🛶','🧭','⛺','🪵','🍳','🔋',
] as const;
```

## UI — `/gear` page rebuild

Match the mockup at `/mockups/gear-library.html`. Use the tab layout standard: one sticky top region, scrolling body below.

**Sticky top:**

- Title "Gear Library" + subtitle "Reusable bins for your family trips — build once, pack fast."
- Primary button: "＋ New bin" (opens bottom-sheet modal)
- Stats row (pills): total bins, total items, locations used, last-used trip name (from a later phase — for now just show the first three)
- Filter pills: All / By location / By use / Recently used
- Search input (filters bins by name and items by name substring)

**Scrolling body:**

- Bins grouped by `default_location` (use `CAR_LOCATIONS` order). Each group has a header row: colored dot + location name + "N bins · M items" count chip.
- Each bin is a card: icon in a tinted square, name (bold), `item count · 'X trips'` (the trips count is a placeholder returning 0 until Phase 2 exists — render `"New"` instead of `"0 trips"` for empty state), and a location-colored badge.
- Clicking a bin card expands it inline (single-card expand — clicking another collapses the previous). Expanded state shows:
  - Left column: item rows with quantity chip, checkbox (visual state representing `checked_default` — purely UI for now, no DB column yet), "＋ Add item" inline input.
  - Right column: default-location picker, notes textarea, and a placeholder "Recent trips" section that reads `"Will populate once you've used this bin on a trip"` until Phase 2.
  - Footer actions: Edit bin / Duplicate / Change location / Archive.

**Create/edit bin modal** (bottom-sheet — follow the Add Booking Modal pattern):

- Name (required)
- Icon picker (grid from `GEAR_ICONS`)
- Color picker (small swatch row — the 5 location colors plus `#5a9a2f` default)
- Default location (radio pills using `CAR_LOCATIONS`)
- Description textarea
- Notes textarea
- Save / Cancel

**Empty state** (no bins yet): centered card with `📦` emoji, "Your gear library is empty. Build your first bin to start packing smart trips.", and a "＋ Create your first bin" CTA.

## Do NOT build in this phase

- Any trip integration, `trip_gear_bins` table, or changes under `/trip/[id]/packing/*`
- The car visualization SVG
- Pack photos / vehicles
- "Recent trips" real data (placeholder only)
- Dropping the old `saved_gear` table

## Acceptance

1. Fresh user: `/gear` shows the empty state, and "＋ New bin" creates a bin end-to-end.
2. Migrated user: existing `saved_gear` rows appear inside an "Imported Gear" bin, and can be renamed, moved between bins (reassign `bin_id`), deleted, or left as is.
3. RLS verified: user A cannot read or mutate user B's `gear_bins` or `gear_items` via the Supabase client.
4. Bin archive hides the bin from the main view but keeps it in the DB (soft-delete via `archived_at`).
5. Tab layout: sticky top is actually sticky while the bin grid scrolls (match `docs/tab-layout-standard.md`).
6. No console errors, no React key warnings, no Supabase policy errors in the network tab.
7. `npm run build` and `npm run lint` both pass.

## Delivery

Solo hobby project — commit and push straight to `main`. Do not open a PR or a staging branch. After merging, verify on prod (`https://tripplannerapp-lilac.vercel.app`) that:

- `/gear` loads without errors
- Creating a bin and adding items works
- Any pre-existing `saved_gear` rows you had are visible inside "Imported Gear"
