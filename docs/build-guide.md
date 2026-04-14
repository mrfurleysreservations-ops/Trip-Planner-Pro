# Trip Planner Pro — Build Guide
## Itinerary-First Rebuild

### How to Use This Guide
1. **One phase per chat session.** Open a new chat for each phase. The `CLAUDE.md` file auto-loads the preamble and architecture rules every time.
2. **One prompt at a time.** Paste a prompt, wait for it to finish, verify it works, then paste the next one.
3. **Don't skip ahead.** Each prompt builds on the one before it. If something breaks, fix it before moving on.
4. **Check the box** when each prompt is done and verified.
5. **After each phase:** Test the feature end-to-end before starting the next phase in a new chat.

---

## Phase 1: Group & Invitation System
> **Goal:** After creating a trip, users can invite people and manage who's going.
> **Start a NEW chat for this phase.**

### Prompt 1.1 — Database: trip_members table
```
Read docs/page-hierarchy-v2.md for the full architecture context.

Create a new Supabase migration file at supabase/migrations/20260408_trip_members.sql that creates the trip_members table:

- id (uuid, PK, default gen_random_uuid())
- trip_id (uuid, FK → trips.id ON DELETE CASCADE, NOT NULL)
- user_id (uuid, FK → auth.users(id), nullable — null for external invitees not yet on the app)
- family_member_id (uuid, FK → family_members.id, nullable)
- name (text, NOT NULL)
- email (text, nullable — for external invites)
- role (text, NOT NULL, CHECK in ('host', 'member'), default 'member')
- status (text, NOT NULL, CHECK in ('pending', 'accepted', 'declined'), default 'pending')
- invited_by (uuid, FK → auth.users(id), NOT NULL)
- invite_token (text, UNIQUE, nullable — for email/text invite links)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

Add Row-Level Security policies:
- Users can SELECT trip_members for trips where they are a member (user_id = auth.uid())
- Users can INSERT trip_members for trips where they are a host
- Users can UPDATE trip_members for trips where they are a host, OR their own row (to accept/decline)
- Users can DELETE trip_members for trips where they are a host

Also add the trip_members type definitions to types/database.types.ts following the existing pattern.

When the trip creator creates a trip, they should automatically be added as a host member with status 'accepted'. Check if trip creation already exists in the codebase and note where this auto-insert should be wired in (but don't wire it yet — that's the next prompt).
```
- [ ] Done & verified

### Prompt 1.2 — Auto-add host on trip creation
```
Read the existing trip creation flow in the codebase (dashboard page, any create-trip logic).

Wire up trip_members so that when a user creates a new trip, they are automatically inserted as a trip_member with role='host' and status='accepted'. This should happen in the same flow as trip creation — either as a second insert after the trip is created, or as a database trigger. Use whichever approach is cleaner given the existing code.

Do NOT change the trip creation UI yet — just ensure the data layer works. After creating a trip, the user should appear in trip_members for that trip.
```
- [ ] Done & verified

### Prompt 1.3 — UI: Group page (roster & invite flow)
```
Read docs/page-hierarchy-v2.md for the group page spec. Read the existing trip page at app/trip/[id]/ to understand the server/client component pattern.

Build the Group page at /trip/[id]/group following the existing architecture:
- app/trip/[id]/group/page.tsx (server component — fetch trip + trip_members)
- app/trip/[id]/group/group-page.tsx (client component — UI)

The page should show:
1. Group roster — list all trip_members with their name, role (host badge), and status (pending/accepted/declined chips)
2. Add from friends — button that shows a list of the user's existing friends/family members to add (query families + family_members for the current user). Selecting one creates a trip_member with status='pending'.
3. Invite externally — form with name + email fields. Creates a trip_member with user_id=null, generates a unique invite_token. (We'll handle the actual email sending later — for now just create the record.)
4. Remove member — host can remove any member (delete from trip_members). Show a confirmation before deleting.
5. Status indicators — pending (yellow), accepted (green), declined (red/gray)

Style it consistently with the existing trip page. Use inline styles, glass-morphism cards, and the trip's accent color theme.
```
- [ ] Done & verified

### Prompt 1.4 — Trip sub-navigation
```
Read the existing app-shell.tsx and tab-bar.tsx components to understand current navigation.

Create a trip sub-navigation component that appears inside /trip/[id]/ pages. This is a horizontal tab bar (NOT the bottom tab bar) that shows:

Group | Notes | Itinerary | Packing | Meals | Logistics

Requirements:
- Highlights the active section based on current route
- Uses the trip's accent color for the active indicator
- Renders above the page content, below the top bar
- Works on the existing trip page and the new group page
- Notes, Itinerary, and Logistics tabs can link to placeholder pages for now (just show "Coming soon" with the trip sub-nav)

Update the trip detail page and group page to include this sub-navigation.
```
- [ ] Done & verified

