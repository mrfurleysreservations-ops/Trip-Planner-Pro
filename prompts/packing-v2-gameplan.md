# Packing System V2 — Game Plan

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## The Big Picture

Three tabs. Clean progression. No redundancy.

```
GROUP  →  OUTFITS  →  PACK & GO ✓
```

Consolidate tab is killed. Its useful bits (summary stats) absorb into Pack & Go. The old `compartmentMap` / `COMPARTMENT_OPTIONS` system is removed entirely — replaced by the real bag hierarchy in Pack & Go.

---

## Change 1: Kill Consolidate Tab

**What to remove:**
- The `"consolidation"` option from the `activeView` type and the tab array
- The entire `activeView === "consolidation"` render block (lines ~1581–1667)
- The `COMPARTMENT_OPTIONS` constant (lines 209–220)
- The `compartmentMap` state variable (line 297)
- All `compartmentMap` references in the Walkthrough view (the hyper-organizer dropdown select in the item rows, and the compartment breakdown at the bottom of each walkthrough step)
- The "Ready to Pack →" button that linked from Consolidate to Pack & Go

**What to keep:**
- The summary stats logic (total items, multi-use count, outfit groups count) — moves to Pack & Go

**Tab array becomes:**
```
["grouping", "walkthrough", "checklist"]
→ labeled: "Group", "Outfits", "Pack & Go ✓"
```

For spontaneous mode: `["walkthrough", "checklist"]` → "Quick Pack", "Pack & Go ✓" (unchanged)

---

## Change 2: Group Tab — Make It Actually Understandable

**Current problem:** It's just a list of dress-code-grouped event cards. You have no idea what the page wants you to do, and the merge/split functionality is completely hidden until you tap on a group. Nobody discovers it.

**The fix — add three things:**

### 2a. Instructional header
At the top, a brief explainer card:

> **How this works:** Your events are auto-grouped by day and dress code — events with the same vibe share an outfit. Review the groups below. If two groups can share an outfit, tap one then tap "Merge" on another to combine them.

Keep it short, one-time-read feeling. Not a wall of text.

### 2b. Visible merge affordance
Right now, merging requires tapping into a group first. Instead:

- Each group card gets a **subtle action row** at the bottom with icon buttons: "Merge with..." and "Split" (if it has multiple events)
- When you tap "Merge with..." on one group, the OTHER groups get a highlighted border and a "Merge here" target state — so it's visually obvious what's happening
- The current click-to-select-then-click-another pattern is too hidden

### 2c. Visual connection between groups and the next step
At the bottom of the Group tab, a clear CTA: **"Looks good → Build Outfits"** that switches to the Outfits tab. This tells the user what comes next and that grouping is a *setup* step, not the main event.

---

## Change 3: Outfits Tab — Inspo Placement, Sticky Nav, Mobile Fix

### 3a. Get Inspo placement
**Current:** The inspo section is below the item list in each walkthrough step.
**Fix:** Move it to directly below the event description / dress code header, ABOVE the items. The flow for each step becomes:

```
┌─────────────────────────────────┐
│  Day 2 — Daytime                │
│  Beach Day + Boat Tour          │
│  Casual · ☀️ 85°F               │
├─────────────────────────────────┤
│  📸 Get Outfit Inspiration      │  ← inspo moves HERE
│  [Search]  [Upload]             │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ img │ │ img │ │ img │       │
│  └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│  👔 White linen button-down     │
│  👖 Khaki shorts                │
│  👟 Sandals                     │
│  ...                            │
├─────────────────────────────────┤
│  + Add item to this outfit      │
└─────────────────────────────────┘
```

Rationale: You see the event context, then get inspired, THEN see/manage the items. Inspo informs what you pick — it should come before, not after.

### 3b. Sticky bottom navigation
**Current:** The Prev/Next step buttons are at the TOP of the walkthrough. On long outfit steps, you scroll down through items and then have to scroll all the way back up to advance.

**Fix:** Move the step navigation to a **sticky bottom bar** inside the Outfits view:

```
┌─────────────────────────────────┐
│  [← Prev]   2 of 3   [Next →]  │
└─────────────────────────────────┘
```

- `position: sticky`, `bottom: 56px` (above the fixed TripSubNav which is 56px tall)
- Background with blur to match the bottom nav aesthetic
- Same Prev/Next buttons, just relocated
- On the last step, "Next →" becomes "Done → Pack & Go" and switches to the checklist tab

### 3c. Mobile fix
**Current:** The Outfits tab "doesn't work on phone" — needs investigation. Most likely candidates:

- The step navigation being at the top means mobile users don't see how to advance (fixed by 3b)
- The inspo search panel may overflow or not respond to touch events properly
- Touch targets may be too small on the item rows or action buttons
- Horizontal overflow on long event names or the inspo image grid

**Investigation approach:** Check all touch handlers, ensure no `hover`-only interactions, verify the inspo panel uses proper mobile-friendly sizing (min 44px touch targets), and test that the step nav is accessible on small screens.

