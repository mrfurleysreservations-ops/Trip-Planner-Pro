# Packing System V2 — Build Prompt

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## CRITICAL: Read Before You Touch Anything

This prompt modifies the packing page ONLY. You are ADDING features and making targeted fixes. You are NOT restructuring the page, NOT removing packing styles, NOT removing outfit groups, and NOT creating new files. If a section says "no changes," do not change it.

**Reference the existing mockup** at `packing-full-mockup.jsx` in the project root for the Pack & Go UI behavior. Match the existing inline styling patterns from the current `packing-page.tsx`.

---

## Overview: What Changes

The packing page currently has 4 view tabs: Group, Outfits, Consolidate, Pack & Go. After this build:

```
GROUP  →  OUTFITS  →  PACK & GO ✓
```

Three tabs. Consolidate is removed (its useful bits absorbed into Pack & Go). The old in-memory compartment system (`compartmentMap` / `COMPARTMENT_OPTIONS`) is removed — replaced by a real persisted bag hierarchy in Pack & Go.

---

## Change 1: Remove Consolidate Tab

### Remove:
- `"consolidation"` from the `activeView` type union and from both tab arrays (the standard one and the spontaneous one)
- The entire `activeView === "consolidation"` render block (~lines 1581–1667)
- The `COMPARTMENT_OPTIONS` constant (~lines 209–220)
- The `compartmentMap` useState variable (~line 297)
- ALL `compartmentMap` references in the Walkthrough view:
  - The `<select>` dropdown on each item row in the walkthrough (~line 1363)
  - The compartment breakdown section at the bottom of each walkthrough step (~lines 1414–1425)
- The "Ready to Pack →" button at the bottom of Consolidation

### Keep:
- The consolidation summary stats logic (total items, multi-use count, outfit groups count) — this moves to Pack & Go in Change 4

### Tab arrays become:
- Standard mode: `["grouping", "walkthrough", "checklist"]` → labeled "Group", "Outfits", "Pack & Go ✓"
- Spontaneous mode: `["walkthrough", "checklist"]` → labeled "Quick Pack", "Pack & Go ✓" (unchanged)

---

## Change 2: Group Tab — Make It Clear

The Group tab is confusing. Users don't know what it does or that they can merge groups. Fix with three additions:

### 2a. Instructional header
Add a card at the top of the grouping view, ABOVE the group cards:

```
Your events are auto-grouped by day and dress code — events with the same
vibe share one outfit. If two groups could share the same outfit, merge them.
Otherwise, you're good to go.
```

Style it as a subtle info card — light background, small text, not aggressive. One-time educational content.

### 2b. Visible merge/split actions
Each group card currently requires tapping into it to discover merge. Instead, add a compact action row at the bottom of each group card:

- A "Merge with..." button (text button, not hidden) — when tapped, the OTHER group cards get a highlighted border and a "Merge here ↓" label, making it obvious you're in merge mode. Tap a target group to merge. Tap "Cancel" to exit merge mode.
- A "Split" button — only visible if the group has more than one event. Splits the group back into individual events.

### 2c. CTA to advance
At the bottom of the Group tab, add: **"Looks good → Build Outfits"** button that sets `activeView` to `"walkthrough"`. Same style as the existing "Ready to Pack →" button that was on Consolidation.

---

## Change 3: Outfits Tab — Three Fixes

### 3a. Move Get Inspo above items
Currently the inspo search/upload panel is BELOW the item list in each walkthrough step. Move it to ABOVE the items, directly below the event description / dress code header.

The layout order for each walkthrough step becomes:
1. Outfit group header (label, dress code badge, event names)
2. Inspo panel (search button, image results, upload) ← MOVES HERE
3. Item list (clothing/gear items for this outfit)
4. Add item input

This way the user sees the event context, gets inspired, THEN manages items. Inspo informs item choices.

### 3b. Fix inspo "Couldn't load" error
The "Get Outfit Inspiration" button currently shows "Couldn't load inspiration images. Try again." every time. The root cause is the Unsplash API key is not configured.