### Prompt 1.5 — Phase 1 verification
```
Review all the work done in this phase:
1. Verify trip_members migration is clean SQL with proper RLS
2. Verify auto-host insertion works when creating a trip
3. Verify the group page loads, shows roster, and allows adding/removing members
4. Verify the trip sub-navigation appears and highlights correctly
5. Check for any TypeScript errors, unused imports, or inconsistencies with existing code patterns

List any issues found. Do not proceed to fix them yet — just report.
```
- [ ] Done & verified — all issues resolved

---

## Phase 2: Notes System
> **Goal:** Users can capture individual ideas/notes and finalize them into itinerary events later.
> **Start a NEW chat for this phase.**

### Prompt 2.1 — Database: trip_notes table
```
Read docs/page-hierarchy-v2.md for the notes system spec.

Create a new Supabase migration at supabase/migrations/20260409_trip_notes.sql that creates the trip_notes table:

- id (uuid, PK, default gen_random_uuid())
- trip_id (uuid, FK → trips.id ON DELETE CASCADE, NOT NULL)
- created_by (uuid, FK → auth.users(id), NOT NULL)
- title (text, NOT NULL)
- body (text, nullable — free text details)
- link_url (text, nullable)
- photo_url (text, nullable)
- status (text, NOT NULL, CHECK in ('idea', 'finalized'), default 'idea')
- event_id (uuid, nullable — populated when finalized into an itinerary event, FK added in Phase 3)
- sort_order (integer, default 0)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

RLS policies:
- SELECT: any trip_member of this trip can read notes
- INSERT: any trip_member of this trip can create notes
- UPDATE: the note creator can edit their own notes, OR any host can edit any note
- DELETE: the note creator can delete their own, OR any host can delete any

Add types to types/database.types.ts.
```
- [ ] Done & verified

### Prompt 2.2 — UI: Notes page
```
Read the existing group page (app/trip/[id]/group/) for the server/client pattern. Read docs/page-hierarchy-v2.md for the notes spec.

Build the Notes page at /trip/[id]/notes:
- app/trip/[id]/notes/page.tsx (server — fetch trip, trip_notes, trip_members)
- app/trip/[id]/notes/notes-page.tsx (client — UI)

The page should show:
1. List of note cards — each card shows: title, body preview (truncated), who created it, status badge (idea/finalized), optional link icon
2. Add note — button opens a form: title (required), body (optional), link URL (optional). Creates with status='idea'.
3. Edit note — inline edit or modal for the note creator / host
4. Delete note — with confirmation
5. Filter tabs — All | Ideas | Finalized
6. "Finalize" button on idea notes — for now this just changes status to 'finalized'. (The actual conversion to itinerary event comes in Phase 3 when the itinerary exists.)

Include the trip sub-navigation. Style consistently with existing pages.
```
- [ ] Done & verified

### Prompt 2.3 — Phase 2 verification
```
Review all Phase 2 work:
1. Verify trip_notes migration is clean with proper RLS
2. Verify notes page loads, CRUD works (create, read, update, delete)
3. Verify filter tabs work (all/ideas/finalized)
4. Verify only note creators and hosts can edit/delete
5. Verify trip sub-navigation shows Notes as active
6. Check for TypeScript errors and pattern consistency

List any issues found.
```
- [ ] Done & verified — all issues resolved

---

## Phase 3: Itinerary System
> **Goal:** Day-by-day, time-slotted event planning with per-person opt-in and notes→event pipeline.
> **Start a NEW chat for this phase.**

