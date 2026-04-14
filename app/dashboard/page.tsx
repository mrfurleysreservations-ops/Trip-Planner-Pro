import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile, Trip, Family, FamilyMember } from "@/types/database.types";
import DashboardPage from "./dashboard";

export type FamilyWithMembers = Family & {
  family_members: FamilyMember[];
};

export default async function DashboardServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch trips the user is a member of (invited trips)
  const memberTripsRes = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const memberTripIds = (memberTripsRes.data ?? []).map((m: any) => m.trip_id);

  const [profileRes, ownedTripsRes, memberTripsDataRes, familiesRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase.from("trips").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    // Fetch trips where user is a member but NOT the owner (avoid duplicates)
    memberTripIds.length > 0
      ? supabase.from("trips").select("*").in("id", memberTripIds).neq("owner_id", user.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("families").select("*, family_members(*)").eq("owner_id", user.id),
  ]);

  // Combine owned + member trips, owned first
  const allTrips = [
    ...((ownedTripsRes.data ?? []) as Trip[]),
    ...((memberTripsDataRes.data ?? []) as Trip[]),
  ];

  return (
    <DashboardPage
      user={{ id: user.id, email: user.email ?? "" }}
      profile={profileRes.data as UserProfile | null}
      initialTrips={allTrips}
      initialFamilies={(familiesRes.data ?? []) as FamilyWithMembers[]}
    />
  );
}
