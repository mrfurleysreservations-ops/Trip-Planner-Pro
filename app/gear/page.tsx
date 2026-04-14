import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SavedGear } from "@/types/database.types";
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

  return (
    <GearPage
      userId={user.id}
      initialGear={(data ?? []) as SavedGear[]}
    />
  );
}
