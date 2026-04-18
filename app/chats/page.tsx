import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchChatList } from "@/lib/chat-list";
import type { UserProfile } from "@/types/database.types";
import ChatsPage from "./chats-page";

// NOTE: unread chat counting lives in `fetchChatList` — it already honors
// each trip's `chat_notification_level`. Summing the returned rows keeps
// the top-nav bubble and the per-row pills aligned: if you mute a trip,
// it drops out of both at the same time.

export default async function ChatsServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const initialRows = await fetchChatList(supabase, user.id);

  // Mirror dashboard/page.tsx: fetch the three nav counts so TopNav bubbles are
  // driven by the server, not the now-skipped AppShell effect.
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const memberTripIds = (memberTripsRes.data ?? []).map((m: any) => m.trip_id);

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

  // Aggregate unread for the top-nav bubble. Derived from the per-trip rows
  // so a muted or mentions-only trip can't inflate the number.
  const unreadChatCount = initialRows.reduce((acc, r) => acc + r.unreadCount, 0);

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
    <ChatsPage
      userId={user.id}
      initialRows={initialRows}
      unreadChatCount={unreadChatCount}
      pendingFriendCount={pendingFriendCount}
      unreadAlertCount={unreadAlertCount}
    />
  );
}
