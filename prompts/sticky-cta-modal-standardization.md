# Sticky CTA + Bottom-Sheet Modal Standardization (All Sub-Pages)

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Overview
Standardize the "add" experience across all trip sub-pages. Every sub-page gets:
1. A **sticky CTA button** pinned above the bottom nav
2. A **bottom-sheet modal** for the add form (not inline forms)

The Expenses page already has both patterns working correctly — it is the reference implementation. The other 3 pages (Trip Hub, Notes, Itinerary) need to be brought in line.

**Files to modify (4):**
- `app/trip/[id]/trip-page.tsx`
- `app/trip/[id]/notes/notes-page.tsx`
- `app/trip/[id]/itinerary/itinerary-page.tsx`
- `app/trip/[id]/expenses/expenses-page.tsx` (minor — add sticky CTA only)

**No new files. No new dependencies. No SQL.**

---

## Reference: The Two Patterns

### Pattern A — Sticky CTA (already exists in Packing)
```tsx
{/* Sticky gradient CTA */}
<div style={{
  position: "fixed",
  bottom: "56px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "100%",
  maxWidth: "480px",
  zIndex: 101,
  padding: "0 16px 12px",
  boxSizing: "border-box" as const,
  background: `linear-gradient(to top, ${th.bg} 70%, transparent)`,
  pointerEvents: "none" as const
}}>
  <button onClick={openAddModal} style={{
    pointerEvents: "auto" as const,
    width: "100%",
    padding: "16px 24px",
    fontSize: "16px",
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    color: "#fff",
    background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`,
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "52px"
  }}>
    + Add [Thing]
  </button>