### Prompt 3.1 — Database: itinerary_events + event_participants
```
Read docs/page-hierarchy-v2.md for the itinerary and event_participants spec.

Create supabase/migrations/20260410_itinerary.sql with TWO tables:

TABLE 1: itinerary_events
- id (uuid, PK, default gen_random_uuid())
- trip_id (uuid, FK → trips.id ON DELETE CASCADE, NOT NULL)
- created_by (uuid, FK → auth.users(id), NOT NULL)
- date (date, NOT NULL)
- time_slot (text, NOT NULL, CHECK in ('morning', 'afternoon', 'evening'))
- start_time (time, nullable — for precise scheduling)
- end_time (time, nullable)
- title (text, NOT NULL)
- description (text, nullable)
- location (text, nullable)
- event_type (text, NOT NULL, CHECK in ('travel', 'activity', 'dining', 'outdoors', 'nightlife', 'downtime', 'shopping', 'other'))
- dress_code (text, nullable, CHECK in ('casual', 'smart_casual', 'formal', 'active', 'swimwear', 'outdoor', 'business'))
- reservation_number (text, nullable)
- confirmation_code (text, nullable)
- cost_per_person (numeric, nullable)
- external_link (text, nullable)
- is_optional (boolean, default false — if true, members can opt out)
- note_id (uuid, nullable, FK → trip_notes.id ON DELETE SET NULL — link back to source note)
- sort_order (integer, default 0)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

TABLE 2: event_participants
- id (uuid, PK, default gen_random_uuid())
- event_id (uuid, FK → itinerary_events.id ON DELETE CASCADE, NOT NULL)
- trip_member_id (uuid, FK → trip_members.id ON DELETE CASCADE, NOT NULL)
- status (text, NOT NULL, CHECK in ('attending', 'skipping'), default 'attending')
- UNIQUE(event_id, trip_member_id)

Also add the FK from trip_notes.event_id → itinerary_events.id (ALTER TABLE).

RLS policies:
- itinerary_events: trip members can SELECT. Hosts can INSERT/UPDATE/DELETE. Members can INSERT (anyone can suggest events).
- event_participants: trip members can SELECT. Each person can UPDATE their own status. Hosts can UPDATE any. Auto-populated on event creation (all accepted trip_members get an 'attending' row).

Add types to types/database.types.ts.
```
- [ ] Done & verified

### Prompt 3.2 — UI: Itinerary page (day/time view + events)
```
Read the group and notes pages for the established server/client pattern. Read docs/page-hierarchy-v2.md for itinerary spec.

Build the Itinerary page at /trip/[id]/itinerary:
- app/trip/[id]/itinerary/page.tsx (server — fetch trip, itinerary_events, event_participants, trip_members)
- app/trip/[id]/itinerary/itinerary-page.tsx (client — UI)

The page should show:
1. Day-by-day sections — generated from the trip's start_date to end_date. Each day is a collapsible section header (Day 1: Fri May 15, etc.)
2. Time slots within each day — Morning, Afternoon, Evening. Events are placed in their slot.
3. Event cards — show: title, event_type icon/badge, time, location, dress_code badge, participant count (e.g., "6/8 going")
4. Expand event — shows full details: description, reservation #, confirmation code, cost, link, dress code, and participant list with attending/skipping status
5. Add event — button per time slot. Form: title, event_type (dropdown), description, location, dress code (dropdown), reservation #, confirmation code, cost, link, is_optional toggle. On save, auto-create event_participants for all accepted trip_members.
6. Opt in/out — on optional events, each member sees a toggle to switch between attending/skipping. Non-optional events show "Required" badge.
7. Edit/delete events — host can edit/delete any event.

Include trip sub-navigation. Style with existing patterns.
```
- [ ] Done & verified

### Prompt 3.3 — Wire up Notes → Itinerary pipeline
```
Read the notes page and itinerary page code.

Update the "Finalize" button on the notes page so that:
1. Clicking "Finalize" on an idea note opens the itinerary event creation form, pre-filled with:
   - title from the note title
   - description from the note body
   - external_link from the note link_url
   - note_id set to this note's id
2. The user fills in the remaining fields (date, time_slot, event_type, dress_code, etc.) and saves
3. On save:
   - The itinerary_event is created with note_id referencing the source note
   - The note's status is updated to 'finalized' and event_id is set to the new event's id
4. Finalized notes on the notes page show a link/badge that says "View event" linking to the itinerary (or scrolling to that day)
5. On the itinerary, events created from notes show a small "From notes" indicator

This should work as a flow between the two pages — finalize on notes page → lands on itinerary page with the form pre-filled, OR a modal/drawer on the notes page that creates the event inline.

Choose whichever approach is cleaner given the existing code.
```
- [ ] Done & verified

### Prompt 3.4 — Phase 3 verification
```
Review all Phase 3 work:
1. Verify itinerary migration creates both tables with proper RLS and the trip_notes FK
2. Verify itinerary page shows days generated from trip dates with time slots
3. Verify event CRUD works — create, edit, delete, with all fields
4. Verify event_participants are auto-created for accepted members on event creation
5. Verify opt-in/out toggles work on optional events
6. Verify notes → itinerary finalize pipeline works end to end
7. Verify finalized notes show "View event" link
8. Check TypeScript errors and pattern consistency

List any issues found.
```
- [ ] Done & verified — all issues resolved

