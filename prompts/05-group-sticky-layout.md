# Build Prompt — Group sticky layout refactor

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Apply the Trip Tab Layout Standard (see `docs/tab-layout-standard.md`) to the Group tab. This is a **UI-shell-only refactor** plus one small content reorder on the Friends tab. The ONLY things changing are:

1. The header + crew roster + Friends/Families toggle + search bar become pinned in one sticky container at the top (4 rows).
2. The Friends/Families toggle is restyled from underline tabs to the **canonical pill** (matches Itinerary's Calendar/List). Labels, state variable, and handlers stay identical.
3. The crew chips are made more compact so the 4-row sticky region fits comfortably — 32px avatar with a status-colored ring replaces the current 44px avatar + status-chip + toggle layout.
4. The "Save & Continue to Your Trip" sticky-bottom CTA moves to a top-right header action button ("Save ✓"). Same onClick handler (`router.push(\`/trip/${trip.id}?from=group\`)`).
5. The back button becomes a 40x40 circular accent-tinted button. Handler already navigates correctly to `/trip/${trip.id}` — do not change it.
6. The **Friends tab body is reordered** so the "Invite someone new" form appears FIRST, then "Your friends", then "Not on the app yet". Rationale: new users will be inviting friends for the first time — the invite form should be the first thing they see, not buried below a list of app-user friends they may not have yet.

Everything else — friend list rendering, external invite form fields/handler, family cards, member pills with age emoji, empty states, search filtering logic, add/remove member logic, host lock — stays exactly as it is today.

## File in scope

Only: `app/trip/[id]/group/group-page.tsx`

Do NOT touch `page.tsx` (server), the `StatusChip` component, `FamilyCard` component, other tabs, or types.

## Required changes

### 1. Wrap the top region in one sticky container

Currently the file renders (approximately):

```
<div root>
  <Header>  ← · Group  </Header>
  <TripSubNav />
  <Crew roster strip>        ← currently NOT sticky
  <Friends/Families tabs>    ← underline tabs, currently NOT sticky
  {activeTab === "friends" && <>
    <Search bar>              ← currently NOT sticky
    <Friend list + External + Invite form>
  </>}
  {activeTab === "families" && <>
    <Search bar>
    <Your families + Friends' families>
  </>}
  <Sticky bottom "Save & Continue" CTA>
</div>
```

Refactor the top region so header, crew roster, tabs toggle, and search bar all live in one sticky container. Only ONE search bar — reuse it across tabs (the placeholder text changes based on active tab):

```
<div root>
  <div STICKY style={{ position: "sticky", top: 0, zIndex: 20, background: th.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${th.cardBorder}` }}>
    <Header>  ← (upgraded) · Group · Save ✓  </Header>
    <Crew roster strip (compact, see §3)>
    <Friends/Families pill (canonical, see §4)>
    <Search input (one, placeholder varies by active tab)>
  </div>
  <TripSubNav />
  {activeTab === "friends" && <Friend body (no search bar inside)>}
  {activeTab === "families" && <Families body (no search bar inside)>}
</div>
```

Rules:
- The sticky container holds exactly 4 rows and nothing else.
- Remove the two separate search bars (one in each tab body) — replace with ONE search bar in the sticky container.
- Remove the sticky-bottom "Save & Continue" CTA and its gradient wrapper (see §5).
- TripSubNav positioning is unchanged.

### 2. Upgrade the back button and add a Save action button

Replace the existing small `←` arrow with a 40x40 circular accent-tinted button. It already calls `router.push(\`/trip/${trip.id}\`)` — do NOT change the handler.

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

Add the Save action button on the right side of the header, taking the onClick handler from the old sticky-bottom CTA:

```tsx
<button
  onClick={() => router.push(`/trip/${trip.id}?from=group`)}
  style={{
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: `0 2px 8px ${th.accent}4d`,
  }}
>
  Save ✓
</button>
```

Add a small left margin to the "Group" title (e.g. `marginLeft: 10` on the existing h2) so it doesn't crowd the round back button.

### 3. Compact the crew roster chips

Current crew chip (lines ~327–377) renders a 44×44 avatar + name + StatusChip + toggle switch per member. That layout is too tall to pin comfortably. Replace with a compact version:

```tsx
// Inside the crew roster horizontal-scroll strip:
members.map((m) => {
  const isHostChip = m.id === host.id;
  const statusColor =
    isHostChip ? th.accent :
    m.status === "accepted" ? "#2e7d32" :
    m.status === "pending"  ? "#856404" :
    "#888";
  const statusLabel =
    isHostChip ? "HOST" :
    m.status === "accepted" ? "✓" :
    m.status === "pending"  ? "…" : "×";
  return (
    <div
      key={m.id}
      onClick={() => { if (!isHostChip && isHost) removeMember(m.id); }}
      style={{
        flexShrink: 0,
        background: "#fff",
        border: `1px solid ${th.cardBorder}`,
        borderRadius: 10,
        padding: "6px 8px",
        minWidth: 62,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        cursor: isHostChip ? "default" : (isHost ? "pointer" : "default"),
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: m.avatarColor || th.accent,
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${statusColor}`,
        }}
      >
        {getInitial(m.name)}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: th.text, maxWidth: 58, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {m.name}
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.04em", color: statusColor }}>
        {statusLabel}
      </div>
    </div>
  );
})
```

Host lock behavior: the host chip is never removable. For other members, tapping the chip removes them — but only if the current user is the host (preserve the existing `isHost` check). The old toggle switch is gone; the whole chip acts as a tap target for remove. If you prefer to keep the toggle, that's fine too — just make it smaller.

Horizontal scroll wrapper:

```tsx
<div
  style={{
    display: "flex",
    gap: 6,
    overflowX: "auto",
    scrollbarWidth: "none",
    padding: "4px 16px 10px",
  }}
