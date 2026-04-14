# Trip Planner Pro — Build Rules

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Tech Stack
- **Framework:** Next.js 14 (App Router) with React 18, TypeScript
- **Auth & Database:** Supabase (PostgreSQL with Row-Level Security)
- **Styling:** Inline CSS (no CSS framework — maintain existing pattern)
- **State:** React hooks + Supabase client (no external state library)
- **Pattern:** Server component (data fetch) → Client component (UI + interactivity)

## Architecture Rules
1. **Server/Client split:** Every page has a `page.tsx` (server, fetches data) and a `*-page.tsx` (client, renders UI). Follow this pattern exactly.
2. **Supabase client:** Use `createClient` from `@/lib/supabase/server` in server components, `createClient` from `@/lib/supabase/client` in client components. Never mix them.
3. **Types:** All database types live in `types/database.types.ts`. Update this file when adding new tables.
4. **Constants:** Trip types, themes, categories live in `lib/constants.ts`. Add new constants here, not inline.
5. **Styling:** Use inline styles consistent with existing components. Glass-morphism cards, theme accent colors per trip type. Do not introduce Tailwind or CSS modules.
6. **No unnecessary abstraction:** Don't create wrapper components or utility layers unless there's a clear reuse case. Keep it flat and readable.

## Current Architecture: Itinerary-First
The app follows an "itinerary-first" philosophy. See `docs/page-hierarchy-v2.md` for the full plan.

### Core Flow
```
Create Trip → Invite Group → Research Notes → Build Itinerary → Pack by Event → Consolidate → Go
```

### Page Structure
```
/dashboard                        ← Home
/trip/[id]                        ← Trip Hub
/trip/[id]/group                  ← Step 2: Invite & manage people
/trip/[id]/notes                  ← Step 3: Research ideas, finalize → events
/trip/[id]/itinerary              ← Step 4: Day/time events, opt-in/out
/trip/[id]/packing                ← Step 5: Event-driven packing, consolidation
/trip/[id]/meals                  ← Meal planning
/trip/[id]/logistics              ← Flights, hotels, docs, gear
/profile                          ← User & family management
/friends                          ← Friend connections
```

### Key Database Tables (new system)
- `trip_members` — who's on the trip (role: host/member, status: pending/accepted/declined)
- `trip_notes` — research ideas, each can finalize into an itinerary event
- `itinerary_events` — day/time-slotted events with dress code, reservations, opt-in
- `event_participants` — who's attending which event (drives personalized packing)
- `packing_items` — event-linked packing items per person
- `packing_outfits` — outfit per event per person

### Sub-Navigation Order (inside trip)
Itinerary → Expenses → Packing → Notes → Meals → Group

## Build Guide
Follow `docs/build-guide.md` for the phased build prompts. Complete each phase in a NEW chat session. Do not skip phases or combine them.

## What NOT to Do
- Do not create standalone packing pages outside of a trip context
- Do not build persistent wardrobe/suitcase systems (deprecated concept)
- Do not add new top-level tabs beyond Trips, Profile, Friends
- Do not use external state management libraries
- Do not introduce CSS frameworks or change the styling approach
- Do not guess at database schema — refer to `docs/page-hierarchy-v2.md` for table definitions
