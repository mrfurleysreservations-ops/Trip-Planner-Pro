# Trip Planner Pro — Page Hierarchy v2
## "Itinerary-First" Architecture

### The Philosophy
People plan trips in a natural sequence: **Where → When → What → What to Wear → Pare Down**.
The app should mirror that thinking. Packing is not a standalone activity — it's driven by the itinerary. The itinerary is not an afterthought — it's the backbone of the entire trip.

---

## Page Hierarchy

```
/auth/login
/auth/reset-password
/auth/callback

/dashboard                          ← Home: Your Trips
│
├── /trip/new                       ← Step 1: Create Trip (destination, dates, type)
│
├── /trip/[id]                      ← Trip Hub (overview, weather summary, countdown)
│   │
│   ├── /trip/[id]/group            ← Step 2: Build Your Group
│   │   ├── Invite people to the trip
│   │   │   ├── Search & select from existing friends/families on the app
│   │   │   ├── Send invite to non-app users (email/text with join link)
│   │   │   └── Invite status: pending, accepted, declined
│   │   ├── Manage group after creation
│   │   │   ├── Add more people at any time
│   │   │   ├── Remove/cancel members who drop out
│   │   │   └── Roles: host (can edit everything), member (can opt in/out, pack)
│   │   └── Group roster: see who's confirmed, pending, declined
│   │
│   ├── /trip/[id]/itinerary        ← Step 3: Build Your Itinerary (the CORE of the app)
│   │   ├── Day-by-day timeline broken into time blocks
│   │   │   ├── Each day is a section (Day 1: Fri May 15, Day 2: Sat May 16, etc.)
│   │   │   ├── Time slots within each day (morning, afternoon, evening — or specific times)
│   │   │   └── Events placed into day + time slot
│   │   ├── Events (created by host or any member)
│   │   │   ├── Title, description, location
│   │   │   ├── Event type: travel, activity, dining, outdoors, nightlife, downtime, etc.
│   │   │   ├── Dress code: casual, smart casual, formal, outdoor/active, swimwear, etc.
│   │   │   ├── Detail fields: reservation number, confirmation codes, links, cost
│   │   │   ├── Who's in? → each person opts in or out of each event
│   │   │   │   ├── Default: everyone is opted in
│   │   │   │   ├── People can deselect events they don't want to do
│   │   │   │   └── This directly shapes their individual packing list
│   │   │   └── Host can mark events as "required" (everyone) vs "optional" (opt-in)
│   │   └── Add/edit/reorder/delete events
│   │
│   ├── /trip/[id]/notes            ← Ideas & Research (feeds into itinerary)
│   │   ├── List of individual notes (one idea per note)
│   │   │   ├── Example: "The Grey — upscale restaurant, Southern food, need reservation"
│   │   │   ├── Example: "Kayak tour of the marsh — $45/person, 2 hours"
│   │   │   ├── Example: "Forsyth Park — free, good for morning walk"
│   │   │   └── Each note: title, body text, optional link/photo, status (idea/finalized)
│   │   ├── Anyone in the group can add notes
│   │   ├── Finalize a note → converts it into an itinerary event
│   │   │   ├── Pre-fills event title from note title
│   │   │   ├── Prompts to add: day, time, dress code, reservation #, details
│   │   │   ├── Note is marked as "finalized" (linked to its event)
│   │   │   └── Unfinalized notes stay in the list as open ideas
│   │   └── Filter: all notes, open ideas only, finalized only
│   │
│   ├── /trip/[id]/packing          ← Step 4: Pack for Your Trip (driven BY itinerary)
│   │   ├── Per-person tabs (each person sees ONLY events they opted into)
│   │   ├── Event walk-through view (chronological)
│   │   │   ├── Shows: event name, weather forecast, dress code/vibe
│   │   │   ├── Pick/build outfit for this event
│   │   │   └── Flag any gear needed (umbrella, hiking boots, etc.)
│   │   ├── Consolidation view ("the bed spread")
│   │   │   ├── See ALL items laid out across all days
│   │   │   ├── Identify duplicates and multi-use items
│   │   │   ├── Pare down: remove or combine
│   │   │   └── Final packing checklist with packed/not-packed toggles
│   │   └── Packing is personalized — if you skipped the kayak trip,
│   │       you don't see "water shoes" in your packing flow
│   │
│   ├── /trip/[id]/meals            ← Meal Planning (existing feature, nested under trip)
│   │   ├── Linked to itinerary dining events
│   │   ├── Grocery list generation
│   │   └── Snacks & drinks
│   │
│   └── /trip/[id]/logistics        ← Travel Details
│       ├── Flights, car rentals, hotels, reservations
│       ├── Documents checklist (passports, confirmations, tickets)
│       └── Inventory/gear for trip type (camping gear, etc.)
│
├── /profile                        ← Your Profile & Family
│   ├── Family members
│   └── Account settings
│
└── /friends                        ← Friends & Collaboration
    ├── Friend list (search, add, remove)
    ├── Family groups (create/manage reusable family units)
    └── Incoming/outgoing friend requests
```

