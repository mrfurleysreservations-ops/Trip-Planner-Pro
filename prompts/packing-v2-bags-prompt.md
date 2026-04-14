# Packing V2 — Bag Hierarchy & Two-Tab Redesign

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Context

The packing page at `/trip/[id]/packing` currently has an event walk-through view and a consolidation view. We're redesigning it into a **two-tab flow** that supports both quick packers and hyper-organized packers using the same UI — they just stop at different depths.

**Reference the existing mockup** at `packing-mockup.jsx` in the project root for the exact UI behavior and layout. Use the existing inline styling patterns from the current `packing-page.tsx`.

---

## What You're Building

### Two Tabs Inside Packing

**Tab 1: "What's Coming"** — Event-based checklist  
**Tab 2: "Pack It"** — Physical bag organization with checkboxes + optional depth

---

### Tab 1: "What's Coming"

This replaces the old event walk-through and consolidation views with a single unified checklist organized by event.

**Layout:**
- Progress bar at the top showing `X / Y` items checked off
- Below that, one card per itinerary event the user is opted into (chronological order)
- Each event card shows: event icon, event name, dress code, and the packing items generated for that event
- Every item has a **checkbox**. Checking it means "yes, I'm bringing this"
- At the bottom, an **"Essentials"** card for items not tied to any specific event (toiletries, documents, chargers — items where `event_id` is null)
- Each event card header shows a mini counter: `3/5` checked

**Completion State:**
- When ALL items across all events and essentials are checked, show a **completion animation/moment** at the top of the tab
- A subtle celebratory state — think a green checkmark with a gentle scale-up animation, text like "You're all set!" with a soft fade-in
- Below the completion message, a non-pushy nudge: "Want to organize into bags?" as a tappable link that switches to the Pack It tab
- Keep it lightweight — a CSS keyframe animation, not a library. Something like a checkmark that draws itself or scales in with a slight bounce, and text that fades in after a short delay
- The quick packer sees this and feels **done**. They never need to touch Tab 2

**Data source:** Items come from `packing_items` joined to `itinerary_events` via `event_id`. Items with null `event_id` go in the Essentials section. Only show events where the current user is an `event_participant`.

---

### Tab 2: "Pack It"

This is where the hyper-organized packer goes after completing Tab 1. It has two sections: **Bag Setup** at the top, and the **Item List** below.

#### Bag Setup Section

A card at the top with the user's bags shown as compact pills. An "Edit Bags" button toggles into edit mode.

**Edit mode shows the full hierarchy and lets you:**
- See all bags, their sections, and containers as an indented tree
- Add a new bag (name + type: carry-on, checked, personal item, duffel, tote, etc.)
- Add sections to any bag (e.g., "Left Side", "Right Side", "Front Pocket", "Top Lid")
- Add containers inside sections (e.g., "Packing Cube — Tops", "Shoe Bag", "Toiletry Pouch")
- The hierarchy is: **Bag → Section → Container**. All levels are user-defined and freeform
- Sections and containers are optional — a casual user can just have bags with items directly in them

**New database tables needed for this:**

```sql
-- User's bags (persist across trips — you set up your bags once)
CREATE TABLE packing_bags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🧳',
  bag_type TEXT DEFAULT 'carry-on', -- carry-on, checked, personal-item, duffel, tote, garment-bag
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sections within a bag
CREATE TABLE packing_bag_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id UUID NOT NULL REFERENCES packing_bags(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Containers within a section (packing cubes, pouches, etc.)
CREATE TABLE packing_bag_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES packing_bag_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assignment of a packing item to a bag location (per-trip)
-- This is the join between the item and where it goes physically
CREATE TABLE packing_item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_item_id UUID NOT NULL REFERENCES packing_items(id) ON DELETE CASCADE,
  bag_id UUID REFERENCES packing_bags(id) ON DELETE SET NULL,
  section_id UUID REFERENCES packing_bag_sections(id) ON DELETE SET NULL,
  container_id UUID REFERENCES packing_bag_containers(id) ON DELETE SET NULL,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(packing_item_id, trip_id)
);

-- RLS: users can only see/edit their own bags and assignments
ALTER TABLE packing_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_bag_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_bag_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_item_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bags" ON packing_bags
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own bag sections" ON packing_bag_sections
  FOR ALL USING (bag_id IN (SELECT id FROM packing_bags WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own bag containers" ON packing_bag_containers
  FOR ALL USING (section_id IN (
    SELECT s.id FROM packing_bag_sections s
    JOIN packing_bags b ON b.id = s.bag_id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own item assignments" ON packing_item_assignments
  FOR ALL USING (packing_item_id IN (
    SELECT pi.id FROM packing_items pi
    JOIN trip_members tm ON tm.id = pi.trip_member_id
    WHERE tm.user_id = auth.uid()
  ));
```

