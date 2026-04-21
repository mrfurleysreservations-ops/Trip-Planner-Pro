# Trip Tab Layout Standard

Every tab inside a trip (Itinerary, Expenses, Packing, Notes, Meals, Group) uses this exact shell. Apply it one tab at a time. Do NOT change the body content — only wrap it.

## The shell (copy-paste template)

```tsx
// At top of the client component file, you already have:
//   const th = THEMES[trip.trip_type] || THEMES.home;
//   import TripSubNav from "../trip-sub-nav";

return (
  <div
    style={{
      minHeight: "100vh",
      background: th.bg,
      color: th.text,
      paddingBottom: 56, // clears the fixed sub-nav
    }}
  >
    {/* ─── STICKY TOP REGION ─────────────────────────────── */}
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: th.headerBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Row 1 — Header (required) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 8px",
          gap: 8,
        }}
      >
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
            background: `${th.accent}1a`,           // ~10% accent tint
            border: `1.5px solid ${th.accent}40`,   // ~25% accent border
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
        <h1
          style={{
            flex: 1,
            margin: "0 0 0 10px",
            fontSize: 20,
            fontWeight: 800,
            color: th.text,
          }}
        >
          {/* TAB TITLE */}
        </h1>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {/* HEADER ACTIONS — Import / Export / Edit / etc. (NOT "+") */}
        </div>
      </div>

      {/* Row 2 — Primary pill toggle (optional, 2–3 options) */}
      {/* Omit this whole block if the tab has no pill */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4px 16px 10px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "rgba(0,0,0,0.06)",
            borderRadius: 999,
            padding: 3,
          }}
        >
          {/* PILL BUTTONS — see helper below */}
        </div>
      </div>

      {/* Row 3 — Chip row / day chips / search (optional) */}
      {/* Omit if the tab has none */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "0 16px 10px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {/* CHIPS / FILTERS */}
      </div>
    </div>

    {/* ─── SCROLLABLE BODY ───────────────────────────────── */}
    <div style={{ padding: "14px 16px 24px" }}>
      {/* BODY — this tab's existing content goes here UNCHANGED */}
    </div>

    {/* ─── FAB (optional) ────────────────────────────────── */}
    {/* Omit on tabs where "+" lives in the header or there is no "+" */}
    <button
      onClick={() => {/* open add modal */}}
      aria-label="Add"
      style={{
        position: "fixed",
        bottom: 72,        // sub-nav is 56 + 16 gap
        right: 16,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: th.accent,
        color: "#fff",
        border: "none",
        fontSize: 28,
        fontWeight: 300,
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}
    >
      +
    </button>

    {/* ─── FIXED SUB-NAV (existing, unchanged) ───────────── */}
    <TripSubNav tripId={trip.id} active="notes" />
  </div>
);
```

## Canonical pill — used on EVERY tab

Every tab's primary view toggle uses this exact pill style (matches the Itinerary Calendar/List toggle). Do not invent variants.

**Container:**
```tsx
<div
  style={{
    display: "inline-flex",
    background: th.card,
    border: `1.5px solid ${th.cardBorder}`,
    borderRadius: 20,
  }}
>
  {/* pill buttons go here */}
</div>
```

**Pill button (reusable):**
```tsx
const PillBtn = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      background: active ? th.accent : "transparent",
      border: "none",
      padding: "8px 18px",
      borderRadius: 20,
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      color: active ? "#fff" : th.muted,
      cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.15s",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </button>
);
```

Works identically for 2-option pills (Itinerary, Expenses, Notes, Meals, Group) and 3-option pills (Packing). Just add more `PillBtn` children.

## Chip helper (use inside Row 3)

```tsx
const Chip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      flexShrink: 0,
      padding: "6px 12px",
      borderRadius: 999,
      background: active ? th.accent : "rgba(0,0,0,0.05)",
      color: active ? "#fff" : "#666",
      border: "none",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </button>
);
```

## Per-tab checklist

For each tab, verify:

- [ ] Outer wrapper is the root element — no other wrapper above it.
- [ ] The sticky region uses `position: sticky; top: 0; zIndex: 20`.
- [ ] Nothing else in the tab uses `position: sticky` (no orphan sticky children).
- [ ] The body content sits directly below the sticky region, no extra wrapper added around existing content.
- [ ] The outer wrapper has `paddingBottom: 56` so the last body item clears the sub-nav.
- [ ] If the tab has a "+" action, it's the FAB (bottom-right, `bottom: 72`) — NOT in the header.
- [ ] If the tab has Import/Export/Edit/Save buttons, they're in the header actions on the right.
- [ ] `TripSubNav` is the last child, with the correct `active` key.

## Per-tab assignments (what goes where)

| Tab | Row 2 pill | Row 3 chips | FAB | Header actions |
|---|---|---|---|---|
| Itinerary | Calendar / List | Day dates | + | Import · Export |
| Expenses | Expenses / Summary | Category chips (All, Food, Lodging, Transport, Activities, Other) | + | — |
| Packing | Grouping / Walkthrough / Pack & Go | Person tabs (Joe, Sarah, Emma, Noah…) | — | Edit Bags |
| Notes | Group / Personal | All / Ideas / Finalized | + | Import · Export |
| Meals | Calendar / List | Day dates | + | — |
| Group | Friends / Families | Search input (replaces chip row) | — | Save & continue |

Notes:
- Packing has **no FAB** — items are added inside the walkthrough, not from a floating button.
- Group uses a **search input** in Row 3 instead of chips.
- Tabs with a "+" FAB should NOT also have "+" in the header — one or the other.

## Sticky rule (the one hard rule)

All pinned rows live in ONE sticky container (the Row 1 / Row 2 / Row 3 div). Do not add a second `position: sticky` anywhere else in the page. If you need another pinned row for a future tab, add it as Row 4 inside the same container.

## Back button rule

From every trip tab, the back button MUST navigate to the trip hub (`/trip/${trip.id}`) via `router.push`. Do NOT use `router.back()` — it's unreliable (the user may have arrived from a sibling tab, a dashboard link, or an external URL). The trip hub is the canonical return point.

Visual: 40x40 circular, accent-tinted, tappable. See template above.
