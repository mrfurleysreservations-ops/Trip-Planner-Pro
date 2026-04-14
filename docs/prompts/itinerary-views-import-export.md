# Phase: Itinerary — List View, Import & Calendar Export

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Context
This is a Next.js 14 App Router project (Trip Planner Pro). The itinerary page (`/trip/[id]/itinerary`) currently shows a horizontal day-tab picker and a vertical time grid (7 AM–11 PM) with absolutely-positioned event blocks for ONE selected day at a time. This phase adds three features:

1. **List View** — A toggle between the existing Calendar View and a new List View that shows all days stacked vertically with collapsible sections
2. **Import** — Bulk-import events from CSV or XLSX files with column mapping
3. **Calendar Export** — Export the full itinerary as an .ics file for Google Calendar, Apple Calendar, Outlook, etc.

## Tech Stack (unchanged)
- Next.js 14 App Router, React 18, TypeScript
- Supabase (PostgreSQL + RLS)
- Inline CSS (existing pattern — no Tailwind, no CSS modules)
- No external state libraries

---

## Feature 1: List View Toggle

### What It Does
A view toggle at the top of the itinerary page lets the user switch between:
- **Calendar** (existing) — Day tabs + time grid, one day at a time
- **List** — All trip days shown vertically as collapsible accordion sections, each containing event cards in chronological order

### UI Spec

**View Toggle:**
- Two-button pill toggle (like the filter tabs on the Notes page), positioned between the day picker and the content area
- Buttons: "📅 Calendar" and "📋 List"
- Active state uses `th.accent` background with white text (match existing `filterTabStyle` pattern from notes page)
- Default view: Calendar (preserves current behavior)
- State: `const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")`