**Important:** Bags persist across trips (they belong to the user, not the trip). Assignments are per-trip. This means once you set up your bags/sections/cubes, they're there for every trip.

#### Item List Section

Below the bag setup, show every checked item from Tab 1 as a row. Each row has:

1. **Checkbox** (left side) — This is the "I physically packed this" confirmation. A quick packer can just tap checkboxes without touching any dropdowns. Checking it means it's in a bag somewhere, even if you don't specify which one.

2. **Item name** with category color dot

3. **Three inline dropdowns** (right side, optional):
   - **Bag** — which bag is this going in?
   - **Section** — which section of that bag? (populates after bag is selected)
   - **Cube/Container** — which container? (populates after section is selected, only if that section has containers)

**Behavior:**
- Selecting a bag in the dropdown **auto-checks** the checkbox (assigning to a bag implies packed)
- The checkbox can be checked **without** using any dropdowns (quick pack mode)
- Unchecking the checkbox does NOT clear the dropdown selections (in case they accidentally unchecked)
- Progress bar tracks **checkboxes**, not dropdown assignments
- When the checkbox is checked, the item row gets a subtle green tint and the text gets a line-through

#### Bag Summary

Below the item list, show a **live Bag Summary** that builds as items are assigned via dropdowns. This is a collapsible tree view:

```
🧳 Carry-On Roller (8 items)
  ├── Left Side
  │   ├── 📦 Tops Cube (3)
  │   │   ├── White linen button-down
  │   │   └── Navy polo
  │   └── 📦 Bottoms Cube (2)
  │       └── Khaki shorts
  ├── Right Side
  │   └── 📦 Shoe Bag (2)
  │       └── Brown loafers
🎒 Daypack (4 items)
  ├── Front Zip Pocket
  │   ├── Phone charger
  │   └── Sunscreen
  └── Top Pocket
      └── Passport
```

Only show the summary when at least one item has a bag assigned. Items assigned to a bag but without a section show at the bag level with a subtle "no section" label.

---

## Files to Modify

1. **`app/trip/[id]/packing/page.tsx`** — Add fetches for `packing_bags`, `packing_bag_sections`, `packing_bag_containers`, `packing_item_assignments` for the current user. Pass as props.

2. **`app/trip/[id]/packing/packing-page.tsx`** — Rebuild the packing UI with the two-tab layout. Remove the old event walk-through / consolidation view toggle. Replace with `WhatsComingTab` and `PackItTab` components inline (no separate files — keep it flat per architecture rules).

3. **`types/database.types.ts`** — Add types for `PackingBag`, `PackingBagSection`, `PackingBagContainer`, `PackingItemAssignment`.

---

## Styling Notes

- Follow existing inline style patterns from `packing-page.tsx`
- Glass-morphism cards with `rgba` backgrounds, consistent with the rest of the app
- Use the trip's theme accent color where appropriate
- Green (`#00B894`) for packed/checked states
- Orange/amber for "not yet packed" states
- The completion animation should be CSS only — a `@keyframes` block in a `<style>` tag within the component. Checkmark draws or scales in, text fades in with a slight delay.

---

## What NOT to Do

- Do not create separate component files — keep everything in `packing-page.tsx`
- Do not introduce any CSS framework or external animation library
- Do not modify the sub-nav or page structure outside of packing
- Do not make bags trip-specific — they belong to the user and persist across trips
- Do not require the dropdowns to mark something as packed — the checkbox is sufficient on its own
- Do not remove any existing packing_items or packing_outfits functionality — the bag system layers on top