---

## What Changes From Current Structure

### REMOVED or DEMOTED
| Current Page | What Happens | Why |
|---|---|---|
| `/packing` (standalone) | **Removed as top-level.** Packing now lives INSIDE each trip at `/trip/[id]/packing` | Packing is always in context of a specific trip. There's no reason to pack outside of a trip. |
| `/gear` (standalone) | **Demoted.** Gear becomes part of `/trip/[id]/logistics` for trip-specific gear, or a lightweight reference library in profile | Gear is trip-contextual. Camping gear matters for a camping trip, not a city weekend. |
| Saved Suitcase Templates | **Removed.** | Your wife is right — clothes change between trips, especially for women. A "saved suitcase" assumes static wardrobes. Instead, each trip starts fresh with itinerary-driven packing. |
| Wardrobe System (persistent) | **Simplified or removed.** | A persistent wardrobe library assumes people maintain and update it. Most won't. Instead, let people build outfits per-event in the moment. If someone wants to save a favorite outfit, that's optional — not the default flow. |

### NEW
| Feature | Where It Lives | What It Does |
|---|---|---|
| **Group Management** | `/trip/[id]/group` | Invite friends/families to the trip. Add from app friends or send external invites. Manage roster — add late joiners, remove cancellations. |
| **Itinerary Builder** | `/trip/[id]/itinerary` | Day-by-day, time-slotted event timeline. The heart of the app. Hosts and members can add events. People opt in/out of individual events. |
| **Per-Event Opt-In** | Inside Itinerary events | Each person selects which events they're attending. Skipping the kayak trip? You won't see water shoes in your packing list. |
| **Notes → Events Pipeline** | `/trip/[id]/notes` | Individual notes (one idea per note). Research dinner spots, activities, etc. Finalize a note to convert it into a real itinerary event with all the details (reservation #, dress code, time). |
| **Event-Driven Packing** | `/trip/[id]/packing` | Instead of "what's in my suitcase?", it asks "what am I doing on Day 1 evening?" and helps you pick an outfit for THAT. Personalized per person based on their opted-in events. |
| **Weather Integration** | Trip Hub + Packing | Show weather forecast per day so outfit choices are informed. |
| **Consolidation View** | `/trip/[id]/packing` | The "lay it all on the bed" moment. See everything across all days, find duplicates, pare down. |
| **Logistics Hub** | `/trip/[id]/logistics` | Central place for flights, hotels, car rentals, documents, and trip-type gear. |

---

## The Natural User Flow (How Someone Uses This)

```
1. CREATE TRIP
   "We're going to Savannah with the Smiths, May 15-18"
   → Set destination, dates, trip type

2. INVITE YOUR GROUP
   "Let me add the Smiths — they're already on the app"
   "And my sister — she's not on the app yet, I'll send her an invite link"
   → Select from friends/families on the app
   → Send email/text invites to non-app users
   → Everyone shows up on the group roster as pending/accepted

3. RESEARCH & CAPTURE IDEAS (Notes)
   "Oh that restaurant Sarah mentioned — The Grey — let me save that"
   "Kayak tour of the marsh, $45/person"
   "Forsyth Park morning walk"
   → Each idea is its own note
   → Anyone in the group can add notes
   → This is the phone-notes-on-the-couch phase

4. BUILD ITINERARY (from notes + new events)
   "Okay let's lock in Friday"
   → Finalize "The Grey" note → becomes a Friday evening dining event
     → Add reservation number, dress code: smart casual
   → Add "Fly into SAV" as a Friday morning travel event
   → Add "Check into hotel" as Friday afternoon downtime
   "Saturday morning — let's do the walking tour"
   → Create event directly, or finalize from notes
   → Mark kayak tour as "optional" — not everyone wants to go
   → People opt in/out: Dave and Lisa skip the kayak, they'll hit the shops instead

5. PACK BY EVENT (this is the key insight)
   "Okay, Friday dinner at The Grey — smart casual, 78° — I need something nice but not too formal"
   → See: Event name, weather, dress code
   → Pick outfit for this event
   "Saturday walking tour — 82° and humid — comfortable shoes, sundress"
   → Next event, next outfit
   → Continue through all events
   → Dave doesn't see kayak gear in his packing — he opted out
   → Lisa does see kayak gear — she opted in

6. CONSOLIDATE (the "bed spread" moment)
   "Okay let me see everything laid out..."
   "I have 3 pairs of shoes — can I get away with 2?"
   "This top works for both the walking tour AND the casual lunch"
   → See all items across all days
   → Identify multi-use pieces
   → Remove duplicates
   → Final checklist

7. LAST-MINUTE CHANGES
   "The Johnsons want to come! Adding them to the group"
   → Add to group roster
   → They see the itinerary, opt into events, start packing
   "Actually Mike can't make it anymore"
   → Remove from group — his packing list cleans up automatically

8. GO!
   → Packed checklist with check-off
   → Documents and logistics at a glance
   → Everyone's on the same page
```

---

## Tab Bar (Bottom Navigation) — Simplified

| Tab | Route | Icon |
|---|---|---|
| Trips | `/dashboard` | 🧭 |
| Profile | `/profile` | 👤 |
| Friends | `/friends` | 👥 |

That's it. Three tabs. Everything else lives inside the trip. The trip hub becomes the command center with its own sub-navigation:

### Trip Sub-Navigation (inside `/trip/[id]`)
| Tab | Route | Purpose |
|---|---|---|
| Group | `/trip/[id]/group` | Who's going — invites, roster, roles |
| Notes | `/trip/[id]/notes` | Research & ideas — finalize into events |
| Itinerary | `/trip/[id]/itinerary` | The plan — day/time events, opt-in/out |
| Packing | `/trip/[id]/packing` | What to bring — driven by your events |
| Meals | `/trip/[id]/meals` | Food planning — groceries, snacks |
| Logistics | `/trip/[id]/logistics` | Travel details — flights, hotels, docs |

The sub-nav order follows the natural planning sequence: gather people → research ideas → lock in the plan → pack for it → handle food → sort logistics.

---

## How to Build This — Recommended Order

### Phase 1: Group & Invitation System
The first thing after creating a trip is inviting people. Build this before itinerary.

1. **Database:** Create `trip_members` table
   - `id`, `trip_id`, `user_id` (nullable — null for non-app invitees)
   - `family_member_id` (nullable — link to existing family member if applicable)
   - `name`, `email` (for external invites)
   - `role`: host, member
   - `status`: pending, accepted, declined
   - `invited_by` (user_id of who sent the invite)
   - `invite_token` (unique token for email/text invite links)
   - `created_at`, `updated_at`
2. **UI:** Build `/trip/[id]/group` page
   - Search & select from existing friends/families on the app
   - External invite flow (enter name + email/phone → generate invite link)
   - Group roster showing status (pending/accepted/declined)
   - Add more people, remove/cancel members
   - Host vs member role indicators

### Phase 2: Notes System (the research phase)
People capture ideas before they build the itinerary. Build this next.

3. **Database:** Create `trip_notes` table
   - `id`, `trip_id`, `created_by` (user_id)
   - `title` (e.g., "The Grey — upscale Southern restaurant")
   - `body` (free text — details, links, thoughts)
   - `link_url` (optional — website, Google Maps link, etc.)
   - `photo_url` (optional)
   - `status`: idea, finalized
   - `event_id` (nullable — populated when finalized into an itinerary event)
   - `sort_order`, `created_at`, `updated_at`
4. **UI:** Build `/trip/[id]/notes` page
   - List of individual notes (card-style)
   - Anyone in group can add notes
   - Filter: all / open ideas / finalized
   - "Finalize" button → converts note into itinerary event (Phase 3 integration)

### Phase 3: Itinerary System (the backbone)
The core of the app. Day-by-day, time-slotted event planning with per-person opt-in.

5. **Database:** Create `itinerary_events` table
   - `id`, `trip_id`, `created_by` (user_id)
   - `date` or `day_number`, `time_slot` (morning/afternoon/evening or specific time)
   - `start_time`, `end_time` (optional — for precise scheduling)
   - `title`, `description`, `location`
   - `event_type`: travel, activity, dining, outdoors, nightlife, downtime, shopping, etc.
   - `dress_code`: casual, smart_casual, formal, active, swimwear, etc.
   - `reservation_number` (optional)
   - `confirmation_code` (optional)
   - `cost_per_person` (optional)
   - `external_link` (optional — booking URL, map link, etc.)
   - `is_optional` (boolean — if true, people can opt out; if false, everyone attends)
   - `note_id` (nullable — link back to the note that spawned this event)
   - `sort_order`, `created_at`, `updated_at`
6. **Database:** Create `event_participants` table
   - `id`, `event_id`, `trip_member_id`
   - `status`: attending, skipping (default: attending)
   - This is what drives personalized packing lists
7. **UI:** Build `/trip/[id]/itinerary` page
   - Day-by-day accordion/timeline view with time slots
   - Add/edit/delete/reorder events
   - Event detail panel (reservation #, dress code, cost, link, etc.)
   - Per-event participant list with opt-in/opt-out toggles
   - Host can mark events as required vs optional
   - "Finalize from note" flow — pre-fills event from a note, prompts for day/time/details
8. **Integration:** Wire up Notes → Itinerary pipeline
   - Finalize button on a note opens event creation pre-filled
   - Finalized notes show link to their event
   - Event shows link back to its source note

### Phase 4: Event-Driven Packing
Replace the current suitcase-first system with itinerary-driven packing.

9. **Database:** Create `packing_items` table
   - `id`, `trip_id`, `trip_member_id`
   - `event_id` (nullable — linked to itinerary event, or null for general items)
   - `name`, `category` (clothing, shoes, toiletries, gear, documents, etc.)
   - `is_packed` (boolean)
   - `is_multi_use` (boolean — flagged during consolidation)
   - `photo_url` (optional)
10. **Database:** Create `packing_outfits` table
    - `id`, `trip_id`, `trip_member_id`, `event_id`
    - `name` (optional), `notes`
    - Links to packing_items via junction table `outfit_packing_items`
11. **UI:** Build `/trip/[id]/packing` with two views:
    - **Event Walk-Through:** Step through ONLY the events each person opted into
    - **Consolidation View:** Grid of ALL items, grouped by category, with duplicate detection
    - Per-person tabs

### Phase 5: Trip Hub & Logistics
12. **UI:** Redesign `/trip/[id]` as a true hub/dashboard
    - Trip countdown, weather widget, group quick-stats
    - Sub-navigation: Group | Notes | Itinerary | Packing | Meals | Logistics
13. **UI:** Build `/trip/[id]/logistics`
    - Travel bookings, document checklist, trip-type gear

### Phase 6: Cleanup
14. Remove standalone `/packing` page (fold into trip context)
15. Remove standalone `/gear` page (fold into logistics or profile reference)
16. Simplify tab bar to 3 tabs
17. Migrate existing trip data to new structure

---

## Database Changes Summary

### New Tables
- `trip_members` — who's on the trip (replaces trip_families as the primary people tracker)
- `trip_notes` — individual research notes/ideas with finalize-to-event pipeline
- `itinerary_events` — the backbone: day/time-slotted events with dress code, reservations, opt-in
- `event_participants` — who's attending which event (drives personalized packing)
- `packing_items` — replaces suitcase_items (event-linked, not suitcase-linked)
- `packing_outfits` — outfit per event per person
- `outfit_packing_items` — junction: which items in which outfit

### Tables to Deprecate (Phase 6)
- `suitcases` → no longer needed (packing is per-trip, not per-suitcase)
- `suitcase_items` → replaced by `packing_items`
- `suitcase_photos` → photos move to packing_items or outfits
- `wardrobe_items` → optional/removed (no persistent wardrobe assumption)
- `outfits` / `outfit_items` → replaced by `packing_outfits` / `outfit_packing_items`
- `trip_families` → replaced by `trip_members` (more flexible, supports individuals not just families)

### Tables That Stay
- `trips`, `user_profiles`, `families`, `family_members`
- `trip_data` (meals, snacks, drinks — still useful)
- `inventory_bins`, `inventory_items`, `trip_inventory` (still useful for camping/gear trips)
- `friend_links` (needed for the invite-from-friends flow)

### Key Relationships
```
trip
 └── trip_members (who's going)
 └── trip_notes (research & ideas)
      └── can finalize into → itinerary_events
 └── itinerary_events (what's happening, when)
      └── event_participants (who's doing what — per trip_member)
      └── packing_outfits (what to wear for this event)
           └── outfit_packing_items → packing_items
 └── packing_items (everything being packed, per person)
```