**List View Layout:**
- Remove the horizontal day tab picker when in List View (it's redundant)
- Show ALL trip days as vertical sections, stacked top to bottom
- Each day section has:
  - **Day header row** (clickable to collapse/expand):
    - Left: Day label — "Day 1 · Sat, Apr 18" format using existing `formatDate` helper
    - Right: Event count badge — "4 events" in muted text
    - Expand/collapse chevron icon: ▼ when expanded, ▶ when collapsed
    - Header style: sticky within scroll, subtle background tint (`${th.accent}08`), bottom border
  - **Event cards** (when section is expanded):
    - Compact horizontal card for each event, sorted by `start_time`
    - Layout: `[time] [icon] [title] [location] [badges]`
    - Time column: `formatTime12h(start_time)` – if start_time exists, otherwise show time_slot label ("Morning")
    - Icon: event type icon from `getEventTypeConfig`
    - Title: bold, truncated with ellipsis
    - Location: muted, truncated (if exists)
    - Badges: dress code badge + required/optional badge (compact, same components)
    - Click → opens the same expanded event detail modal (set `expandedId`)
    - Card style: same glass card style as notes cards (`th.card` background, `th.cardBorder` border, 12px radius)
  - **Empty day:** Show muted text "No events planned" instead of event cards
  - **Add button per day:** Small "+ Add Event" button at the bottom of each day section
    - Clicking sets `addFormSlot` with that day's date and opens the add form
    - When in list view, render the add form inline below the day's events

**Collapse State:**
- `const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())`
- Note: this state already exists in the component (line 108). Reuse it.
- All days expanded by default
- Click day header → toggle that date in the Set
- Persist collapse state across view mode switches (don't reset when toggling calendar↔list)

### Changes Required

**`itinerary-page.tsx`:**
- Add `viewMode` state
- Add view toggle pill UI (render between TripSubNav and the content area)
- Create a `renderListView()` function that maps over `tripDays` and renders collapsible day sections
- Wrap existing calendar grid code in a conditional: `{viewMode === "calendar" && (...existing calendar...)}`
- Add `{viewMode === "list" && renderListView()}`
- The event detail modal (expandedId) should work in BOTH views — it's already a fixed-position overlay
- The add event form in list view should render inline within the day section

**No server or database changes needed.**

---

## Feature 2: Import Events from CSV/XLSX

### What It Does
Users can upload a CSV or XLSX file to bulk-create itinerary events. The flow:
1. Click "Import" button → file picker opens
2. File is parsed client-side (Papa Parse for CSV, SheetJS for XLSX)
3. User sees a preview/mapping screen showing parsed rows and which columns map to which event fields
4. User confirms → events are bulk-inserted into Supabase

### UI Spec

**Import Button:**
- In the itinerary header area (next to the "Next: Packing →" button), add a secondary-style "📥 Import" button
- Style: outlined button with `th.accent` border, no fill (matches the pattern of secondary actions)

**Import Modal (full-screen overlay, same pattern as event detail modal):**

**Step 1 — Upload:**
- Drag-and-drop zone OR click to browse
- Accepts: `.csv`, `.xlsx`, `.xls`
- File is parsed entirely client-side using:
  - Papa Parse (`papaparse` — already available as a CDN import or npm package) for CSV
  - SheetJS (`xlsx` npm package) for XLSX/XLS
- After parse: extract headers and first 5 rows for preview
- If parse fails, show error message in red

**Step 2 — Column Mapping:**
- Show a mapping table with two columns:
  - Left: "Your Column" (dropdown of headers from the uploaded file)
  - Right: "Maps To" (event field)
- Required mappings: **Title** (must be mapped), **Date** (must be mapped)
- Optional mappings: Start Time, End Time, Location, Description, Event Type, Dress Code
- Auto-detect: try to match column headers to field names (case-insensitive, partial match)
  - e.g., "Event Name" or "Title" or "Activity" → Title
  - "Date" or "Day" → Date
  - "Start" or "Start Time" or "Time" → Start Time
  - "End" or "End Time" → End Time
  - "Location" or "Place" or "Venue" or "Where" → Location
  - "Description" or "Details" or "Notes" → Description
- Show preview of first 3 rows with the mapped values
- Date parsing: try multiple formats — "YYYY-MM-DD", "MM/DD/YYYY", "M/D/YYYY", "Apr 18, 2025", etc.
  - Validate that parsed dates fall within the trip's date range. Warn (don't block) if dates are outside range.
- Time parsing: accept "HH:MM", "H:MM AM/PM", "H AM/PM"
  - Normalize to "HH:MM" 24-hour format for storage

**Step 3 — Preview & Confirm:**
- Show all parsed events in a scrollable list, grouped by date
- Each row shows: date, time, title, location (if mapped)
- Rows with errors (missing title, unparseable date) highlighted in red with error message
- Valid row count shown: "Ready to import 12 events (2 skipped due to errors)"
- "Import" button (primary) + "Cancel" button
- Import button disabled if 0 valid rows

**Step 4 — Processing:**
- Bulk insert valid events into `itinerary_events` via Supabase
- For each event: derive `time_slot` from `start_time` using existing `timeToSlot()` helper
- Set `sort_order: 0`, `created_by: userId`, `trip_id: trip.id`, `is_optional: false`
- After insert: refresh local events state with the new events
- Show success message: "12 events imported!" with a checkmark
- Log activity: single activity entry "imported 12 events"
- Close modal

### Changes Required

**`itinerary-page.tsx`:**
- Add import button to header
- Add import modal state: `showImportModal`, `importStep`, `importFile`, `importData`, `importMapping`, etc.
- Add `renderImportModal()` function with the 4-step flow
- The CSV/XLSX parsing logic can be inline (it's one use site)

**Dependencies:**
- `papaparse` — install via npm (`npm install papaparse @types/papaparse`)
- `xlsx` — install via npm (`npm install xlsx`)

**No server or database schema changes needed.** Events are inserted using the existing `itinerary_events` table structure.

---

## Feature 3: Calendar Export (.ics)

### What It Does
Users can download their full itinerary as an `.ics` file that can be imported into Google Calendar, Apple Calendar, Outlook, or any calendar app.

### UI Spec

**Export Button:**
- In the itinerary header area, add a secondary-style "📤 Export" button (next to Import)
- Style: same outlined style as Import button

**On Click:**
- Generate an `.ics` file client-side containing ALL events in the itinerary
- Trigger browser download of the file
- Filename: `{trip.name}-itinerary.ics` (slugified, lowercase, dashes for spaces)
- No modal needed — it's a single click action

### .ics File Format

The iCalendar (.ics) format is plain text. Generate it client-side:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Trip Planner Pro//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:{trip.name} Itinerary
{...events...}
END:VCALENDAR
```

Each event:
```
BEGIN:VEVENT
UID:{event.id}@tripplannerpro
DTSTART:{date}T{start_time in HHMMSS format}
DTEND:{date}T{end_time in HHMMSS format}
SUMMARY:{event.title}
DESCRIPTION:{event.description || ""}
LOCATION:{event.location || ""}
STATUS:CONFIRMED
END:VEVENT
```

**Rules:**
- If `start_time` is null, use time_slot defaults: morning=09:00, afternoon=13:00, evening=18:00
- If `end_time` is null, default to start_time + 1 hour
- Date format: `YYYYMMDD` (no dashes)
- Time format: `HHMMSS` (no colons, append 00 for seconds)
- Escape special characters in text fields: commas, semicolons, newlines (use `\\n` for newlines, `\\,` for commas)
- UID must be unique per event — use the Supabase UUID

**No "Add to Google Calendar" per-event link** for now — the .ics download covers all calendar apps. We can add per-event Google Calendar links later if requested.

### Changes Required

**`itinerary-page.tsx`:**
- Add export button to header
- Add `exportToICS()` function that:
  1. Builds the .ics string from the `events` array
  2. Creates a Blob with `text/calendar` MIME type
  3. Triggers download via `URL.createObjectURL` + temporary `<a>` element
- No modal, no loading state needed (it's instant, client-side)

**No server or database changes needed.**

---

## File Summary

| File | Changes |
|------|---------|
| `itinerary-page.tsx` | View toggle, list view renderer, import modal (4-step), export function, new header buttons |
| `package.json` | Add `papaparse`, `@types/papaparse`, `xlsx` |

No new files needed. No database migrations. No server component changes.

---

## Implementation Order

1. **List View toggle + collapsible days** — Pure UI, no dependencies, no DB changes. Most self-contained.
2. **Calendar Export (.ics)** — Small feature, ~50 lines, no dependencies. Quick win.
3. **Import (CSV/XLSX)** — Largest feature. Needs npm packages installed first, then the 4-step modal flow.

## Validation

After all three features:
1. `npx tsc --noEmit` — must pass clean
2. Toggle between Calendar and List views — events should be visible in both, modal should work from both
3. Collapse/expand days in List view — state should persist when switching views
4. Export .ics — download should open correctly in Apple Calendar and Google Calendar
5. Import CSV — create a test CSV with columns: Title, Date, Start Time, End Time, Location. Import should create events for each row.
6. Import XLSX — same test with .xlsx file
7. Verify all existing functionality still works: add event, edit, delete, opt-in/out, notes→event conversion, deep-linking from alerts