### 3d. Suggestions persistence (already fixed)
Clicking one suggestion no longer removes the others. This is already done — just calling it out so the prompt doesn't re-break it.

---

## Change 4: Pack & Go Tab — Add Bag Hierarchy

This is the big addition. Everything here is NEW content added to the existing Pack & Go tab. Nothing existing gets removed (except the old compartment summary, which is already gone from Change 1).

### 4a. Summary stats bar (absorbed from Consolidate)
At the very top, before the progress bar, add a compact one-line stats bar:

```
21 items · 5 multi-use · 3 outfit groups
```

Small, muted text. Context at a glance. Not the big three-column grid from Consolidate — just a single line.

### 4b. Progress bar (existing — no changes)
Stays exactly as-is. Shows packed count, percentage, green when complete.

### 4c. "Your Bags" setup card (NEW)
Between the progress bar and the item checklist. See `packing-full-mockup.jsx` for the exact UI pattern.

**Collapsed state:** Shows bag pills (🧳 Carry-On Roller, 🎒 Daypack) with section/container counts. "Edit Bags" button.

**Edit mode:** Full tree editor — add bags, add sections to bags, add containers to sections. All user-defined, all freeform.

**Data source:** `packing_bags`, `packing_bag_sections`, `packing_bag_containers` tables (already fetched in page.tsx server component).

**Key detail:** Bags belong to the USER, not the trip. They persist across trips. Set up once, use everywhere.

### 4d. Item checklist (ENHANCED — add dropdowns)
The existing checklist grouped by category stays. Each item row gets enhanced:

**Current row:**
```
[✓] Item name                    ↻ ×2
```

**New row:**
```
[✓] Item name                    ↻ ×2
     [Bag ▾]  [Section ▾]  [Cube ▾]
```

- Checkbox behavior is UNCHANGED — toggles `is_packed` in the database
- Three dropdowns below each item: Bag → Section → Container (cascading)
- Dropdowns are OPTIONAL. A quick packer ignores them entirely
- Selecting a bag auto-checks the item as packed
- Unchecking does NOT clear dropdown selections
- Dropdowns write to `packing_item_assignments` table (already fetched in page.tsx)

### 4e. Don't Forget section (existing — no changes)
Stays exactly as-is.

### 4f. Overpacker Just-in-Case section (existing — no changes)
Stays exactly as-is for overpacker packing style.

### 4g. Bag Summary tree (NEW)
Below Don't Forget / Just-in-Case. Only renders when at least one item has a bag assignment.

Shows the full hierarchy:
```
🗂️ Bag Summary

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

🎒 Daypack (4 items)
   Front Zip
     Phone charger
     Sunscreen
   Top Pocket
     Passport
```

### 4h. Completion animation (NEW)
When ALL items are checked as packed (`packedCount === totalCount`):

- A green checkmark animates in (CSS keyframe — scale from 0 with slight bounce)
- "You're all set!" text fades in below it
- If not all items have bag assignments, a subtle nudge: "Want to organize into bags?" with a link that opens the bag editor
- CSS-only animation, no libraries. A `<style>` tag inside the component with `@keyframes`

---

## Change 5: Remove Old Compartment System

Across the entire `packing-page.tsx`, remove:

- `COMPARTMENT_OPTIONS` constant
- `compartmentMap` state
- All `compartmentMap` references in the Walkthrough view:
  - The `<select>` dropdown on each item row (line ~1363)
  - The compartment breakdown section at the bottom of each walkthrough step (lines ~1414–1425)
- All `compartmentMap` references in the Consolidation view (already gone since we're removing the whole view)

These are replaced by the real bag hierarchy in Pack & Go (Change 4).

---

## Files to Modify

| File | What Changes |
|------|-------------|
| `app/trip/[id]/packing/packing-page.tsx` | All UI changes (tabs, group clarity, outfits layout, pack & go bags) |
| `types/database.types.ts` | Verify `PackingBag`, `PackingBagSection`, `PackingBagContainer`, `PackingItemAssignment` types exist (they should from previous migration) |
| `app/trip/[id]/packing/page.tsx` | No changes needed — already fetches all bag tables |

**Do NOT modify:**
- Any other page files
- The TripSubNav component
- The sub-nav order or structure
- Any database tables or migrations (tables already exist)
- The packing style system (spontaneous, minimalist, overpacker, planner, hyper_organizer)
- Outfit groups, outfits, or outfit_packing_items logic

---

## What NOT to Do

- Do NOT create new tabs or remove tabs beyond what's specified (kill Consolidate only)
- Do NOT restructure the overall page layout (header, person tabs, view switcher pattern stays)
- Do NOT remove packing style-specific behavior (minimalist gauge, overpacker extras, spontaneous groups)
- Do NOT remove outfit group functionality
- Do NOT create separate component files — keep everything inline in packing-page.tsx
- Do NOT introduce CSS frameworks or animation libraries
- Do NOT make bags trip-specific — they belong to the user
- Do NOT require dropdowns to mark something as packed — checkbox is sufficient alone
- Do NOT remove the suggestions persistence fix in the Outfits walkthrough
