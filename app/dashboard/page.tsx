import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { countTotalUnreadForUser } from "@/lib/chat-list";
import type { UserProfile, Trip, TripMember, Family, FamilyMember } from "@/types/database.types";
import DashboardPage from "./dashboard";

export type FamilyWithMembers = Family & {
  family_members: FamilyMember[];
};

export interface PendingTripInvitation {
  memberId: string;
  trip: Trip;
}

export default async function DashboardServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch trips the user is a member of (invited trips), including status so we can
  // split pending invitations (awaiting accept/decline) from accepted memberships.
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("id, trip_id, status")
    .eq("user_id", user.id);

  const memberRows = (memberTripsRes.data ?? []) as Pick<TripMember, "id" | "trip_id" | "status">[];
  const memberTripIds = memberRows.map((m) => m.trip_id);

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

  // Partition membership rows: pending invitations get their own section on the
  // dashboard with Accept/Decline buttons; accepted ones show inline with owned trips.
  const pendingTripIds = new Set(memberRows.filter((m) => m.status === "pending").map((m) => m.trip_id));
  const memberIdByTripId = new Map(memberRows.map((m) => [m.trip_id, m.id]));

  const memberTripRows = (memberTripsDataRes.data ?? []) as Trip[];
  const acceptedMemberTrips = memberTripRows.filter((t) => !pendingTripIds.has(t.id));
  const pendingInvitations: PendingTripInvitation[] = memberTripRows
    .filter((t) => pendingTripIds.has(t.id))
    .map((trip) => ({ memberId: memberIdByTripId.get(trip.id) as string, trip }));

  // Combine owned + accepted member trips, owned first. Pending invitations are
  // intentionally excluded here — they render in their own section above Upcoming.
  const allTrips = [
    ...((ownedTripsRes.data ?? []) as Trip[]),
    ...acceptedMemberTrips,
  ];

  const pendingInviteCount = pendingInvitations.length;

  // Unread chat messages across all trips the user belongs to — aggregated
  // through the shared helper so the viewer's per-trip
  // chat_notification_level is honored (muted trips contribute 0, mentions
  // trips only contribute @mentions). Solo-hobby-scale acceptable; revisit
  // if message volume grows large.
  const unreadChatCount = await countTotalUnreadForUser(supabase, user.id);

  // Trip activity newer than the user's last visit to /alerts. Mirrors the
  // aggregate currently computed client-side in AppShell, which stops rendering
  // on /dashboard once the TopNav migration lands here.
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
  const unreadAlertCount = pendingInviteCount + pendingFriendCount + activityCount;

  return (
    <DashboardPage
      user={{ id: user.id, email: user.email ?? "" }}
      profile={profileRes.data as UserProfile | null}
      initialTrips={allTrips}
      initialFamilies={(familiesRes.data ?? []) as FamilyWithMembers[]}
      initialPendingInvitations={pendingInvitations}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendCount}
      unreadAlertCount={unreadAlertCount}
    />
  );
}
