# Packing Outfit Slots — Testing Checklist

Post-merge verification for the 2×3 slot-based outfit builder on
`/trip/[id]/packing` (Outfits view).

## 0. Migration

Run `supabase/migrations/20260416_packing_slot_consolidation.sql` in the
Supabase SQL Editor, then confirm:

- [ ] `packing_items` has **no rows** where `category in ('head','hat','hats','headwear')` — they should now be `'accessories'`.
- [ ] `trip_members.show_dress_slot` column exists, is `not null`, default `false`.
- [ ] `trip_members.show_dress_slot = true` for members whose linked `user_profiles.gender = 'female'`.

SQL to verify:
```sql
select category, count(*) from public.packing_items where category ilike '%head%' or category ilike '%hat%' group by 1;
select tm.id, tm.show_dress_slot, p.gender from public.trip_members tm left join public.user_profiles p on p.id = tm.user_id limit 20;
```

## 1. Slot grid — structure

Open any trip → **Packing → Outfits view** → select an event outfit group.

- [ ] Grid renders as **2 columns × 3 rows**, tiles in the order defined in `SLOT_ORDER_WITH_DRESS` / `SLOT_ORDER_WITHOUT_DRESS`.
- [ ] Every tile shows its emoji, uppercase label, and either `+ add …` placeholder or the item names inside (max 3 with "+N more").
- [ ] Empty tiles use the dashed warm-neutral border; filled tiles use a solid theme-accent border.
- [ ] The flat items list + `+ Add Item` button is **gone**.
- [ ] The bottom "Suggested for [dress code]" chip row is still present (kept intentionally).

## 2. Dress slot gating

On the person-tab you're viewing:

- [ ] When the toggle labelled **"Include Dress slot"** is OFF, the grid shows 5 tiles: `Top / Layer / Bottom / Shoes / Accessories`.
- [ ] Flipping the toggle ON makes the grid show 6 tiles, with **Dress** in position 1 (top-left).
- [ ] The Dress tile background is pink-tinted (`#fff1f8` empty, `#fdf2f8` filled) with a pink-accented border.
- [ ] Refresh the page — the toggle state persists (reads from `trip_members.show_dress_slot`).
- [ ] Switching to a different person-tab shows their own toggle state (not shared).

## 3. Modal — single-select slots (Top / Layer / Bottom / Shoes)

Tap any of these tiles. The bottom sheet opens.

- [ ] Sheet slides up with a drag handle, header (emoji + "Add a …" + dress code), and close ✕.
- [ ] "Reuse from suitcase" chips appear with `×N` reuse counts, sorted by count descending. Omitted for slots with no reusable items.
- [ ] "Suggestions for [dress code]" shows dashed-border chips from `lib/slot-suggestions.ts`, keyed to the current event's dress code (falls back to **casual** when unset).
- [ ] Typing in the input filters the reuse strip by substring and hides the suggestions.
- [ ] Tapping a reuse chip or a suggestion chip **commits that item and closes the sheet**.
- [ ] Typing a new name + Enter (or the orange Add button) commits and closes.
- [ ] ESC closes the sheet without committing.
- [ ] Tapping the scrim (outside the sheet) closes without committing.
- [ ] After close, the corresponding slot tile now displays the item name.

## 4. Modal — multi-select (Accessories)

Tap the **Accessories** tile.

