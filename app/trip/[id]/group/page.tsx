import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, FamilyMember, Family } from "@/types/database.types";
import GroupPage from "./group-page";

export interface FriendWithProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface FamilyWithMembers extends Family {
  family_members: FamilyMember[];
  owner_name: string | null;
  is_own: boolean;
}

export interface GroupPageProps {
  trip: Trip;
  members: TripMember[];
  friends: FriendWithProfile[];
  familiesWithMembers: FamilyWithMembers[];
  otherAppUsers: FriendWithProfile[];
  otherFamilies: FamilyWithMembers[];
  userId: string;
  isHost: boolean;
}

export default async function GroupServerPage({ params }: { params: { id: string } }) {
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

  const isHost = trip.owner_id === user.id;

  // Fetch trip members
  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .order("created_at");

  // Fetch accepted friend links where this user is either side
  const [sentRes, receivedRes] = await Promise.all([
    supabase
      .from("friend_links")
      .select("friend_id")
      .eq("user_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friend_links")
      .select("user_id")
      .eq("friend_id", user.id)
      .eq("status", "accepted"),
  ]);

  const friendUserIds = [
    ...(sentRes.data || []).map((r: any) => r.friend_id),
    ...(receivedRes.data || []).map((r: any) => r.user_id),
  ];

  // Fetch profiles for friend user IDs
  let friends: FriendWithProfile[] = [];
  if (friendUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", friendUserIds);

    friends = (profiles || []).map((p: any) => ({
      id: p.id,
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      avatar_url: p.avatar_url,
    }));
  }

  // Fetch ALL families accessible to this user: own families + friends' families
  const allFamilyOwnerIds = [user.id, ...friendUserIds];
  let familiesWithMembers: FamilyWithMembers[] = [];

  if (allFamilyOwnerIds.length > 0) {
    const { data: families } = await supabase
      .from("families")
      .select("*, family_members(*)")
      .in("owner_id", allFamilyOwnerIds)
      .order("created_at");

    if (families && families.length > 0) {
      // Get owner names for friend families
      const ownerIds = [...new Set(families.map((f: any) => f.owner_id))];
      const { data: ownerProfiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", ownerIds);

      const ownerNameMap: Record<string, string | null> = {};
      (ownerProfiles || []).forEach((p: any) => {
        ownerNameMap[p.id] = p.full_name;
      });

      familiesWithMembers = families.map((f: any) => ({
        ...f,
        family_members: f.family_members || [],
        owner_name: ownerNameMap[f.owner_id] || null,
        is_own: f.owner_id === user.id,
      }));
    }
  }

  // ── Discovery: other app users (NOT current user, NOT a friend) ──
  // Note: this exposes all public user_profiles rows to every logged-in user.
  // That's fine for the current hobby-project scope; flag if RLS is ever tightened.
  const excludedUserIds = [user.id, ...friendUserIds];
  let otherAppUsers: FriendWithProfile[] = [];
  {
    const { data: otherProfiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .not("id", "in", `(${excludedUserIds.join(",")})`)
      .order("full_name")
      .limit(100);

    otherAppUsers = (otherProfiles || []).map((p: any) => ({
      id: p.id,
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      avatar_url: p.avatar_url,
    }));
  }

  // ── Discovery: other families on the app (owner NOT current user, NOT a friend) ──
  let otherFamilies: FamilyWithMembers[] = [];
  {
    const { data: otherFamiliesData } = await supabase
      .from("families")
      .select("*, family_members(*)")
      .not("owner_id", "in", `(${excludedUserIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (otherFamiliesData && otherFamiliesData.length > 0) {
      const ownerIds = [...new Set(otherFamiliesData.map((f: any) => f.owner_id))];
      const { data: ownerProfiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", ownerIds);

      const ownerNameMap: Record<string, string | null> = {};
      (ownerProfiles || []).forEach((p: any) => {
        ownerNameMap[p.id] = p.full_name;
      });

      otherFamilies = otherFamiliesData.map((f: any) => ({
        ...f,
        family_members: f.family_members || [],
        owner_name: ownerNameMap[f.owner_id] || null,
        is_own: false,
      }));
    }
  }

  return (
    <GroupPage
      trip={trip as Trip}
      members={(members ?? []) as TripMember[]}
      friends={friends}
      familiesWithMembers={familiesWithMembers}
      otherAppUsers={otherAppUsers}
      otherFamilies={otherFamilies}
      userId={user.id}
      isHost={isHost}
    />
  );
}
