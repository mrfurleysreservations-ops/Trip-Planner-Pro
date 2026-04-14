# Notes "Convert To" Menu — Build Prompt

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Goal

Replace the single "📅 Convert to Itinerary Event" button in the notes modal with a **"Convert To" action menu** that gives the user multiple destinations for a note. Notes are freeform on creation (no category tagging). The categorization decision happens only at conversion time.

## Why

This app is being built for bachelorette/bachelor trip planning. Notes aren't always activities — they can be things to buy (matching shirts, party supplies, decorations), meal/food ideas (restaurants, recipes, snack runs), or reference info (Airbnb rules, playlists). The current flow forces everything through "itinerary event" which doesn't fit.

## What to build

### 1. Add `NOTE_CONVERT_OPTIONS` to `lib/constants.ts`

Add a new constant array after `EVENT_TYPES`:

```ts
export const NOTE_CONVERT_OPTIONS = [
  { value: "event", label: "Itinerary Event", icon: "📅", description: "Add to the schedule with a date & time" },
  { value: "packing", label: "Packing / Shopping Item", icon: "🛍️", description: "Something to buy, bring, or pack" },
  { value: "meal", label: "Meal Idea", icon: "🍽️", description: "Restaurant, recipe, or food to plan" },
  { value: "reference", label: "Keep as Reference", icon: "📌", description: "Pin this note — no action needed" },
] as const;
```

### 2. Add `converted_to` column to `trip_notes`

**Provide me the exact SQL to paste into Supabase SQL Editor:**

```sql
ALTER TABLE trip_notes
ADD COLUMN converted_to text DEFAULT NULL
CHECK (converted_to IN ('event', 'packing', 'meal', 'reference'));
```

Then update `types/database.types.ts` — add `converted_to: string | null` to the `trip_notes` Row and Insert types (Insert should have `converted_to?: string | null`).

### 3. Replace the convert button in `notes-page.tsx`

**Current behavior (lines ~509-522):** When the note is an "idea" and the date picker isn't showing, there's a single button:
```
📅 Convert to Itinerary Event
```
Clicking it sets `showDatePicker(true)` and starts the date → time → create flow.

**New behavior:** Replace that single button with a "Convert To" menu that shows the 4 options from `NOTE_CONVERT_OPTIONS`. Use the existing inline-style patterns (glass card, accent colors from `th`). Each option should be a row/button showing the icon, label, and description.

When the user picks an option:

- **"Itinerary Event"** → Behaves exactly like today. Sets `showDatePicker(true)`, uses the existing date → time → `convertToEvent()` flow. No changes needed to this path.

- **"Packing / Shopping Item"** → Updates the note in the database: sets `status = 'finalized'` and `converted_to = 'packing'`. Then navigates to `/trip/${trip.id}/packing?fromNote=${note.id}&title=${note.title}` (with body and link_url as optional params, same pattern as the itinerary deep-link). The packing page doesn't handle this yet — that's a future build. For now, just do the DB update and navigate. Log activity with action `"converted"` and include `converted_to: "packing"` context.

- **"Meal Idea"** → Same pattern: sets `status = 'finalized'` and `converted_to = 'meal'`. Navigates to `/trip/${trip.id}/meals?fromNote=${note.id}&title=${note.title}` (with optional body/link params). Meals page doesn't handle this yet either — just do the DB update and navigate. Log activity similarly.

- **"Keep as Reference"** → Sets `status = 'finalized'` and `converted_to = 'reference'`. Does NOT navigate anywhere — stays on the notes page. Closes the modal. This replaces the current "✓ Mark as Finalized" button (remove that button since "Keep as Reference" covers the same intent with more clarity).

### 4. Update the status badge

The `StatusBadge` component currently shows "Idea" or "Finalized". Update it to be smarter:

- If `converted_to` is set, show the matching icon + label from `NOTE_CONVERT_OPTIONS` instead of generic "Finalized"
- If `status === 'finalized'` but `converted_to` is null (legacy notes), keep showing "Finalized" as-is
- If `status === 'idea'`, keep showing "Idea" as-is

### 5. Update filter tabs

The current filter tabs are: All, Ideas, Finalized.

Keep these three BUT also show sub-counts inside the Finalized tab or as a tooltip. Don't add more tabs — three is enough. The badge update from step 4 already tells users what each finalized note became.

### 6. Wire up the `convertNote` helper function

Create a new `useCallback` function (similar pattern to existing `convertToEvent` and `finalizeNote`):

```ts
const convertNote = useCallback(async (noteId: string, convertTo: string) => {
  setLoading(true);
  const { error } = await supabase
    .from("trip_notes")
    .update({ status: "finalized", converted_to: convertTo, updated_at: new Date().toISOString() })
    .eq("id", noteId);
  if (!error) {
    setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, status: "finalized", converted_to: convertTo } : n));
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      logActivity(supabase, {
        tripId: trip.id, userId, userName: currentUserName,
        action: "converted", entityType: "note",
        entityName: `${note.title} → ${convertTo}`,
        entityId: noteId, linkPath: `/trip/${trip.id}/notes?note=${noteId}`,
      });
    }
  }
  setLoading(false);
}, [supabase, trip.id, userId, currentUserName, notes]);
```

## State changes needed in `notes-page.tsx`

- Add: `const [showConvertMenu, setShowConvertMenu] = useState(false);`
- The existing `showDatePicker` state stays — it's used after selecting "Itinerary Event" from the new menu
- When the convert menu is open and user picks "event", hide the menu and show the date picker (existing flow)
- When the convert menu is open and user picks packing/meal/reference, call `convertNote()` then navigate or close modal

## Files to modify

1. `lib/constants.ts` — add `NOTE_CONVERT_OPTIONS`
2. `types/database.types.ts` — add `converted_to` field to trip_notes Row and Insert
3. `app/trip/[id]/notes/notes-page.tsx` — main changes (convert menu, badge, helper function)

## Files NOT to modify

- Do NOT touch the itinerary page or its `fromNote` handling — that flow already works
- Do NOT build out the packing or meals receiving end — that's a separate phase
- Do NOT add categories to the note creation form — categorization only happens at conversion time (Option B)

## Style guide

- Use inline styles matching the existing patterns in `notes-page.tsx`
- Glass-morphism cards with `th.accent` colors
- Use `th.cardBorder`, `th.bg`, `th.text`, `th.muted` from the theme
- DM Sans for body, Outfit for headings
- Pill-style buttons with border-radius 10-12
- Keep the convert menu compact — it appears inside the existing modal, not a separate modal
