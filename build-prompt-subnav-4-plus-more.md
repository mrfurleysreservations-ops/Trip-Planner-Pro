You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Task: Refactor trip sub-nav from 7 flat tabs to "4 primary + ⋯ More" with a bottom sheet

The trip sub-nav at `app/trip/[id]/trip-sub-nav.tsx` currently renders all 7 tabs in a fixed bottom bar (Itinerary, Expenses, Chat, Packing, Notes, Meals, Group). Labels are already tight at 10px. An 8th tab (Flights, Docs, Weather, Gear, Settings, etc.) will break the row.

We're switching to **4 primary tabs + a 5th ⋯ More tile** that opens a bottom sheet containing every non-primary tab. This preserves the "all tabs always reachable" invariant (see feedback memory `role_density_no_feature_loss.md`) while giving us an unlimited growth slot.

**Which 4 tabs are primary depends on the user's role_preference** — this extends the existing role-density pattern. Roles never hide tabs; they only decide which 4 ride in the bar and which live behind ⋯ More.

---

### File changes

#### 1. `lib/constants.ts` — extend `ROLE_PREFERENCES`

Add a new `primaryTabs: readonly string[]` field (length exactly 4) to each of the 4 existing roles. The 4 values must be a subset of that role's `subNavOrder`. Keep `subNavOrder` as-is (it remains the canonical ordering of all 7 tabs, and governs the order tabs appear inside the More sheet for tabs not in `primaryTabs`).

Suggested primaries (confirm with user if unsure):

- **all_in**: `["itinerary", "expenses", "chat", "packing"]` — they're running the show
- **helping_out**: `["itinerary", "packing", "chat", "expenses"]` — utility-forward
- **just_here**: `["expenses", "chat", "itinerary", "group"]` — money + people
- **vibes_only**: `["itinerary", "chat", "expenses", "group"]` — light touch

Whatever's left from each role's `subNavOrder` (3 tabs) goes into More, in `subNavOrder` order.

Add a short comment block above `ROLE_PREFERENCES` explaining the invariant: `primaryTabs.length === 4`, all values in `primaryTabs` must appear in `subNavOrder`, and the More sheet renders `subNavOrder.filter(t => !primaryTabs.includes(t))`.

#### 2. `lib/role-density.ts` — expose primaryTabs

Add a helper next to the existing `subNavOrderForRole` / `defaultTabForRole`:

```ts
/** Which tabs ride in the bottom bar (always 4). Rest go into the ⋯ More sheet. */
export function primaryTabsForRole(role: RolePreference | string | null | undefined): readonly string[] {
  return getRoleConfig(role).primaryTabs;
}

/** Tabs that live behind ⋯ More for this role — subNavOrder minus primaryTabs, order preserved. */
export function moreTabsForRole(role: RolePreference | string | null | undefined): readonly string[] {
  const cfg = getRoleConfig(role);
  const primary = new Set(cfg.primaryTabs);
  return cfg.subNavOrder.filter((seg) => !primary.has(seg));
}
```

Do not filter inside the component — compute it here so the role is the single source of truth.

#### 3. `app/trip/[id]/trip-sub-nav.tsx` — rewrite

Replace the current component. Requirements:

**Bottom bar (keep the existing container styles — do not change):**

- Still `position: fixed; bottom: 0; left: 0; right: 0; maxWidth: 480px; margin: 0 auto; zIndex: 100; height: 56px`
- Still the same glass background, `borderTop: 1px solid #e5e5e5`, `padding: 0 4px`
- Renders **exactly 5 buttons**: 4 primary tabs from `primaryTabsForRole(role)` in order, followed by a fixed 5th ⋯ More tile.

**Primary tab buttons** use the identical styles as today (flex:1, 3px top border for active using `theme.accent`, 18px icon, 10px label, DM Sans). Keep the `getActiveSegment` logic. Keep chat-badge rendering on the Chat tab when it appears in primary (same `muted-dot` / `count` variants).

