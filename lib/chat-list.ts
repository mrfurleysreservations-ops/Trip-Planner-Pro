// Shared query for the /chats index.
//
// Used by both the server page (initial SSR hydration) and the client page
// (window-focus refetch). Keeping it in one place means the two views can't
// drift in what they consider "the latest message" or how unread is counted.
//
// Design: one round-trip fetches trips, one fetch gets all recent messages
// across those trips, one fetch gets the user's read markers. We aggregate
// in JS — at hobby-scale the fetched message set stays small, and the
// (trip_id, created_at desc) index backs the message query.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Trip, TripMessage } from "@/types/database.types";
import {
  type ChatNotificationLevel,
  countUnreadByLevel,
  normalizeChatLevel,
} from "./chat-unread";

export interface ChatListRow {
  trip: Trip;
  latestMessage: TripMessage | null;
  latestSenderName: string | null; // "You" if sender is the current user
  /** Filtered by the viewer's chat_notification_level for this trip. */
  unreadCount: number;
  /** Viewer's notification level on this trip — drives badge styling. */
  chatLevel: ChatNotificationLevel;
}

// How many recent messages to pull. 500 covers any realistic load for a solo
// hobby user with a dozen or so trips. If this ever pages, we can swap in a
// Postgres view without changing the caller contract.
const MESSAGE_FETCH_CAP = 500;

