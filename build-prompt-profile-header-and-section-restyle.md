# Build: Profile Page — Header Avatar + Section Header Restyle + Compact Hero Card (Phase 2 of Profile Consistency Pass)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` and `docs/tab-layout-standard.md` before writing any code. Phase 1 (`build-prompt-profile-pill-redistribute.md`) must be merged first — this phase assumes the `You · Family · Account` pill exists and sections already live under it.

This phase modifies `app/profile/profile-page.tsx` only. Server component (`app/profile/page.tsx`) does not change.

---

## What this phase builds (and ONLY this)

Three coordinated visual changes that make the Profile page look like the rest of the app:

1. **User avatar in the sticky Row 1** — left of the "Profile" title, mirroring Dashboard's pattern exactly.
2. **Compact hero card in view mode** — drop the 80px avatar from the hero card's *view mode* (the avatar now lives in the header). Edit mode is unchanged — the large `AvatarPicker` still appears there because that's where users change their avatar.
3. **Section-header restyle** — convert every `<h3>` on the Profile page from the old emoji + Outfit 17px / 800 style to the canonical small-caps section header used across Dashboard and Friends.

Nothing else changes. No accordion cleanup. No helper extraction. No sticky-bg color change. No family-editor row restyle. No other file touched.

---

## Finalized design decisions — do NOT re-ask

### Header avatar (Row 1 of the sticky region)

Place a 36×36 circular avatar to the left of the "Profile" title. Mirror Dashboard's approach (`app/dashboard/dashboard.tsx` lines ~178–204) byte-for-byte, with these differences:

- Avatar source: the existing `displayAvatar` state (not `profile?.avatar_url`) so it live-updates when the user uploads a new one from the hero card's edit mode.
- Initials fallback source: `displayName` state, falling back to `userEmail`.
- **No click handler, `cursor: default`.** We're already on Profile; clicking the header avatar should do nothing. (Dashboard's avatar navigates to `/profile`, which is the opposite of what we want here.)

Exact markup — drop this inside the existing Row 1 container, before the `<h1>Profile</h1>`:

```tsx
{displayAvatar ? (
  <img
    src={displayAvatar}
    alt={displayName || "You"}
    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
  />
) : (
  <div
    style={{
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
      color: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: 14,
    }}
  >
    {(displayName || userEmail || "?").charAt(0).toUpperCase()}
  </div>
)}
```

Update Row 1's container so it becomes a flex row with `gap: 10` (match Dashboard):

```tsx
<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
  {/* avatar block above */}
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
    }}
  >
    Profile
  </h1>
</div>
```

The `<h1>` keeps its existing font styling. Only the container becomes flex + the `marginLeft: 4` + `flex: 1` are new.

### Hero card — view mode only

In the **view mode branch** of the profile card (the `<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>` block inside the `!editingProfile` branch), remove the `<AvatarPicker>` entirely. Keep the name, email, and Edit button. Re-tune the spacing so it doesn't look like a half-empty card:

```tsx
// Replace the existing view-mode content of the hero card with:
<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px" }}>
      {displayName || "No name set"}
    </div>
    <div style={{ fontSize: "14px", color: "#777", marginTop: "4px" }}>{userEmail}</div>
  </div>
  <button onClick={() => setEditingProfile(true)} className="btn btn-sm" style={{ background: th.accent }}>
    Edit
  </button>
</div>
```

Also drop the outer card padding from `24px` to `20px` so the card feels appropriately sized for its new, lighter content:

```tsx
<div className="card-glass" style={{ padding: "20px", marginBottom: "24px" }}>
```

**Edit mode is unchanged.** The `editingProfile === true` branch still renders the full layout with the 80px `AvatarPicker`, Display Name input, and Cancel / Save buttons. That is the one place a user changes their avatar, so the affordance must remain prominent there.

### Section header restyle

Every existing `<h3>` on the Profile page currently uses:
```
fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700 or 800
```
with emoji prefix.

