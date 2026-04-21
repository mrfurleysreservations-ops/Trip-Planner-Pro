# Build: Family Editor — Sticky Back Header + Member/Item Row Restyle (Phase 4 of Profile Consistency Pass)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` and `docs/tab-layout-standard.md` before writing any code. Phases 1–3 must be merged first — this phase assumes the `You · Family · Account` pill exists, headers use `<SectionHeader>` from `app/components/ui`, and `editFam` already lives inside the `Family` pill.

This phase modifies `app/profile/profile-page.tsx` only. No new files, no schema, no other components.

---

## What this phase builds (and ONLY this)

The family editor sub-view (the `editFam` branch on the Family pill) is the last part of the Profile page that still feels like the old admin chrome — small fonts, ghost ✕ delete affordances, an inline "← All Profiles" gray button. This phase brings it in line with the rest of the app:

1. **Sticky header swaps to "back + family name" while in editor mode.** Replaces the inline `← All Profiles` button. Mirrors the trip-tab pattern from `docs/tab-layout-standard.md`.
2. **Per-member row** in the Members list gets `card-glass` styling, a 32px avatar, larger inputs, and a proper red Delete button.
3. **Per-bin-item row** inside each Inventory Bin gets larger inputs and a proper red Delete button.
4. **The bin top row + "+ Item" / "+ Bin" / "+ Add Member" buttons** get proper sizing so they stop looking like leftovers from a different design era.

Nothing else. No accordion changes, no sticky-bg color tweaks, no helper extraction, no new components, no schema changes, no behavior changes.

---

## Finalized design decisions — do NOT re-ask

### Conditional sticky header (the big one)

When the user is inside the family editor (`editFam !== null`), the sticky region collapses from three rows (avatar + title | TopNav | pill) to one row (back button + family name title). Both shapes share the same outer sticky container — only the inner content differs.

**Why:** This mirrors the trip-tab convention where Row 1 carries `back + page title`. Once you're focused on editing one family, the global TopNav and the You/Family/Account pill are noise — you'll leave via the back button when done. Same logic that hides TopNav inside trip tabs.

**Implementation shape:**

```tsx
<div /* existing sticky outer container */>
  <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
    {editFam ? (
      // ── Editor mode: back + family name ──
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
        <button
          onClick={() => setEditId(null)}
          aria-label="Back to families"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `${th.accent}1a`,            // ~10% accent tint
            border: `1.5px solid ${th.accent}40`,    // ~25% accent border
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
            margin: 0,
            marginLeft: 4,
            flex: 1,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: th.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {editFam.name || "Family"}
        </h1>
      </div>
    ) : (
      // ── Normal mode: existing Phase-2 sticky content ──
      <>
        {/* existing Row 1 (avatar + Profile title) */}
        {/* existing TopNav */}
        {/* existing pill (You · Family · Account) */}
      </>
    )}
  </div>
</div>
```

