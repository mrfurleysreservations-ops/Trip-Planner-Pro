# Build Prompt — Notes sticky layout + Group/Personal scope

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Two changes to the Notes tab, in one pass:

**A. Feature addition — Group/Personal scope.** Every note is either a Group note (visible to all trip members) or a Personal note (visible only to its creator). The user toggles between the two views with a primary pill at the top of the page. Inside the add/edit modal there's a scope chooser so each note's scope is set when created.

**B. UI-shell refactor — apply the Trip Tab Layout Standard** (see `docs/tab-layout-standard.md`). Sticky header + pill + chip row; "+" becomes a FAB; back button becomes a 40x40 circular accent-tinted button.

Everything else — note cards, status badges, convert-to-event flow, import/export CSV/XLSX, deep-link `?note=<id>` support, markdown rendering, edit/delete permissions, trip activity logging — stays exactly as it is today.

## Files in scope

- `types/database.types.ts` — add `scope` to the `trip_notes` Row/Insert types.
- `app/trip/[id]/notes/page.tsx` — no code change needed unless the select statement needs updating (it shouldn't since `*` is used).
- `app/trip/[id]/notes/notes-page.tsx` — the main work.
- Supabase SQL Editor — run the SQL in section 1 below.

Do NOT touch `lib/constants.ts`, modals outside the notes page, or any other tab.

## 1. Supabase SQL (run in order, copy-paste exactly)

### Part A — add the scope column (safe to run anytime)

```sql
ALTER TABLE trip_notes
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'group'
  CHECK (scope IN ('group', 'personal'));

CREATE INDEX IF NOT EXISTS idx_trip_notes_scope ON trip_notes(scope);
```

### Part B — find the existing SELECT policy on trip_notes

```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'trip_notes' AND cmd = 'SELECT';
```

Copy the exact policy name that comes back (there should be one).

### Part C — replace the SELECT policy so personal notes are only visible to their creator

Replace `<EXISTING_POLICY_NAME>` below with the value from Part B, then run:

```sql
DROP POLICY "<EXISTING_POLICY_NAME>" ON trip_notes;

CREATE POLICY "trip_members_view_group_or_own_notes" ON trip_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_notes.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    )
    AND (
      scope = 'group'
      OR created_by = auth.uid()
    )
  );
```

This keeps the existing "you must be a trip member" gate and adds: personal notes are filtered out unless you created them.

Do NOT change the INSERT / UPDATE / DELETE policies — they already gate on `created_by` / trip membership and don't need to know about scope.

## 2. Type update

In `types/database.types.ts`, add `scope: "group" | "personal"` to the `trip_notes` Row type and `scope?: "group" | "personal"` to the Insert type. Do not restructure the file — only add the two lines in the correct places.

## 3. Client component changes (`notes-page.tsx`)

### 3a. New state

Add a scope filter state alongside the existing `filter` state:

```ts
const [scopeFilter, setScopeFilter] = useState<"group" | "personal">("group");
```

Add a scope field to the add/edit form state:

```ts
const [addScope, setAddScope] = useState<"group" | "personal">("group");
const [editScope, setEditScope] = useState<"group" | "personal">("group");
```

### 3b. Filter notes by scope

Update `filteredNotes` (or wherever the list is filtered) to first filter by `scopeFilter`, then by the existing status filter:

```ts
const filteredNotes = notes
  .filter((n) => n.scope === scopeFilter)
  .filter((n) => {
    if (filter === "all") return true;
    return n.status === filter;
  });
```

Keep the status count labels ("All (N)", "Ideas (N)", "Finalized (N)") but make them count within the current scope — i.e., apply the scope filter first, then count.

### 3c. Save handlers include scope

In the add-note save handler, include `scope: addScope` in the insert payload. In the edit save handler, include `scope: editScope` in the update payload. When opening the edit modal for an existing note, pre-fill `editScope` from `note.scope`.

### 3d. Sticky top region — build the new shell

Replace the current top region (header + filter tabs + Import button row) with a single sticky container containing:

**Row 1 — page header** (back button + title + Import action in the header actions):

```tsx
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
  <h2
    style={{
      flex: 1,
      margin: "0 0 0 10px",
      fontFamily: "'Outfit', sans-serif",
      fontWeight: 800,
      fontSize: 20,
      color: th.text,
    }}
  >
    Notes
  </h2>
  <button
    onClick={() => { resetImport(); setShowImportModal(true); }}
    style={{
      padding: "8px 14px",
      borderRadius: 10,
      border: `1.5px solid ${th.accent}`,
      background: "none",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 700,
      color: th.accent,
      fontFamily: "'DM Sans', sans-serif",
      whiteSpace: "nowrap",
    }}
  >
    Import
  </button>
</div>
```

**Row 2 — Group/Personal pill** (canonical pill style from the standard doc):

```tsx
<div style={{ display: "flex", justifyContent: "center", padding: "6px 16px 8px" }}>
  <div
    style={{
      display: "inline-flex",
      background: th.card,
      border: `1.5px solid ${th.cardBorder}`,
      borderRadius: 20,
    }}
  >
    {(["group", "personal"] as const).map((s) => (
      <button
        key={s}
        onClick={() => setScopeFilter(s)}
        style={{
          background: scopeFilter === s ? th.accent : "transparent",
          border: "none",
          padding: "8px 18px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: scopeFilter === s ? 700 : 500,
          color: scopeFilter === s ? "#fff" : th.muted,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {s === "group" ? "Group" : "Personal"}
      </button>
    ))}
  </div>
</div>
```

**Row 3 — All / Ideas / Finalized chip row** — use the existing markup from the current code (lines ~515–520 in `notes-page.tsx` with `filterTabStyle`). Move it into this row unchanged. Keep the count labels updating based on scope-filtered notes.

Wrap all three rows in the sticky container:

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
  {/* Row 1, Row 2, Row 3 */}
</div>
```

### 3e. Scope chooser in add modal

At the top of the add-note modal body, add a scope chooser before the Title field. Use side-by-side buttons (not a pill — this is a form field, bigger tap targets):

```tsx
<label style={{ display: "block", fontSize: 11, fontWeight: 700, color: th.muted, margin: "4px 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
  Scope
</label>
<div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
  {(["group", "personal"] as const).map((s) => (
    <button
      key={s}
      type="button"
      onClick={() => setAddScope(s)}
      style={{
        flex: 1,
        padding: 12,
        border: `2px solid ${addScope === s ? th.accent : th.cardBorder}`,
        background: addScope === s ? `${th.accent}0d` : "#fff",
        borderRadius: 12,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        color: addScope === s ? th.accent : th.muted,
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 22 }}>{s === "group" ? "👥" : "🔒"}</span>
      <span>{s === "group" ? "Group" : "Personal"}</span>
      <span style={{ fontSize: 10, color: th.muted, fontWeight: 500 }}>
        {s === "group" ? "Everyone sees it" : "Only you see it"}
      </span>
    </button>
  ))}
</div>
```

Default the scope chooser to match whatever the user has selected via the sticky pill at the time the modal opens — so if they're currently viewing Personal and tap "+", the modal pre-selects Personal. (Set `setAddScope(scopeFilter)` when opening the add modal.)

### 3f. Same scope chooser in the edit form inside the detail modal

In the inline edit form that's already inside the note-detail modal, add the identical scope chooser (wired to `editScope`) before the title input. When entering edit mode on a note, initialize `editScope` from the note's scope.

### 3g. Scope badge on note cards

On each note card, add a small badge indicating scope, in the same row as the existing status badge:

```tsx
<span
  style={{
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: note.scope === "personal" ? "rgba(156,39,176,0.15)" : `${th.accent}26`,
    color: note.scope === "personal" ? "#7b1fa2" : th.accent,
  }}
>
  {note.scope === "personal" ? "Personal" : "Group"}
</span>
```

Purple for Personal to distinguish it from accent-colored Group badges at a glance.

### 3h. FAB — replace the bottom-center "+" CTA

Remove the existing `{!showAddModal && !selectedNoteId && !showImportModal && ( ... )}` fixed bottom-center "+ Add Note" gradient button (lines ~602–640).

Add a FAB at the root level of the returned JSX:

```tsx
{!showAddModal && !selectedNoteId && !showImportModal && (
  <button
    onClick={() => {
      setAddScope(scopeFilter); // pre-select scope to match current view
      resetAddForm?.();          // if such a helper exists; otherwise clear add fields
      setShowAddModal(true);
    }}
    aria-label="Add note"
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

### 3i. Empty state text

When `filteredNotes.length === 0`, update the empty state to mention the current scope so the user understands why they see nothing:

- If `scopeFilter === "personal"` and there are no personal notes: show "No personal notes yet. These are only visible to you."
- Otherwise keep the existing empty-state copy.

## Hard do-not-touch list

- Note card layout below the sticky container — body content does not change visually beyond adding the scope badge.
- Status filter logic (`"all" | "idea" | "finalized"`), its count labels, or its styling.
- Convert-to-itinerary-event flow and the date/time picker inside the note detail modal.
- CSV / XLSX import flow (all three steps), export flow.
- Deep link `?note=<id>` handling.
- Edit/delete permissions logic (`isHost || created_by === userId`).
- `logActivity` calls — but DO add activity logs for scope changes if edit updates it. Mirror the existing pattern.
- TripSubNav positioning.

## Verification checklist

After your change, confirm by reading the file + testing:

- [ ] SQL Part A ran — `trip_notes` has a `scope` column with default `'group'`.
- [ ] SQL Part C ran — the SELECT policy now includes the `scope = 'group' OR created_by = auth.uid()` clause.
- [ ] `TripNote` and `TripNoteInsert` types include `scope`.
- [ ] The sticky container wraps header + Group/Personal pill + All/Ideas/Finalized chips — nothing else.
- [ ] Group/Personal pill uses the canonical style (inline-flex, `th.card` bg, 1.5px `th.cardBorder`, 20 radius; active = `th.accent` + white + 700 weight).
- [ ] Switching the pill filters the notes list.
- [ ] All/Ideas/Finalized counts reflect the currently-selected scope.
- [ ] Back button is 40x40 circular accent-tinted, calls `router.push(\`/trip/${trip.id}\`)`.
- [ ] Import button is in the header actions.
- [ ] FAB exists at `bottom: 72; right: 16` with the scope-preselecting onClick.
- [ ] Add modal has the scope chooser at the top of the form, two cards (Group / Personal), defaulting to the currently-viewed scope.
- [ ] Edit form has the same scope chooser, pre-filled from the note's scope.
- [ ] Note cards show a Group or Personal badge next to the status badge.
- [ ] Creating a Personal note then logging in as a different trip member (if possible to test) confirms it's not visible.
- [ ] Creating a Group note confirms it's visible to all members.

## Ship it

Run `npm run build` locally first. If build passes, push straight to `main` — solo project, no branch or PR needed.

If the build fails on the type update, double-check `types/database.types.ts` edits and re-run.
