import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, TripActivity, FriendLink } from "@/types/database.types";
import AlertsPage from "./alerts-page";

export interface PendingInvitation {
  member: TripMember;
  trip: Trip;
}

export interface PendingFriendRequest {
  friendLink: FriendLink;
  fromName: string;
  fromEmail: string | null;
  fromAvatar: string | null;
}

export interface AlertsPageProps {
  userId: string;
  alertsLastSeenAt: string | null;
  pendingInvitations: PendingInvitation[];
  pendingFriendRequests: PendingFriendRequest[];
  activity: TripActivity[];
  tripNameMap: Record<string, string>;
  unreadChatCount: number;
  pendingFriendCount: number;
  unreadAlertCount: number;
}

export default async function AlertsServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // ─── Kick off independent fetches in parallel ───
  const [profileRes, pendingMemberRes, incomingFriendRes, allMembershipsRes, ownedTripsRes] = await Promise.all([
    supabase.from("user_profiles").select("alerts_last_seen_at").eq("id", user.id).single(),
    supabase.from("trip_members").select("*").eq("user_id", user.id).eq("status", "pending"),
    supabase.from("friend_links").select("*").eq("friend_id", user.id).eq("status", "pending"),
    supabase.from("trip_members").select("trip_id").eq("user_id", user.id),
    supabase.from("trips").select("id, name").eq("owner_id", user.id),
  ]);

  const alertsLastSeenAt = profileRes.data?.alerts_last_seen_at || null;

  // ─── Pending trip invitations ───
  const pendingMemberRows = pendingMemberRes.data ?? [];
  const pendingTripIds = pendingMemberRows.map((m: any) => m.trip_id);
  let pendingInvitations: PendingInvitation[] = [];
  if (pendingTripIds.length > 0) {
    const { data: pendingTrips } = await supabase
      .from("trips")
      .select("*")
      .in("id", pendingTripIds);
    const tripMap: Record<string, Trip> = {};
    (pendingTrips ?? []).forEach((t: any) => { tripMap[t.id] = t as Trip; });
    pendingInvitations = pendingMemberRows
      .filter((m: any) => tripMap[m.trip_id])
      .map((m: any) => ({ member: m as TripMember, trip: tripMap[m.trip_id] }));
  }

  // ─── Pending friend requests (where someone sent ME a request) ───
  const incomingFriendLinks = incomingFriendRes.data ?? [];
  let pendingFriendRequests: PendingFriendRequest[] = [];
  if (incomingFriendLinks.length > 0) {
    const senderIds = incomingFriendLinks.map((fl: any) => fl.user_id);
    const { data: senderProfiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", senderIds);
    const profileMap: Record<string, any> = {};
    (senderProfiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    pendingFriendRequests = incomingFriendLinks.map((fl: any) => {
      const profile = profileMap[fl.user_id] || {};
      return {
        friendLink: fl as FriendLink,
        fromName: profile.full_name || profile.email || "Someone",
        fromEmail: profile.email || null,
        fromAvatar: profile.avatar_url || null,
      };
    });
  }

  // ─── Trip activity (across all user's trips) ───
  const memberTripIds = (allMembershipsRes.data ?? []).map((m: any) => m.trip_id);
  const ownedTripIds = (ownedTripsRes.data ?? []).map((t: any) => t.id);
  const combinedTripIds = Array.from(new Set<string>([...memberTripIds, ...ownedTripIds]));

  let activity: TripActivity[] = [];
  const tripNameMap: Record<string, string> = {};

  if (combinedTripIds.length > 0) {
    const [activityRes, tripsRes] = await Promise.all([
      supabase
        .from("trip_activity")
        .select("*")
        .in("trip_id", combinedTripIds)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("trips")
        .select("id, name")
        .in("id", combinedTripIds),
    ]);
    activity = (activityRes.data ?? []) as TripActivity[];
    (tripsRes.data ?? []).forEach((t: any) => { tripNameMap[t.id] = t.name; });
  }

  // ─── TopNav badge counts ───
  // Mirrors /dashboard so the nav badges stay consistent across all top-level pages.
  // unreadAlertCount here is computed from the pre-update snapshot of
  // alerts_last_seen_at — after the client marks alerts as seen it will render as 0
  // on the next request, which is expected.

  // Unread chat messages across all trips the user belongs to.
  let unreadChatCount = 0;
  if (combinedTripIds.length > 0) {
    const [readsRes, msgsRes] = await Promise.all([
      supabase
        .from("trip_message_reads")
        .select("trip_id, last_read_at")
        .eq("user_id", user.id)
        .in("trip_id", combinedTripIds),
      supabase
        .from("trip_messages")
        .select("trip_id, created_at")
        .in("trip_id", combinedTripIds)
        .is("deleted_at", null)
        .neq("sender_id", user.id),
    ]);

    const readsByTrip = new Map<string, string>();
    (readsRes.data ?? []).forEach((r: any) => readsByTrip.set(r.trip_id, r.last_read_at));

    (msgsRes.data ?? []).forEach((m: any) => {
      const lastRead = readsByTrip.get(m.trip_id);
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
        unreadChatCount++;
      }
    });
  }

  // Trip activity newer than the user's last visit to /alerts.
  let activityCount = 0;
  if (memberTripIds.length > 0) {
    let activityQuery = supabase
      .from("trip_activity")
      .select("id", { count: "exact", head: true })
      .in("trip_id", memberTripIds);
    if (alertsLastSeenAt) {
      activityQuery = activityQuery.gte("created_at", alertsLastSeenAt);
    }
    const { count } = await activityQuery;
    activityCount = count ?? 0;
  }

  const pendingFriendCount = incomingFriendLinks.length;
  const pendingInviteCount = pendingMemberRows.length;
  const unreadAlertCount = pendingInviteCount + pendingFriendCount + activityCount;

  return (
    <AlertsPage
      userId={user.id}
      alertsLastSeenAt={alertsLastSeenAt}
      pendingInvitations={pendingInvitations}
      pendingFriendRequests={pendingFriendRequests}
      activity={activity}
      tripNameMap={tripNameMap}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendCount}
      unreadAlertCount={unreadAlertCount}
    />
  );
}
