# Build: Import Trip from AI (ChatGPT / Claude / etc.)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Why this exists
Users already plan trips in ChatGPT / Claude with prompts like "plan me a 4-day Nashville bachelor weekend with an itinerary." This feature lets them bring that output into Trip Planner Pro without retyping it.

Flow: dashboard → "+ New Trip" menu → **Import from AI** → modal shows a copyable prompt → user pastes our prompt + their trip idea into whichever AI they use → they paste the AI's JSON output back into our modal → we validate → we show a preview → on confirm we insert a new `trips` row + its `itinerary_events` rows and route them to `/trip/[id]`.

---

## Finalized design decisions — do NOT re-ask

- **Scope (v1):** Imports a `trips` row + its `itinerary_events` rows only. No `trip_notes`, no `packing_items`, no `meals`, no `event_participants`. Packing/meals are event-driven under the itinerary-first model and will populate naturally once the trip + events exist.
- **AI response format:** Strict JSON only. Our prompt instructs the AI to output ONLY a single JSON object, no code fences, no prose. We `JSON.parse` + validate manually in TypeScript. No Zod, no new dependencies.
- **Entry point:** Dashboard. The existing "+" FAB becomes a 2-option menu (tap +, see: *Blank trip* | *Import from AI*). No in-trip "add more events from AI" entry point in v1.
- **Always creates a NEW trip.** Never appends to an existing trip in v1.
- **Preview before commit:** After paste → parse → validate, show a read-only summary (trip name, dates, location, trip type, per-day list of events with time + title). User clicks **Create Trip** to commit.
- **Atomicity:** Insert via a Postgres RPC function (`import_ai_trip`) that creates the trip + events in a single transaction. If any event is invalid, the whole import fails and nothing is written.
- **Privacy notice:** One-line notice in the copy-prompt step: "This prompt sends your input to whichever AI you paste it into — avoid sensitive info like passport/card numbers." No server-side AI call; everything is user-driven copy/paste.
- **Schema versioning:** The AI prompt includes `"schema_version": 1`. If the incoming JSON's schema_version doesn't match, show an error: "This looks like it was generated with an older prompt — please re-copy the latest prompt and try again."

---

## Step 1 — Migration (copy-paste this into Supabase SQL Editor)

```sql
-- Postgres RPC: atomically create a trip + its itinerary events from a validated JSON payload.
-- Called from the client via supabase.rpc('import_ai_trip', { payload: {...} }).
-- Returns the new trip id.

create or replace function public.import_ai_trip(payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_trip_id uuid;
  v_user_id uuid := auth.uid();
  v_event jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Insert the trip
  insert into public.trips (owner_id, name, trip_type, location, start_date, end_date, notes)
  values (
    v_user_id,
    coalesce(payload->>'name', 'Imported Trip'),
    coalesce(payload->>'trip_type', 'meetup'),
    payload->>'location',
    nullif(payload->>'start_date', '')::date,
    nullif(payload->>'end_date', '')::date,
    payload->>'notes'
  )
  returning id into v_trip_id;

  -- Initialize trip_data (mirrors the blank-trip path in dashboard.tsx)
  insert into public.trip_data (trip_id) values (v_trip_id);

  -- Insert each event
  for v_event in select * from jsonb_array_elements(coalesce(payload->'events', '[]'::jsonb))
  loop
    insert into public.itinerary_events (
      trip_id, created_by, date, time_slot, start_time, end_time,
      title, description, location, event_type, dress_code,
      cost_per_person, external_link, is_optional, sort_order
    )
    values (
      v_trip_id,
      v_user_id,
      nullif(v_event->>'date', '')::date,
      coalesce(v_event->>'time_slot', 'afternoon'),
      nullif(v_event->>'start_time', '')::time,
      nullif(v_event->>'end_time', '')::time,
      coalesce(v_event->>'title', 'Untitled'),
      v_event->>'description',
      v_event->>'location',
      coalesce(v_event->>'event_type', 'other'),
      v_event->>'dress_code',
      nullif(v_event->>'cost_per_person', '')::numeric,
      v_event->>'external_link',
      coalesce((v_event->>'is_optional')::boolean, false),
      coalesce((v_event->>'sort_order')::int, 0)
    );
  end loop;

  return v_trip_id;
end;
$$;

grant execute on function public.import_ai_trip(jsonb) to authenticated;
```