**⋯ More tile** uses the same button style as the primary tabs, with:
- Icon `"⋯"` at `fontSize: 20, fontWeight: 900, letterSpacing: 1px`
- Label `"More"`
- Active state (`borderTop: 3px solid ${theme.accent}`) when the current route segment is ANY of the `moreTabsForRole(role)` values
- A single aggregate badge: if Chat is in More (not in primary) and `useTripChatUnread` returns a count > 0 or a muted state, render the existing chat badge on the More tile. Use the same visual as the chat tab badge — no new styles. (This is the only aggregate source for v1. We'll add other tabs' activity later; don't scaffold for them now.)
- `onClick`: opens the More sheet (see below). Do NOT navigate.

**More sheet** — a bottom sheet that slides up from the bottom of the screen, matching the project's standard modal pattern (memory `project_modal_pattern.md`):

- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.4); zIndex: 200; animation: fadeIn 0.15s ease-out`. Clicking dismisses.
- Sheet: `position: fixed; left: 0; right: 0; bottom: 0; maxWidth: 480px; margin: 0 auto; zIndex: 201; background: #fff; borderRadius: 20px 20px 0 0; animation: slideUp 0.2s ease-out; maxHeight: 75vh; display: flex; flexDirection: column`
- Drag handle: 40×4px pill, `background: #ddd`, centered, `margin: 10px auto 2px`
- Header: padding `10px 20px 4px`, title "More in this trip" (Outfit, weight 700, 15px), subtitle "Everything else for this trip" (DM Sans, 11px, `theme.muted`)
- Grid: 3 columns, `gap: 10px; padding: 14px 16px 24px`. Each tile:
  - Background `theme.card`, border `1px solid ${theme.cardBorder}`, `borderRadius: 14px`, `padding: 14px 8px`
  - Column layout: 22px icon, `gap: 6px`, 12px label (DM Sans, weight 600, `theme.text`)
  - `onClick`: `router.push(/trip/${tripId}/${segment})` then close sheet
  - Active state (current segment): background = `${theme.accent}15`, border = `${theme.accent}55`, label color = `theme.accent`
- Inject the `@keyframes fadeIn` and `@keyframes slideUp` keyframes via a `<style>` tag inside the component if they aren't already defined in a parent (the trip page defines them once; if your sheet renders inside a route where they aren't, inline them). They are already defined in `trip-page.tsx` line ~1201 — since this component mounts under `trip-page.tsx`, you can rely on them and skip the inline `<style>` tag.

**Sheet state**: `const [moreOpen, setMoreOpen] = useState(false)`. When the user navigates to a More-sheet route via a tile tap, close the sheet. When the route changes (via back button, etc.), close the sheet as well — use `useEffect` on `pathname` to call `setMoreOpen(false)`.

**Keep the existing `SUB_NAV_TABS` catalog** — it's still the source for icon + label lookup by segment. Primary and More both look tabs up by segment from this same array. Do NOT duplicate the catalog.

**Invariant check (dev-only)**: If a role's `primaryTabs` is not length 4 or contains a segment not in `SUB_NAV_TABS`, `console.warn` once. Don't throw — graceful degrade: fall back to the first 4 entries of `subNavOrder`.

#### 4. `app/trip/[id]/trip-page.tsx` — no structural changes

The `<TripSubNav>` call stays where it is. The `paddingBottom: 80px` on body containers stays. Do not touch the header or back button — they already work.

---

### What NOT to change

- Do not touch the sticky top header or the `←` back button. Already correct.
- Do not introduce a new modal component. Inline the sheet inside `trip-sub-nav.tsx` — it's the only caller.
- Do not add icons/labels inline. Always resolve through the existing `SUB_NAV_TABS` array.
- Do not remove any tabs. All 7 must still be reachable (4 in bar + 3 in sheet per role).
- Do not change the `ThemeConfig` contract or add fields to it.
- Do not port the sheet to desktop media queries. Mobile-first is the pattern.

---

### Testing checklist

After implementing, verify:

1. Bottom bar renders exactly 5 slots: 4 primary + ⋯ More.
2. Switching `role_preference` in the profile reorders the primary 4 correctly for each of the 4 roles.
3. Tapping ⋯ More opens a bottom sheet with the 3 non-primary tabs for that role, in `subNavOrder` order.
4. Tapping a tile in the sheet navigates to that route and closes the sheet.
5. Tapping the backdrop or the drag handle area closes the sheet without navigating.
6. When the active route's segment is one of the More tabs (e.g., user is on `/trip/[id]/notes` and Notes is in More for this role), the ⋯ More tile shows the active 3px top accent border.
7. When Chat is in More (e.g., `vibes_only` — depending on your chosen primaryTabs), the existing chat unread count/muted dot renders on the ⋯ More tile, not the Chat tab.
8. When Chat is in primary, the badge renders on the Chat tab as it does today.
9. Adding a new tab to `SUB_NAV_TABS` and appending it to each role's `subNavOrder` makes it appear in the More sheet for all roles with no other code changes.
10. The sheet closes automatically when the route changes by any other mechanism (back button, deep link, etc.).
11. The bottom nav and sheet both respect the camping/flying/roadtrip/meetup theme accent colors.
12. Modals on child pages (add event, add booking, etc.) still layer above the bottom nav and the sheet (existing modals use zIndex higher than 201; verify one to be safe).

---

### Commit

Push straight to main once manually verified on at least one trip per theme. No branch, no PR.
