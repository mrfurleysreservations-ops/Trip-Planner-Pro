# Supplies — Phase 1.2: Modal polish + quick-expense on cards

## Preamble

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` before starting. Follow: Next.js 14 App Router, Supabase + RLS, inline CSS (no Tailwind), server/client component split, types in `types/database.types.ts`, constants in `lib/constants.ts`, tab layout per `docs/tab-layout-standard.md`, modals are bottom-sheets (maxW 480px, 20px top radius, slideUp) per the Add Booking Modal pattern.

This is a solo hobby project — when done, hand Joe the `git add/commit/push` PowerShell commands; no PR, push straight to `main`.

## Context

The Supplies tab (`/trip/[id]/supplies`) has three views — Meals, Grocery, Supplies — with bottom-sheet editors for creating and editing meals and supplies. Phase 1 shipped the MVP but the editor sheets and list cards need two polish passes:

1. **Modal layout is wrong.** Right now `MealEditorSheet`, `NewMealSheet`, and `SupplyEditorSheet` let the whole sheet body scroll as one tall column. As the ingredient list grows, the Save button and the "+ Add ingredient" row scroll off-screen together. We need the sheet structure to match the standard bottom-sheet pattern used by the Add Booking Modal: fixed header, scrolling middle, fixed footer — with the "Save" button **pinned to the very bottom** and the "+ Add ingredient" control living just above it as a **sticky sub-bar** inside the body so it stays reachable while the ingredient list scrolls above it.

2. **No quick way to log an expense from the list.** Today a user must open a meal or supply's editor sheet and tap "Add expense for reimbursement" inside. Whoever just paid at the register wants a one-tap shortcut right on the card. Add a small `💳` expense icon button to each meal card (Meals view) and each supply card (Supplies view) that deep-links to the Expenses tab pre-filled.

All the data model work for expense-linking already exists:
- `trip_expenses.supply_id` column + index — added in migration `20260421_supplies_expense_link.sql`.
- `trip_expenses.event_id` has always existed — meals are itinerary events (`event_type='meal'`), so meal-sourced expenses reuse the event FK.
- The Expenses tab already consumes `?fromEvent=<id>&title=&date=` and `?fromSupply=<id>&title=` query params to auto-open its Add Expense modal pre-filled. Do not change the expenses page in this phase — only call into it from the supplies cards.

## Goal

Deliver two focused changes in `app/trip/[id]/supplies/supplies-page.tsx`:

1. Rebuild all three bottom sheets (`MealEditorSheet`, `NewMealSheet`, `SupplyEditorSheet`) so they share this exact three-region layout:
   - **Fixed header** (Sheet handle + title + subtitle + close button).
   - **Scrolling body** (all form fields, attendee chips, ingredient list). The body must overflow-scroll internally — it must NEVER cause the whole modal to outgrow the viewport.
   - **Fixed footer** with the primary `Save` / `Create` button pinned at the bottom. Secondary actions (Delete, Cancel) live in the same footer row to the left.
   - **Sticky sub-bar** immediately above the footer, only when the sheet contains a growing list. For `MealEditorSheet` this sub-bar is the **"+ Add ingredient"** entry row: one compact inline input + "Add" button. When you tap "Add", it writes the new `meal_items` row and clears — the list above grows and scrolls, and the sub-bar stays put. `SupplyEditorSheet` has no growing list, so it has no sub-bar — just header / body / footer.
   - Max modal height remains `90vh` (as today), body gets `overflowY: auto; flex: 1; minHeight: 0`, footer is `flexShrink: 0`.
   - Keep the `slideUp` entry animation, the handle bar, the 20px top radius, and the 480px max-width. Only the internal flex layout changes.

2. Add a **quick Add Expense button** to every card in the two list views:
   - **Meals view** cards: add a small circular `💳` button to the top-right corner of each meal card (or inline next to the time, wherever it stays out of the way of the existing tap-to-open behavior). Click → `router.push("/trip/<tripId>/expenses?fromEvent=<meal.id>&title=<encoded meal.title>&date=<meal.date>")`. Must `e.stopPropagation()` so the card's primary tap (opens editor) still works. Use a button element with `aria-label="Add expense for this meal"`.
   - **Supplies view** cards: identical treatment, but routes to `?fromSupply=<supply.id>&title=<encoded supply.name>`.
   - Grocery view: no button. Grocery is a derived aggregation.
   - Styling: 28x28 circle, `background: ${th.accent}14`, `border: 1px solid ${th.accent}33`, `color: th.accent`, `fontSize: 14`. Matches the chip styling used elsewhere in the app. No text label — icon only.

## Exact tasks

### Task 1 — Introduce a `Sheet`/`SheetBody`/`SheetFooter` layout structure

In `app/trip/[id]/supplies/supplies-page.tsx`, update the existing `Sheet` helper so the **direct child structure is enforced by three slot components**:

```tsx
<Sheet onClose={...}>
  <SheetHandle />
  <SheetHeader title=... subtitle=... onClose=... />
  <SheetBody>
    {/* scrolling content — all fields + any list */}
  </SheetBody>
  {/* optional sticky sub-bar (e.g. + Add ingredient) */}
  <SheetStickyBar>...</SheetStickyBar>
  <SheetFooter>
    {/* left-aligned secondary action (Delete) + primary Save */}
  </SheetFooter>
