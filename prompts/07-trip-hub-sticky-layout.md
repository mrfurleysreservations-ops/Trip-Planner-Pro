# Build Prompt — Trip Hub sticky layout refactor

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Apply the Trip Tab Layout Standard (see `docs/tab-layout-standard.md`) to the Trip Hub page — the main `/trip/[id]` landing page, NOT the individual tabs. This is a **UI-shell-only refactor**. The ONLY things changing are:

1. The header row (back button + trip title + subtitle + Edit Details) becomes pinned in a sticky container at the top.
2. The back button becomes a 40x40 circular accent-tinted button. Handler already goes to `/dashboard` — do not change it.
3. The "+ Add Booking" button moves from the fixed bottom-center gradient CTA to a bottom-right FAB. Handler is unchanged (`setShowAddBookingModal(true)`).

Everything else — WeatherCard, the Travel & Lodging section, booking type grouping (Flights / Hotels / Car rentals / Restaurants), collapse/expand state, booking card detail rendering, add/edit booking modals, setup gate early-return (`needsSetup`), host-only Edit gate, Delete logic, TripSubNav — stays exactly as it is today.

## File in scope

Only: `app/trip/[id]/trip-page.tsx` (~1,207 lines)

Do NOT touch:
- `app/trip/[id]/page.tsx` (server)
- `app/trip/[id]/trip-sub-nav.tsx`
- `app/trip/[id]/weather-card.tsx`
- any modal internals
- any tab page
- constants, types, CSS

## Required changes

### 1. Wrap the top header row in a single sticky container

The current header (approximately lines 711–735) renders inline. Wrap it as-is in one new sticky `<div>`:

```tsx
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: `1px solid ${th.cardBorder}`,
  }}
>
  {/* existing header JSX — back button, trip title + subtitle + Edit Details — goes here */}
</div>
```

Do NOT change:
- The inner content of the header (trip title with type icon, location · date range · member count subtitle, Edit Details host-only button).
- The position of WeatherCard (line ~739) — it stays in the body, scrolls with content.
- The position of the Travel & Lodging section — stays in the body.
- The setup-gate early-return block — it has its own separate render path and is out of scope.
- TripSubNav positioning.

This applies to the hub view only. The setup wizard view (when `needsSetup === true`) is rendered separately (lines 1115–1206) — leave its header and layout untouched.

### 2. Upgrade the back button (visual only)

The existing back button at approximately line 714 currently renders as a plain `←` with `fontSize: 18, color: th.muted`. Replace the styling only — the `onClick={() => router.push("/dashboard")}` handler stays identical.

```tsx
<button
  onClick={() => router.push("/dashboard")}
  aria-label="Back to dashboard"
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: `${th.accent}1a`,
    border: `1.5px solid ${th.accent}40`,
    color: th.accent,
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    transition: "all 0.15s",
    flexShrink: 0,
  }}
>
  ←
</button>
```

Add a small left margin or gap before the trip title so it doesn't crowd the round button.

### 3. Replace the bottom-center "+ Add Booking" CTA with a bottom-right FAB

Find the fixed gradient CTA (approximately lines 962–999) — the block wrapped in `{!showAddBookingModal && ( ... )}` with `position: "fixed", bottom: "56px", left: "50%", transform: "translateX(-50%)"`, gradient overlay, and a `"+ Add Booking"` gradient button inside.

Delete that entire block (the gradient overlay wrapper AND the button inside).

Replace it with a FAB at the root level of the returned JSX:

```tsx
{!showAddBookingModal && (
  <button
    onClick={() => setShowAddBookingModal(true)}
    aria-label="Add booking"
    style={{
      position: "fixed",
      bottom: 72,                                   // clears 56px TripSubNav + 16px gap
      right: 16,
      zIndex: 101,                                  // same z as old CTA so it stays above sub-nav
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
      color: "#fff",
      border: "none",
      fontSize: 28,
      fontWeight: 300,
      cursor: "pointer",
      boxShadow: `0 4px 20px ${th.accent}8c`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    +
  </button>
)}
```

- Reuse the existing `setShowAddBookingModal` handler. Do NOT create a new state or helper.
- Keep the `{!showAddBookingModal && ( ... )}` guard so the FAB hides when the modal is open (matches existing behavior).
- Leave the empty-state inline "+ Add Booking" button (inside the section when no bookings exist, around line 944) exactly as it is — it's context-specific and still appropriate.

### 4. Adjust bottom padding

The container at approximately line 737 currently has `paddingBottom: 80px` to clear the old 56px TripSubNav + the sticky CTA height. With the FAB instead of a full-width CTA, the padding only needs to clear the sub-nav (56px) plus enough room that the last booking card isn't crowded. Set it to `paddingBottom: 80px` (keep it the same — safe to leave) or trim to `paddingBottom: 72px` if you verify the last card renders cleanly above the sub-nav. Do not change anything else about that container.

## Hard do-not-touch list

- WeatherCard rendering — all its props and behavior.
- Travel & Lodging section — including section header "🧳 Travel & Lodging", booking type grouping, type-level count badges, collapse/expand chevron behavior.
- Booking card rendering — headline, subtitle, date/time, confirmation number, cost, tap-to-expand detail (terminal, seat, times, address with Maps link, notes, "Added by", edit/delete buttons).
- Empty state inside the section (emoji + "No bookings yet" + inline "+ Add Booking" button) — stays unchanged.
- Add-booking and edit-booking modals — their sticky modal headers (lines ~1018 and ~1069) are INSIDE modals and out of scope.
- Setup gate: the `needsSetup` early-return and the full setup wizard view (lines 1115–1206) — stays unchanged.
- Host-only Edit Details button gating logic (who sees the button).
- TripSubNav component, its positioning, or which tabs it renders.
- Theme variables (`th`) and where they come from.
- `router.push("/dashboard")` handler on the back button.
- `setShowAddBookingModal(true)` handler wired to the FAB.

If you think you need to change anything in this list, stop and ask first.

## Verification checklist

After your change, confirm by reading the file + testing:

- [ ] A single `<div>` with `position: sticky; top: 0; zIndex: 20` wraps exactly the header row and nothing else.
- [ ] The sticky container only wraps the header on the HUB path (when `needsSetup === false`). The setup-wizard path is untouched.
- [ ] The back button is 40x40 circular, accent-tinted, and still calls `router.push("/dashboard")`.
- [ ] The trip title still shows the type icon + name, subtitle still shows `📍 location · date range · 👥 member count`, and the Edit Details button still only renders for the host.
- [ ] The old fixed bottom-center gradient "+ Add Booking" CTA block (at `bottom: 56px; left: 50%`) and its gradient overlay wrapper are GONE.
- [ ] A new FAB exists at `position: fixed; bottom: 72; right: 16; zIndex: 101`, wrapped in `{!showAddBookingModal && ( ... )}`, wired to the existing `setShowAddBookingModal(true)` handler.
- [ ] Clicking the FAB opens the same add-booking modal as before.
- [ ] The inline "+ Add Booking" button inside the empty-state card is unchanged.
- [ ] WeatherCard, Travel & Lodging section, booking cards, collapse/expand, and modals render byte-identical.
- [ ] TripSubNav is unchanged and still fixed at bottom.
- [ ] `npm run build` passes locally.

## Ship it

Run `npm run build` locally first. If build passes, push straight to `main` — solo project, no branch or PR needed.

If anything outside this scope surfaces a type error or layout regression, stop and ask — don't patch beyond the three changes described above.
