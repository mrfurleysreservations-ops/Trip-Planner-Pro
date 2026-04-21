# Build: Profile Page — Pill Toggle + Section Redistribution (Phase 1 of Profile Consistency Pass)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` and `docs/tab-layout-standard.md` before writing any code. This phase modifies `app/profile/profile-page.tsx` only — the server component (`app/profile/page.tsx`) does not change.

---

## What this phase builds (and ONLY this)

Add a 3-option pill toggle to the sticky top region of the Profile page — `You · Family · Account` — and redistribute the existing sections into those three views. Nothing else changes in this phase: no section headers get restyled, no accordions are removed, no avatars move into the header, no helper extraction. We are ONLY adding the pill and routing existing content under it.

Doing the pill first lets every later phase (section-header restyle, chevron-accordion cleanup, helper extraction, hero-card shrink) be applied to one pill view at a time without wrestling a 900-line file.

---

## Finalized design decisions — do NOT re-ask

### The pill
- Three options in this order: **You**, **Family**, **Account**.
- Default view on mount: `You`.
- View state lives in local React state (`useState<"you" | "family" | "account">("you")`) — do NOT persist to URL, localStorage, or the database in this phase.
- Selected view does NOT deep-link (you can't link someone to `/profile?view=family`). That's fine for v1.
- The pill uses the **canonical pill** from `docs/tab-layout-standard.md` — same container + `PillBtn` as Friends and the trip tabs. Do not invent a variant.

### Sticky top region
Follow the same shape as Friends and Dashboard — one sticky container, three rows:
- **Row 1** — `Profile` title (existing `<h1>`, unchanged styling).
- **Row 2** — `TopNav` (existing, unchanged).
- **Row 3** — the new 3-option pill (NEW in this phase).

The sticky container keeps `position: sticky; top: 0; zIndex: 20` and its current background. Do NOT change the sticky bg color in this phase (that's a later phase).

### What goes under each pill

This is the required redistribution. DO NOT drop a single feature, button, handler, or state variable — every existing piece of functionality must still be reachable. If something doesn't obviously fit, ASK before dropping it.

**You** (the default view)
- Profile card (avatar + name + email + Edit button, and the inline Edit mode with `AvatarPicker`, Display Name input, Cancel / Save)
- Packing Preferences accordion (entire block, including empty state, style picker, Fine-tune disclosure, Shortcuts, setupMode)

**Family**
- Family Members section (the `MemberSlider` + `MemberDetailCard`, plus the "No members yet" empty state)
- Your Families section (the "+ New Family" header row, the empty state, the list of family rows)
- The family editor sub-view (`editFam` branch — Family Name input, Members editor, Car Snack Prefs, Inventory Bins). When `editId` is set the Family pill should render the editor sub-view INSTEAD of the slider/list, exactly as it does today. Leaving the editor (`setEditId(null)`) returns to slider + list, still on the Family pill.

**Account**
- Change Password accordion (entire block, including error/success states)
- Sign Out row
- Delete Account accordion (entire block, including the warning card, password + DELETE confirmations, error state, and the full delete handler)

### Cross-view behavior

- Switching pills does NOT reset any state. If a user opens the Packing Preferences accordion on **You**, switches to **Family**, and comes back, the accordion should still be open. (This is the free default — just don't conditionally mount/unmount the section contents; render all three views and toggle visibility with `display: none` OR conditionally render — pick the option that preserves existing state. Conditional render is fine here because the state lives in `ProfilePage`'s top-level `useState`s, not inside the sections.)
- The existing `selectedMemberId` / `editId` / `editingProfile` / `showChangePassword` / `packingExpanded` / `showDeleteAccount` / all other state stays exactly where it is — at the top of `ProfilePage`. Do NOT split state by view.

### What does NOT change in this phase
- No section-header restyling (`🏠 Your Families` etc. stay as-is).
- No avatar moved into the sticky header — the hero Profile card keeps its current layout.
- No accordion replaced with inline content.
- No helper extraction into a shared `components/ui.tsx`.
- No sticky background color change.
- No changes to `app/profile/page.tsx` (server component).
- No changes to any other page, component, CSS, or schema.

If you find yourself tempted to "clean up while you're in there" — stop. Each follow-up phase has its own prompt.

---

## Implementation notes

### Pill component
Define `PillBtn` **inline** in `profile-page.tsx` for this phase, matching the style used in `app/friends/friends-page.tsx` and `docs/tab-layout-standard.md`. We'll extract it to a shared helper in a later phase — do NOT do that now.

```tsx
function PillBtn({ label, active, onClick, accent, muted }: {
  label: string; active: boolean; onClick: () => void; accent: string; muted: string;
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

### Sticky Row 3 markup

Drop this between the existing `TopNav` and the closing tag of the sticky container:

```tsx
{/* Row 3 — View pill */}
<div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
  <div
    style={{
      display: "inline-flex",
      background: th.card,
      border: `1.5px solid ${th.cardBorder}`,
      borderRadius: 20,
    }}
  >
    <PillBtn label="You" active={view === "you"} onClick={() => setView("you")} accent={th.accent} muted={th.muted} />
    <PillBtn label="Family" active={view === "family"} onClick={() => setView("family")} accent={th.accent} muted={th.muted} />
    <PillBtn label="Account" active={view === "account"} onClick={() => setView("account")} accent={th.accent} muted={th.muted} />
  </div>
</div>
```

Note the horizontal padding is `0` on this row (not `16px`) because the parent `<div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>` already supplies it. Match what Friends does.

### Body redistribution
Inside the existing scrollable body container (`<div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>`), replace the flat sequence of sections with three conditionally rendered branches:

```tsx
{view === "you" && (
  <>
    {/* Existing: Profile card */}
    {/* Existing: Packing Preferences accordion */}
  </>
)}

{view === "family" && (
  <>
    {/* Existing: !editFam branch (Family Members slider + Your Families list) */}
    {/* Existing: editFam branch (family editor sub-view) */}
    {/* The existing `!editFam ? (...) : (...)` ternary stays exactly as it is — just live inside the "family" view. */}
  </>
)}

{view === "account" && (
  <>
    {/* Existing: Change Password accordion */}
    {/* Existing: Sign Out card */}
    {/* Existing: Delete Account accordion */}
  </>
)}
```

Keep the existing JSX for each section byte-for-byte. You are moving blocks, not rewriting them.

### Margin / spacing
The first section under each pill currently has `marginBottom: "24px"` from its own styling. That's fine — do not add extra wrapper margins. The body container already has `padding: "16px"` all around.

---

## Verification checklist (run before declaring done)

- [ ] On page load, the **You** pill is active and shows the Profile card + Packing Preferences accordion.
- [ ] Clicking **Family** hides You content and shows the Family Members slider + Your Families list. Clicking a family row still opens the editor sub-view inside the Family pill.
- [ ] Clicking **Account** shows Change Password + Sign Out + Delete Account.
- [ ] Every existing button, input, and flow works end-to-end exactly as before:
  - Edit profile → Save (You)
  - AvatarPicker upload (You, and inside MemberDetailCard on Family)
  - Packing style change cascades defaults (You)
  - Add / delete family, add / delete member, edit member, inventory bin CRUD (Family)
  - Change password happy path + wrong-current-password error (Account)
  - Sign Out redirects to `/auth/login` (Account)
  - Delete Account happy path + wrong-password error (Account)
- [ ] Switching pills preserves in-progress state: open the Packing Preferences accordion on **You**, switch to **Family**, switch back to **You** — the accordion is still open. Same test for Change Password on **Account**.
- [ ] TopNav badges (`unreadChatCount`, `pendingFriendCount`, `unreadAlertCount`) still render and are unchanged.
- [ ] `app/profile/page.tsx` (server component) is untouched.
- [ ] No other file is touched.
- [ ] `npm run build` passes with no new TypeScript errors.

---

## When done

Push straight to `main` (solo hobby project — no PR). Commit message:

```
profile: add You/Family/Account pill + redistribute sections

Phase 1 of profile consistency pass. Splits the flat scrolling profile
page into three pill views matching the pattern used on Friends and all
trip tabs. No visual restyling or feature changes — this is purely the
pill + a re-parent of existing JSX. Follow-up phases will restyle
section headers, collapse chevron accordions, shrink the hero card, and
extract shared PillBtn/SectionHeader helpers.
```

I (Claude) cannot run git from the sandbox — run the commit + push locally.
