# Build Prompt — Itinerary sticky layout refactor

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Apply the new Trip Tab Layout Standard (see `docs/tab-layout-standard.md`) to the Itinerary tab. This is a **UI-shell-only refactor**. The ONLY things changing are:

1. The header region becomes sticky so it stays pinned as the user scrolls.
2. The "+" add-event button moves from a fixed bottom-center gradient button to a bottom-right FAB.
3. The back button becomes larger and explicitly navigates to the trip hub (`/trip/[id]`), not `router.back()`.

Everything else — event logic, modals, calendar hour grid, click-empty-hour-to-open-modal, list view rendering, data fetching, participant logic, staging banner, imports/exports, badges, per-day inline "+ Add Event" buttons — stays exactly as it is today.

## File in scope

Only: `app/trip/[id]/itinerary/itinerary-page.tsx`

Do NOT touch `page.tsx` (server), any modals, constants, helpers, or types.

## Required changes

### 1. Wrap the top region in a single sticky container

Wrap these existing, already-rendered elements in one new `<div>`:

- Page header (back button, "Itinerary" title, 📥 Import + 📤 Export buttons) — with the back button updated per section 2 below
- Calendar/List pill toggle
- Day picker (only rendered in Calendar view today — leave that conditional as-is)

The wrapper:

```tsx
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: th.headerBg,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: `1px solid ${th.cardBorder}`,
  }}
>
  {/* existing header JSX */}
  {/* existing Calendar/List pill JSX */}
  {viewMode === "calendar" && (
    {/* existing day picker JSX — unchanged */}
  )}
</div>
```

Do NOT change:
- The contents of the header, pill, or day picker (except the back button update below).
- Whether the day picker shows in List view. (It still only shows in Calendar.)
- The List view "all days" behavior.
- The existing sticky day-section headers inside the List view body. They stay exactly as they are today — that's body content, out of scope for this refactor. They may visually stack under the new outer sticky container; that's accepted.

### 2. Upgrade the back button

Replace the existing small text-arrow back button with a larger, more tappable circular button that **explicitly navigates to the trip hub** (`/trip/[trip.id]`) instead of calling `router.back()`. `router.back()` is unreliable — if the user arrived from Packing, Notes, or an external link, it would send them to the wrong place. From any trip tab, back should always land on the hub.

```tsx
import { useRouter } from "next/navigation";
// ...inside the component:
const router = useRouter();

// Inside the page header, replace the existing back button with:
<button
  onClick={() => router.push(`/trip/${trip.id}`)}
  aria-label="Back to trip hub"
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: `${th.accent}1a`,          // ~10% accent
    border: `1.5px solid ${th.accent}40`,  // ~25% accent
    color: th.accent,
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    transition: "all 0.15s",
  }}
>
  ←
</button>
```

Also add a little left margin to the page title so it doesn't crowd the new round button (e.g. `marginLeft: 10` on the title's style).

### 3. Replace the bottom-center "+ Add Event" button with a bottom-right FAB

- Find the existing fixed-position bottom-center gradient "+ Add Event" button (the one wrapped in the gradient overlay).
- Remove that button AND its gradient overlay wrapper.
- Add a new FAB at the root level of the returned JSX:

```tsx
<button
  onClick={/* the SAME handler the old button used — reuse, don't duplicate */}
  aria-label="Add event"
  style={{
    position: "fixed",
    bottom: 72,
    right: 16,
    zIndex: 50,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2} 100%)`,
    color: "#fff",
    border: "none",
    fontSize: 28,
    fontWeight: 300,
    cursor: "pointer",
    boxShadow: `0 4px 20px ${th.accent}60`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  +
</button>
```

Click behavior: opens the same add-event modal that the old button opened. Do not create a new modal or a new handler — wire it to whatever function the old button called.

### 4. Leave the per-day inline "+ Add Event" dashed buttons in List view alone

They continue to exist and work as they do today.

## Hard do-not-touch list

- Calendar hour grid rendering and its click-empty-slot-to-open-modal behavior.
- List view rendering across all days.
- Body-level sticky day-section headers.
- Event card layout, time/location/badges/icons, dress-code pill, required/optional pill, expense pill (both green "$X" and soft "Add") variants.
- Event detail modal (bottom sheet) and everything inside it.
- Add / Edit / Delete event modal flows.
- Staging area banner for unplaced events.
- Import and Export buttons and their behavior.
- Family auto-attend logic.
- RLS trip-owner-clause behavior.

If you think you need to change anything in this list to make the sticky container or FAB work, stop and ask first.

## Verification checklist

After your change, confirm by reading the file:

- [ ] The outer `<div>` with `position: sticky; top: 0; zIndex: 20` wraps exactly the header + pill + day picker and nothing else.
- [ ] The back button is a 40x40 circular accent-tinted button that calls `router.push(`/trip/${trip.id}`)`, NOT `router.back()`.
- [ ] The old bottom-center gradient "+ Add Event" button and its overlay wrapper are gone.
- [ ] The new FAB exists with `position: fixed; bottom: 72; right: 16; zIndex: 50` and wires to the same add-event handler.
- [ ] `viewMode === "calendar"` still gates the day picker.
- [ ] The List view body JSX is byte-identical except for surrounding context.
- [ ] The Calendar view hour grid JSX is byte-identical.
- [ ] Nothing in any modal changed.

## Ship it

Push straight to `main` — solo project, no branch or PR needed.
