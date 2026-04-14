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
}

export default async function AlertsServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // ─── Get user's last seen timestamp ───
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("alerts_last_seen_at")
    .eq("id", user.id)
    .single();

  const alertsLastSeenAt = profile?.alerts_last_seen_at || null;

  // ─── Pending trip invitations ───
  const { data: pendingMemberRows } = await supabase
    .from("trip_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending");

  const pendingTripIds = (pendingMemberRows ?? []).map((m: any) => m.trip_id);
  let pendingInvitations: PendingInvitation[] = [];
  if (pendingTripIds.length > 0) {
    const { data: pendingTrips } = await supabase
      .from("trips")
      .select("*")
      .in("id", pendingTripIds);
    const tripMap: Record<string, Trip> = {};
    (pendingTrips ?? []).forEach((t: any) => { tripMap[t.id] = t as Trip; });
    pendingInvitations = (pendingMemberRows ?? [])
      .filter((m: any) => tripMap[m.trip_id])
      .map((m: any) => ({ member: m as TripMember, trip: tripMap[m.trip_id] }));
  }

  // ─── Pending friend requests (where someone sent ME a request) ───
  const { data: incomingFriendLinks } = await supabase
    .from("friend_links")
    .select("*")
    .eq("friend_id", user.id)
    .eq("status", "pending");

  let pendingFriendRequests: PendingFriendRequest[] = [];
  if (incomingFriendLinks && incomingFriendLinks.length > 0) {
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
  const { data: allMemberships } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const allTripIds = (allMemberships ?? []).map((m: any) => m.trip_id);

  // Also include trips owned by user
  const { data: ownedTrips } = await supabase
    .from("trips")
    .select("id, name")
    .eq("owner_id", user.id);

  const ownedTripIds = (ownedTrips ?? []).map((t: any) => t.id);
  const combinedTripIds = [...new Set([...allTripIds, ...ownedTripIds])];

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

  return (
    <AlertsPage
      userId={user.id}
      alertsLastSeenAt={alertsLastSeenAt}
      pendingInvitations={pendingInvitations}
      pendingFriendRequests={pendingFriendRequests}
      activity={activity}
      tripNameMap={tripNameMap}
    />
  );
}