**Fix:** Add `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` to your `.env.local` file. Get a free API key from https://unsplash.com/oauth/applications — create an app, copy the Access Key, and add it:

```
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your-access-key-here
```

The API route at `app/api/unsplash/route.ts` is already correctly built — it just needs the key. No code changes required for this fix, just the env variable.

**Additionally:** Make the error message more helpful. In the `fetchInspoImages` catch block (~line 740), change the error text to check if it's a configuration issue:

```typescript
catch (err) {
  setInspoError("Couldn't load images — check that NEXT_PUBLIC_UNSPLASH_ACCESS_KEY is set in .env.local");
}
```

### 3c. Sticky bottom navigation for walkthrough steps
The Prev/Next step buttons are currently at the TOP of the Outfits view. On long outfit steps, users scroll past items and have to scroll back up to advance. This is especially painful on mobile.

Move the step navigation to a **sticky bar at the bottom** of the walkthrough view:

```
position: "sticky"
bottom: "56px"     ← sits above the fixed TripSubNav (56px tall)
```

The bar contains:
- "← Prev" button (disabled on first step)
- "Step N of M" counter
- "Next →" button (disabled on last step)
- On the LAST step: "Next →" becomes **"Pack & Go →"** and switches to checklist view

Style it with the same `rgba(255,255,255,0.97)` blur background as the TripSubNav for visual consistency.

### 3d. Do NOT break suggestions persistence
The Outfits walkthrough already has a fix where clicking one dress code suggestion does NOT remove the others from the list. Do NOT revert this behavior. Leave the suggestion rendering logic as-is.

---

## Change 4: Pack & Go Tab — Add Bag Hierarchy

Everything in this section is ADDED to the existing Pack & Go view. Do NOT remove the existing checklist, Don't Forget section, or style-specific sections (minimalist gauge, overpacker extras, spontaneous groups).

### 4a. Summary stats line (from old Consolidate)
At the very top of the Pack & Go view, before the progress bar, add a single compact line:

```
21 items · 5 multi-use · 3 outfit groups
```

Use the same `consolidatedItems` and `memberOutfitGroups` data that Consolidation used. Style as small muted text — context, not a feature.

### 4b. "Your Bags" setup card (NEW)
Place between the progress bar and the first category group.

**Collapsed state (default):**
- Heading: "🧳 Your Bags" with subtext "Optional — organize where things go"
- Bag pills showing each bag name, icon, section count, container count
- "Edit Bags" button to expand

**Edit mode (expanded):**
- Full tree of bags → sections → containers, indented
- Inline "+" buttons to add sections to any bag, containers to any section
- Input field + "Add Bag" button at the bottom for new bags
- "Done" button to collapse

**Data:** Uses `packingBags`, `packingBagSections`, `packingBagContainers` props from page.tsx (already fetched). Bags are user-owned (not trip-specific) — CRUD operations go to `packing_bags`, `packing_bag_sections`, `packing_bag_containers` tables via Supabase client.

### 4c. Item rows — add bag assignment dropdowns (ENHANCED)
The existing checklist items grouped by category stay exactly as they are. Enhance each item row by adding a second line with three inline dropdowns:

**Current row structure:**
```
[✓ checkbox]  Item name                    ↻ ×2
```

**New row structure:**
```
[✓ checkbox]  Item name                    ↻ ×2
              [Bag... ▾]  [Section... ▾]  [Cube... ▾]
```

Dropdown behavior:
- **Bag dropdown** — lists all user's bags. Selecting one auto-checks the item as packed (`is_packed = true`)
- **Section dropdown** — populates with sections from the selected bag. Disabled/dimmed until a bag is selected
- **Container dropdown** — populates with containers from the selected section. Disabled/dimmed if the section has no containers
- Changing the bag clears section and container. Changing section clears container.
- Unchecking the checkbox does NOT clear dropdown selections
- The checkbox can be checked WITHOUT using any dropdowns (quick pack mode)
- All selections write to `packing_item_assignments` table (one row per item per trip, already fetched as prop)

