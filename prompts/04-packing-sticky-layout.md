# Build Prompt — Packing sticky layout refactor

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Apply the Trip Tab Layout Standard (see `docs/tab-layout-standard.md`) to the Packing tab. This is a **UI-shell-only refactor**. The ONLY things changing are:

1. The header + person tabs + view-mode toggle become pinned in one sticky container at the top.
2. The view-mode toggle (Grouping / Walkthrough / Pack & Go — or Quick Pack / Pack & Go for spontaneous users) is restyled from the current underline-tab style to the **canonical pill** (matches Itinerary's Calendar/List). Option labels, values, and `setActiveView` handlers stay identical.
3. The back button becomes a 40x40 circular accent-tinted button. It already navigates correctly via `router.push(\`/trip/${trip.id}\`)` — leave the handler alone, only restyle.

Everything else — person tabs styling, all three view-mode bodies (Grouping / Walkthrough / Pack & Go), outfit groups, outfit inspo, multi-use detection, bag hierarchy, dress-code suggestions, just-in-case extras, don't-forget reminders, onboarding gate, style banner, fixed bottom walkthrough nav (Prev/Next/Pack&Go), activity logging — stays exactly as it is today.

There is NO FAB on the Packing tab. Adds happen inside the walkthrough via existing "Add to Packing List" buttons. Do not introduce a FAB.

## File in scope

Only: `app/trip/[id]/packing/packing-page.tsx`

Do NOT touch `page.tsx` (server), constants, types, supabase schema, or any other tab.

## Required changes

### 1. Wrap the top region in one sticky container

Currently the file renders (approximately, lines 1740–1787):

```
{onboarding gate early return}
<div root>
  <vibe bg>
  <Header> ← button · Packing · style badge </Header>
  <TripSubNav />
  <Person tabs row>                     ← currently NOT sticky
  <View mode switcher underline tabs>   ← currently NOT sticky
  <Style banner description>
  {activeView === "grouping" && <Grouping body>}
  {activeView === "walkthrough" && <Walkthrough body>}
  {activeView === "checklist" && <Pack & Go body>}
  <Fixed walkthrough bottom nav> (when walkthrough)
</div>
```

Refactor the top region so header, person tabs, and view-mode toggle all live in one sticky container:

```
<div root>
  <vibe bg>
  <div STICKY style={{ position:"sticky", top:0, zIndex:20, background:th.headerBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderBottom:`1px solid ${th.cardBorder}` }}>
    <Header>  ← (upgraded) · Packing · style badge </Header>
    <Person tabs row>                 (unchanged styling)
    <View mode pill>                  (restyled to canonical pill — see §3)
  </div>
  <TripSubNav />
  <Style banner description>          (stays in body, not sticky)
  {activeView === "grouping"    && <Grouping body>}
  {activeView === "walkthrough" && <Walkthrough body>}
  {activeView === "checklist"   && <Pack & Go body>}
  <Fixed walkthrough bottom nav>      (unchanged — still position:fixed, bottom:56px)
</div>
```

Rules:
- The sticky container holds exactly THREE rows: header, person tabs, view pill. Nothing else.
- The style description banner STAYS in the body (it's descriptive text that scrolls away with content).
- The fixed walkthrough bottom nav strip is at `position: fixed; bottom: 56px` — do not change its positioning.
- Do not change the conditional render order of the three view bodies.
- Do not move the onboarding early-return block.

### 2. Upgrade the back button (visual only)

The existing back button already calls `router.push(\`/trip/${trip.id}\`)`. Do NOT change the handler. Only restyle to the standard:

```tsx
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
    background: `${th.accent}1a`,
    border: `1.5px solid ${th.accent}40`,
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

Add a small left margin to the "Packing" title (e.g. `marginLeft: 10` on the existing h2 style) so it doesn't crowd the round button. The style badge on the right stays unchanged.

### 3. Restyle the view-mode toggle to the canonical pill

Current view mode switcher uses an underline-tab style (button with `borderBottom: 3px solid accent` for active, transparent for inactive). Replace with the canonical pill. Keep the SAME view values and the SAME click handlers, including the spontaneous-vs-standard branching.

For spontaneous packing style (2 options):
- `walkthrough` → "Quick Pack"
- `checklist` → "Pack & Go ✓"

For standard packing styles (3 options):
- `grouping` → "Group"
- `walkthrough` → "Outfits"
- `checklist` → "Pack & Go ✓"

Shape:

```tsx
<div style={{ display: "flex", justifyContent: "center", padding: "8px 16px 10px" }}>
  <div
    style={{
      display: "inline-flex",
      background: th.card,
      border: `1.5px solid ${th.cardBorder}`,
      borderRadius: 20,
    }}
  >
    {/* build the list of view options based on packing style, same as today */}
    {views.map((v) => (
      <button
        key={v.value}
        onClick={() => setActiveView(v.value)}
        style={{
          background: activeView === v.value ? th.accent : "transparent",
          border: "none",
          padding: "8px 18px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: activeView === v.value ? 700 : 500,
          color: activeView === v.value ? "#fff" : th.muted,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {v.label}
      </button>
    ))}
  </div>
</div>
```

The spontaneous-style branching stays — just build the `views` array the same way the old code did, and render pill buttons instead of underline buttons.

### 4. Keep person tabs as-is

Person tabs use underline-tab styling today (`borderBottom: 3px solid` on active, with avatar initial + name + optional Host badge). This is intentionally DIFFERENT from the pill so users can distinguish "which person am I packing for" (persistent context) from "which view am I in" (mode toggle). Do not restyle person tabs.

Only move their JSX into the sticky container. The markup and inline styles inside stay byte-identical.

### 5. No FAB

Packing has no "+" FAB today and the standard says it shouldn't. Do not add one. Do not move any existing add button — all item-add flows are inside the walkthrough body.

## Hard do-not-touch list

- Onboarding early-return block (the full-page modal if `!userProfile?.onboarding_completed`).
- Vibe background div.
- TripSubNav positioning.
- Style banner text + styling (stays in body).
- Grouping view rendering: day-carousel, group labels, dress-code badges, merge/split, event count, item count.
- Walkthrough view rendering: step progression, outfit inspo panel (Unsplash search + custom upload), outfit-group/event headers, dress-code suggestion pills, overpacker bonus suggestions, reuse-outfit dropdown, bedtime pseudo-event, essentials pseudo-event, quantity pickers, Quick Pack mode.
- Pack & Go view rendering: progress bar, stats, grouped items, consolidated items, multi-use detection, checkbox behavior, bag hierarchy (bags → sections → containers), "Your Bags" card collapse/expand, just-in-case extras, don't-forget reminders, bag summary tree.
- Fixed walkthrough bottom nav strip (Prev / Next / Pack & Go buttons).
- All save / toggle-packed / add-item / delete-item handlers.
- `logActivity` calls.
- `myFamilyTripMembers` filtering logic.
- `event_participants.status` filtering (skipped events don't appear).
- Packing style system (planner / minimalist / overpacker / spontaneous / hyper_organizer).
- Gender-aware dress code and inspo search.

If you think you need to change anything in this list, stop and ask first.

## Verification checklist

After your change, confirm by reading the file:

- [ ] A single `<div>` with `position: sticky; top: 0; zIndex: 20` wraps exactly the header + person tabs + view-mode pill.
- [ ] The back button is 40x40 circular, accent-tinted, and still calls `router.push(\`/trip/${trip.id}\`)`.
- [ ] The "Packing" title has a left margin so it doesn't crowd the new round back button.
- [ ] The style badge on the right of the header is unchanged.
- [ ] The view-mode control is the canonical pill (inline-flex container, `th.card` bg, 1.5px `th.cardBorder`, 20 radius; active = `th.accent` bg + white + fontWeight 700; inactive = transparent + `th.muted` + fontWeight 500).
- [ ] The spontaneous-vs-standard branching for the pill options still works — spontaneous users see 2 pill buttons, everyone else sees 3.
- [ ] Clicking any pill button still calls `setActiveView` with the correct value.
- [ ] Person tabs markup is BYTE-IDENTICAL except for the new parent sticky wrapper. Underline style preserved.
- [ ] Style banner is STILL in the body (not in the sticky container).
- [ ] Grouping body, Walkthrough body, Pack & Go body rendering is unchanged — only their parent container context changed.
- [ ] Fixed walkthrough bottom nav strip is unchanged.
- [ ] No FAB was added.
- [ ] Onboarding early-return block is unchanged.

## Ship it

Run `npm run build` locally first. If build passes, push straight to `main` — solo project, no branch or PR needed.

If the build surfaces any unexpected type errors, they're almost certainly from something outside the scope of this refactor — stop and ask.
