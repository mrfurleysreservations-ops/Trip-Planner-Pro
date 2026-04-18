import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchChatList } from "@/lib/chat-list";
import ChatsPage from "./chats-page";

export default async function ChatsServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const initialRows = await fetchChatList(supabase, user.id);

  return <ChatsPage userId={user.id} initialRows={initialRows} />;
}