</Sheet>
```

Implementation notes:

- `Sheet` is a flex column with `maxHeight: 90vh` and `minHeight: 0` so children can shrink.
- `SheetHeader` stays `flexShrink: 0`.
- `SheetBody` uses `flex: 1; overflowY: auto; minHeight: 0; padding: 14px 20px 16px`.
- `SheetStickyBar` is `flexShrink: 0`, sits above the footer, has a `borderTop: 1px solid #eee`, `padding: 10px 16px`, `background: #fafaf7`. This is the "+ Add ingredient" input row.
- `SheetFooter` is `flexShrink: 0`, has `padding: 12px 20px 18px`, `borderTop: 1px solid #eee`, `background: #fff`, `borderRadius: 0 0 20px 20px`, `display: flex; gap: 10px; alignItems: center`.

Do not use `position: sticky` inside the scrolling body — use flex ordering instead. The body scrolls; siblings (sub-bar, footer) do not move.

### Task 2 — Rebuild `MealEditorSheet` around the new structure

Today the ingredient list and the "+ Add ingredient" dashed button and the Save are all in one scrolling column. Change to:

- **Body** holds: the subtitle (date/time), attendee avatars row, claim-control card, "Ingredients" section label, the existing ingredient rows (each with inline edit expansion).
- **Sticky sub-bar** holds the "+ Add ingredient" inline form (item name + qty + unit + section dropdown + Add button). This is exactly the same IngredientEditor that exists today — just relocated from the bottom of the scrolling body into the sub-bar. Pressing Add calls `addMealItem`, then resets the sub-bar form's state so the user can keep adding rows without scrolling.
- **Footer** holds the Close (left, `background: none`, muted text) and, for meal editing, we keep the claim-toggle inline so the footer isn't load-bearing for create. Actually — MealEditorSheet has no primary Save because all fields auto-persist (add/edit/delete ingredients are individual calls; claim toggle is a separate call). Leave the footer with just a "Done" button on the right that calls `onClose`. Fine to reuse `btnPrimaryStyle(th.accent)`.
- When the ingredient list is long, the body scrolls, the sticky sub-bar stays pinned above the footer, and the Done button stays pinned at the absolute bottom.

### Task 3 — Rebuild `NewMealSheet` around the new structure

The new-meal sheet has no growing list. Still split it into:

- **Body**: title input, day pills, start/end time row, "I'll buy" checkbox.
- **Footer**: Cancel (left) + `Create meal` primary button (right, `flex: 1`).

No sticky sub-bar. Just body + footer.

### Task 4 — Rebuild `SupplyEditorSheet` around the new structure

This sheet already has a footer with Save + Delete — just confirm it's wired through the new `SheetFooter` slot and the body scrolls independently. Specifically:

- **Body** holds: Item + Qty row, Category dropdown, Status 3-button segmented control, "Who's bringing it?" claim card, host-only member dropdown, `isEdit && onAddExpense` block (the `💳 Add expense for reimbursement →` button and hint text), Notes input.
- **Footer** holds: Delete / Confirm delete (left, only when `isEdit && onDelete`), primary Save / Create (right, `flex: 1`).
- No sticky sub-bar.

