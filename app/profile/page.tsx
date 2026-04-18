import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Family, FamilyMember, InventoryBin, InventoryItem, UserProfile } from "@/types/database.types";
import ProfilePage from "./profile-page";

export type FamilyWithRelations = Family & {
  family_members: FamilyMember[];
  inventory_bins: (InventoryBin & {
    inventory_items: InventoryItem[];
  })[];
};

export default async function ProfileServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Trip IDs the user is a member of — used for TopNav chat/activity badges.
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const memberTripIds = (memberTripsRes.data ?? []).map((m: any) => m.trip_id);

  const [familiesRes, profileRes, ownedTripsRes, pendingFriendRes, pendingInviteRes] = await Promise.all([
    supabase.from("families")
      .select("*, family_members(*), inventory_bins(*, inventory_items:inventory_items(*))")
      .eq("owner_id", user.id)
      .order("created_at"),
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    // Owned trip ids (in case the host-as-member DB trigger missed a row).
    supabase.from("trips").select("id").eq("owner_id", user.id),
    // Pending friend requests targeting this user. Schema uses `friend_id` as the recipient
    // (RLS: only the sender — auth.uid() = user_id — can insert rows).
    supabase
      .from("friend_links")
      .select("id", { count: "exact", head: true })
      .eq("friend_id", user.id)
      .eq("status", "pending"),
    // Pending trip invitations awaiting this user's accept/decline.
    supabase
      .from("trip_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  const profile = profileRes.data as UserProfile | null;

  // Combine owned + member trip ids for the chat-unread scan.
  const ownedTripIds = (ownedTripsRes.data ?? []).map((t: any) => t.id);
  const allTripIds = Array.from(new Set<string>([...ownedTripIds, ...memberTripIds]));

  // Unread chat messages across all trips the user belongs to. Mirrors the
  // approach in /dashboard: fetch per-trip last_read_at, fetch undeleted
  // messages from others in those trips, compare in JS. Solo-hobby-scale.
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

  // Trip activity newer than the user's last visit to /alerts. Mirrors the
  // aggregate /dashboard computes so the Alerts badge is consistent across pages.
  let activityCount = 0;
  const lastAlertsSeen = profile?.alerts_last_seen_at ?? null;
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
    <ProfilePage
      userId={user.id}
      initialFamilies={(familiesRes.data ?? []) as FamilyWithRelations[]}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? user.user_metadata?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      packingPreferences={(profile?.packing_preferences as Record<string, string> | null) ?? null}
      onboardingCompleted={profile?.onboarding_completed ?? false}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendCount}
      unreadAlertCount={unreadAlertCount}
    />
  );
}
