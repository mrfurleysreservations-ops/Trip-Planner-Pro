// Chat unread bookkeeping — level-aware.
//
// All unread counters in the app funnel through here so that
// `trip_members.chat_notification_level` is honored consistently:
//
//   'muted'     → 0 unread, gray dot on the chat tab
//   'mentions'  → only @mentions of the viewer count as unread
//   'all'       → every message from someone else counts (legacy behavior)
//
// v1 mention detection: parse `@name` tokens out of the message body and
// match against the viewer's `trip_members.name`. No dedicated mentions
// column yet — when we add one later, only `matchesMention` needs to
// change. Keeping the logic pure + synchronous makes it easy to reuse
// across server pages (chats, dashboard) and client views (sub-nav hook).

import type { TripMessage } from "@/types/database.types";

export type ChatNotificationLevel = "all" | "mentions" | "muted";

/** Normalize arbitrary string input from the DB into one of the known levels. */
export function normalizeChatLevel(level: string | null | undefined): ChatNotificationLevel {
  if (level === "muted" || level === "mentions" || level === "all") return level;
  return "all";
}

/**
 * Returns true if the message body tags the viewer via an `@name` token.
 *
 * Matching is case-insensitive, spaces in the name are collapsed (so
 * "@JaneDoe" matches "Jane Doe"), and the match must end at a non-word
 * boundary so `@jane` doesn't accidentally match `@janet`.
 */
export function matchesMention(message: TripMessage, viewerName: string | null | undefined): boolean {
  if (!viewerName) return false;
  const trimmed = viewerName.trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/\s+/g, "").toLowerCase();
  if (!normalized) return false;

  const body = (message.content || "").toLowerCase();
  if (!body.includes("@")) return false;

  // Walk each `@token` in the body — a token is `@` followed by word chars
  // (letters, digits, underscore). Compare the contiguous alphanumeric
  // prefix against the collapsed viewer name. Any prefix up to the length
  // of the viewer's name that matches counts as a tag.
  const regex = /@([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    const token = m[1].toLowerCase();
    if (token === normalized) return true;
  }
  return false;
}

export interface UnreadInputs {
  /** Messages that are newer than last_read_at, from senders other than the viewer. */
  unreadMessages: TripMessage[];
  level: ChatNotificationLevel;
  viewerName: string | null | undefined;
}

/**
 * Apply the viewer's notification-level filter to an already-narrowed list
 * of unread messages. Callers are expected to have excluded the viewer's
 * own sends and messages at-or-before `last_read_at` upstream.
 */
export function filterUnreadByLevel({ unreadMessages, level, viewerName }: UnreadInputs): TripMessage[] {
  if (level === "muted") return [];
  if (level === "mentions") {
    return unreadMessages.filter((m) => matchesMention(m, viewerName));
  }
  return unreadMessages;
}

export function countUnreadByLevel(inputs: UnreadInputs): number {
  return filterUnreadByLevel(inputs).length;
}

// ─── Shared fetcher ─────────────────────────────────────────────
//
// Pure async function that encapsulates the query sequence previously
// inlined in `useTripChatUnread`: resolve the viewer's member row for name
// + notification level, look up their read marker, pull unread messages,
// apply the level filter. Works on both the server Supabase client and the
// browser client because it only uses the `.from()` / `.select()` surface.
//
// The hook still owns realtime subscriptions + focus handling; this helper
// just centralizes the one-shot read path so the trip hub server page can
// get an unread badge + level without duplicating query logic.
//
// Returns { count, level } — the same shape exposed by the hook's state.

export interface ChatUnreadState {
  count: number;
  level: ChatNotificationLevel;
}

// Intentionally structural: both `@supabase/supabase-js` browser and server
// clients implement the `.from(...).select(...)` surface we use here, but
// their Database generics differ. Typing against the intersection keeps
// this helper reusable from either side without a cast dance.
interface MinimalSupabase {
  from: (table: string) => any;
}

export async function fetchUnreadChatState(
  supabase: MinimalSupabase,
  tripId: string,
  userId: string,
): Promise<ChatUnreadState> {
  const { data: memberRow } = await supabase
    .from("trip_members")
    .select("name, chat_notification_level")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  // Trip owner without a member row — fall back to the user profile name.
  // Mirrors the hook's fallback path so counts match across tabs/devices.
  if (!memberRow) {
    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: readRow } = await supabase
      .from("trip_message_reads")
      .select("last_read_at")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle();
    const lastRead = readRow?.last_read_at ?? null;

    let q = supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", tripId)
      .is("deleted_at", null)
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (lastRead) q = q.gt("created_at", lastRead);
    const { data: msgs } = await q;

    const count = countUnreadByLevel({
      unreadMessages: (msgs ?? []) as TripMessage[],
      level: "all",
      viewerName: profileRow?.full_name ?? null,
    });
    return { count, level: "all" };
  }

  const level = normalizeChatLevel(memberRow.chat_notification_level);

  // Muted viewers short-circuit — no count query needed, the badge is a
  // dot-only indicator that never displays a number.
  if (level === "muted") {
    return { count: 0, level: "muted" };
  }

  const { data: readRow } = await supabase
    .from("trip_message_reads")
    .select("last_read_at")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  const lastRead = readRow?.last_read_at ?? null;

  let q = supabase
    .from("trip_messages")
    .select("*")
    .eq("trip_id", tripId)
    .is("deleted_at", null)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (lastRead) q = q.gt("created_at", lastRead);
  const { data: msgs } = await q;

  const count = countUnreadByLevel({
    unreadMessages: (msgs ?? []) as TripMessage[],
    level,
    viewerName: memberRow.name,
  });
  return { count, level };
}
