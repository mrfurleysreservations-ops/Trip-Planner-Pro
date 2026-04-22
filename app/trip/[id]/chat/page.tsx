import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeChatLevel, type ChatNotificationLevel } from "@/lib/chat-unread";
import type { TripMessage } from "@/types/database.types";
import { getTripData } from "@/lib/trip-data";
import ChatPage from "./chat-page";

// Shape passed from server → client. Only the fields the bubbles and
// member stack actually need — keeps the client payload small.
export interface ChatMember {
  id: string;              // trip_members.id
  userId: string;          // auth.users.id
  name: string;
  avatarUrl: string | null;
  role: string;
}

/** Viewer-specific chat state surfaced to the client page. */
export interface ViewerChatSettings {
  /** trip_members.id for the viewer on this trip. Used for the settings update. */
  memberId: string;
  /** Viewer's display name on this trip — drives local @mention matching. */
  memberName: string;
  /** Viewer's current notification level. Default set by role, overridable in chat. */
  notificationLevel: ChatNotificationLevel;
  /** Role preference — lets the settings sheet label the "default for X" option. */
  rolePreference: string | null;
}

export default async function ChatServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  const { members: allMembers, userId } = await getTripData(id);

  // Only accepted members with a real auth account can appear in chat.
  // Family-linked rows without a user_id (e.g. kids) are filtered out.
  // allMembers is ordered by created_at (same as the old dedicated query).
  const acceptedMembers = allMembers.filter(
    (m) => m.status === "accepted" && !!m.user_id,
  );
  const memberUserIds = acceptedMembers
    .map((m) => m.user_id)
    .filter((v): v is string => !!v);

  // Fetch profiles + messages in parallel — both depend only on ids that
  // are already resolved above.
  const [profilesRes, messagesRes] = await Promise.all([
    memberUserIds.length
      ? supabase
          .from("user_profiles")
          .select("id, avatar_url, full_name")
          .in("id", memberUserIds)
      : Promise.resolve({ data: [] as { id: string; avatar_url: string | null; full_name: string | null }[] }),
    // Last 50 messages — fetched desc for the index, reversed so the client
    // gets them in chronological order.
    supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  );

  const members: ChatMember[] = acceptedMembers.map((m) => ({
    id: m.id,
    userId: m.user_id as string,
    name: m.name,
    avatarUrl: profileMap.get(m.user_id as string)?.avatar_url ?? null,
    role: m.role,
  }));

  const initialMessages = ((messagesRes.data ?? []) as TripMessage[]).slice().reverse();

  // Viewer's trip_member row drives sub-nav ordering, @mention matching,
  // and the chat settings sheet. Pulled from the shared members list — the
  // previously dedicated trip_members lookup is now free via getTripData.
  const viewerMemberRow = allMembers.find((m) => m.user_id === userId) ?? null;
  const currentUserRole = viewerMemberRow?.role_preference ?? null;

  const viewerSettings: ViewerChatSettings | null = viewerMemberRow
    ? {
        memberId: viewerMemberRow.id,
        memberName: viewerMemberRow.name,
        notificationLevel: normalizeChatLevel(viewerMemberRow.chat_notification_level),
        rolePreference: viewerMemberRow.role_preference ?? null,
      }
    : null;

  // Bump last_read_at so the /chats unread pill clears immediately on open.
  // The client also bumps on mount + on incoming realtime — this just covers
  // the SSR case and avoids a flash of stale unread count.
  await supabase
    .from("trip_message_reads")
    .upsert(
      { trip_id: id, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "trip_id,user_id" }
    );

  return (
    <ChatPage
      members={members}
      initialMessages={initialMessages}
      currentUserRole={currentUserRole}
      viewerSettings={viewerSettings}
    />
  );
}