Convert **each one** to the canonical small-caps section header (matches Dashboard's "UPCOMING" / "PAST TRIPS"):

```tsx
<h3 style={{
  fontSize: "14px",
  fontWeight: 700,
  color: "#999",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,                    // ← adjust per layout (see table below)
  fontFamily: "'DM Sans', sans-serif",
}}>
  FAMILY MEMBERS
</h3>
```

Write the label text in plain sentence case in the source (`Family Members`) — `text-transform: uppercase` handles the visual caps. Do NOT hard-code uppercase letters in the JSX.

**Emoji: drop them from every section header.** The small-caps style doesn't pair well with emoji, and no other top-level page uses emoji in section headers. This is a deliberate design call — do not try to preserve them.

Every header to convert (and the label text to use):

| Current (in source) | New label |
|---|---|
| `👨‍👩‍👧‍👦 Family Members` (Family pill, slider section) | `Family Members` |
| `🏠 Your Families` (Family pill, families list section) | `Your Families` |
| `👨‍👩‍👧‍👦 Members` (inside family editor sub-view) | `Members` |
| `🚗 Car Snack Preferences` (inside family editor) | `Car Snack Preferences` |
| `📦 Inventory Bins` (inside family editor) | `Inventory Bins` |

Preserve the existing **flex row wrappers** those `<h3>`s sit in (the ones with "+ Add" / "+ New Family" / "+ Bin" buttons on the right) — only swap the `<h3>` itself. The row-level layout does not change in this phase.

### Packing-preferences sub-group labels

Inside the Packing Preferences accordion there are already small-caps labels for `Packing Style`, `How You Pack`, `How Much You Plan`, `Shortcuts`. They currently use `color: th.accent`. Change only the color to `#999` so they match the canonical section header style:

```tsx
// Before
<div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: th.accent, marginBottom: "10px" }}>

// After
<div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "10px" }}>
```

Do not change anything else about those labels (keep 11px, keep the 0.05em letter-spacing variation — that's consistent with Friends' nested labels which also use 11px). There are four of these; update all four.

### What does NOT change in this phase
- The pill from Phase 1 (do not touch).
- `TopNav` (unchanged).
- Accordion rows (Change Password, Packing Preferences, Delete Account) keep their chevron + expand behavior.
- Sign Out card markup (unchanged).
- Family editor row styling (old dense edit row) — phase 4.
- The back button from the editor (`← All Profiles`) — phase 4.
- Sticky container background color — phase 5.
- No helper extraction — phase 3.
- `app/profile/page.tsx` server component (untouched).
- Every other file in the repo (untouched).

If you find yourself tempted to clean up an adjacent thing — stop. It has its own phase.

---

## Verification checklist (run before declaring done)

- [ ] Sticky Row 1 shows the user's avatar (36×36, circular) to the left of the "Profile" title. Initial fallback renders correctly when `displayAvatar` is `null`.
- [ ] The header avatar has `cursor: default` and does nothing on click.
- [ ] Upload a new avatar from the hero card's edit mode → the sticky header avatar updates live (same `displayAvatar` source).
- [ ] Hero card view mode shows: name + email + Edit button, and **no** avatar on the left.
- [ ] Hero card edit mode is visually identical to before this change (80px AvatarPicker + name input + Cancel / Save).
- [ ] All five `<h3>`s on the Profile page have been converted to small-caps (14px, #999, uppercase, 0.06em tracking, DM Sans). No emoji prefixes.
- [ ] The inline "+ Add" / "+ New Family" / "+ Bin" buttons still sit on the right of each header row, unchanged.
- [ ] The four Packing Preferences sub-group labels (`Packing Style`, `How You Pack`, `How Much You Plan`, `Shortcuts`) use `color: #999` — no orange text inside the Packing Preferences accordion.
- [ ] The pill still defaults to `You`, switches correctly, and preserves state across pill switches. No Phase 1 behavior broken.
- [ ] Every existing action still works end-to-end: edit profile, avatar upload, packing style change, add/delete family, member CRUD, bin CRUD, change password, sign out, delete account.
- [ ] `npm run build` passes with no new TypeScript errors.
- [ ] Visual sanity check: open Dashboard and Profile side-by-side — the sticky Row 1 (avatar + title) looks identical in structure/size on both pages.

---

## When done

Push straight to `main` (solo hobby project — no PR). Commit message:

```
profile: header avatar + section-header restyle + compact hero card

Phase 2 of profile consistency pass. Brings the Profile page's visual
chrome in line with Dashboard/Friends:

- adds a 36px user avatar to the sticky Row 1 next to the title
  (mirrors Dashboard), fed from displayAvatar state so it live-updates
  on upload
- drops the redundant 80px avatar from the hero card's view mode (edit
  mode keeps the AvatarPicker since that's where users change it)
- converts all <h3> section headers from emoji + Outfit/17px to the
  canonical small-caps style (14px, #999, uppercase, 0.06em tracking)
- normalizes the Packing Preferences sub-group labels from accent to
  #999 to match

No feature changes. Accordion rows, back button, and family-editor row
styling are intentionally unchanged — those are later phases.
```

I (Claude) cannot run git from the sandbox — run the commit + push locally.
