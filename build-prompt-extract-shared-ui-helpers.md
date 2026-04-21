# Build: Extract Shared UI Helpers — `PillBtn` + `SectionHeader` (Phase 3 of Profile Consistency Pass)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` and `docs/tab-layout-standard.md` before writing any code. Phases 1 and 2 must be merged first — this phase assumes Profile already has the `You · Family · Account` pill (with an inline `PillBtn`) and small-caps section headers.

---

## What this phase builds (and ONLY this)

Create `app/components/ui.tsx` exporting **two** components — `PillBtn` and `SectionHeader` — and replace the inline copies on Profile and Friends with imports.

That is the entire scope. No new features. No new components. No styling tweaks.

### Why only two

Friends defines several inline helpers today (`PillBtn`, `SectionHeader`, `SectionSubtitle`, `EmptyRow`, `List`, `Slider`, `ShowMoreButton`, `SearchBar`, `PendingDropdown`). We are extracting **only the two with current second consumers** (Profile uses both after Phase 2). Speculative extraction violates the "avoid unnecessary abstraction" rule in `CLAUDE.md` — when a future page needs `EmptyRow` or `Slider`, lift it then.

---

## Finalized design decisions — do NOT re-ask

### File location and naming
- New file: `app/components/ui.tsx`. Matches the existing convention (`app-shell.tsx`, `avatar-picker.tsx`, `member-slider.tsx`).
- Both components are named exports: `export function PillBtn(...)`, `export function SectionHeader(...)`.
- No default export. No barrel file. Importers use `import { PillBtn, SectionHeader } from "@/app/components/ui";`.
- Add a one-line comment at the top: `// Shared layout primitives. Extract more from app/friends/friends-page.tsx as second consumers appear.` This is a deliberate signpost — do NOT pre-extract things "just in case."

### `PillBtn` — exact API and implementation
Match the version currently in `app/friends/friends-page.tsx` (lines 641–664) byte-for-byte. Same prop names, same styles, same casing.

```tsx
export function PillBtn({
  label,
  active,
  onClick,
  accent,
  muted,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent: string;
  muted: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? accent : "transparent",
        border: "none",
        padding: "8px 22px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? "#fff" : muted,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
```

The `accent` and `muted` props stay required (do NOT default them) — every caller has a theme handy and passing the colors keeps the component theme-agnostic. This matches Friends' existing API exactly and preserves the per-trip-type accent behavior on trip tabs that will adopt this later.

### `SectionHeader` — exact API and implementation

Two real-world sizes exist in the app:
- **sm** (11px, 0.08em tracking, `margin: "16px 0 6px"`) — Friends uses this for every section header.
- **md** (14px, 0.06em tracking, `marginBottom: "12px"`) — Dashboard uses this for "UPCOMING" / "PAST TRIPS"; Profile (after Phase 2) uses this for "Family Members" / "Your Families" / etc.

Single component with a `size` prop. Default `size="sm"` so Friends' diff stays minimal — Friends does not pass `size` and gets exactly its current 11px style.

```tsx
export function SectionHeader({
  label,
  size = "sm",
  style,
}: {
  label: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}) {
  const sizeStyle: React.CSSProperties =
    size === "md"
      ? {
          fontSize: 14,
          fontWeight: 700,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 12,
          fontFamily: "'DM Sans', sans-serif",
        }
      : {
          fontSize: 11,
          fontWeight: 700,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "16px 0 6px",
          fontFamily: "'DM Sans', sans-serif",
        };
  return <h3 style={{ ...sizeStyle, ...style }}>{label}</h3>;
}
```

`style` is the escape hatch for callers that need to override margin (e.g., a header sitting inside a flex row with an action button on the right needs `style={{ margin: 0 }}`). The caller's `style` always wins by spreading second.

`label` text is sentence case in source — `text-transform: uppercase` handles the visual caps. Do NOT capitalize in JSX.

---

## Migration — Friends (`app/friends/friends-page.tsx`)

1. Add the import at the top of the file (alongside the other component imports):
   ```tsx
   import { PillBtn, SectionHeader } from "@/app/components/ui";
   ```
2. Delete the local `function PillBtn(...)` definition (currently around line 641).
3. Delete the local `function SectionHeader(...)` definition (currently around line 666).
4. Do NOT change any callsite — both were already named `PillBtn` / `SectionHeader` with the same APIs. The migration is purely "delete local + add import."
5. Do NOT touch `SectionSubtitle`, `EmptyRow`, `List`, `Slider`, `ShowMoreButton`, `SearchBar`, or `PendingDropdown` — they stay defined inline in Friends.

