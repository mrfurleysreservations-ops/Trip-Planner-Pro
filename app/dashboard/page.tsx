import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile, Trip, Family, FamilyMember } from "@/types/database.types";
import DashboardPage from "./dashboard";

export type FamilyWithMembers = Family & {
  family_members: FamilyMember[];
};

export default async function DashboardServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch trips the user is a member of (invited trips)
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const memberTripIds = (memberTripsRes.data ?? []).map((m: any) => m.trip_id);

  const [profileRes, ownedTripsRes, memberTripsDataRes, familiesRes, pendingFriendRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase.from("trips").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    // Fetch trips where user is a member but NOT the owner (avoid duplicates)
    memberTripIds.length > 0
      ? supabase.from("trips").select("*").in("id", memberTripIds).neq("owner_id", user.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("families").select("*, family_members(*)").eq("owner_id", user.id),
    // Pending friend requests targeting this user. Schema uses `friend_id` as the recipient
    // (RLS: only the sender — auth.uid() = user_id — can insert rows).
    supabase
      .from("friend_links")
      .select("id", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending"),
  ]);

  // Combine owned + member trips, owned first
  const allTrips = [
    ...((ownedTripsRes.data ?? []) as Trip[]),
    ...((memberTripsDataRes.data ?? []) as Trip[]),
  ];

  // Unread chat messages across all trips the user belongs to.
  // Approach: fetch the user's per-trip last_read_at, fetch undeleted messages from others
  // in those same trips, compare in JS. Solo-hobby-scale acceptable; revisit if message
  // volume grows large.
  let unreadChatCount = 0;
  const allTripIds = allTrips.map((t) => t.id);
  if (allTripIds.length > 0) {
    const [readsRes, msgsRes] = await Promise.all([
      supabase
        .from("trip_message_reads")
        .select("trip_id, last_read_at")
        .eq("user_id", user.id)
        .in("trip_id", allTripIds),
      supabase
        .from("trip_messages")
        .select("trip_id, created_at")
        .in("trip_id", allTripIds)
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

  return (
    <DashboardPage
      user={{ id: user.id, email: user.email ?? "" }}
      profile={profileRes.data as UserProfile | null}
      initialTrips={allTrips}
      initialFamilies={(familiesRes.data ?? []) as FamilyWithMembers[]}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendRes.count ?? 0}
    />
  );
}
