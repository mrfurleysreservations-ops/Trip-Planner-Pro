# Build Prompt — Expenses sticky layout refactor

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Apply the new Trip Tab Layout Standard (see `docs/tab-layout-standard.md`) to the Expenses tab. This is a **UI-shell-only refactor**. The ONLY things changing are:

1. The header region, Expenses/Summary toggle, and category filter pills become pinned in one sticky container at the top.
2. The Expenses/Summary toggle is restyled from its current full-width border-bottom form to the **canonical pill** (matches Itinerary's Calendar/List pill). Option labels, emojis, and click handlers stay identical.
3. The "+ Add Expense" button moves from the fixed bottom-center gradient CTA to a bottom-right FAB.
4. The back button becomes larger (40x40 circular, accent-tinted). It already navigates correctly via `router.push(\`/trip/${trip.id}\`)` — leave the handler alone, only restyle.

Everything else — Trip Total banner, expense cards, expand/collapse, 3-step add modal, mark-settled button, delete confirmation, settle-up transfers in Summary view, payer/split logic, Trip Total math, category counts, category filter pills — stays exactly as it is today.

## File in scope

Only: `app/trip/[id]/expenses/expenses-page.tsx`

Do NOT touch `page.tsx` (server), the add modal internals, constants, helpers, or types.

## Required changes

### 1. Wrap the top region in a single sticky container

Currently the file renders (roughly):

```
<div root>
  <Header div> back + "Expenses" title </Header>
  <TripSubNav />
  <div container>
    <View toggle: Expenses / Summary>
    {activeView === "expenses" && <>
      <Trip Total banner>
      <Category filter pills>
      <Expense cards>
    </>}
    {activeView === "summary" && <Summary view>}
    <Spacer 80px>
    <Sticky bottom CTA "+ Add Expense">
  </div>
  <Add modal>
</div>
```

Refactor to:

```
<div root>
  <div STICKY style={{ position: "sticky", top: 0, zIndex: 20, background: th.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${th.cardBorder}` }}>
    <Header div> (upgraded back button) + "Expenses" title </Header>
    <View toggle: Expenses / Summary>
    {activeView === "expenses" && expenses.length > 0 && <Category filter pills>}
  </div>
  <TripSubNav />
  <div container>
    {activeView === "expenses" && <>
      <Trip Total banner>
      <Expense cards>
    </>}
    {activeView === "summary" && <Summary view>}
  </div>
  <FAB />
  <Add modal>
</div>
```

Key points:
- The View toggle is **restyled to the canonical pill** per section 2 below. The option labels, icons, and `setActiveView` click handlers do not change.
- The Category filter pills markup stays byte-identical — only its JSX position moves into the sticky wrapper. Keep the existing `expenses.length > 0` guard; the row simply doesn't render when there are no expenses. Do NOT change `pillStyle` or the category pill visuals.
- The Trip Total banner STAYS in the body (it's data, not a control). Do not move it into the sticky container.
- Remove the 80px `<div style={{ height: "80px" }} />` spacer — the FAB floats, no spacer is needed. The container's existing `padding: 16` is enough.

### 2. Restyle the Expenses / Summary toggle to the canonical pill

Replace the existing full-width flex toggle (the one with `background: ${th.accent}0a`, `border-radius: 12`, border-bottom indicator) with the canonical pill from the standard doc. Keep the SAME two options and the SAME click handlers:

```tsx
<div
  style={{
    display: "flex",
    justifyContent: "center",
    padding: "6px 16px 10px",
  }}
>
  <div
    style={{
      display: "inline-flex",
      background: th.card,
      border: `1.5px solid ${th.cardBorder}`,
      borderRadius: 20,
    }}
  >
    {(["expenses", "summary"] as const).map((view) => (
      <button
        key={view}
        onClick={() => setActiveView(view)}
        style={{
          background: activeView === view ? th.accent : "transparent",
          border: "none",
          padding: "8px 18px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: activeView === view ? 700 : 500,
          color: activeView === view ? "#fff" : th.muted,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {view === "expenses" ? "💰 Expenses" : "📊 Summary"}
      </button>
    ))}
  </div>
</div>
```

Do not introduce a shared helper component — keep it inline. No behavior change: clicking either button still calls `setActiveView` with the same value as before.

### 3. Upgrade the back button

The existing back button at line ~517 already calls `router.push(\`/trip/${trip.id}\`)` — do NOT change the handler. Only restyle it to match the standard:

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

Also bump the title's margin so it doesn't crowd the round button (e.g. add `marginLeft: 10` to the existing h2 style, or wrap as the standard doc shows).

### 4. Replace the bottom-center "+ Add Expense" CTA with a bottom-right FAB

- Find the `{!showAddModal && ( <div style={{ position: "fixed", bottom: "56px", left: "50%", ... }}> <button ...>+ Add Expense</button> </div> )}` block.
- Delete that entire block (the gradient overlay wrapper and the button inside).
- Add a FAB at the root level of the returned JSX (outside the container, at the same level as the Add modal):

```tsx
{!showAddModal && (
  <button
    onClick={openAddModal}
    aria-label="Add expense"
    style={{
      position: "fixed",
      bottom: 72,
      right: 16,
      zIndex: 50,
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
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
)}
```

- Reuse the existing `openAddModal` handler exactly. Do not create a new function.
- Keep the `{!showAddModal && ...}` guard so the FAB hides when the modal is open (matches existing behavior).

## Hard do-not-touch list

- Expense card rendering, expand/collapse behavior, per-card split breakdown.
- Trip Total banner layout, numbers, or math.
- Category filter logic, counts, or `filterCategory` state.
- 3-step add-expense modal (what/amount/category/date → who paid → split between families), all its internals, save handler.
- Mark-settled button per split.
- Delete confirmation state machine.
- Summary view: per-family balances, settle-up transfer list, simplification algorithm.
- Host/creator edit/delete permission logic (`canModify`).
- `pillStyle` helper and its consumers.
- `EXPENSE_CATEGORIES`, `memberNameMap`, `familyGroups`, any derived state.
- TripSubNav positioning.

If you think you need to change anything in this list, stop and ask first.

## Verification checklist

After your change, confirm by reading the file:

- [ ] A single `<div>` with `position: sticky; top: 0; zIndex: 20` wraps the header + view toggle + category pills — nothing else.
- [ ] The back button is 40x40 circular, accent-tinted, and still calls `router.push(\`/trip/${trip.id}\`)`.
- [ ] The Expenses/Summary toggle is the canonical pill (inline-flex container, `th.card` bg, 1.5px border, 20px radius; active button = `th.accent` bg + white text).
- [ ] Clicking "💰 Expenses" or "📊 Summary" still calls `setActiveView` with the correct value and switches the rendered view.
- [ ] The 80px spacer `<div>` is gone.
- [ ] The old bottom-center gradient "+ Add Expense" CTA and its wrapper are gone.
- [ ] The new FAB exists with `position: fixed; bottom: 72; right: 16; zIndex: 50` and wires to the existing `openAddModal` handler.
- [ ] The FAB is wrapped in `{!showAddModal && ( ... )}`.
- [ ] The Category pills markup is byte-identical (same `pillStyle` helper, same labels with counts).
- [ ] The Trip Total banner is STILL in the body (not in the sticky container).
- [ ] The Summary view rendering is unchanged.
- [ ] The Add Expense modal is unchanged.

## Ship it

Push straight to `main` — solo project, no branch or PR needed.

Before pushing, run `npm run build` locally to catch type errors. If the build fails, fix the issue and re-run — do not push a broken build.
