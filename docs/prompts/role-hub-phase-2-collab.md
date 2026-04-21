# Role Hub Phase 2 — Real Collaboration Features

Phase 1 ships honest, static-data heros. This phase adds the three interactive features I speculated about in the first pass:

- **2A** — Nudge pending invites (send reminder email to invitees who haven't accepted)
- **2B** — Pending RSVP surface + nudge-per-event (host can see which events have pending RSVPs and ping those people)
- **2C** — @mentions in chat (parse `@name` at write time, filter unread for mentions-only users)

Run each sub-phase in a **new chat session**. They're independent — ship 2A, then 2B, then 2C. Each ends with the hero getting a new button that references the feature it just built (e.g., 2A adds a `Nudge pending →` button to the All In hero).

Meal claims are deliberately excluded — the meals tab is currently a stub ("Coming soon") with no table, so a claim feature is a whole new meals spec, not a phase-2 addon. Do that as its own full build later.

Reference:
- Phase 1 prompt: `docs/prompts/role-hub-hero-rebuild.md`
- Mockup: `mockups/role-hub-current-vs-target.html`
- Existing invite email plumbing: `/api/send-invite` (called from `app/trip/[id]/group/group-page.tsx` line ~52)

---

## Phase 2A — Nudge pending invites

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal

Hosts can resend an invite email to any `trip_members` row with `status = 'pending'`. The button lives in two places: on the Group page (per pending row) and on the All In hub hero as an aggregate "Nudge pending →" action. Rate-limited to once per 24h per invitee so the host doesn't accidentally spam.

### Why

Today the Group page shows a "Pending" chip on unaccepted invites but there's no way to follow up. Hosts either manually text people or forget. A one-tap resend is the minimum viable nudge.

### What to build

#### 1. Migration — track nudges

**Provide me the exact SQL to paste into Supabase SQL Editor:**

```sql
-- Migration: trip_member_nudges
-- Tracks reminder emails sent to pending invitees. Used to enforce a
-- 24-hour rate limit and to show "last nudged" on the Group page.
CREATE TABLE IF NOT EXISTS trip_member_nudges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_member_id   uuid        NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  sent_by          uuid        NOT NULL REFERENCES auth.users(id),
  sent_at          timestamptz NOT NULL DEFAULT now(),
  delivery_status  text        NOT NULL DEFAULT 'sent'
                                CHECK (delivery_status IN ('sent', 'failed')),
  error_message    text
);

CREATE INDEX IF NOT EXISTS idx_trip_member_nudges_member_recent
  ON trip_member_nudges(trip_member_id, sent_at DESC);

ALTER TABLE trip_member_nudges ENABLE ROW LEVEL SECURITY;

-- Hosts can SELECT + INSERT nudges for trips they own.
CREATE POLICY "Hosts can read nudges for their trips"
  ON trip_member_nudges FOR SELECT
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      JOIN trips t ON t.id = tm.trip_id
      WHERE t.owner_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can send nudges for their trips"
  ON trip_member_nudges FOR INSERT
  WITH CHECK (
    sent_by = auth.uid()
    AND trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      JOIN trips t ON t.id = tm.trip_id
      WHERE t.owner_id = auth.uid()
    )
  );
```

Update `types/database.types.ts` with the new table's Row + Insert.

#### 2. API route — `/api/nudge-invite`

Create `app/api/nudge-invite/route.ts`. Accepts `POST { trip_member_id: string }`. Logic:

1. Auth check — must be the trip host (look up `trips.owner_id`).
2. Load the target `trip_members` row. 400 if status !== 'pending' or no `invite_token` or no `email`.
3. Check rate limit — most recent `trip_member_nudges.sent_at` must be older than 24h. 429 otherwise with `{ error: "Already nudged recently", retryAfter: secondsUntilAvailable }`.
4. Reuse the email plumbing from `/api/send-invite`. Extract the email-body construction into `lib/invite-email.ts` so both routes share it. Subject for a nudge should differ: "Reminder: You're invited to {trip.name}" instead of the first-invite subject.
5. Insert a `trip_member_nudges` row regardless of success (set `delivery_status = 'failed'` + `error_message` if email fails).
6. Return 200 with `{ ok: true, sent_at }`.

#### 3. Group page button

In `app/trip/[id]/group/group-page.tsx`, on each pending member row, add a small "Nudge →" button (host-only). Clicking POSTs to `/api/nudge-invite`.

After a successful nudge, show a "Nudged {relative time}" label next to the pending chip until the page refreshes. Pull most-recent `trip_member_nudges.sent_at` for each member in the server-side fetch (same page.tsx) so the UI already knows who was nudged recently.

If the API returns 429, disable the button and show "Nudged {time}" with a tooltip "Wait 24h between nudges."

#### 4. All In hero button

In `role-hero.tsx` `RoleHeroAllIn`, add a real `Nudge pending →` button to the hero button row when:

- `heroData.pendingInviteCount > 0` (new field — extend `RoleHeroData` in `page.tsx` to count `trip_members` where status = 'pending')
- Current user is host

Tapping it routes to `/trip/[id]/group?filter=pending` (extend the Group page to support `?filter=pending` — scroll to and highlight pending rows).

Update the All In hero meta copy to include "`· {pendingInviteCount} not yet in`" when > 0.

#### 5. Activity log

Every successful nudge writes a `trip_activity` row with `action: 'nudged'`, `entity_type: 'invite'`, `entity_name: nudgedMemberName`. This gives hosts an audit trail on the dashboard.

### Files to create

- `supabase/migrations/20260420_member_nudges.sql`
- `app/api/nudge-invite/route.ts`
- `lib/invite-email.ts`

### Files to modify

- `types/database.types.ts` — add `trip_member_nudges` + extend `RoleHeroData` if defined centrally
- `app/trip/[id]/group/page.tsx` — fetch most-recent nudge per member
- `app/trip/[id]/group/group-page.tsx` — nudge button + "Nudged X ago" label + `?filter=pending` scroll behavior
- `app/trip/[id]/page.tsx` — add `pendingInviteCount` to `RoleHeroData`
- `app/trip/[id]/role-hero.tsx` — enable `Nudge pending →` button for All In hosts
- `app/api/send-invite/route.ts` — refactor to use the extracted `lib/invite-email.ts`

### Edge cases

- **Invitee already on the app (has `user_id` set) but still status='pending'** — send to their account email from `user_profiles.email`, not the original invite email.
- **Invite token expired** — send-invite plumbing may regenerate. If it doesn't, reject with 400 and surface "Invite link is stale. Remove and re-invite" — don't silently send a broken link.
- **Host nudges themselves** — can't happen since hosts are auto-accepted, but defensive: reject with 400 if `trip_member.role === 'host'`.

### When finished

```bash
git add supabase/migrations/20260420_member_nudges.sql \
        app/api/nudge-invite/route.ts \
        app/api/send-invite/route.ts \
        lib/invite-email.ts \
        types/database.types.ts \
        app/trip/[id]/group/page.tsx \
        app/trip/[id]/group/group-page.tsx \
        app/trip/[id]/page.tsx \
        app/trip/[id]/role-hero.tsx
git commit -m "Phase 2A: nudge pending invites (24h rate-limited email reminders)"
git push origin main
```

---

## Phase 2B — Pending RSVP surface

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal

Hosts can see — at a glance — which itinerary events still have pending RSVPs, and nudge those members individually. The All In hero picks up a "`{X} events waiting on RSVPs`" line and an inline button that jumps to the first event with pendings. The itinerary event detail view grows a "`{N} pending · Nudge →`" chip.

### Why

Event-level RSVPs exist (`event_participants.status`) but aren't surfaced anywhere the host can act on them. The host has no idea who hasn't RSVP'd to what without opening each event individually. This makes running the schedule a guessing game.

### What to build

#### 1. Server query — pending RSVP aggregates

In `app/trip/[id]/page.tsx`, add a query that groups `event_participants` by event_id where status = 'pending', joined back to `itinerary_events` so we can pass `{ eventId, eventTitle, date, pendingCount, pendingMembers: [{ id, name }] }[]` into `TripPage`. Call this `pendingRsvps`.

Also compute `pendingRsvpEventCount = pendingRsvps.length` for the hero line.

#### 2. All In hero update

In `RoleHeroAllIn`, when `pendingRsvpEventCount > 0` AND the viewer is host:

- Add "`· {pendingRsvpEventCount} event${s} waiting on RSVPs`" to the hero meta line.
- Add a new button `Chase RSVPs →` that routes to `/trip/[id]/itinerary?filter=pending-rsvps` — the itinerary page scrolls to the first event with pendings.

Extend `RoleHeroData` with `pendingRsvpEventCount: number` and pass `pendingRsvps` separately to `TripPage` (the hero only needs the count, but the itinerary page reads the full list).

#### 3. Itinerary event "pending" chip

In `app/trip/[id]/itinerary/itinerary-page.tsx`, each event card that has pending RSVPs shows a chip: `{N} pending`. Tapping expands a mini-roster of the pending members with per-row `Nudge →` buttons.

The per-member Nudge button POSTs to a new `/api/nudge-rsvp` route:

```
POST /api/nudge-rsvp
Body: { trip_member_id: string, event_id: string }
```

Reuse the email extraction from Phase 2A (`lib/invite-email.ts`). Subject: "Hey — can you RSVP to {event.title}?" with a link back to `/trip/{id}/itinerary?event={event_id}`.

Log nudges to `trip_member_nudges` (reuse the table from 2A) with a new column: add `event_id uuid REFERENCES itinerary_events(id)`. Pending-invite nudges from 2A leave `event_id` null; RSVP nudges set it. Same 24h rate-limit applies per `(trip_member_id, event_id)` pair (so the same person can be nudged for 3 different events in the same day, but not the same event twice).

**Migration — extend trip_member_nudges:**

```sql
ALTER TABLE trip_member_nudges
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES itinerary_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trip_member_nudges_event_recent
  ON trip_member_nudges(trip_member_id, event_id, sent_at DESC);
```

#### 4. Itinerary `?filter=pending-rsvps` behavior

When this query param is set, the itinerary page:
- Expands all events that have pendings
- Collapses all events that don't
- Scrolls to the first expanded event
- Shows a banner at the top: "Showing {N} events waiting on RSVPs · Clear filter"

### Files to create

- `supabase/migrations/20260421_rsvp_nudges.sql`
- `app/api/nudge-rsvp/route.ts`

### Files to modify

- `types/database.types.ts` — add `event_id` to `trip_member_nudges`
- `app/trip/[id]/page.tsx` — pendingRsvps query + heroData field
- `app/trip/[id]/trip-page.tsx` — pass `pendingRsvps` to child
- `app/trip/[id]/role-hero.tsx` — `Chase RSVPs →` button + meta copy
- `app/trip/[id]/itinerary/page.tsx` — include `event_participants` data
- `app/trip/[id]/itinerary/itinerary-page.tsx` — pending chip + expand-on-tap + filter handling
- `lib/invite-email.ts` — add `buildRsvpNudgeEmail` alongside the existing invite builder

### Files NOT to modify

- Phase 2A files stay as-is (don't regress the invite nudge)

### When finished

```bash
git add supabase/migrations/20260421_rsvp_nudges.sql \
        app/api/nudge-rsvp/route.ts \
        types/database.types.ts \
        app/trip/[id]/page.tsx \
        app/trip/[id]/trip-page.tsx \
        app/trip/[id]/role-hero.tsx \
        app/trip/[id]/itinerary/page.tsx \
        app/trip/[id]/itinerary/itinerary-page.tsx \
        lib/invite-email.ts
git commit -m "Phase 2B: pending RSVP surface + per-event nudges"
git push origin main
```

---

## Phase 2C — @mentions in chat

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal

Parse `@name` tokens at message write time, store the mentioned member ids on the row, and use that column to (a) accurately count mention-only unread badges and (b) surface a "@mentions you" preview card on the Helping Out and Just Here hub heros.

### Why

Phase 1 shows "latest chat message" to Helping Out / Just Here users regardless of whether it tags them — which is fine but generic. The `chat_notification_level = 'mentions'` default for Just Here also over-counts today (any unread counts as a mention because we fall back to message-level filtering). Real mention storage fixes both.

### What to build

#### 1. Migration — add mentions column

**Provide me the exact SQL to paste into Supabase SQL Editor:**

```sql
-- Migration: store parsed @mentions on chat messages
-- mentioned_member_ids: array of trip_members.id referenced by @name in the body.
-- Parsed client-side at insert time (see chat-page.tsx). Empty array if none.
ALTER TABLE trip_messages
  ADD COLUMN IF NOT EXISTS mentioned_member_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_trip_messages_mentions
  ON trip_messages USING GIN (mentioned_member_ids);
```

Update `types/database.types.ts` — add `mentioned_member_ids: string[]` to `trip_messages` Row and `mentioned_member_ids?: string[]` to Insert.

#### 2. Mention parser

Create `lib/parse-mentions.ts`:

```ts
import type { TripMember } from "@/types/database.types";

/**
 * Parse @mentions from a chat body against the trip roster.
 * Greedy-matches longest name first so "@Sarah Jones" wins over "@Sarah".
 * Case-insensitive. Returns unique trip_member_ids in document order.
 *
 * Examples:
 *   "@Dan can you grab ice" → [dan's id]
 *   "@Sarah Jones and @Dan" → [sarah's id, dan's id]
 *   "email me at foo@bar.com" → []   (no roster match)
 */
export function parseMentions(body: string, roster: Pick<TripMember, "id" | "name">[]): string[] {
  // sort roster by name-length desc so longer names match first
  const sorted = [...roster].sort((a, b) => b.name.length - a.name.length);
  const hits = new Set<string>();
  const order: string[] = [];
  const lower = body.toLowerCase();

  for (const m of sorted) {
    const needle = "@" + m.name.toLowerCase();
    let i = 0;
    while ((i = lower.indexOf(needle, i)) !== -1) {
      // Require a word boundary after the name so "@Dan" doesn't match "@Daniel"
      const after = lower[i + needle.length];
      if (!after || /[^a-z0-9_]/.test(after)) {
        if (!hits.has(m.id)) { hits.add(m.id); order.push(m.id); }
      }
      i += needle.length;
    }
  }
  return order;
}
```

#### 3. Parse on send

In `app/trip/[id]/chat/chat-page.tsx`, when sending a message:

- Before the insert, call `parseMentions(body, members)`
- Include `mentioned_member_ids` in the insert payload

Do this on the client — we already have the member list loaded for display. Server parsing would require an extra round-trip.

#### 4. Unread badge uses mentions column

In the chat-unread helper (`useTripChatUnread` + server equivalent from Phase 1), when `chat_notification_level === 'mentions'`:

- Count only rows where `auth.uid()`'s `trip_members.id` is in `mentioned_member_ids`

The SQL becomes a `WHERE mentioned_member_ids @> ARRAY[viewerMemberId]::uuid[]` filter. Update both the client hook and the server function.

#### 5. Hero: `@mentioned you` preview

In `role-hero.tsx`, extend the Phase 1 "latest message" MiniSection for Helping Out and Just Here:

- If the latest message (regardless of who sent it) has `mentioned_member_ids` containing the viewer's `trip_members.id`, replace the "💬 Latest" section with "💬 {authorName} mentioned you"
- Otherwise keep the generic "Latest" section

Extend `RoleHeroData.latestMessage` to include `mentionsViewer: boolean`. Set it server-side in `page.tsx` when building `heroData`.

#### 6. Visual treatment in the chat stream

When rendering messages in `chat-page.tsx`, if a message's `mentioned_member_ids` contains the viewer's member id, add a subtle left-border accent (4px solid theme accent) to make mentions scannable on scroll-back. This is a low-effort polish but closes the loop on "mentions matter here."

### Files to create

- `supabase/migrations/20260422_chat_mentions.sql`
- `lib/parse-mentions.ts`

### Files to modify

- `types/database.types.ts` — add `mentioned_member_ids`
- `app/trip/[id]/chat/chat-page.tsx` — parse + insert + scroll highlight
- `lib/use-trip-chat-unread.ts` — use mentions filter
- `lib/chat-unread.ts` (from Phase 1) — same filter server-side
- `app/trip/[id]/page.tsx` — compute `mentionsViewer` on `latestMessage`
- `app/trip/[id]/role-hero.tsx` — swap copy when mention matches

### Edge cases

- **Viewer not in the trip roster** — shouldn't happen (they'd be redirected), but defensive: return empty mentions.
- **Message edited later to add/remove a mention** — we don't support message editing today. If added later, re-parse on update.
- **Name collisions** — two members named "Sarah" both get tagged when someone writes `@Sarah`. This is fine for v1; future work could add disambiguation UI.
- **Case: `@` followed by trailing punctuation** — `"@Dan."` should match Dan. The word-boundary regex above allows this.

### When finished

```bash
git add supabase/migrations/20260422_chat_mentions.sql \
        lib/parse-mentions.ts \
        types/database.types.ts \
        app/trip/[id]/chat/chat-page.tsx \
        lib/use-trip-chat-unread.ts \
        lib/chat-unread.ts \
        app/trip/[id]/page.tsx \
        app/trip/[id]/role-hero.tsx
git commit -m "Phase 2C: @mentions parsing + mention-only unread + hero preview"
git push origin main
```

---

## Post-Phase-2 state

After all three sub-phases ship:

- 🔥 **All In** — hero shows `Settle up`, `Open Itinerary`, `Nudge pending` (2A), `Chase RSVPs` (2B) buttons
- 🙌 **Helping Out** — `@mentioned you` preview replaces generic Latest when viewer is tagged (2C)
- 🎟️ **Just Here** — same mention-aware preview; mention-only chat badge is now accurate (2C)
- ✌️ **Vibes Only** — unchanged (still muted); mention column exists but doesn't surface

Meal claims remain deliberately unbuilt — that's its own future build, not a tack-on.