Verify: when the browser viewport is short (e.g. iPhone SE 568px), the Save button MUST remain visible without scrolling — only the body scrolls.

### Task 5 — Add a quick-expense icon to each Meal card

Find the `MealsView` component (rendered for `view === "meals"`) and its per-meal card. Today the card is a tap-target that calls `onTapMeal(id)`. Add a small `💳` button to the card's header row:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    const params = new URLSearchParams({
      fromEvent: meal.id,
      title: meal.title,
      ...(meal.date ? { date: meal.date } : {}),
    });
    router.push(`/trip/${trip.id}/expenses?${params.toString()}`);
  }}
  aria-label="Add expense for this meal"
  style={{
    width: 28, height: 28,
    borderRadius: "50%",
    background: `${th.accent}14`,
    border: `1px solid ${th.accent}33`,
    color: th.accent,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  }}
>
  💳
</button>
```

`MealsView` is a sub-component today and does not receive `trip` or `router` directly. Pass them down as props (add `tripId: string` and `router: ReturnType<typeof useRouter>` to its prop type). Do the same for the supplies view sub-component in the next task.

### Task 6 — Add a quick-expense icon to each Supply card

Identical treatment in `SuppliesView` / per-supply card, but the router.push call uses `fromSupply=<supply.id>&title=<encoded name>`. Button aria-label: `"Add expense for this supply"`.

### Task 7 — Do not regress existing behavior

- The sub-nav order, role density, family auto-attend, RLS rules, and URL deep-link handling (`?view=...&newMeal=1&fromNote=...`) all stay unchanged.
- `editMealItem` / `deleteMealItem` / `claimedBy` flows stay unchanged — you're only moving where the "+ Add ingredient" row lives.
- The existing `onAddExpense` button inside `SupplyEditorSheet` (tinted accent block with hint text) stays — the new card-level icon is in addition to, not a replacement for, the in-sheet button.

### Task 8 — Verify + commit

Run `npx tsc --noEmit`; fix any type errors. Then test locally (`npm run dev`):

1. Open a meal with a long ingredient list → add more ingredients → confirm the "+ Add ingredient" row and the Done button stay pinned while the list scrolls.
2. Open a supply editor on a short viewport (resize browser to ~560px tall) → Save button must remain visible; fields scroll.
3. Tap the `💳` icon on a meal card in the Meals view → lands on Expenses tab with the meal title, event link, and meal date pre-filled in the Add Expense modal.
4. Tap the `💳` icon on a supply card in the Supplies view → lands on Expenses tab with the supply name and `supply_id` pre-filled.
5. Tapping the `💳` icon must NOT open the meal/supply editor (event propagation stopped).

When done, hand over the PowerShell push commands — one line at a time — not a single chained command.

## Files you will touch

- `app/trip/[id]/supplies/supplies-page.tsx` — primary work: refactor `Sheet`, `MealEditorSheet`, `NewMealSheet`, `SupplyEditorSheet`, `MealsView`, `SuppliesView`. Add `SheetBody`, `SheetStickyBar`, `SheetFooter` slot components at the bottom of the file next to the existing `Sheet`/`SheetHandle`/`SheetHeader` helpers.

## Files you will NOT touch

- `app/trip/[id]/expenses/page.tsx`, `app/trip/[id]/expenses/expenses-page.tsx` — deep-link params already wired.
- `types/database.types.ts` — no schema change in this phase.
- `supabase/migrations/` — no new migration.
- `lib/constants.ts` — no new constants.
- Any packing, itinerary, notes, group, or gear files.

## Done criteria

- `npx tsc --noEmit` passes.
- Save / Done / Create button is always visible in every sheet regardless of viewport height.
- "+ Add ingredient" is reachable without scrolling past the Save button in `MealEditorSheet`.
- Every meal card and every supply card has a `💳` icon that opens Expenses pre-filled.
- Tapping the `💳` does not also open the editor.
- No regressions in Grocery view, claim flow, notes-finalize deep-links, or role-density ordering.
