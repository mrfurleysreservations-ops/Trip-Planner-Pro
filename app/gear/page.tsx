import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SavedGear, UserProfile } from "@/types/database.types";
import GearPage from "./gear-page";

export default async function GearServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("saved_gear")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at");

  // Mirror dashboard/page.tsx: fetch the three nav counts so TopNav bubbles are
  // driven by the server, not the now-skipped AppShell effect.
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const memberTripIds = (memberTripsRes.data ?? []).map((m: any) => m.trip_id);

  const ownedTripsRes = await supabase
    .from("trips")
    .select("id")
    .eq("owner_id", user.id);

  const ownedTripIds = (ownedTripsRes.data ?? []).map((t: any) => t.id);
  const allTripIds = Array.from(new Set([...ownedTripIds, ...memberTripIds]));

  const [profileRes, pendingFriendRes, pendingInviteRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("friend_links")
      .select("id", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("trip_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  // Unread chat messages across all trips the user belongs to.
  let unreadChatCount = 0;
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

  // Trip activity newer than the user's last /alerts visit.
  let activityCount = 0;
  const lastAlertsSeen = (profileRes.data as UserProfile | null)?.alerts_last_seen_at ?? null;
  if (memberTripIds.length > 0) {
    let activityQuery = supabase
      .from("trip_activity")
      .select("id", { count: "exact", head: true })
      .in("trip_id", memberTripIds);
    if (lastAlertsSeen) {
      activityQuery = activityQuery.gte("created_at", lastAlertsSeen);
    }
    const { count } = await activityQuery;
    activityCount = count ?? 0;
  }

  const pendingFriendCount = pendingFriendRes.count ?? 0;
  const pendingInviteCount = pendingInviteRes.count ?? 0;
  const unreadAlertCount = pendingInviteCount + pendingFriendCount + activityCount;

  return (
    <GearPage
      userId={user.id}
      initialGear={(data ?? []) as SavedGear[]}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendCount}
      unreadAlertCount={unreadAlertCount}
    />
  );
}
