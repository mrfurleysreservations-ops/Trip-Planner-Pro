-- Migration: In-trip chat feature
--   * trip_messages    — text chat bound to a trip (author must be an auth.users)
--   * trip_message_reads — per-user last-read timestamp for unread counts
--
-- Design decisions (see docs / memory project_chat_feature_spec):
--   * Text only, 1–4000 chars, no edits, soft delete via deleted_at.
--   * RLS: trip owner OR accepted trip_member (mirrors the family-member RLS
--     gotcha — tables keyed by trip need an OR trip-owner clause so the host
--     can still act even when they're not in trip_members).
--   * Realtime is enabled on trip_messages only — reads table doesn't need it.

-- ─── trip_messages ────────────────────────────────────────────
create table if not exists public.trip_messages (
  id         uuid         primary key default gen_random_uuid(),
  trip_id    uuid         not null references public.trips(id)   on delete cascade,
  sender_id  uuid         not null references auth.users(id)     on delete cascade,
  content    text         not null check (char_length(content) between 1 and 4000),
  created_at timestamptz  not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_trip_messages_trip_created
  on public.trip_messages (trip_id, created_at desc);

-- ─── trip_message_reads ───────────────────────────────────────
create table if not exists public.trip_message_reads (
  trip_id      uuid        not null references public.trips(id)     on delete cascade,
  user_id      uuid        not null references auth.users(id)       on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ─── RLS ──────────────────────────────────────────────────────
alter table public.trip_messages      enable row level security;
alter table public.trip_message_reads enable row level security;

-- trip_messages: SELECT — accepted trip members OR trip owner
create policy trip_messages_select on public.trip_messages for select using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_messages.trip_id
      and tm.user_id = auth.uid()
      and tm.status  = 'accepted'
  )
  or exists (
    select 1 from public.trips t
    where t.id = trip_messages.trip_id
      and t.owner_id = auth.uid()
  )
);

-- trip_messages: INSERT — sender must be caller, and caller must be
-- an accepted member or the trip owner.
create policy trip_messages_insert on public.trip_messages for insert with check (
  sender_id = auth.uid()
  and (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_messages.trip_id
        and tm.user_id = auth.uid()
        and tm.status  = 'accepted'
    )
    or exists (
      select 1 from public.trips t
      where t.id = trip_messages.trip_id
        and t.owner_id = auth.uid()
    )
  )
);

-- trip_messages: UPDATE — only your own messages (soft delete path).
create policy trip_messages_update_own on public.trip_messages for update using (
  sender_id = auth.uid()
) with check (
  sender_id = auth.uid()
);

-- trip_message_reads: user can read/write only their own row.
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

-- ─── Realtime publication ─────────────────────────────────────
-- Wrapped in a DO block so re-running the migration is idempotent.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_messages'
  ) then
    alter publication supabase_realtime add table public.trip_messages;
  end if;
end $$;