Run this once. No table changes — everything else uses existing tables.

---

## Step 2 — Prompt template + validator

Create `lib/ai-import-prompt.ts`. This file owns two things:
1. `AI_IMPORT_PROMPT` — the exact text copied to the user's clipboard.
2. `validateImportPayload(raw: unknown)` — parses and validates the pasted JSON, returning either a normalized object or a list of error messages.

The prompt text MUST reference the enum values from `lib/constants.ts` (`TRIP_TYPES`, `EVENT_TYPES`, `DRESS_CODES`, `TIME_SLOTS`) — import them and template them into the string. Do not hardcode the enums in the prompt string, so future constant changes propagate automatically.

The prompt must tell the AI (verbatim points — phrase them as you see fit):
- Output **ONLY** a single JSON object. No code fences. No prose. No markdown.
- Top-level shape: `{ schema_version: 1, name, trip_type, location, start_date, end_date, notes, events: [...] }`.
- `trip_type` must be one of the TRIP_TYPES values.
- Dates are `YYYY-MM-DD`. Times are `HH:MM` (24-hour). If unknown, use `null`, never omit a field.
- Each event has: `date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, cost_per_person, external_link, is_optional, sort_order`.
- `time_slot` must be one of TIME_SLOTS values. `event_type` one of EVENT_TYPES. `dress_code` one of DRESS_CODES or `null`.
- `sort_order` starts at 0 for the first event of each day and increments within the day.
- `is_optional` defaults to `false`.
- Do not invent reservation numbers or confirmation codes — always `null`.
- If the user didn't specify something, use sensible defaults but **never** hallucinate specific restaurant names, addresses, or bookings.

The validator (`validateImportPayload`) must:
- Check `schema_version === 1`. If not, return `{ errors: ["Schema version mismatch — please re-copy the latest prompt."] }`.
- Require `name` (string, 1–120 chars). Everything else may be null.
- Coerce + validate `trip_type`, per-event `time_slot`, `event_type`, `dress_code` against the constant arrays. Unknown enum value → error `"Event 3: event_type 'foo' is not valid"`.
- Validate date strings match `^\d{4}-\d{2}-\d{2}$` and parse cleanly.
- Validate time strings match `^\d{2}:\d{2}$`.
- Reject `events` that isn't an array, and any event missing `title`.
- Return either `{ ok: true, normalized: {...} }` or `{ ok: false, errors: string[] }`. Do NOT throw.

No Zod, no new deps — write it by hand. ~150 lines is reasonable.

---

## Step 3 — Modal component

Create `app/dashboard/ImportFromAIModal.tsx` (client component, `"use client"` at the top).

Props:
```ts
interface ImportFromAIModalProps {
  userId: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}
```

State machine (use `useState<'prompt' | 'paste' | 'preview' | 'error'>('prompt')`):

1. **prompt** — Shows the copyable AI prompt. A "Copy prompt" button (uses `navigator.clipboard.writeText(AI_IMPORT_PROMPT)`, shows "Copied ✓" for 2s). Below it, a one-line privacy notice: *"This prompt sends your input to whichever AI you paste it into — avoid sensitive info like passport/card numbers."* A "Next: paste AI response →" button.
2. **paste** — A large `<textarea>` labeled "Paste the AI's JSON response here." A "Back" button and a "Validate" button. On Validate: run `validateImportPayload(JSON.parse(text))`. If parse fails, show `"Couldn't parse JSON — make sure you copied the full response."`. If validation fails, show the error list. If ok, stash the normalized payload in state and advance to **preview**.
3. **preview** — Read-only summary:
    - Trip header: name, trip_type badge, location, date range.
    - Grouped by date, list each event: `time_slot icon + start_time — title (event_type icon)`. Truncate description at 120 chars with "…".
    - Bottom: "Back" + **"Create Trip"** button.
    - On Create Trip click: call `supabase.rpc('import_ai_trip', { payload: normalized })`. On success, `onCreated(trip_id)` which the parent uses to route to `/trip/[id]`. On error, advance to **error** state with the error message.
