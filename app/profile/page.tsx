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

  const [familiesRes, profileRes] = await Promise.all([
    supabase.from("families")
      .select("*, family_members(*), inventory_bins(*, inventory_items:inventory_items(*))")
      .eq("owner_id", user.id)
      .order("created_at"),
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
  ]);

  const profile = profileRes.data as UserProfile | null;

  return (
    <ProfilePage
      userId={user.id}
      initialFamilies={(familiesRes.data ?? []) as FamilyWithRelations[]}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? user.user_metadata?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      packingPreferences={(profile?.packing_preferences as Record<string, string> | null) ?? null}
      onboardingCompleted={profile?.onboarding_completed ?? false}
    />
  );
}