- [ ] Sub-header reads "… · tap multiple, then Done".
- [ ] Tapping reuse chips / suggestion chips / typed names **stages** them — they appear in the orange "Ready to add" row.
- [ ] The sheet does not close on each tap.
- [ ] Already-staged or already-in-slot chips show the green ✓ and are disabled (can't be double-added).
- [ ] The **Done** button shows the staged count and commits them all on tap, then closes.
- [ ] Tapping Done with no staged items does nothing.
- [ ] After close, all staged items appear in the Accessories tile.

## 5. Existing items — removal

With some items in a slot, re-open that slot's modal.

- [ ] Top of the sheet shows a green "✓ In this outfit" row listing each item as a removable chip.
- [ ] Tapping the ✕ on a chip removes it from the DB (`packing_items` deleted) and the tile updates.
- [ ] Canceling/closing after a remove does not undo the delete.

## 6. Dress-fills-other-slots interaction

With **Include Dress slot** ON, pick a Dress for an event.

- [ ] `Top` / `Layer` / `Bottom` tiles visibly dim (opacity ~0.42). `Shoes` and `Accessories` stay fully opaque.
- [ ] Tapping a dimmed tile **does not** open the slot modal.
- [ ] Instead, a pink-tinted confirm block appears under the grid: *"You're wearing a dress for this event. Add a [top] anyway?"* with **Swap out dress** and **Keep dress** buttons.
- [ ] **Swap out dress** removes all dress items for this event, closes the confirm, and opens the picked slot's modal.
- [ ] **Keep dress** just closes the confirm; the tiles remain dimmed.
- [ ] Removing the Dress (via the Dress tile's modal) un-dims the other tiles.

## 7. Dress-code → suggestions

Open the same outfit group under three different event dress codes (e.g., create test events with `casual`, `formal`, `active`).

- [ ] Suggestion chips change to match each dress code.
- [ ] An event with no dress code set falls back to **casual** suggestions (sheet is never empty).
- [ ] An unknown dress code value (`"something"`) also falls back to casual, no crash.

## 8. Category persistence + cross-slot display

- [ ] Adding "Jeans" via the Bottom slot creates a `packing_items` row with `category = 'bottoms'` (use SQL to verify).
- [ ] Adding a legacy-named item (e.g., import data with `category = 'shirt'`) still surfaces in the **Top** tile because `CATEGORY_TO_SLOT_MAP` handles aliases.
- [ ] Items with categories that don't map to any slot (e.g., `toiletries`, `documents`, `electronics`) do **not** appear in the grid — they remain visible in other packing surfaces.

## 9. Grouping + consolidation (downstream views)

- [ ] Checklist view ("Pack & Go") still lists every item added via the slot grid.
- [ ] `by_category` grouping puts slot items under their canonical category headings (Dresses, Tops, Outerwear, Bottoms, Shoes, Accessories).
- [ ] Multi-use detection still works: reusing a chip across multiple events shows the `↻ ×N` badge on the consolidated item.

## 10. Keep list — regression checks

- [ ] Page header + TripSubNav + person tabs + view tabs still render.
- [ ] Step indicator and prev/next buttons on walkthrough still work.
- [ ] TOD band on the outfit card (morning/afternoon/evening/night gradient + weather chip) is unchanged.
- [ ] Collapsible events pill on grouped cards still expands / collapses.
- [ ] ✨ Get Outfit Inspo panel still fetches Unsplash results and saves a pick.
- [ ] Sticky bottom CTA ("Pack & Go →") still navigates to the checklist view.
- [ ] The card-level "Suggested for [dress code]" chip row below the grid still adds items (via the legacy `addItem` path).
- [ ] "Wear same outfit as…" reuse dropdown (above inspo) still works.

## 11. Accessibility

- [ ] Each slot tile has an `aria-label` like "Add Top" or "Top (2 items)".
- [ ] The dress-slot toggle is `role="switch"` with correct `aria-checked`.
- [ ] The modal has `role="dialog" aria-modal="true"` with an `aria-label` naming the slot.
- [ ] Modal trap: focus moves into the modal on open; ESC closes; scrim click closes.

## 12. Optimistic UI

- [ ] Toggling the dress slot updates the grid instantly (no visible flash) — the Supabase update happens in the background.
- [ ] If the Supabase write fails (simulate by blocking network), the toggle flips back.

## 13. Multi-member trips

- [ ] Two accepted members on the same trip — Dress slot visibility is independent per member.
- [ ] Adding an item for Member A does not appear in Member B's grid (items are scoped to `trip_member_id`).