4. **error** — Error message + "Try again" (returns to paste step with the textarea preserved).

Styling: match existing modals — inline styles, glass card look, backdrop `rgba(0,0,0,0.5)`, modal body `background: #fff`, `borderRadius: 18`, max-width 520, scrollable body, sticky footer with the nav buttons. Reference `app/trip/[id]/group/*.tsx` or any existing modal component for the exact pattern already in use.

---

## Step 4 — Wire up the dashboard FAB

Modify `app/dashboard/dashboard.tsx`:

1. Replace the single-action FAB (currently lines ~347–375 — `onClick={createTrip}`) with a FAB that toggles a small popover menu just above it. Two buttons in the popover:
   - **Blank trip** — calls the existing `createTrip` function unchanged.
   - **Import from AI** — opens `<ImportFromAIModal />`.
2. Add state: `const [showFabMenu, setShowFabMenu] = useState(false);` and `const [showImportModal, setShowImportModal] = useState(false);`.
3. Clicking the FAB toggles `showFabMenu`. Clicking the backdrop or either option closes the menu.
4. Render `<ImportFromAIModal>` conditionally at the end of the component, passing `userId={user.id}`, `onClose={() => setShowImportModal(false)}`, and `onCreated={(id) => router.push(\`/trip/${id}\`)}`.
5. Do NOT change the FAB's visual style (same gradient, same position, same size). Only its behavior.

Keep the existing `createTrip` function — it's still the "Blank trip" path.

---

## Step 5 — Testing checklist

Paste each of these into ChatGPT or Claude along with our copied prompt, then paste the AI's response into the modal. All should succeed:

1. *"Plan me a 3-day Nashville bachelor weekend, May 15-17 2026, bar crawl, country concert, brunch."*
2. *"4-day flying trip to Cabo, April 20-23 2026, beach days, one fancy dinner, snorkeling, nightclub one night."*
3. *"Weekend camping at Big Sur, no specific dates yet."* — Should produce null dates and still import.

Failure cases that must show a clean error:
- Paste an empty string → "Couldn't parse JSON…"
- Paste `{}` → "Missing required field: name"
- Hand-edit the JSON to set `trip_type: "glamping"` → enum error naming the offending field.
- Hand-edit `schema_version: 2` → schema version mismatch message.

Verify after a successful import:
- New trip appears in the dashboard upcoming list.
- Clicking it lands on `/trip/[id]` and the Itinerary tab shows all imported events grouped by date.
- Host was auto-added to `trip_members` (DB trigger — same as blank-trip path).
- Events have `created_by = auth.uid()`.

---

## What NOT to do
- Do not add a Zod dependency or any other new npm package.
- Do not call any external LLM API server-side. This is 100% user-driven copy/paste.
- Do not import `trip_notes`, `packing_items`, `meals`, or `event_participants` in v1.
- Do not append to existing trips. Always creates a new one.
- Do not change the FAB's visual style — only its click behavior.
- Do not add a new top-level route (no `/import` page). The modal lives on the dashboard.
- Do not persist the AI prompt anywhere server-side — it's a static string in `lib/ai-import-prompt.ts`.

---

## Deliverables
- `supabase/migrations/NNNN_import_ai_trip_rpc.sql` (or wherever migrations live — match the existing pattern in `lib/migrations/`).
- `lib/ai-import-prompt.ts` (prompt + validator).
- `app/dashboard/ImportFromAIModal.tsx` (modal).
- Edits to `app/dashboard/dashboard.tsx` (FAB menu + modal wiring).
- No changes to `types/database.types.ts` (no schema changes).