>
  {/* crew chips */}
</div>
```

### 4. Restyle the Friends/Families toggle to the canonical pill

Replace the underline-tab Friends/Families switcher with the canonical pill. Keep labels, state variable (`activeTab`), and click handlers identical.

```tsx
<div style={{ display: "flex", justifyContent: "center", padding: "4px 16px 6px" }}>
  <div
    style={{
      display: "inline-flex",
      background: th.card,
      border: `1.5px solid ${th.cardBorder}`,
      borderRadius: 20,
    }}
  >
    {(["friends", "families"] as const).map((t) => (
      <button
        key={t}
        onClick={() => setActiveTab(t)}
        style={{
          background: activeTab === t ? th.accent : "transparent",
          border: "none",
          padding: "8px 18px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: activeTab === t ? 700 : 500,
          color: activeTab === t ? "#fff" : th.muted,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {t === "friends" ? "👥 Friends" : "🏠 Families"}
      </button>
    ))}
  </div>
</div>
```

### 5. Consolidate to one search bar and remove the bottom CTA

Today there are two search inputs (one inside each tab body). Remove both. Add a single search input to the sticky container, with placeholder text that switches based on `activeTab`:

```tsx
<div style={{ padding: "2px 16px 10px", position: "relative" }}>
  <span style={{ position: "absolute", left: "26px", top: 9, fontSize: 14, color: th.muted }}>🔍</span>
  <input
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder={activeTab === "friends" ? "Search friends…" : "Search families…"}
    style={{
      width: "100%",
      padding: "9px 12px 9px 34px",
      border: `1px solid ${th.cardBorder}`,
      borderRadius: 10,
      background: "#fff",
      fontSize: 13,
      fontFamily: "'DM Sans', sans-serif",
    }}
  />
</div>
```

Both tabs consume the same `search` state. The existing filtering logic (e.g. `filteredFriends`, `filteredExternals`, family filter) doesn't need to change — it already reads from one search value, just used by two different inputs. Consolidating to one input is a pure markup simplification.

Remove the sticky-bottom "Save & Continue" CTA (the `position: fixed; bottom: 56px; ...` block near lines 592–631). Its handler is now wired to the new header Save button.

### 6. Reorder the Friends tab body

Today the Friends tab body renders in this order:

1. Your friends (app-user friends)
2. Not on the app yet (external pending invites)
3. Invite someone new (the form)

Change the order to:

1. **Invite someone new (the form)**
2. **Your friends (app-user friends)**
3. **Not on the app yet (external pending invites)**

Rules:
- Only move the JSX blocks. Do NOT change the markup, styles, handlers, or state inside any of the three sections.
- The search bar stays in the sticky container (§5) — it's not part of the Friends tab body anymore.
- The Families tab body ordering does NOT change.

## Hard do-not-touch list

- Friend list rendering (app-user friends, "Not on the app yet" section) — each row's avatar / name / email / "+ Add" vs "✓ Added" state.
- External invite form — Name / Email / Send Invite button and its handler.
- Family card component — family name, owner label, "+ Add All" button, member pills with age emoji + name.
- Empty states for friends and families tabs.
- Add / remove member handlers and their Supabase calls.
- Host lock logic (`isHost` checks before `removeMember`).
- Filtering logic for friends, externals, and families.
- Data fetched from the server component — do NOT modify `page.tsx`.
- `StatusChip` component (it may still be used inside the body for external invites).
- `FamilyCard` component.

If you think you need to change anything in this list, stop and ask first.

## Verification checklist

After your change, confirm by reading the file:

- [ ] A single `<div>` with `position: sticky; top: 0; zIndex: 20` wraps the header + crew strip + Friends/Families pill + search — exactly 4 rows.
- [ ] The back button is 40x40 circular, accent-tinted, and still calls `router.push(\`/trip/${trip.id}\`)`.
- [ ] The "Group" title has a left margin so it doesn't crowd the round back button.
- [ ] A gradient "Save ✓" button is in the header's right side, calling `router.push(\`/trip/${trip.id}?from=group\`)`.
- [ ] The old sticky-bottom "Save & Continue" CTA and its gradient wrapper are gone.
- [ ] Crew chips are compact: 32px avatar with a status-colored ring, tiny status indicator below.
- [ ] Host chip has an accent-colored ring and cannot be removed.
- [ ] Tapping a non-host chip triggers `removeMember` only if the current user is host.
- [ ] Friends/Families control is the canonical pill (inline-flex container, `th.card` bg, 1.5px `th.cardBorder`, 20 radius; active = `th.accent` bg + white + fontWeight 700).
- [ ] Exactly ONE search input exists, inside the sticky container. Placeholder toggles between "Search friends…" and "Search families…".
- [ ] The two old per-tab search inputs are gone.
- [ ] Friend list, external invite form, family cards, empty states, and all handlers are unchanged (content-wise — only the Friends tab section order changes).
- [ ] Friends tab renders in this order: (1) Invite someone new form, (2) Your friends, (3) Not on the app yet.
- [ ] Families tab section order is unchanged.

## Ship it

Run `npm run build` locally first. If build passes, push straight to `main` — solo project, no branch or PR needed.