Style the dropdowns small (fontSize: 10px) and aligned under the item name (margin-left to clear the checkbox). Use the same border/background pattern as the existing item rows.

### 4d. Bag Summary tree (NEW)
Place below the Don't Forget section (and below overpacker Just-in-Case if present). Only render when at least one item has a bag assignment.

Heading: "🗂️ Bag Summary"

For each bag that has at least one item assigned, show a card with the full tree:
```
🧳 Carry-On Roller (8 items)
   Left Side
     📦 Tops Cube (3)
        White linen button-down
        Navy polo
        Black tee
     📦 Bottoms Cube (2)
        Khaki shorts
        Navy chinos
   Right Side
     📦 Shoe Bag (2)
        Brown loafers
        Sandals
```

Items assigned to a bag but with no section show at the bag level with a subtle "unsorted" label. Items assigned to a section but no container show directly under the section name.

### 4e. Completion animation (NEW)
When `packedCount === totalCount && totalCount > 0`:

Show a completion card at the TOP of the Pack & Go view (above the stats line):

- A green circle with a checkmark that scales in with a slight bounce (CSS `@keyframes`, no libraries)
- "You're all set!" text that fades in after a short delay
- If some items don't have bag assignments: a subtle nudge below — "Want to organize into bags?" as a tappable link that scrolls to or opens the bag setup card
- Use a `<style>` tag inside the component for the keyframes

```css
@keyframes checkDraw {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/trip/[id]/packing/packing-page.tsx` | All five changes above |
| `.env.local` | Add `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your-key-here` |

**Do NOT modify:**
| File | Reason |
|------|--------|
| `app/trip/[id]/packing/page.tsx` | Already fetches all bag tables — no changes needed |
| `types/database.types.ts` | Bag types already exist — verify but don't recreate |
| `app/api/unsplash/route.ts` | Already correctly built — just needs the env key |
| `app/trip/[id]/trip-sub-nav.tsx` | Do not touch |
| Any other page files | Scope is packing only |

---

## Exact SQL (if bag tables don't exist yet)

Check Supabase first — these may already be created from a previous session. Only run if the tables are missing:

```sql
-- User's bags (persist across trips — belong to user, not trip)
CREATE TABLE IF NOT EXISTS packing_bags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🧳',
  bag_type TEXT DEFAULT 'carry-on',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packing_bag_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id UUID NOT NULL REFERENCES packing_bags(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packing_bag_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES packing_bag_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packing_item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_item_id UUID NOT NULL REFERENCES packing_items(id) ON DELETE CASCADE,
  bag_id UUID REFERENCES packing_bags(id) ON DELETE SET NULL,
  section_id UUID REFERENCES packing_bag_sections(id) ON DELETE SET NULL,
  container_id UUID REFERENCES packing_bag_containers(id) ON DELETE SET NULL,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(packing_item_id, trip_id)
);

-- RLS
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

---

## What NOT to Do

- Do NOT create new component files — everything stays in packing-page.tsx
- Do NOT remove or restructure existing tabs beyond what's specified (kill Consolidate only)
- Do NOT remove packing style behavior (spontaneous, minimalist, overpacker, planner, hyper_organizer)
- Do NOT remove outfit group functionality (grouping, merging, splitting, auto-group)
- Do NOT remove the Don't Forget section or overpacker Just-in-Case section
- Do NOT make bags trip-specific — they belong to the user and persist across trips
- Do NOT require bag dropdowns to mark something as packed — the checkbox alone is sufficient
- Do NOT revert the suggestion persistence fix in Outfits (clicking one suggestion must NOT remove others)
- Do NOT introduce CSS frameworks or external animation libraries
- Do NOT modify the TripSubNav, page structure, or sub-nav order
- Do NOT guess at database schema — use the SQL above or verify existing tables
