import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMessage } from "@/types/database.types";
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

export default async function ChatServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) redirect("/dashboard");

  // Only accepted members with a real auth account can appear in chat.
  // Family-linked rows without a user_id (e.g. kids) are filtered out.
  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("id, user_id, name, role")
    .eq("trip_id", id)
    .eq("status", "accepted")
    .not("user_id", "is", null)
    .order("created_at");

  const memberUserIds = (memberRows ?? [])
    .map((m) => m.user_id)
    .filter((v): v is string => !!v);

  const { data: profileRows } = memberUserIds.length
    ? await supabase
        .from("user_profiles")
        .select("id, avatar_url, full_name")
        .in("id", memberUserIds)
    : { data: [] as { id: string; avatar_url: string | null; full_name: string | null }[] };

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p])
  );

  const members: ChatMember[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id as string,
    name: m.name,
    avatarUrl: profileMap.get(m.user_id as string)?.avatar_url ?? null,
    role: m.role,
  }));

  // Last 50 messages — fetched desc for the index, reversed so the client
  // gets them in chronological order.
  const { data: messagesRaw } = await supabase
    .from("trip_messages")
    .select("*")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialMessages = ((messagesRaw ?? []) as TripMessage[]).slice().reverse();

  // Bump last_read_at so the /chats unread pill clears immediately on open.
  // The client also bumps on mount + on incoming realtime — this just covers
  // the SSR case and avoids a flash of stale unread count.
  await supabase
    .from("trip_message_reads")
    .upsert(
      { trip_id: id, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "trip_id,user_id" }
    );

  return (
    <ChatPage
      trip={trip as Trip}
      userId={user.id}
      members={members}
      initialMessages={initialMessages}
    />
  );
}
