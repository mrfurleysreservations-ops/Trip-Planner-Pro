# Supplies — Phase 1: Rename Meals tab, add Meals / Grocery / Supplies views

## Preamble

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` before starting. Follow: Next.js 14 App Router, Supabase + RLS, inline CSS (no Tailwind), server/client component split, types in `types/database.types.ts`, constants in `lib/constants.ts`, tab layout per `docs/tab-layout-standard.md`, modals are bottom-sheets (maxW 480px, 20px top radius, slideUp) per the Add Booking Modal pattern.

Also read `docs/page-hierarchy-v2.md` (itinerary-first architecture) and the existing `/app/trip/[id]/itinerary/` code so you see how `itinerary_events` + `event_participants` already work. A meal here is NOT a new entity — it's an `itinerary_events` row with `event_type = 'meal'`.

## Context

The current `/trip/[id]/meals` tab is an empty shell — never built, no real data to migrate. This phase replaces it with `/trip/[id]/supplies`, a three-view tab that answers the question "what are we getting for this trip."

The Gear system (`gear_bins`, `gear_items`, `/gear` page) was built in a prior chat as Gear Phase 1. Gear Phase 2 will wire it into the Packing tab later. **Do not touch Gear in this phase.** Supplies and Gear are parallel systems with no overlap: Supplies = bought/consumed for this trip; Gear = owned durable items carried across trips.

Visual targets:
- `mockup-supplies.html` — the three views (Meals / Grocery / Supplies)
- `mockup-supplies-modals.html` — bottom-sheet editors

## Goal

Rename `/trip/[id]/meals` → `/trip/[id]/supplies`. Single page, three views behind a sticky segmented control:

1. **Meals** — itinerary events where `event_type = 'meal'`, each with a list of ingredients (`meal_items`) and one claimer (buyer).
2. **Grocery List** — derived for the viewing user from `meal_items` on meals they've claimed, aggregated by grocery aisle. Nothing stored except per-user checkoffs.
3. **Supplies** — shared non-food items the group is buying for this trip (fuel, consumables, disposables, toiletries, event, other).

Notes finalize into one of three targets (event / meal / supply) via the existing `trip_notes.converted_to` field. A new `trip_notes.supply_id` column links supply-finalized notes back.

## Data model

Paste this into the Supabase SQL Editor exactly as written. Safe to re-run.

```sql
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
```

## Type + constants changes

`types/database.types.ts` — add rows for the new tables and columns, following the existing conventions in the file. Export:

- `MealItem`, `MealItemInsert`, `MealItemUpdate`
- `SupplyItem`, `SupplyItemInsert`, `SupplyItemUpdate`
- `GroceryCheckoff`, `GroceryCheckoffInsert`
- Extend `ItineraryEvent` Row/Insert with `claimed_by: string | null`
- Extend `TripNote` Row/Insert with `supply_id: string | null`

`lib/constants.ts` — add:

```ts
export const GROCERY_SECTIONS = [
  { value: 'produce',   label: 'Produce' },
  { value: 'meat',      label: 'Meat & Seafood' },
  { value: 'dairy',     label: 'Dairy & Eggs' },
  { value: 'pantry',    label: 'Pantry' },
  { value: 'bakery',    label: 'Bakery' },
  { value: 'frozen',    label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'snacks',    label: 'Snacks' },
  { value: 'other',     label: 'Other' },
] as const;
export type GrocerySection = typeof GROCERY_SECTIONS[number]['value'];

export const SUPPLY_CATEGORIES = [
  { value: 'fuel',        label: 'Fuel' },         // firewood, propane, charcoal, lighter fluid
  { value: 'consumables', label: 'Consumables' },  // ice, batteries, duct tape, zip ties
  { value: 'disposables', label: 'Disposables' },  // paper plates, cups, trash bags
  { value: 'toiletries',  label: 'Toiletries' },   // sunscreen, bug spray, wipes, TP
  { value: 'event',       label: 'Event' },        // sashes, decorations, favors, games
  { value: 'other',       label: 'Other' },
] as const;
export type SupplyCategory = typeof SUPPLY_CATEGORIES[number]['value'];

export const SUPPLY_STATUSES = [
  { value: 'needed',    label: 'Needed',    color: '#c75a2a' },
  { value: 'claimed',   label: 'Claimed',   color: '#e8943a' },
  { value: 'purchased', label: 'Purchased', color: '#4a7c59' },
] as const;
export type SupplyStatus = typeof SUPPLY_STATUSES[number]['value'];