---

## Phase 4: Event-Driven Packing
> **Goal:** Each person packs based on the events they opted into. Two views: event walk-through and consolidation.
> **Start a NEW chat for this phase.**

### Prompt 4.1 — Database: packing tables
```
Read docs/page-hierarchy-v2.md for the packing system spec.

Create supabase/migrations/20260411_packing.sql with THREE tables:

TABLE 1: packing_items
- id (uuid, PK, default gen_random_uuid())
- trip_id (uuid, FK → trips.id ON DELETE CASCADE, NOT NULL)
- trip_member_id (uuid, FK → trip_members.id ON DELETE CASCADE, NOT NULL)
- event_id (uuid, nullable, FK → itinerary_events.id ON DELETE SET NULL — null for general items not tied to an event)
- name (text, NOT NULL)
- category (text, NOT NULL, CHECK in ('clothing', 'shoes', 'outerwear', 'underwear', 'toiletries', 'electronics', 'accessories', 'documents', 'gear', 'other'))
- is_packed (boolean, default false)
- is_multi_use (boolean, default false — flagged during consolidation)
- photo_url (text, nullable)
- created_at (timestamptz, default now())

TABLE 2: packing_outfits
- id (uuid, PK, default gen_random_uuid())
- trip_id (uuid, FK → trips.id ON DELETE CASCADE, NOT NULL)
- trip_member_id (uuid, FK → trip_members.id ON DELETE CASCADE, NOT NULL)
- event_id (uuid, FK → itinerary_events.id ON DELETE CASCADE, NOT NULL)
- name (text, nullable)
- notes (text, nullable)
- created_at (timestamptz, default now())

TABLE 3: outfit_packing_items (junction)
- id (uuid, PK, default gen_random_uuid())
- outfit_id (uuid, FK → packing_outfits.id ON DELETE CASCADE, NOT NULL)
- packing_item_id (uuid, FK → packing_items.id ON DELETE CASCADE, NOT NULL)
- UNIQUE(outfit_id, packing_item_id)

RLS: each person can manage their own packing data (trip_member's user_id = auth.uid()). Hosts can view everyone's packing.

Add types to types/database.types.ts.
```
- [ ] Done & verified

### Prompt 4.2 — UI: Packing page (event walk-through view)
```
Read the itinerary page for established patterns. Read docs/page-hierarchy-v2.md for packing spec.

Build the Packing page at /trip/[id]/packing:
- app/trip/[id]/packing/page.tsx (server — fetch trip, trip_members, itinerary_events, event_participants, packing_items, packing_outfits)
- app/trip/[id]/packing/packing-page.tsx (client — UI)

Start with the EVENT WALK-THROUGH view:
1. Per-person tabs — each accepted trip_member gets a tab. Active user's tab selected by default.
2. For the selected person, show ONLY events they are "attending" (from event_participants), in chronological order
3. Each event card shows: event title, date, time_slot, dress_code, weather placeholder (just show "Weather: TBD" for now)
4. Under each event: outfit builder
   - "Add item" button — name, category dropdown. Creates a packing_item linked to this event.
   - List of items added for this event
   - Optional: group items into an outfit (create packing_outfit, link items)
5. A "General items" section at the bottom for items not tied to any event (toiletries, chargers, documents, etc.)

Include trip sub-navigation. Match existing styling.
```
- [ ] Done & verified

### Prompt 4.3 — UI: Packing consolidation view
```
Read the packing page code from the previous prompt.

Add a CONSOLIDATION VIEW toggle to the packing page (switch between "By Event" and "All Items"):

The consolidation view shows:
1. ALL packing items for the selected person, grouped by category (not by event)
2. Each item shows: name, which event(s) it's for, packed checkbox
3. Duplicate detection — if the same item name appears for multiple events, highlight it and suggest marking as "multi-use" (one physical item, worn multiple times)
4. "Mark as multi-use" button — sets is_multi_use=true, visually groups the duplicates into one row showing all events it covers
5. Remove button — delete items you decide you don't need
6. Summary stats at top: total items, packed count, multi-use count

This is the "lay it all on the bed" view where users pare down their packing.
```
- [ ] Done & verified

### Prompt 4.4 — Phase 4 verification
```
Review all Phase 4 work:
1. Verify packing migration creates all three tables with proper RLS
2. Verify event walk-through shows only events the person opted into
3. Verify items can be added per-event and as general items
4. Verify consolidation view groups by category and detects duplicates
5. Verify multi-use flagging works
6. Verify packed checkbox persists
7. Verify per-person tabs work correctly
8. Check TypeScript errors and pattern consistency

List any issues found.
```
- [ ] Done & verified — all issues resolved