If any callsite breaks (it shouldn't), check whether the local definition's API drifted from this prompt's spec. Prefer fixing the spec match over changing the API.

---

## Migration — Profile (`app/profile/profile-page.tsx`)

### `PillBtn`
1. Add `PillBtn` to the import from `@/app/components/ui` (you'll be importing both — see the SectionHeader migration below).
2. Delete the local `function PillBtn(...)` that Phase 1 added.
3. Callsites (the three `<PillBtn label="You" .../>` etc. in the sticky Row 3) do not change.

### `SectionHeader`
After Phase 2 there are two flavors of section header to migrate on Profile:

**(a) The five Phase-2-converted `<h3>` blocks** — use `size="md"`:

| Location in file | Old JSX → New JSX |
|---|---|
| Family Members section (Family pill) | `<h3 style={{...}}>Family Members</h3>` → `<SectionHeader label="Family Members" size="md" style={{ margin: 0 }} />` |
| Your Families section (Family pill) | `<h3 style={{...}}>Your Families</h3>` → `<SectionHeader label="Your Families" size="md" style={{ margin: 0 }} />` |
| Members (inside family editor) | `<h3 style={{...}}>Members</h3>` → `<SectionHeader label="Members" size="md" style={{ marginBottom: 12 }} />` |
| Car Snack Preferences (inside family editor) | same pattern → `<SectionHeader label="Car Snack Preferences" size="md" style={{ marginBottom: 12 }} />` |
| Inventory Bins (inside family editor) | same pattern → `<SectionHeader label="Inventory Bins" size="md" style={{ margin: 0 }} />` |

The `style={{ margin: 0 }}` overrides on rows that contain an inline action button on the right ("+ Add" / "+ New Family" / "+ Bin") — those flex parents already control vertical spacing, and a non-zero margin on the header would break alignment.

For the two non-action-row headers (`Members`, `Car Snack Preferences`), pass `style={{ marginBottom: 12 }}` to preserve the spacing the inline `<h3>` currently has via Phase 2.

**(b) The four Packing-Preferences sub-group labels** — use `size="sm"`:

These are currently `<div>`s, not `<h3>`s. Replace them anyway — semantic `<h3>` is correct for these labels too, and `SectionHeader` always renders `<h3>`:

| Label text | Old JSX → New JSX |
|---|---|
| Packing Style | `<div style={{ fontSize: "11px", ..., color: "#999", marginBottom: "10px" }}>Packing Style</div>` → `<SectionHeader label="Packing Style" style={{ marginBottom: 10 }} />` |
| How You Pack | same → `<SectionHeader label="How You Pack" style={{ marginBottom: 10 }} />` |
| How Much You Plan | same → `<SectionHeader label="How Much You Plan" style={{ marginBottom: 10 }} />` |
| Shortcuts | same → `<SectionHeader label="Shortcuts" style={{ marginBottom: 10 }} />` |

The `style={{ marginBottom: 10 }}` override preserves Phase-2's spacing (default sm margin is `"16px 0 6px"` which would space them differently from how they sit today).

### Combined import on Profile
After both migrations:
```tsx
import { PillBtn, SectionHeader } from "@/app/components/ui";
```

---

## What does NOT change in this phase
- No other component is extracted (`SectionSubtitle`, `EmptyRow`, `List`, `Slider`, `ShowMoreButton`, `SearchBar`, `PendingDropdown` stay inline in Friends).
- No styling values change. The two `SectionHeader` size variants reproduce exactly what Friends and Phase-2 Profile already render.
- No file outside `app/profile/profile-page.tsx`, `app/friends/friends-page.tsx`, and the new `app/components/ui.tsx` is touched.
- No `app/profile/page.tsx` (server component) changes.
- No CSS / theme / schema changes.
- No accordion cleanup, no family-editor row restyle, no sticky-bg color change — those are later phases.

---

## Verification checklist (run before declaring done)

- [ ] `app/components/ui.tsx` exists, exports `PillBtn` and `SectionHeader` as named exports, contains the comment about extracting more from Friends as needed.
- [ ] Friends: local `PillBtn` and `SectionHeader` definitions are gone. Import from `@/app/components/ui` is present.
- [ ] Friends visually unchanged — pill toggle still works, all five section headers still render with the same 11px small-caps style.
- [ ] Profile: local `PillBtn` definition (added in Phase 1) is gone. Import from `@/app/components/ui` is present.
- [ ] Profile pill (`You · Family · Account`) still works. State preservation across pill switches still works (Phase 1 behavior).
- [ ] Profile's five Phase-2 section headers render at 14px small-caps. Inline action buttons ("+ Add", "+ New Family", "+ Bin") still align correctly with the headers (no vertical drift from a stray default margin).
- [ ] Profile's four Packing Preferences sub-group labels (`Packing Style`, `How You Pack`, `How Much You Plan`, `Shortcuts`) render at 11px small-caps with `#999`. Spacing inside the accordion looks identical to Phase 2.
- [ ] Every existing handler still works end-to-end on both pages — no callsite was missed.
- [ ] `npm run build` passes with no new TypeScript errors and no new ESLint warnings about unused imports (the inline definitions you deleted should not leave behind orphaned imports of `React.ReactNode` etc.).
- [ ] Diff is clean — only three files changed.

---

## When done

Push straight to `main` (solo hobby project — no PR). Commit message:

```
ui: extract PillBtn + SectionHeader to app/components/ui.tsx

Phase 3 of profile consistency pass. Lifts the two helpers with current
second consumers out of Friends into a shared module:

- PillBtn: byte-for-byte the version Friends uses; Profile now imports
  it instead of redefining inline (added in Phase 1)
- SectionHeader: same 11px Friends default, plus a size="md" variant
  (14px) for Dashboard-style page-level dividers used by Profile after
  Phase 2

Profile's five Phase-2 <h3>s and four packing-prefs sub-group labels
now flow through SectionHeader. Friends visually unchanged.

Other Friends-only helpers (SectionSubtitle, EmptyRow, List, Slider,
ShowMoreButton, SearchBar, PendingDropdown) stay inline — extract them
when a second consumer appears.
```

I (Claude) cannot run git from the sandbox — run the commit + push locally.
