# Build: In-Trip Chat Feature

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## What this phase builds
A chat feature that lives in two places and shares no abstraction (per the "no unnecessary abstraction" rule — the two views have different UIs):

1. **Dashboard-level index** at `/chats` — a list of every trip the user is a member of, with last-message preview, timestamp, unread badge. Replaces the Packing tab in the top `TabBar`.
2. **In-trip chat tab** at `/trip/[id]/chat` — the actual message thread. Added to `TripSubNav` right after Expenses. Follows `docs/tab-layout-standard.md` exactly.

---

## Finalized design decisions — do NOT re-ask

- **Participants:** Only users with an `auth.users` row participate. Family-linked members without their own account (e.g. young kids) appear in itinerary/packing but NOT in chat — they have no identity to post as. Adults with accounts (e.g. host's spouse) chat as themselves.
- **Scope (v1):** Text-only. Messages 1–4000 chars. No attachments, no images, no link previews, no reactions, no @mentions.
- **Edit/delete:** Delete own message only (soft-delete → bubble shows "Message deleted" placeholder, italic, dashed border). No edit.
- **Realtime:** Supabase realtime subscription on `trip_messages` filtered by `trip_id`, scoped to the open thread view only. `/chats` index refetches on window focus — no realtime there.
- **Unread:** `trip_message_reads` stores `last_read_at` per (trip_id, user_id). Unread count = `count(*) where created_at > last_read_at`. Update `last_read_at` when user opens `/trip/[id]/chat` and again when new realtime messages arrive while the view is focused.
- **Nav placement:**
  - Dashboard top nav (`TabBar`): `Trips → Chats → Gear → Friends → Profile → Alerts`. Chats takes Packing's slot.
  - Trip sub-nav (`TripSubNav`): `Itinerary → Expenses → Chat → Packing → Notes → Meals → Group`. Chat slots after Expenses.

---

## Step 1 — Migration (copy-paste this into Supabase SQL Editor)

```sql
-- trip_messages: text chat bound to a trip
create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_trip_messages_trip_created
  on public.trip_messages (trip_id, created_at desc);

-- trip_message_reads: per-user last-read timestamp, for unread counts
create table if not exists public.trip_message_reads (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- RLS
alter table public.trip_messages enable row level security;
alter table public.trip_message_reads enable row level security;

-- Read: you can read messages in trips where you're an accepted member OR the owner.
create policy trip_messages_select on public.trip_messages for select using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_messages.trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'accepted'
  )
  or exists (
    select 1 from public.trips t
    where t.id = trip_messages.trip_id and t.owner_id = auth.uid()
  )
);

-- Insert: you can post if you're an accepted member or the owner, and sender_id must be you.
create policy trip_messages_insert on public.trip_messages for insert with check (
  sender_id = auth.uid()
  and (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_messages.trip_id
        and tm.user_id = auth.uid()
        and tm.status = 'accepted'
    )
    or exists (
      select 1 from public.trips t
      where t.id = trip_messages.trip_id and t.owner_id = auth.uid()
    )
  )
);

-- Update: only for soft-deleting your own message (setting deleted_at).
create policy trip_messages_update_own on public.trip_messages for update using (
  sender_id = auth.uid()
) with check (
  sender_id = auth.uid()
);

-- trip_message_reads: you can read/write only your own row.
create policy trip_message_reads_select on public.trip_message_reads for select using (
  user_id = auth.uid()
);
create policy trip_message_reads_upsert on public.trip_message_reads for insert with check (
  user_id = auth.uid()
);
create policy trip_message_reads_update on public.trip_message_reads for update using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- Enable realtime on trip_messages (not trip_message_reads — no need)
alter publication supabase_realtime add table public.trip_messages;
```

After running, verify in Supabase Dashboard → Database → Replication that `trip_messages` is in the `supabase_realtime` publication.

---

## Step 2 — Types (`types/database.types.ts`)

Add these two interfaces alongside the existing ones. Do not invent shapes — match the columns above exactly.

```ts
export interface TripMessage {
  id: string;
  trip_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

export interface TripMessageRead {
  trip_id: string;
  user_id: string;
  last_read_at: string;
}
```

---

## Step 3 — Nav swaps

**`app/components/tab-bar.tsx`** — replace the Packing entry with Chats:

```ts
{ key: "chats", icon: "💬", label: "Chats", path: "/chats" },
```

Keep the badge system. Pass an unread sum as `badges.chats` from AppShell if you want a red dot on the top nav (optional for v1 — OK to skip and add later).

**`app/trip/[id]/trip-sub-nav.tsx`** — insert the Chat tab after Expenses:

```ts
const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅", segment: "itinerary" },
  { key: "expenses", label: "Expenses", icon: "💰", segment: "expenses" },
  { key: "chat", label: "Chat", icon: "💬", segment: "chat" },
  { key: "packing", label: "Packing", icon: "🧳", segment: "packing" },
  { key: "notes", label: "Notes", icon: "📝", segment: "notes" },
  { key: "meals", label: "Meals", icon: "🍽️", segment: "meals" },
  { key: "group", label: "Group", icon: "👥", segment: "group" },
];
```

The sub-nav is now 7 tabs — confirm labels don't wrap on a 360px viewport before moving on.

---

## Step 4 — New page: `/trip/[id]/chat`

Files:
- `app/trip/[id]/chat/page.tsx` (server component — fetches trip, members, last 50 messages, bumps `last_read_at`)
- `app/trip/[id]/chat/chat-page.tsx` (client component — renders, subscribes to realtime, handles composer + delete)

**Follow `docs/tab-layout-standard.md` exactly.** Structure:

- Outer wrapper: `minHeight: "100vh"`, `background: th.bg`, `paddingBottom: 56` (clears sub-nav).
- Sticky top region (Row 1 ONLY — no pill, no chips):
  - Back button (40×40 circular, accent-tinted, `router.push(`/trip/${trip.id}`)` — never `router.back()`).
  - Title "Chat" in Outfit 20/800.
  - Header actions slot: member-avatar stack + member count (auth-user members only).
- Scrollable body: day dividers ("Today", "Yesterday", "Wednesday, April 15") + message bubbles grouped by sender. Mine = right-aligned, `th.accent` bg, white text. Others = left-aligned, white bg, `.card-glass` border style. Soft-deleted bubbles: transparent bg, dashed border, italic "Message deleted".
- **Composer** (chat-specific — not in the standard): absolutely positioned `bottom: 56px` (above sub-nav), full-width, rounded input + circular accent send button. Body `paddingBottom` should be ~120 (composer ~60 + sub-nav 56) so the last message isn't hidden.
- No FAB — the composer is the add action.
- `<TripSubNav tripId={trip.id} theme={th} active="chat" />` as last child.

**Behavior:**
- On mount: upsert `trip_message_reads` with `last_read_at = now()` for (trip_id, user_id).
- Subscribe to `trip_messages` inserts + updates filtered by `trip_id`. On new insert, append to state. On update (soft delete), patch the bubble.
- Auto-scroll to bottom on mount and on new own message. Do NOT auto-scroll if user has scrolled up — detect scroll position first.
- Delete UX: tap your own bubble to reveal a small "Delete" action beneath it. Confirm with a simple `confirm()` or a tiny inline "Delete?/Cancel". Soft delete = `update trip_messages set deleted_at = now() where id = X and sender_id = auth.uid()`.
- Member stack: query `trip_members` joined to `user_profiles` for accepted rows where `user_id is not null`. Family-linked rows without a `user_id` are filtered out.
- Empty state: centered "No messages yet. Say hi 👋" when `trip_messages` is empty.

---

## Step 5 — New page: `/chats`

Files:
- `app/chats/page.tsx` (server — fetches all trips where user is accepted member or owner, plus latest message + unread count per trip)
- `app/chats/chats-page.tsx` (client — renders the list, refetches on window focus)

**Layout:**
- Same outer shell as `/dashboard` (title bar + TabBar come from `AppShell` automatically).
- Page title "Chats" in Outfit 22/800 with a small muted "All your trip conversations in one place" subtitle.
- Section labels: "Active" (has messages in last 7 days) / "Other Trips" (no recent activity). Skip sections if you want — just sort by most-recent-message first, trips with no messages at the bottom with "No messages yet — start the conversation" CTA.
- Each row: `.card-glass` with `borderLeft: 4px solid theme.accent` based on `trip.trip_type` (match the existing `TripCard` pattern on `/dashboard`).
- Row contents:
  - Trip icon + name (same pattern as dashboard trip cards).
  - Last message preview: `"{sender_name}: {content}"` truncated with ellipsis. Sender = "You" if it's the current user. If the latest message is soft-deleted, show "_Message deleted_" italic muted.
  - Trip type badge + date range (same pattern as `TripCard`).
  - Right side: relative timestamp ("2m ago", "1h ago", "Yesterday", "Mar 12") + red unread pill if count > 0.
- Clicking a card navigates to `/trip/[id]/chat`.

**Behavior:**
- Refetch on window focus (`window.addEventListener("focus", ...)`). No realtime on this page.
- Query shape: one round trip fetches trips; a second query fetches the latest message per trip (use a lateral join or a view if needed — do whatever is cleanest, just don't N+1 it).

---

## Step 6 — Acceptance checklist

Before you consider this done:

- [ ] Migration ran cleanly in Supabase; RLS policies visible in Dashboard.
- [ ] `trip_messages` appears in `supabase_realtime` publication.
- [ ] Posting as a non-member returns 403 (RLS works).
- [ ] Owner can post even if they're not in `trip_members` (trip-owner OR clause works — same gotcha as the family-member RLS memory).
- [ ] TabBar shows Chats where Packing used to be; no visual regressions on other tabs.
- [ ] TripSubNav shows 7 tabs with Chat third; labels don't wrap at 360px.
- [ ] `/trip/[id]/chat` passes the tab-layout-standard per-tab checklist in `docs/tab-layout-standard.md` (single sticky region, back btn goes to trip hub, 56px bottom padding on outer).
- [ ] Composer stays docked above the sub-nav; body scrolls underneath.
- [ ] Realtime: open two browser tabs, post in one, see it appear in the other within a second.
- [ ] Delete your own message → becomes "Message deleted" placeholder; other users see the same update live.
- [ ] Family-linked member without auth account (e.g. a kid) does NOT appear in the member stack or as a possible sender.
- [ ] `/chats` lists every trip you're in; unread counts accurate; sorted newest-first.
- [ ] Window focus on `/chats` triggers a refetch.
- [ ] `last_read_at` is updated when you open a thread — confirmed by the unread count going to 0.

---

## Reference
- Memory file: `project_chat_feature_spec.md` (in auto-memory) has the design summary.
- Tab layout standard: `docs/tab-layout-standard.md`.
- Related rules in MEMORY.md: family-member RLS gotcha, push-to-main (skip branches/PRs), always provide copy-paste SQL.

Push straight to main when done — this is Joe's solo hobby project, no PR required.