**Behavior notes:**
- The title `{editFam.name || "Family"}` is live — typing into the Family Name input below updates `editFam.name` via `updateFamily()`, and the sticky title re-renders immediately. Verify this works during testing.
- `aria-label="Back to families"` is required for accessibility — the ← character is not self-describing.
- Hide overflow with ellipsis on the title to handle long family names gracefully.
- The accent-tinted circle back button uses the **same exact alpha hex codes** as `tab-layout-standard.md` (`1a` and `40`). Do not invent variants.
- The existing inline `<button>← All Profiles</button>` in the body (currently the first child of the `editFam` ternary's truthy branch) **gets deleted**. The sticky back button replaces it.

### Per-member row in the Members list

Currently (inside the editor's Members section):
```tsx
<div className="card-glass" style={{ padding: "8px 12px", marginBottom: "4px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
  <span style={{ fontWeight: 600, fontSize: "13px" }}>{ageIcon(...)} {m.name}</span>
  <select age_type fontSize: 11px />
  <select appetite fontSize: 11px />
  <span onClick=delete style={{ opacity: 0.3 }}>✕</span>
</div>
```

Replace each member row with:

```tsx
<div
  key={m.id}
  className="card-glass"
  style={{
    padding: "10px 12px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  }}
>
  {/* 32px avatar — image if set, age-icon emoji fallback in tinted circle */}
  {m.avatar_url ? (
    <img
      src={m.avatar_url}
      alt={m.name}
      style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  ) : (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: `${th.accent}1a`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        flexShrink: 0,
      }}
    >
      {ageIcon(m.age_type || "adult")}
    </div>
  )}

  {/* name */}
  <span style={{ fontWeight: 600, fontSize: "14px", flex: "1 1 100px", minWidth: "80px" }}>
    {m.name}
  </span>

  {/* age select */}
  <select
    value={m.age_type || "adult"}
    onChange={(e) => updateMember(editFam.id, m.id, "age_type", e.target.value)}
    className="input-modern"
    style={{ width: "auto", padding: "6px 10px", fontSize: "13px" }}
  >
    {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
  </select>

  {/* appetite select (hidden for babies, same as today) */}
  {m.age_type !== "baby" && (
    <select
      value={m.appetite || "normal"}
      onChange={(e) => updateMember(editFam.id, m.id, "appetite", e.target.value)}
      className="input-modern"
      style={{ width: "auto", padding: "6px 10px", fontSize: "13px" }}
    >
      {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
    </select>
  )}

  {/* delete — proper red btn-sm, replaces the opacity-0.3 ghost ✕ */}
  <button
    onClick={() => deleteMember(editFam.id, m.id)}
    aria-label={`Remove ${m.name}`}
    className="btn btn-sm"
    style={{ background: "#e74c3c", padding: "6px 10px", marginLeft: "auto" }}
  >
    ✕
  </button>
</div>
```

`marginLeft: "auto"` on the delete button keeps it pinned to the right when the row wraps. The select font sizes go from 11px → 13px to match the rest of the app's `input-modern` minimums on mobile.

### Add-member row (top of Members section)

Currently:
```tsx
<div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
  <input placeholder="Name" ... fontSize 14ish/>
  <select age fontSize: 12px />
  <select appetite fontSize: 12px />
  <button btn-sm + />
</div>
```

Bump the two select font sizes from `12px` to `13px` to match the per-member row above. Bump the gap from `6px` to `8px`. Keep everything else as-is — the row works, just needs proportional polish.

```tsx
<div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
  <input placeholder="Name" value={newMemName} onChange={...} onKeyDown={...} className="input-modern" style={{ flex: "1 1 100px", minWidth: "80px" }} />
  <select value={newMemAge} onChange={...} className="input-modern" style={{ width: "auto", fontSize: "13px" }}>...</select>
  <select value={newMemApp} onChange={...} className="input-modern" style={{ width: "auto", fontSize: "13px" }}>...</select>
  <button onClick={() => addMember(editFam.id)} className="btn btn-sm" style={{ background: th.accent, padding: "8px 14px" }}>+ Add</button>
</div>
```

The `+ Add` label is more discoverable than a bare `+` and matches Profile's "+ New Family" / "+ Bin" button labels elsewhere.

### Per-bin top row

Currently:
```tsx
<div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
  <input bin name fontWeight 600 />
  <select zone fontSize: 12px />
  <button delete bg red ✕ />
</div>
```

Bump zone select font 12px → 13px, gap 6px → 8px, marginBottom 8px → 10px. Keep handlers identical.

```tsx
<div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
  <input value={bin.name} onChange={...} className="input-modern" style={{ flex: "1 1 150px", fontWeight: 600 }} />
  <select value={bin.zone || "none"} onChange={...} className="input-modern" style={{ width: "auto", fontSize: "13px" }}>...</select>
  <button onClick={() => deleteBin(editFam.id, bin.id)} className="btn btn-sm" style={{ background: "#e74c3c", padding: "6px 10px" }} aria-label="Delete bin">✕</button>
</div>
```

### Per-bin-item row

Currently:
```tsx
<div style={{ display: "flex", gap: "4px", marginBottom: "3px", alignItems: "center", flexWrap: "wrap", background: "#fafafa", borderRadius: "8px", padding: "5px 8px" }}>
  <input name fontSize: 12px />
  <select category fontSize: 11px />
  <label fontSize: 11px>checkbox Consumable</label>
  {is_consumable && <input qty fontSize: 11px width 45 />}
  <span onClick=delete opacity 0.3 ✕ />
</div>
```

Replace with:

```tsx
<div
  key={item.id}
  style={{
    display: "flex",
    gap: "8px",
    marginBottom: "6px",
    alignItems: "center",
    flexWrap: "wrap",
    background: "#fafafa",
    borderRadius: 10,
    padding: "8px 10px",
  }}
>
  <input
    value={item.name}
    onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "name", e.target.value)}
    placeholder="Item name"
    className="input-modern"
    style={{ flex: "1 1 120px", minWidth: "90px", padding: "6px 10px", fontSize: "13px" }}
  />
  <select
    value={item.category || "gear"}
    onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "category", e.target.value)}
    className="input-modern"
    style={{ width: "auto", fontSize: "13px", padding: "6px 8px" }}
  >
    {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
  </select>
  <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", color: "#666" }}>
    <input
      type="checkbox"
      checked={item.is_consumable || false}
      onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "is_consumable", e.target.checked)}
    />
    Consumable
  </label>
  {item.is_consumable && (
    <input
      type="number"
      min="1"
      value={item.qty_needed || 1}
      onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "qty_needed", parseInt(e.target.value) || 1)}
      className="input-modern"
      style={{ width: 56, fontSize: "13px", padding: "6px 8px" }}
      aria-label="Quantity needed"
    />
  )}
  <button
    onClick={() => deleteBinItem(editFam.id, bin.id, item.id)}
    className="btn btn-sm"
    style={{ background: "#e74c3c", padding: "6px 10px", marginLeft: "auto" }}
    aria-label={`Remove ${item.name || "item"}`}
  >
    ✕
  </button>
</div>
```

### `+ Item` button (bottom of each bin)

Currently:
```tsx
<button ... className="btn btn-sm" style={{ background: "#f0f0f0", color: th.text, marginTop: "4px", fontSize: "11px" }}>+ Item</button>
```

Replace with:
```tsx
<button
  onClick={() => addBinItem(editFam.id, bin.id)}
  className="btn btn-sm"
  style={{ background: th.accent, marginTop: "8px" }}
>
  + Item
</button>
```

Accent background matches "+ Bin" / "+ New Family" / "+ Add Member" / "+ Add". Removes the one-off gray + 11px font.

### `+ Bin` button (Inventory Bins header row)

Already correct (`className="btn btn-sm" style={{ background: th.accent }}`). Leave as-is.

---

## What does NOT change in this phase
- The Family Name input + label (already correct).
- The Car Snack Preferences textarea + label (already correct).
- The bin's outer `card-glass` wrapper with `borderLeft: 3px solid ${th.accent}` (correct — that's the new pattern).
- Section headers (Phase 2 + 3 already converted them).
- Anything outside the `editFam` branch of the Family pill.
- The `MemberDetailCard` component (already on the new pattern).
- The pill, sticky bg color, accordions, helper extraction — those are other phases or already done.
- `app/profile/page.tsx` server component (untouched).
- Every other file in the repo (untouched).

---

## Verification checklist (run before declaring done)

- [ ] Click into a family → sticky header collapses to a single row showing the 40×40 accent-tinted circular back button + the family name as title. TopNav and the You/Family/Account pill are no longer visible while in the editor.
- [ ] The inline `← All Profiles` gray button in the body is gone — the sticky back button is the only way out of the editor.
- [ ] Type into the Family Name input → the sticky title updates live.
- [ ] Type a very long family name (50+ chars) → title ellipses cleanly without breaking the layout.
- [ ] Press the back button → returns to the Family pill's slider + families list, with the pill row + TopNav restored.
- [ ] Each member row renders as a `card-glass` row with a 32px avatar (image if set, age-icon emoji in a tinted circle if not), name, age select, appetite select (hidden for babies), and a solid red ✕ Delete button pinned right.
- [ ] Member row select fonts are 13px on mobile (no iOS zoom on focus, since `.input-modern` mobile rule already bumps to 16px in the global CSS — verify this still applies because the inline `fontSize: 13px` overrides it; if iOS zooms, accept that and report back).
- [ ] Clicking ✕ on a member still deletes them. Editing age/appetite still saves immediately.
- [ ] Add-member row uses 13px selects, gap 8px, and shows a `+ Add` labeled button (not a bare `+`).
- [ ] Per-bin top row uses 13px zone select with proper red ✕ Delete button.
- [ ] Per-bin-item rows use 13px name + category, proper red ✕ Delete button pinned right, qty input 56px wide.
- [ ] The `+ Item` button uses accent color (matches `+ Bin` and `+ Add Member`).
- [ ] All CRUD still works end-to-end: add bin, rename bin, change zone, delete bin, add item, edit item name/category/consumable/qty, delete item.
- [ ] Pill behavior unchanged: switching to You or Account from inside the editor (only possible via back-then-pill) still works as expected.
- [ ] `npm run build` passes with no new TypeScript errors.

---

## A note on the iOS zoom edge case

`app/globals.css` has `.input-modern { font-size: 16px; }` inside a `@media (max-width: 767px)` block to prevent iOS zoom on input focus. The inline `fontSize: 13px` overrides on the per-member and per-bin-item selects will defeat that protection on the affected fields. This is **acceptable** because (a) selects do not trigger the iOS zoom in the same way text inputs do, and (b) the family editor is a low-frequency surface — full-page settings, not real-time entry. If you observe iOS zoom on these selects during testing, report back and we'll address it in a follow-up; do not pre-emptively switch them to 16px.

---

## When done

Push straight to `main` (solo hobby project — no PR). Commit message:

```
profile: family editor sticky back header + row restyle

Phase 4 of profile consistency pass. The editor sub-view was the last
old-chrome surface on the Profile page:

- replaces the inline "← All Profiles" gray button with the canonical
  sticky-row-1 back pattern from docs/tab-layout-standard.md (40×40
  accent-tinted circle + family name as live title); TopNav and the
  You/Family/Account pill hide while in the editor, mirroring how trip
  tabs behave once you're inside one
- restyles per-member rows with card-glass + 32px avatar + 13px selects
  + proper red ✕ Delete button (no more opacity-0.3 ghost)
- restyles per-bin-item rows with 13px inputs + proper red ✕ Delete
  pinned right
- bumps the add-member, bin top, "+ Item" buttons to consistent sizing
  and accent color

No behavior changes — every CRUD path works as before.
```

I (Claude) cannot run git from the sandbox — run the commit + push locally.