</div>
```

Place this just before the closing `</div>` of the main page container (but after all scrollable content). Every page needs a `<div style={{ height: "80px" }} />` spacer above it so content doesn't get hidden behind the CTA.

### Pattern B — Bottom-Sheet Modal (already exists in Expenses)
```tsx
{showAddModal && (
  <div onClick={() => setShowAddModal(false)} style={{
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    animation: "fadeIn 0.15s ease-out"
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      width: "100%", maxWidth: "480px",
      maxHeight: "90vh", overflowY: "auto" as const,
      borderRadius: "20px 20px 0 0",
      boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      background: th.card || "#fff",
      animation: "slideUp 0.2s ease-out"
    }}>
      {/* Sticky modal header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 1,
        padding: "18px 20px 14px",
        borderBottom: `1px solid ${th.cardBorder}`,
        background: th.card || "#fff",
        borderRadius: "20px 20px 0 0",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", margin: 0 }}>
          Add [Thing]
        </h3>
        <button onClick={() => setShowAddModal(false)} style={{
          background: "none", border: "none", fontSize: "22px",
          cursor: "pointer", color: th.muted, padding: "4px"
        }}>✕</button>
      </div>

      {/* Form body */}
      <div style={{ padding: "16px 20px 24px" }}>
        {/* Form fields go here */}
      </div>

      {/* Sticky save button at bottom of modal */}
      <div style={{
        position: "sticky", bottom: 0,
        padding: "12px 20px 20px",
        background: th.card || "#fff",
        borderTop: `1px solid ${th.cardBorder}`
      }}>
        <button onClick={handleSave} style={{
          width: "100%", padding: "14px",
          background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`,
          color: "#fff", border: "none", borderRadius: "12px",
          fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif",
          cursor: "pointer"
        }}>
          Save [Thing]
        </button>
      </div>
    </div>
  </div>
)}
```

Every page that uses a modal MUST include these keyframe animations (add to a `<style>` tag if not already present):
```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

---

## Change 1 — Expenses Page (minor)

**File:** `app/trip/[id]/expenses/expenses-page.tsx`

The bottom-sheet modal already exists and works perfectly (~lines 845–1214). The only change is adding a sticky CTA so users don't have to scroll up to find the add button.

### 1a: Add sticky "＋ Add Expense" CTA

Find the empty-state "+ Add Your First Expense" button (~line 723) — leave it as-is for the empty state.

Add a sticky CTA using Pattern A at the bottom of the main page container (just before the modal JSX and closing `</div>`). The button text should be `+ Add Expense` and its `onClick` should call the existing `openAddModal` function.

Also add a `<div style={{ height: "80px" }} />` spacer above it (after the last scrollable content, before the sticky CTA) so the bottom of the expense list isn't hidden.

**Do NOT touch the existing modal, form, or any other logic.** Only add the sticky CTA + spacer.

### 1b: Hide the inline "+ Add Expense" button in the filter bar

The inline "+ Add Expense" button in the filter/action bar (~line 537) should be removed or hidden now that the sticky CTA provides the same action. Keep the filter/sort controls — just remove the add button from that row.

---

## Change 2 — Trip Hub (Add Booking)

**File:** `app/trip/[id]/trip-page.tsx`

Currently: The "+ Add" button (~line 748) opens an inline form via `setShowBookingForm(true)`. The form renders inline in the page (~lines 757–769). There is no modal.

### 2a: Add state for modal

Add a new state variable:
```tsx
const [showAddBookingModal, setShowAddBookingModal] = useState(false);
```

### 2b: Convert inline form to bottom-sheet modal

Take the existing `AddBookingFormHub` component call (~line 757–769) and move it inside a bottom-sheet modal using Pattern B. The modal header should say "Add Booking". The form fields stay exactly the same — just wrap them in the modal container.

The `onSave` callback should close the modal (`setShowAddBookingModal(false)`) after saving.
The `onCancel` callback should close the modal.

Remove the old inline rendering of `AddBookingFormHub` from the main page flow.

### 2c: Do the same for EditBookingFormHub

The edit form (~lines 771–789) should also open in a bottom-sheet modal instead of rendering inline. Add state:
```tsx
const [showEditBookingModal, setShowEditBookingModal] = useState(false);
```

When a booking card's edit button is clicked, set `editingBookingId` AND `setShowEditBookingModal(true)`. The modal header should say "Edit Booking". The `onSave` and `onCancel` callbacks close the modal and clear `editingBookingId`.

### 2d: Add sticky "＋ Add Booking" CTA

Add a sticky CTA using Pattern A. Button text: `+ Add Booking`. onClick: `() => setShowAddBookingModal(true)`.

This sticky CTA should appear in the **main trip hub view** (not the setup view). The setup view already has its own sticky "Save & Continue" CTA (~lines 1056–1094) — leave that alone.

Add a spacer `<div style={{ height: "80px" }} />` before the sticky CTA.

### 2e: Remove the inline "+ Add" button

Remove the small "+ Add" button in the "Travel & Lodging" section header (~line 748). The sticky CTA replaces it.

### 2f: Add keyframe animations

Add a `<style>` tag with `fadeIn` and `slideUp` keyframes if not already present in this file.

---

## Change 3 — Notes Page (Add Note)

**File:** `app/trip/[id]/notes/notes-page.tsx`

Currently: The "+ Add Note" button (~line 539) opens an inline form via `setShowAddForm(true)`. The form renders inline (~lines 545–559) with title, body, and link inputs. There is no modal for adding.

### 3a: Convert inline add form to bottom-sheet modal

Replace the inline add form with a bottom-sheet modal using Pattern B. Reuse the existing state variables (`showAddForm`, `addTitle`, `addBody`, `addLink`) — just rename `showAddForm` to `showAddModal` for consistency (update all references).

Modal header: "Add Note"

Form body should contain the same 3 fields that currently exist:
- Title input (required)
- Body/description textarea
- Link input

The save button in the modal should call the same save handler that the inline form currently uses. On save success, close the modal and reset the fields.

### 3b: Add sticky "＋ Add Note" CTA

Add a sticky CTA using Pattern A at the bottom of the page. Button text: `+ Add Note`. onClick: open the add modal.

Add a `<div style={{ height: "80px" }} />` spacer.

### 3c: Remove the inline "+ Add Note" button

Remove the "+ Add Note" button from the action bar (~line 539). The sticky CTA replaces it. Keep the Import button and any filter/sort controls.

### 3d: Add keyframe animations

The notes page already has a `<style>` tag with keyframes for the detail modal and import modal. Verify `fadeIn` and `slideUp` are defined — if not, add them.

---

## Change 4 — Itinerary Page (Add Event) ⚠️ Most Complex

**File:** `app/trip/[id]/itinerary/itinerary-page.tsx`

Currently: To add an event, users tap a specific time slot within a specific day. The form renders inline inside that slot via `addFormSlot` state (~line 122). There's no sticky CTA button. The interaction pattern is not discoverable.

### 4a: Add modal state

Add new state:
```tsx
const [showAddEventModal, setShowAddEventModal] = useState(false);
const [addDate, setAddDate] = useState<string>("");
const [addTimeSlot, setAddTimeSlot] = useState<string>("morning");
```

### 4b: Build the bottom-sheet modal

Create a bottom-sheet modal using Pattern B. Modal header: "Add Event".

The modal form should contain these fields **in this order**:

1. **Day selector** — horizontal scrollable pills showing each trip day. Use `tripDays` (already computed ~line 218). Each pill shows `formatDate(day)`. Default to the first day or the day the user was viewing. Selecting a pill sets `addDate`.

2. **Time slot selector** — horizontal pills: Morning, Afternoon, Evening. Default to "morning". Selecting a pill sets `addTimeSlot`.

3. **All existing form fields** — reuse the existing `renderFormFields()` function (~lines 998–1099) or inline the same fields. These include:
   - Title (text input, required)
   - Start time / End time (time inputs)
   - Event type (dropdown — activity, dining, travel, entertainment, wellness, nightlife, sports, shopping, cultural, beach, other)
   - Dress code (dropdown)
   - Description (textarea)
   - Location (text input)
   - Reservation name / Confirmation # (text inputs)
   - Cost (number input)
   - Link (text input)
   - Optional toggle (checkbox)

4. **Save button** — sticky at the bottom of the modal. On save, call the existing `addEvent()` function (~lines 294–342) but use `addDate` and `addTimeSlot` instead of `addFormSlot`. After successful save, close the modal and reset fields.

### 4c: Keep inline slot-tap as a shortcut

Do NOT remove the existing inline slot-tap behavior. When a user taps on a specific time slot in the itinerary grid, instead of rendering an inline form:
- Set `addDate` to that day
- Set `addTimeSlot` to that slot
- Open the modal (`setShowAddEventModal(true)`)

This pre-fills the day and time slot in the modal, giving power users a fast path.

Remove the inline `renderAddForm()` rendering from the time slot grid. The form now always lives in the modal.

### 4d: Add sticky "＋ Add Event" CTA

Add a sticky CTA using Pattern A. Button text: `+ Add Event`. onClick:
```tsx
() => {
  resetAddForm();
  setAddDate(tripDays[0] || "");
  setAddTimeSlot("morning");
  setShowAddEventModal(true);
}
```

Add a `<div style={{ height: "80px" }} />` spacer.

### 4e: Update the addEvent save function

The existing `addEvent` function (~lines 294–342) currently reads from `addFormSlot` to get `date` and `time_slot`. Update it to read from `addDate` and `addTimeSlot` instead. Remove the `addFormSlot` state variable entirely since it's no longer needed.

Update the payload construction (~lines 298–316):
```tsx
// OLD:
date: addFormSlot!.date,
time_slot: addFormSlot!.timeSlot,

// NEW:
date: addDate,
time_slot: addTimeSlot,
```

### 4f: Add keyframe animations

Verify `fadeIn` and `slideUp` keyframes exist in the itinerary page's `<style>` tag. Add them if missing.

---

## Styling Rules (apply to ALL changes)

- All modals use `zIndex: 1000`
- All sticky CTAs use `zIndex: 101`
- Backdrop is always `rgba(0,0,0,0.45)`
- Modal border radius is always `20px 20px 0 0`
- Modal max height is always `90vh` with `overflowY: "auto"`
- Use theme colors throughout (`th.card`, `th.cardBorder`, `th.text`, `th.muted`, `accent`, `th.accent2`)
- Font families: headings use `'Outfit'`, body text uses `'DM Sans'`
- All form inputs should use consistent styling: `width: "100%"`, `padding: "10px 14px"`, `borderRadius: "10px"`, `border: 1px solid ${th.cardBorder}`, `fontSize: "14px"`, `fontFamily: "'DM Sans', sans-serif"`

---

## Files Modified (summary)

| File | What Changed |
|------|-------------|
| `expenses-page.tsx` | Added sticky CTA, removed inline add button from filter bar |
| `trip-page.tsx` | Converted Add/Edit Booking to bottom-sheet modals, added sticky CTA, removed inline add button, added keyframes |
| `notes-page.tsx` | Converted Add Note to bottom-sheet modal, added sticky CTA, removed inline add button |
| `itinerary-page.tsx` | Built Add Event modal with day/time selectors, sticky CTA, slot-tap opens modal as shortcut, removed inline form rendering, added keyframes |

---

## Verification Checklist

After making all changes, verify:

1. `npx tsc --noEmit` passes with no new errors
2. **Expenses**: Sticky CTA visible → opens existing modal → save works → modal closes
3. **Trip Hub**: Sticky CTA visible → opens Add Booking modal → save creates booking → modal closes → booking appears in list
4. **Trip Hub**: Edit booking opens Edit modal → save updates booking → modal closes
5. **Notes**: Sticky CTA visible → opens Add Note modal → save creates note → modal closes → note appears in list
6. **Itinerary**: Sticky CTA visible → opens modal with day/time selectors → fill form → save creates event at correct day/slot → modal closes
7. **Itinerary**: Tapping a time slot in the grid opens the modal with that day/slot pre-filled
8. All modals have working backdrop dismiss (tap outside to close)
9. All modals have working ✕ close button
10. All modals slide up with animation
11. All sticky CTAs are visible above the bottom nav on every page
12. Scrolling content does not get hidden behind sticky CTAs (spacer divs work)
13. Inline add buttons are removed from filter bars / section headers
14. The Trip Hub setup view still shows "Save & Continue" (not the Add Booking CTA)
