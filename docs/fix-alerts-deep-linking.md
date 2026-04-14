# Fix: Alerts Deep-Linking to Notes & Itinerary Events

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Context
This is a Next.js 14 App Router project (Trip Planner Pro). The alerts page (`/alerts`) shows an activity feed. When a user clicks an activity item, it should deep-link to the exact note modal or itinerary event modal. There are three bugs to fix.

## Bug 1: Notes deep-link doesn't open the modal

**What happens:** Clicking a note alert navigates to `/trip/[id]/notes?note=NOTE_ID` but the note modal doesn't open. The user just sees the notes list.

**Root cause:** The notes client component (`app/trip/[id]/notes/notes-page.tsx`) reads query params in a `useEffect(() => {}, [])` using `window.location.search`. This only fires on mount. But `router.push()` from the alerts page does client-side navigation — Next.js may reuse the component instance without remounting it, so the useEffect never fires.

**Fix:** Pass `searchParams` from the server component to the client component as a prop. In `app/trip/[id]/notes/page.tsx`, the server component should accept `searchParams` (Next.js provides this automatically to page components) and pass it to `NotesPage`. The client component should use this prop — not `window.location.search` or `useSearchParams()` — to determine if a note modal should be open on render. Use a `useEffect` that depends on the `noteId` prop value so it fires every time the prop changes (which it will on each navigation).

Changes needed:
- `app/trip/[id]/notes/page.tsx`: Add `searchParams` to the page function signature. Extract `note` param. Pass `openNoteId={searchParams?.note || null}` as a prop to `NotesPage`. Update the `NotesPageProps` interface to include `openNoteId: string | null`.
- `app/trip/[id]/notes/notes-page.tsx`: Accept `openNoteId` prop. Replace the current `useEffect` with one that depends on `[openNoteId]`. When `openNoteId` changes and is non-null, find the note in the list, set filter to "all", and set `selectedNoteId`. Remove the `useRef` guard, the `window.location.search` read, and the `window.history.replaceState` call. Remove the `useRef` import if no longer used.

## Bug 2: Itinerary deep-link opens modal but doesn't switch to the correct date

**What happens:** Clicking an itinerary event alert navigates to `/trip/[id]/itinerary?event=EVENT_ID`. The modal opens for the correct event, but the calendar stays on the first trip day instead of scrolling to the event's actual date.

**Root cause:** The alerts click handler builds the URL with only `?event=EVENT_ID` and no `&date=` param (the fallback at line 304 in `alerts-page.tsx` doesn't include date). The itinerary useEffect checks `if (date)` to set the day index, but `date` is null so it skips. Even when `link_path` in the DB includes `&date=`, the fallback overwrites it because the condition `!href.includes("?")` is false when `link_path` already has params — wait, actually the condition says: if entity_id exists AND (href is null OR href has no "?"), then rebuild. So if `link_path` already has `?event=...&date=...`, it should be used as-is. But the fallback kicks in when `link_path` is null or has no query params.

**The real fix is simpler:** Don't rely on the URL for the date at all. The itinerary page already has all events loaded as props. When deep-linking via `?event=EVENT_ID`, look up the event in the `events` array, get its `.date` field, and use that to set `selectedDayIdx`. This is more reliable than passing date through the URL.

Changes needed:
- `app/trip/[id]/itinerary/page.tsx`: Same pattern as notes — accept `searchParams`, extract `event` and `fromNote` params, pass as props (`openEventId`, `fromNote`, `fromNoteTitle`, `fromNoteDescription`, `fromNoteLink`, `fromNoteDate`, `fromNoteStartTime`, `fromNoteEndTime`). Update `ItineraryPageProps`.
- `app/trip/[id]/itinerary/itinerary-page.tsx`: Accept the new props. Replace the `useEffect` with one that depends on `[openEventId]`. When `openEventId` is set: find the event in the `events` array, get its `date`, find the day index in `tripDays`, call `setSelectedDayIdx`, and call `setExpandedId`. For `fromNote` flow: use the props directly to pre-fill the add form. Remove `window.location.search`, `window.history.replaceState`, and the `useRef` guard.

## Bug 3: Event modal shows military time and no date

**What happens:** The event detail modal shows time as "14:30 – 16:00" instead of "2:30 PM – 4:00 PM". It also shows no date at all.

**Root cause:** Lines 963-964 in `itinerary-page.tsx` render `ev.start_time` and `ev.end_time` raw without formatting. No date is rendered.

**Fix:** Add a `formatTime` helper that converts "HH:MM" to "h:MM AM/PM" format. Add a `formatDate` display next to the time in the modal. The event object has `ev.date` (YYYY-MM-DD) and `ev.start_time`/`ev.end_time` (HH:MM).

Changes needed in `itinerary-page.tsx`:
- Add helper function:
```typescript
function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}
```
- In the modal "Time & Location" section (around line 959), add the formatted date and use `formatTime12h`:
```tsx
{/* Date */}
<div style={{ display: "flex", alignItems: "center", gap: 8, color: th.text }}>
  <span>📅</span>
  <span style={{ fontWeight: 600 }}>{formatDate(ev.date)}</span>
</div>
{/* Time */}
{ev.start_time && (
  <div style={{ display: "flex", alignItems: "center", gap: 8, color: th.text }}>
    <span>🕐</span>
    <span style={{ fontWeight: 600 }}>
      {formatTime12h(ev.start_time)}{ev.end_time ? ` – ${formatTime12h(ev.end_time)}` : ""}
    </span>
  </div>
)}
```
- Note: `formatDate` already exists in the file (line 25-28) — it outputs "Sat, Apr 18" format.
- Also update the calendar event blocks in the time grid to use `formatTime12h` instead of raw time strings. Search for where `ev.start_time` is rendered in the calendar grid view and apply the same formatting.

## Files to modify
1. `app/alerts/alerts-page.tsx` — no changes needed (click handler is now correct)
2. `app/trip/[id]/notes/page.tsx` — pass searchParams.note as prop
3. `app/trip/[id]/notes/notes-page.tsx` — accept prop, fix useEffect
4. `app/trip/[id]/itinerary/page.tsx` — pass searchParams as props
5. `app/trip/[id]/itinerary/itinerary-page.tsx` — accept props, fix useEffect, add formatTime12h, add date to modal

## Validation
After making changes, run `npx tsc --noEmit` to verify no type errors. Then test:
1. Create a note, go to alerts, click the note activity → should open the note modal
2. Create an itinerary event on day 3, go to alerts, click the event activity → should switch to day 3 and open the event modal showing formatted date and 12h time
3. Open a note, click "Convert to Itinerary Event", pick a date and time → should navigate to itinerary with form pre-filled on the correct day