---

## Phase 5: Trip Hub & Logistics
> **Goal:** Redesign the trip detail page as a true hub. Build the logistics section.
> **Start a NEW chat for this phase.**

### Prompt 5.1 — Redesign Trip Hub
```
Read the existing trip page (app/trip/[id]/trip-page.tsx) and the trip sub-navigation component.

Redesign /trip/[id] as a trip hub/dashboard. This is the landing page when you open a trip. It should show:

1. Trip header — name, destination, dates, trip type with themed accent color, cover/icon
2. Countdown — "12 days away" or "In progress" or "Completed"
3. Weather summary — placeholder widget showing "Weather for [destination]" (actual API integration later)
4. Quick stats cards:
   - Group: "8 people, 6 confirmed" → links to /group
   - Itinerary: "14 events across 4 days" → links to /itinerary
   - Notes: "3 open ideas" → links to /notes
   - Packing: "Jane: 80% packed" → links to /packing
5. Trip sub-navigation below the header

Remove or relocate existing trip page content (meals, inventory, etc.) to their appropriate sub-pages. The hub should be clean and scannable — an overview, not a dumping ground.
```
- [ ] Done & verified

### Prompt 5.2 — Build Logistics page
```
Read docs/page-hierarchy-v2.md for the logistics spec.

Build /trip/[id]/logistics:
- app/trip/[id]/logistics/page.tsx (server)
- app/trip/[id]/logistics/logistics-page.tsx (client)

Sections:
1. Travel bookings — add flights, car rentals with details (airline, flight #, times, confirmation code)
2. Accommodations — hotels/Airbnb with name, address, check-in/out dates, confirmation code
3. Documents checklist — list of items to remember (passport, ID, insurance card, tickets, etc.) with checkboxes
4. Trip gear — for camping/outdoor trips, list of shared gear items (tents, coolers, etc.) pulled from existing inventory system if applicable

This can be stored as JSON in trip_data (similar to existing meals/snacks pattern) or as a new table — use whichever approach is more consistent with the existing codebase.

Include trip sub-navigation.
```
- [ ] Done & verified

### Prompt 5.3 — Phase 5 verification
```
Review all Phase 5 work:
1. Verify trip hub shows overview stats and links to sub-pages correctly
2. Verify logistics page CRUD works for travel, accommodations, documents
3. Verify all trip sub-pages have consistent sub-navigation
4. Verify no existing functionality was broken during the hub redesign
5. Check TypeScript errors and pattern consistency

List any issues found.
```
- [ ] Done & verified — all issues resolved

---

## Phase 6: Cleanup & Migration
> **Goal:** Remove deprecated pages, simplify navigation, clean up.
> **Start a NEW chat for this phase.**

### Prompt 6.1 — Remove deprecated pages and simplify nav
```
Read the current tab-bar.tsx and app-shell.tsx.

1. Remove the standalone /packing page (app/packing/) — packing now lives inside trips only
2. Remove the standalone /gear page (app/gear/) — gear is now in logistics
3. Update the bottom tab bar to show only 3 tabs: Trips (dashboard), Profile, Friends
4. Remove any references to the old packing/gear pages in navigation, imports, etc.
5. Update the dashboard to remove any links to the old standalone pages

Do NOT delete the database tables yet (suitcases, wardrobe, etc.) — those can be deprecated in a future migration once we're confident the new system is solid. Just remove the UI.
```
- [ ] Done & verified

### Prompt 6.2 — Final review
```
Do a full codebase review:
1. Check all imports — no broken references to deleted pages
2. Check all routes — no dead links
3. Check TypeScript compilation — no errors
4. Check that every /trip/[id]/* page has the trip sub-navigation
5. Check that the server/client component pattern is consistent everywhere
6. Check for any leftover TODO comments or placeholder text that should be real content
7. Review the overall navigation flow: dashboard → create trip → group → notes → itinerary → packing → consolidation → logistics

List any issues found.
```
- [ ] Done & verified — all issues resolved

---

## Quick Reference: New Chat Checklist
When starting each phase in a new chat:
1. ✅ CLAUDE.md auto-loads (preamble + architecture rules are enforced)
2. ✅ Paste the first prompt for that phase
3. ✅ Wait for completion, test it
4. ✅ Paste the next prompt
5. ✅ Run the verification prompt at the end of each phase
6. ✅ Fix any issues before moving to next phase
