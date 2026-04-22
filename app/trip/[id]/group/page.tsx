import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FamilyMember, Family } from "@/types/database.types";
import { getTripData } from "@/lib/trip-data";
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
  friends: FriendWithProfile[];
  familiesWithMembers: FamilyWithMembers[];
  otherAppUsers: FriendWithProfile[];
  otherFamilies: FamilyWithMembers[];
  // Map of family_member_id → linked_user_id for every family_member_id
  // currently on the roster. Used by the client to dedupe a family-member
  // row against a friend/app-user row for the same person, even when the
  // underlying family isn't in this user's own/friend scope (e.g. a co-host
  // added someone from a family the current viewer can't read).
  rosterLinkedUserIds: Record<string, string>;
}

export default async function GroupServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  const { members, userId } = await getTripData(id);

  // ─── Tier 1 ────────────────────────────────────────────────────────
  // All queries below key off `userId` or `members` (already available via
  // getTripData) — none depend on each other. Collapsing the old sequential
  // block into one parallel batch cuts ~2 round-trips off the critical path.
  const rosterFamilyMemberIds = (members || [])
    .map((m: any) => m.family_member_id)
    .filter(Boolean) as string[];

  const [sentRes, receivedRes, rosterFMsRes] = await Promise.all([
    supabase
      .from("friend_links")
      .select("friend_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("friend_links")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "accepted"),
    rosterFamilyMemberIds.length > 0
      ? supabase
          .from("family_members")
          .select("id, linked_user_id")
          .in("id", rosterFamilyMemberIds)
      : Promise.resolve({ data: [] as { id: string; linked_user_id: string | null }[] }),
  ]);

  const friendUserIds = [
    ...(sentRes.data || []).map((r: any) => r.friend_id),
    ...(receivedRes.data || []).map((r: any) => r.user_id),
  ];

  // ── Roster family_member → linked_user_id map ──
  // Needed so the client can dedupe a friend/app-user row against a
  // family-member row for the same person — even when the family isn't in
  // this viewer's own/friend scope (e.g. a co-host added them from a family
  // we can't read directly). The DB trigger is the authoritative guard;
  // this just keeps the UI honest before any insert is attempted.
  const rosterLinkedUserIds: Record<string, string> = {};
  ((rosterFMsRes.data as any[]) || []).forEach((fm: any) => {
    if (fm.linked_user_id) rosterLinkedUserIds[fm.id] = fm.linked_user_id;
  });

  // ─── Tier 2 ────────────────────────────────────────────────────────
  // Everything here depends on the friendUserIds derived from Tier 1.
  // Friend profiles, own+friend families, and the two discovery queries
  // (other app users / other families) are independent of each other.
  const allFamilyOwnerIds = [userId, ...friendUserIds];
  const excludedUserIds = [userId, ...friendUserIds];

  const [friendProfilesRes, familiesRes, otherProfilesRes, otherFamiliesRes] =
    await Promise.all([
      friendUserIds.length > 0
        ? supabase
            .from("user_profiles")
            .select("id, full_name, email, avatar_url")
            .in("id", friendUserIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("families")
        .select("*, family_members(*)")
        .in("owner_id", allFamilyOwnerIds)
        .order("created_at"),
      supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url")
        .not("id", "in", `(${excludedUserIds.join(",")})`)
        .order("full_name")
        .limit(100),
      supabase
        .from("families")
        .select("*, family_members(*)")
        .not("owner_id", "in", `(${excludedUserIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const friends: FriendWithProfile[] = ((friendProfilesRes.data as any[]) || []).map(
    (p: any) => ({
      id: p.id,
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      avatar_url: p.avatar_url,
    }),
  );

  const ownFamilies = (familiesRes.data as any[]) || [];
  const otherFamiliesData = (otherFamiliesRes.data as any[]) || [];

  const otherAppUsers: FriendWithProfile[] = ((otherProfilesRes.data as any[]) || []).map(
    (p: any) => ({
      id: p.id,
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      avatar_url: p.avatar_url,
    }),
  );

  // ─── Tier 3 ────────────────────────────────────────────────────────
  // Owner-name lookups for the family results. Both sides can share a single
  // combined query — one IN() instead of two — so it's a single round-trip.
  const ownFamilyOwnerIds = ownFamilies.map((f: any) => f.owner_id);
  const otherFamilyOwnerIds = otherFamiliesData.map((f: any) => f.owner_id);
  const allFamilyOwnerLookupIds = [
    ...new Set([...ownFamilyOwnerIds, ...otherFamilyOwnerIds]),
  ];

  const { data: ownerProfiles } =
    allFamilyOwnerLookupIds.length > 0
      ? await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", allFamilyOwnerLookupIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const ownerNameMap: Record<string, string | null> = {};
  ((ownerProfiles as any[]) || []).forEach((p: any) => {
    ownerNameMap[p.id] = p.full_name;
  });

  const familiesWithMembers: FamilyWithMembers[] = ownFamilies.map((f: any) => ({
    ...f,
    family_members: f.family_members || [],
    owner_name: ownerNameMap[f.owner_id] || null,
    is_own: f.owner_id === userId,
  }));

  const otherFamilies: FamilyWithMembers[] = otherFamiliesData.map((f: any) => ({
    ...f,
    family_members: f.family_members || [],
    owner_name: ownerNameMap[f.owner_id] || null,
    is_own: false,
  }));

  return (
    <GroupPage
      friends={friends}
      familiesWithMembers={familiesWithMembers}
      otherAppUsers={otherAppUsers}
      otherFamilies={otherFamilies}
      rosterLinkedUserIds={rosterLinkedUserIds}
    />
  );
}
