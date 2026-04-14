import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Suitcase, SuitcaseItem, SuitcasePhoto, WardrobeItem, Family, FamilyMember, UserProfile, Outfit, OutfitItem, OutfitWithItems } from "@/types/database.types";
import PackingPage from "./packing-page";

export type SuitcaseWithItems = Suitcase & {
  suitcase_items: SuitcaseItem[];
  suitcase_photos: SuitcasePhoto[];
};

export type FamilyWithMembers = Family & {
  family_members: FamilyMember[];
};

export default async function PackingServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [suitcasesRes, familiesRes, profileRes, wardrobeRes, outfitsRes] = await Promise.all([
    supabase.from("suitcases").select("*, suitcase_items(*), suitcase_photos(*)").eq("owner_id", user.id).order("created_at"),
    supabase.from("families").select("*, family_members(*)").eq("owner_id", user.id).order("created_at"),
    supabase.from("user_profiles").select("full_name, avatar_url").eq("id", user.id).single(),
    supabase.from("wardrobe_items").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("outfits").select("*, outfit_items(*)").eq("owner_id", user.id).order("created_at"),
  ]);

  const profile = profileRes.data as Pick<UserProfile, "full_name" | "avatar_url"> | null;

  return (
    <PackingPage
      userId={user.id}
      initialSuitcases={(suitcasesRes.data ?? []) as SuitcaseWithItems[]}
      families={(familiesRes.data ?? []) as FamilyWithMembers[]}
      initialWardrobeItems={(wardrobeRes.data ?? []) as WardrobeItem[]}
      initialOutfits={(outfitsRes.data ?? []) as OutfitWithItems[]}
      userName={profile?.full_name ?? user.user_metadata?.full_name ?? null}
      userAvatarUrl={profile?.avatar_url ?? null}
    />
  );
}