export async function fetchChatList(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ChatListRow[]> {
  // 1. Collect every trip this user can see (owner or accepted member).
  // We pull chat_notification_level + name from the member link so we can
  // honor the viewer's notification preference when counting unread
  // without a second round-trip per trip.
  const [ownedRes, memberLinksRes] = await Promise.all([
    supabase.from("trips").select("*").eq("owner_id", userId),
    supabase
      .from("trip_members")
      .select("trip_id, chat_notification_level, name")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  const ownedTrips = (ownedRes.data ?? []) as Trip[];
  const ownedTripIds = new Set(ownedTrips.map((t) => t.id));

  const memberLinkRows = memberLinksRes.data ?? [];

  const memberTripIds = memberLinkRows
    .map((r) => r.trip_id)
    .filter((tid): tid is string => !!tid && !ownedTripIds.has(tid));

  const memberTripsRes = memberTripIds.length
    ? await supabase.from("trips").select("*").in("id", memberTripIds)
    : { data: [] as Trip[] };

  const allTrips = [...ownedTrips, ...((memberTripsRes.data ?? []) as Trip[])];
  if (allTrips.length === 0) return [];

  const tripIds = allTrips.map((t) => t.id);

  // Per-trip notification level + viewer name (for @mention matching).
  // Owner rows aren't in the member-link query above (owners are always
  // accepted by definition but may not have a member row in some legacy
  // data); fall back to a second targeted fetch so every trip the viewer
  // can see has a resolved level.
  const levelByTrip = new Map<string, ChatNotificationLevel>();
  const viewerNameByTrip = new Map<string, string>();
  memberLinkRows.forEach((r) => {
    if (r.trip_id) {
      levelByTrip.set(r.trip_id, normalizeChatLevel(r.chat_notification_level));
      if (r.name) viewerNameByTrip.set(r.trip_id, r.name);
    }
  });
  const missingTripIds = tripIds.filter((t) => !levelByTrip.has(t));
  if (missingTripIds.length) {
    const { data: ownerMemberRows } = await supabase
      .from("trip_members")
      .select("trip_id, chat_notification_level, name")
      .eq("user_id", userId)
      .in("trip_id", missingTripIds);
    (ownerMemberRows ?? []).forEach((r) => {
      if (r.trip_id) {
        levelByTrip.set(r.trip_id, normalizeChatLevel(r.chat_notification_level));
        if (r.name) viewerNameByTrip.set(r.trip_id, r.name);
      }
    });
  }

  // 2. Pull recent messages across all these trips in one shot.
  const { data: messages } = await supabase
    .from("trip_messages")
    .select("*")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_FETCH_CAP);

  // 3. Pull the user's read markers for those trips.
  const { data: reads } = await supabase
    .from("trip_message_reads")
    .select("trip_id, last_read_at")
    .eq("user_id", userId)
    .in("trip_id", tripIds);

  const lastReadByTrip = new Map<string, string>();
  (reads ?? []).forEach((r) => lastReadByTrip.set(r.trip_id, r.last_read_at));

  // 4. Latest message per trip (messages already ordered desc).
  const latestByTrip = new Map<string, TripMessage>();
  ((messages ?? []) as TripMessage[]).forEach((m) => {
    if (!latestByTrip.has(m.trip_id)) latestByTrip.set(m.trip_id, m);
  });

  // 5. Unread messages per trip: messages newer than last_read_at, excluding
  //    messages the user sent themselves (you don't unread your own post).
  //    We collect the full list per trip so we can apply the viewer's
  //    chat_notification_level filter once, in one place.
  const unreadMessagesByTrip = new Map<string, TripMessage[]>();
  ((messages ?? []) as TripMessage[]).forEach((m) => {
    if (m.sender_id === userId) return;
    if (m.deleted_at) return;
    const lastRead = lastReadByTrip.get(m.trip_id);
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      const bucket = unreadMessagesByTrip.get(m.trip_id);
      if (bucket) bucket.push(m);
      else unreadMessagesByTrip.set(m.trip_id, [m]);
    }
  });

  // 6. Resolve sender display names. Grab accepted member rows for the
  //    senders we actually need — one fetch, no N+1.
  const senderIds = Array.from(
    new Set(
      ((messages ?? []) as TripMessage[])
        .map((m) => m.sender_id)
        .filter((id): id is string => !!id)
    )
  );

  const senderNameMap = new Map<string, string>(); // key: `${tripId}:${senderId}`
  if (senderIds.length > 0) {
    const { data: memberNames } = await supabase
      .from("trip_members")
      .select("trip_id, user_id, name")
      .in("trip_id", tripIds)
      .in("user_id", senderIds);

    (memberNames ?? []).forEach((row) => {
      if (row.user_id) senderNameMap.set(`${row.trip_id}:${row.user_id}`, row.name);
    });
  }

  // 7. Assemble rows and sort (newest message first; message-less trips last).
  const rows: ChatListRow[] = allTrips.map((trip) => {
    const latest = latestByTrip.get(trip.id) || null;
    let latestSenderName: string | null = null;
    if (latest) {
      if (latest.sender_id === userId) {
        latestSenderName = "You";
      } else {
        latestSenderName =
          senderNameMap.get(`${trip.id}:${latest.sender_id}`) || "Someone";
      }
    }
    const level = levelByTrip.get(trip.id) ?? "all";
    const unreadCount = countUnreadByLevel({
      unreadMessages: unreadMessagesByTrip.get(trip.id) ?? [],
      level,
      viewerName: viewerNameByTrip.get(trip.id) ?? null,
    });
    return {
      trip,
      latestMessage: latest,
      latestSenderName,
      unreadCount,
      chatLevel: level,
    };
  });

  rows.sort((a, b) => {
    // Trips without messages sink to the bottom, otherwise newest first.
    if (!a.latestMessage && !b.latestMessage) return 0;
    if (!a.latestMessage) return 1;
    if (!b.latestMessage) return -1;
    return (
      new Date(b.latestMessage.created_at).getTime() -
      new Date(a.latestMessage.created_at).getTime()
    );
  });

  return rows;
}

/**
 * Aggregate count of unread chat messages across every trip the user can
 * see, honoring each trip's `chat_notification_level`. Backs the top-nav
 * bubble on /dashboard and /chats so a muted trip can't contribute noise.
 *
 * This is a thin wrapper around `fetchChatList` to keep unread bookkeeping
 * in exactly one place. The duplicated fetch cost is fine at hobby scale.
 */
export async function countTotalUnreadForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const rows = await fetchChatList(supabase, userId);
  return rows.reduce((acc, r) => acc + r.unreadCount, 0);
}
