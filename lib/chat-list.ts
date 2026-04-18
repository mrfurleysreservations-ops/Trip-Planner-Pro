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

export interface ChatListRow {
  trip: Trip;
  latestMessage: TripMessage | null;
  latestSenderName: string | null; // "You" if sender is the current user
  unreadCount: number;
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
  const [ownedRes, memberLinksRes] = await Promise.all([
    supabase.from("trips").select("*").eq("owner_id", userId),
    supabase
      .from("trip_members")
      .select("trip_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  const ownedTrips = (ownedRes.data ?? []) as Trip[];
  const ownedTripIds = new Set(ownedTrips.map((t) => t.id));

  const memberTripIds = (memberLinksRes.data ?? [])
    .map((r) => r.trip_id)
    .filter((tid): tid is string => !!tid && !ownedTripIds.has(tid));

  const memberTripsRes = memberTripIds.length
    ? await supabase.from("trips").select("*").in("id", memberTripIds)
    : { data: [] as Trip[] };

  const allTrips = [...ownedTrips, ...((memberTripsRes.data ?? []) as Trip[])];
  if (allTrips.length === 0) return [];

  const tripIds = allTrips.map((t) => t.id);

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

  // 5. Unread count per trip: messages newer than last_read_at, excluding
  //    messages the user sent themselves (you don't unread your own post).
  const unreadByTrip = new Map<string, number>();
  ((messages ?? []) as TripMessage[]).forEach((m) => {
    if (m.sender_id === userId) return;
    const lastRead = lastReadByTrip.get(m.trip_id);
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unreadByTrip.set(m.trip_id, (unreadByTrip.get(m.trip_id) || 0) + 1);
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
    return {
      trip,
      latestMessage: latest,
      latestSenderName,
      unreadCount: unreadByTrip.get(trip.id) || 0,
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