export const MEAL_UNITS = [
  'each','lb','oz','g','kg','cup','tbsp','tsp','bottle','bag','pkg','gal','qt',
] as const;
```

Also in `lib/constants.ts`: find every `subNavOrder` array and replace each `"meals"` string with `"supplies"`. Do not reorder any other entries.

`/app/trip/[id]/trip-sub-nav.tsx` — in `SUB_NAV_TABS`, replace the `meals` entry with:

```ts
{ key: "supplies", label: "Supplies", icon: "🛒", segment: "supplies" },
```

## UI — page rebuild

Use the tab layout standard: one sticky top region, scrolling body below.

### Route

Move `/app/trip/[id]/meals/` → `/app/trip/[id]/supplies/`. Rename `meals-page.tsx` → `supplies-page.tsx`. Gut the placeholder content and rebuild as described below.

### Server component — `page.tsx`

Follow the existing meals server-component skeleton (auth check → trip fetch → role lookup → render client). Fetch in parallel:

- Trip, viewer's `trip_members` row, `role_preference` for sub-nav density
- Meal events: `itinerary_events where trip_id = :id and event_type = 'meal'`, ordered by `date, start_time, sort_order`
- For each meal event: its `meal_items` and `event_participants` (join `trip_members` for name)
- Viewer's `grocery_checkoffs` rows filtered by `meal_item_id` in the viewer-claimed set
- `supply_items` for the trip with joined claimer `trip_members` name
- All `trip_members where status='accepted'` (for claim pickers and avatars)

Pass a single typed `SuppliesPageData` prop into the client component. No further server fetches client-side — only mutations.

### Client component — `supplies-page.tsx`

Sticky top region:
- Page header row: back button · "Supplies" title · context action button on the right
- Segmented toggle: `[Meals | Grocery | Supplies]`
- Right-side action changes per view:
  - Meals → `＋ Meal` button
  - Grocery → "N meals claimed" counter chip (no add button — derived view)
  - Supplies → `＋ Supply` button

Persist active view via URL query param `?view=meals|grocery|supplies` so deep links work. Default `meals`.

### Meals view

Render meal events grouped by day (date header: "Saturday · April 25"). Card per meal shows:
- Time pill (from `start_time`)
- Title
- "👥 N attending" pill (count of `event_participants` — family auto-attend already baked in)
- Claim pill: green "You're buying" if claimed by viewer; avatar + name if claimed by someone else; red "Needs a buyer" if unclaimed
- "N items" badge, or "Tap to add items" if empty

Card tap → bottom-sheet meal editor (see Modals below).

`＋ Meal` creates a new `itinerary_events` row with `event_type='meal'` defaulted. Either fork the existing itinerary-event create modal with that default, or build a minimal meal-specific form (date, time, title, auto-insert host + family-linked members into `event_participants` per the family auto-attend rule). Pick whichever causes less churn.

### Grocery view

Pure derived render for the viewing user. Algorithm:

```
claimedMeals = events where event_type='meal' AND claimed_by = me.trip_member_id
for each meal in claimedMeals:
  headcount = count(event_participants where event_id = meal.id)
  for each item in meal.meal_items:
    key = (lowercase(item.item_name), item.unit)
    bucket[item.grocery_section][key].totalQty += item.quantity_per_person * headcount
    bucket[item.grocery_section][key].sources.push(meal.title)
    bucket[item.grocery_section][key].mealItemIds.push(item.id)
```

Render each section in `GROCERY_SECTIONS` order, skipping empty sections. Each row:
- Checkbox → inserts/deletes `grocery_checkoffs` rows for every component `meal_item_id` for this user (aggregated-row check toggles all sources at once)
- Item name, total qty + unit
- Source chip: "for Sat Breakfast" or "Sat Breakfast · Sun Pancakes" or "Sat Breakfast +2 more"

Empty state (no meals claimed): "Claim a meal on the Meals tab to build your grocery list."

### Supplies view

Render `supply_items` grouped by `category` in `SUPPLY_CATEGORIES` order. Skip empty categories. Card per item:
- Name · qty chip
- Small category chip (tinted accent)
- Status dot + label (red/amber/green — colors from `SUPPLY_STATUSES`)
- Claimer avatar + name, or "Needs a buyer" chip when unclaimed

Card tap → bottom-sheet supply editor. `＋ Supply` opens the same sheet empty with `status='needed'` and `claimed_by=null`.

### Notes → three targets

In `/app/trip/[id]/notes/notes-page.tsx`, extend the existing note finalize menu to offer **Event / Meal / Supply**:

- Event → existing behavior: `converted_to='event'`, sets `event_id`.
- Meal → opens the meal create flow prefilled from the note. On save: `converted_to='meal'`, `event_id` = new meal event's id.
- Supply → opens the supply create modal prefilled (`name = note.title`, `notes = note.body`). On save: `converted_to='supply'`, `supply_id` set, and the supply's `source_note_id` set back to the note's id.

Finalized notes display the existing finalized state. Clicking through a finalized supply-note routes to `/trip/[id]/supplies?view=supplies` scrolled to the created item; finalized meal-note routes to `?view=meals` scrolled to the meal card.

## Modals

All modals follow the Add Booking Modal pattern: bottom-sheet, maxW 480, 20px top radius, slideUp, handle bar at top, close ✕ button, sticky footer.

### Meal editor modal

Opens when a meal card is tapped on the Meals view.

Sections top to bottom:
- **Attending (N)** — read-only pills with avatars + names. Hint: "ⓘ Manage attendees on the Itinerary tab." Do not duplicate attendance editing here.
- **Ingredients** — list of `meal_items` with a header hint "per-person qty × N attending." Each row: drag handle · item name · `qty/person unit · section chip` · tap to edit.
- **`＋ Add ingredient`** dashed button below the list.
- **Who's buying?** — claim box. Green-highlighted when claimed by viewer with sub "Your grocery list will include these N items." Host sees a "Change" link that opens a member picker (family RLS clause covers the write).

Sticky footer: `Done` button.

Ingredient add/edit is **inline expansion** — tapping a row or `＋ Add ingredient` expands in place into a form. No modal-on-modal. Fields: name · qty_per_person · unit (from `MEAL_UNITS`, allow free-text) · grocery section (from `GROCERY_SECTIONS`) · optional note. Actions: Remove (destructive) · Cancel · Save item.

### Supply editor modal

Opens when a supply card is tapped, or from `＋ Supply`.

Fields:
- Name (required)
- Quantity (integer, > 0)
- Category (dropdown from `SUPPLY_CATEGORIES`)
- Status — three tappable buttons side-by-side: Needed / Claimed / Purchased. Tapping writes immediately.
- Claim row — "I'll bring it" toggle (sets/clears `claimed_by` to viewer's trip_member_id). Host additionally sees a member dropdown to reassign to any family member.
- Notes (optional)

Sticky footer: Delete (left, destructive) · Save supply (right, primary).

## Do NOT build in this phase

- **Gear integration.** Gear Phase 1 already shipped at `/gear` (`gear_bins`, `gear_items`). Phase 2 (wiring Gear into `/trip/[id]/packing/*`) is a separate future prompt. Do NOT touch `/gear`, `gear_bins`, `gear_items`, or anything under `/app/trip/[id]/packing/`. Do NOT add `gear` or `cooking` back to `SUPPLY_CATEGORIES`.
- Per-person supplies ("everyone brings their own headlamp") — v2
- Supply reminders, notifications, deadlines
- Grocery list export / print / share
- Changing the itinerary event create flow beyond defaulting `event_type='meal'` for new meals
- Migrating anything from `trip_data.meals` (unused JSON column — leave it alone)

## Acceptance

1. `/trip/[id]/meals` route is gone; `/trip/[id]/supplies` loads for every trip.
2. Sub-nav shows "Supplies" in the slot Meals used to occupy, across every role density.
3. Create a meal event → add `meal_items` → claim it → see it in the Grocery view with correct `qty_per_person × headcount` aggregation, grouped by grocery section in store-aisle order.
4. Two meals claimed by the same user with a shared ingredient (same name + unit) collapse into one grocery row with summed quantity and a multi-source chip.
5. Grocery checkboxes persist per-user — Sarah's checkmarks never change Joe's view.
6. Create a supply item, claim it, transition it Needed → Claimed → Purchased.
7. Finalize a note to each of the three targets (event / meal / supply) and land on the correct destination.
8. RLS verified: a user not in a trip's `trip_members` cannot read or mutate its `meal_items` or `supply_items`.
9. Host can create and update `supply_items` with `claimed_by` set to a family member's `trip_member_id` (owner-clause working — see memory `project_family_rls_owner_clause.md`).
10. Sticky top region stays sticky while the body scrolls, matching `docs/tab-layout-standard.md`.
11. No console errors, no React key warnings, no Supabase policy errors. `npm run build` and `npm run lint` both pass.

## Delivery

Solo hobby project — commit and push straight to `main`. Do not open a PR or a staging branch. Sandbox git is locked and has no push creds, so write the changes, stop, and hand back the commit/push commands for the user to run locally.

After merging, verify on prod (`https://tripplannerapp-lilac.vercel.app`) that:

- `/trip/[id]/supplies` loads without errors for an existing trip
- Creating a meal with ingredients and claiming it populates the Grocery view correctly
- Creating a supply and toggling its status works end-to-end
- Finalizing a note as a supply lands it in the Supplies view
