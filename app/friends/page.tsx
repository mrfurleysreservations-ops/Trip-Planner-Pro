import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import FriendsPage from "./friends-page";

// Shapes delivered to the client. Keep these narrow — we don't hand down raw rows,
// we hand down already-shaped view models.
export interface FriendRowData {
  linkId: string;           // friend_links.id for this connection
  userId: string;           // the other user's id
  name: string;
  avatarUrl: string | null;
  city: string | null;
  mutualCount: number;
  tripsTogether: number;
}

export interface PendingFriendData {
  linkId: string;
  direction: "incoming" | "outgoing";
  otherUserId: string;
  name: string;
  avatarUrl: string | null;
  mutualCount: number;
  createdAt: string;
}

export interface SuggestedFriendData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  mutualCount: number;
  mutualNames: string[];
}

export interface OtherUserData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  mutualCount: number;
}

export interface FamilySummary {
  id: string;
  name: string;
  memberCount: number;
  memberAvatars: { name: string; avatarUrl: string | null }[];
}

export interface FamilyRowData extends FamilySummary {
  linkId: string;           // family_links.id for this connection
  myFamilyId: string;       // which of MY families is connected to this one
  mutualCount: number;
  tripsTogether: number;
}

export interface PendingFamilyData extends FamilySummary {
  linkId: string;
  direction: "incoming" | "outgoing";
  myFamilyId: string;       // my family involved in this invite
  mutualCount: number;
  createdAt: string;
}

export interface SuggestedFamilyData extends FamilySummary {
  mutualCount: number;
  mutualNames: string[];
}

export interface OtherFamilyData extends FamilySummary {
  mutualCount: number;
}

export interface OwnedFamily {
  id: string;
  name: string;
}

const OTHER_LIST_CAP = 20;

export default async function FriendsServerPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // ─── Layer 1: parallel primary fetches ───────────────────────────
  const [
    profileRes,
    acceptedLinksRes,
    pendingLinksRes,
    ownFamiliesRes,
    otherUsersRes,
    myTripMembershipsRes,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, avatar_url, city")
      .eq("id", user.id)
      .single(),

    // All accepted friend links involving me (in either direction).
    supabase
      .from("friend_links")
      .select("id, user_id, friend_id, status, created_at")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted"),

    // Pending (incoming + outgoing).
    supabase
      .from("friend_links")
      .select("id, user_id, friend_id, status, created_at")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "pending"),

    // Families I own (drive the Families pill scope).
    supabase
      .from("families")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),

    // Candidate "Other people" — larger pool; we filter out already-connected on the server.
    supabase
      .from("user_profiles")
      .select("id, full_name, avatar_url, city")
      .neq("id", user.id)
      .limit(80),

    // Trips I'm a member of (accepted) — used to compute tripsTogether for friends.
    supabase
      .from("trip_members")
      .select("trip_id")
      .eq("user_id", user.id)
      .eq("status", "accepted"),
  ]);

  const profile = profileRes.data ?? null;

  // Accepted friend links → set of friend user-ids.
  const acceptedLinks = acceptedLinksRes.data ?? [];
  const friendIdToLink = new Map<string, { linkId: string; userId: string }>();
  for (const l of acceptedLinks) {
    const otherId = l.user_id === user.id ? l.friend_id : l.user_id;
    if (!friendIdToLink.has(otherId)) {
      friendIdToLink.set(otherId, { linkId: l.id, userId: otherId });
    }
  }
  const friendIds = Array.from(friendIdToLink.keys());

  // Pending links split by direction.
  const pendingLinks = pendingLinksRes.data ?? [];
  const pendingIncoming: typeof pendingLinks = [];
  const pendingOutgoing: typeof pendingLinks = [];
  for (const l of pendingLinks) {
    if (l.friend_id === user.id) pendingIncoming.push(l);
    else pendingOutgoing.push(l);
  }
  const pendingUserIds = new Set<string>();
  for (const l of pendingLinks) {
    pendingUserIds.add(l.user_id === user.id ? l.friend_id : l.user_id);
  }

  // Owned families.
  const ownedFamilies: OwnedFamily[] = (ownFamiliesRes.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
  }));
  const ownedFamilyIds = ownedFamilies.map((f) => f.id);
  const ownedFamilyIdSet = new Set(ownedFamilyIds);

  // ─── Layer 2: second wave of fetches that depend on layer 1 ─────
  const myTripIds = (myTripMembershipsRes.data ?? []).map((m) => m.trip_id);

  const [
    familyLinksRes,
    secondDegreeFriendsRes,
    friendProfilesRes,
    tripMembersForFriendsRes,
  ] = await Promise.all([
    // All family_links involving one of my families (accepted + pending, both directions).
    ownedFamilyIds.length
      ? supabase
          .from("family_links")
          .select("id, family_id, linked_family_id, requested_by, status, created_at")
          .or(
            `family_id.in.(${ownedFamilyIds.join(",")}),linked_family_id.in.(${ownedFamilyIds.join(",")})`
          )
      : Promise.resolve({ data: [] as any[], error: null }),

    // 2nd-degree friends: accepted links where one side is one of my friends (capped for cost).
    friendIds.length
      ? supabase
          .from("friend_links")
          .select("user_id, friend_id")
          .or(
            `user_id.in.(${friendIds.slice(0, 20).join(",")}),friend_id.in.(${friendIds.slice(0, 20).join(",")})`
          )
          .eq("status", "accepted")
      : Promise.resolve({ data: [] as any[], error: null }),

    // Profiles for everyone we'll render (friends, pending users, plus 2nd-degree once we know IDs).
    // We kick off a provisional fetch for direct friends + pending users here; suggested-friends are
    // fetched after we compute their IDs.
    (friendIds.length > 0 || pendingUserIds.size > 0)
      ? supabase
          .from("user_profiles")
          .select("id, full_name, avatar_url, city")
          .in("id", Array.from(new Set([...friendIds, ...pendingUserIds])))
      : Promise.resolve({ data: [] as any[], error: null }),

    // For tripsTogether on friend rows.
    friendIds.length && myTripIds.length
      ? supabase
          .from("trip_members")
          .select("trip_id, user_id")
          .in("trip_id", myTripIds)
          .in("user_id", friendIds)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const familyLinks = (familyLinksRes.data ?? []) as {
    id: string;
    family_id: string;
    linked_family_id: string;
    requested_by: string;
    status: string;
    created_at: string;
  }[];

  // ─── Compute tripsTogether map for friends ────────────────────────
  const tripsTogetherByFriend = new Map<string, number>();
  {
    const byUser = new Map<string, Set<string>>();
    for (const row of (tripMembersForFriendsRes.data ?? []) as { trip_id: string; user_id: string }[]) {
      if (!row.user_id) continue;
      let s = byUser.get(row.user_id);
      if (!s) { s = new Set(); byUser.set(row.user_id, s); }
      s.add(row.trip_id);
    }
    for (const [uid, set] of byUser.entries()) tripsTogetherByFriend.set(uid, set.size);
  }

  // ─── Compute suggested friends (2nd-degree) ───────────────────────
  // For each 2nd-degree edge, record which direct-friend introduced them.
  const friendIdSet = new Set(friendIds);
  const suggestedAgg = new Map<string, Set<string>>(); // candidateUserId -> set of myFriend (introducers)
  for (const edge of (secondDegreeFriendsRes.data ?? []) as { user_id: string; friend_id: string }[]) {
    // Figure out: one side is a direct friend of mine, the other is a candidate.
    const aIsFriend = friendIdSet.has(edge.user_id);
    const bIsFriend = friendIdSet.has(edge.friend_id);
    let candidate: string | null = null;
    let introducer: string | null = null;
    if (aIsFriend && !bIsFriend) { candidate = edge.friend_id; introducer = edge.user_id; }
    else if (bIsFriend && !aIsFriend) { candidate = edge.user_id; introducer = edge.friend_id; }
    else continue; // friend-of-friend edge where BOTH sides are my friends = skip
    if (!candidate || candidate === user.id) continue;
    if (friendIdSet.has(candidate)) continue;
    if (pendingUserIds.has(candidate)) continue;
    let s = suggestedAgg.get(candidate);
    if (!s) { s = new Set(); suggestedAgg.set(candidate, s); }
    if (introducer) s.add(introducer);
  }

  const suggestedFriendEntries = Array.from(suggestedAgg.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10);
  const suggestedFriendIds = suggestedFriendEntries.map(([id]) => id);

  // Mutual count between two users (capped at 20) for "Other people" rows.
  // We also need profiles for suggested + other candidates → do these fetches in parallel.
  const otherUsersInitial = (otherUsersRes.data ?? []) as {
    id: string; full_name: string | null; avatar_url: string | null; city: string | null;
  }[];
  // We'll compute mutuals for "Other people" from the suggestedAgg map — if they're in it,
  // they have the count; otherwise 0. This keeps cost bounded without a separate query.

  const [suggestedProfilesRes] = await Promise.all([
    suggestedFriendIds.length
      ? supabase
          .from("user_profiles")
          .select("id, full_name, avatar_url, city")
          .in("id", suggestedFriendIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  // Build a name lookup across all profiles we've fetched.
  const profileById = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; city: string | null }>();
  for (const p of (friendProfilesRes.data ?? []) as any[]) profileById.set(p.id, p);
  for (const p of (suggestedProfilesRes.data ?? []) as any[]) profileById.set(p.id, p);
  for (const p of otherUsersInitial) profileById.set(p.id, p);

  const nameOf = (id: string) => profileById.get(id)?.full_name ?? "Someone";

  // ─── Build friend rows ────────────────────────────────────────────
  const friendsData: FriendRowData[] = friendIds.map((fid) => {
    const p = profileById.get(fid);
    const link = friendIdToLink.get(fid)!;
    return {
      linkId: link.linkId,
      userId: fid,
      name: p?.full_name ?? "Unknown",
      avatarUrl: p?.avatar_url ?? null,
      city: p?.city ?? null,
      mutualCount: 0, // direct friends don't need mutual count in v1 (can add later)
      tripsTogether: tripsTogetherByFriend.get(fid) ?? 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ─── Build pending friends data ───────────────────────────────────
  const pendingFriendsData: PendingFriendData[] = pendingLinks.map((l) => {
    const otherId = l.user_id === user.id ? l.friend_id : l.user_id;
    const p = profileById.get(otherId);
    return {
      linkId: l.id,
      direction: (l.friend_id === user.id ? "incoming" : "outgoing") as "incoming" | "outgoing",
      otherUserId: otherId,
      name: p?.full_name ?? "Unknown",
      avatarUrl: p?.avatar_url ?? null,
      mutualCount: suggestedAgg.get(otherId)?.size ?? 0,
      createdAt: l.created_at,
    };
  }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // ─── Build suggested friends ──────────────────────────────────────
  const suggestedFriendsData: SuggestedFriendData[] = suggestedFriendEntries.map(([uid, introducers]) => {
    const p = profileById.get(uid);
    return {
      userId: uid,
      name: p?.full_name ?? "Someone",
      avatarUrl: p?.avatar_url ?? null,
      city: p?.city ?? null,
      mutualCount: introducers.size,
      mutualNames: Array.from(introducers).slice(0, 2).map(nameOf),
    };
  });

  // ─── Build "Other people" list (exclude: self, direct friends, pending, suggested) ─
  const excludedUserIds = new Set<string>([
    user.id,
    ...friendIds,
    ...Array.from(pendingUserIds),
    ...suggestedFriendIds,
  ]);
  const otherUsersData: OtherUserData[] = otherUsersInitial
    .filter((p) => !excludedUserIds.has(p.id))
    .slice(0, OTHER_LIST_CAP)
    .map((p) => ({
      userId: p.id,
      name: p.full_name ?? "Unknown",
      avatarUrl: p.avatar_url,
      city: p.city,
      mutualCount: suggestedAgg.get(p.id)?.size ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ─── Family section ───────────────────────────────────────────────
  // Collect every family ID we'll need member data for.
  const acceptedFamilyLinks = familyLinks.filter((l) => l.status === "accepted");
  const pendingFamilyLinks = familyLinks.filter((l) => l.status === "pending");

  // "Connected" family: accepted, other side is NOT one of mine.
  // Each link has family_id and linked_family_id; one side is mine, the other is the connection target.
  const connectionsList: { linkId: string; myFamilyId: string; otherFamilyId: string }[] = [];
  for (const l of acceptedFamilyLinks) {
    const myIsA = ownedFamilyIdSet.has(l.family_id);
    const myIsB = ownedFamilyIdSet.has(l.linked_family_id);
    if (myIsA && !myIsB) connectionsList.push({ linkId: l.id, myFamilyId: l.family_id, otherFamilyId: l.linked_family_id });
    else if (myIsB && !myIsA) connectionsList.push({ linkId: l.id, myFamilyId: l.linked_family_id, otherFamilyId: l.family_id });
  }
  const connectedFamilyIds = connectionsList.map((c) => c.otherFamilyId);
  const connectedFamilyIdSet = new Set(connectedFamilyIds);

  // Pending family links → direction + my family + other family
  const pendingFamilyEntries: { linkId: string; direction: "incoming" | "outgoing"; myFamilyId: string; otherFamilyId: string; createdAt: string }[] = [];
  for (const l of pendingFamilyLinks) {
    // requested_by is the user who initiated. If it's me → outgoing; else → incoming.
    const outgoing = l.requested_by === user.id;
    const myFamilyId = ownedFamilyIdSet.has(l.family_id) ? l.family_id : l.linked_family_id;
    const otherFamilyId = myFamilyId === l.family_id ? l.linked_family_id : l.family_id;
    pendingFamilyEntries.push({
      linkId: l.id,
      direction: outgoing ? "outgoing" : "incoming",
      myFamilyId,
      otherFamilyId,
      createdAt: l.created_at,
    });
  }

  // Second-degree family mutuals: for each of MY connected families, fetch THEIR accepted links.
  // Then each third-family becomes a suggestion with introducer = my connected family.
  const [familyLinksSecondDegreeRes, otherFamiliesPoolRes] = await Promise.all([
    connectedFamilyIds.length
      ? supabase
          .from("family_links")
          .select("family_id, linked_family_id")
          .or(
            `family_id.in.(${connectedFamilyIds.join(",")}),linked_family_id.in.(${connectedFamilyIds.join(",")})`
          )
          .eq("status", "accepted")
      : Promise.resolve({ data: [] as any[], error: null }),

    // Candidate "Other families" pool — not mine; we exclude already-connected/pending on server.
    supabase
      .from("families")
      .select("id, name, owner_id")
      .neq("owner_id", user.id)
      .limit(80),
  ]);

  const suggestedFamilyAgg = new Map<string, Set<string>>(); // candidateFamId -> introducer family ids
  const connectedFamIdSet = new Set(connectedFamilyIds);
  const pendingOtherFamilyIds = new Set(pendingFamilyEntries.map((p) => p.otherFamilyId));
  for (const edge of (familyLinksSecondDegreeRes.data ?? []) as { family_id: string; linked_family_id: string }[]) {
    const aIsConnected = connectedFamIdSet.has(edge.family_id);
    const bIsConnected = connectedFamIdSet.has(edge.linked_family_id);
    let candidate: string | null = null;
    let introducer: string | null = null;
    if (aIsConnected && !bIsConnected) { candidate = edge.linked_family_id; introducer = edge.family_id; }
    else if (bIsConnected && !aIsConnected) { candidate = edge.family_id; introducer = edge.linked_family_id; }
    else continue;
    if (!candidate) continue;
    if (ownedFamilyIdSet.has(candidate)) continue;
    if (connectedFamIdSet.has(candidate)) continue;
    if (pendingOtherFamilyIds.has(candidate)) continue;
    let s = suggestedFamilyAgg.get(candidate);
    if (!s) { s = new Set(); suggestedFamilyAgg.set(candidate, s); }
    if (introducer) s.add(introducer);
  }
  const suggestedFamilyEntries = Array.from(suggestedFamilyAgg.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10);
  const suggestedFamilyIds = suggestedFamilyEntries.map(([id]) => id);

  // "Other families" = pool minus my families, minus connected, minus pending, minus suggested.
  const otherFamiliesPool = (otherFamiliesPoolRes.data ?? []) as { id: string; name: string; owner_id: string }[];
  const excludedFamilyIds = new Set<string>([
    ...ownedFamilyIds,
    ...connectedFamilyIds,
    ...pendingFamilyEntries.map((p) => p.otherFamilyId),
    ...suggestedFamilyIds,
  ]);
  const otherFamiliesTrimmed = otherFamiliesPool
    .filter((f) => !excludedFamilyIds.has(f.id))
    .slice(0, OTHER_LIST_CAP);

  // Now fetch family names + members for every family we'll render.
  const allRenderedFamilyIds = Array.from(new Set([
    ...ownedFamilyIds,
    ...connectedFamilyIds,
    ...pendingFamilyEntries.map((p) => p.otherFamilyId),
    ...suggestedFamilyIds,
    ...otherFamiliesTrimmed.map((f) => f.id),
  ]));

  const [allFamilyNamesRes, allFamilyMembersRes] = await Promise.all([
    allRenderedFamilyIds.length
      ? supabase.from("families").select("id, name").in("id", allRenderedFamilyIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    allRenderedFamilyIds.length
      ? supabase
          .from("family_members")
          .select("family_id, name, avatar_url")
          .in("family_id", allRenderedFamilyIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const familyNameById = new Map<string, string>();
  for (const f of (allFamilyNamesRes.data ?? []) as { id: string; name: string }[]) {
    familyNameById.set(f.id, f.name);
  }
  const membersByFamilyId = new Map<string, { name: string; avatarUrl: string | null }[]>();
  for (const m of (allFamilyMembersRes.data ?? []) as { family_id: string; name: string; avatar_url: string | null }[]) {
    let arr = membersByFamilyId.get(m.family_id);
    if (!arr) { arr = []; membersByFamilyId.set(m.family_id, arr); }
    arr.push({ name: m.name, avatarUrl: m.avatar_url });
  }

  const summarizeFamily = (id: string): FamilySummary => {
    const members = membersByFamilyId.get(id) ?? [];
    return {
      id,
      name: familyNameById.get(id) ?? "Family",
      memberCount: members.length,
      memberAvatars: members.slice(0, 5),
    };
  };

  const connectedFamiliesData: FamilyRowData[] = connectionsList.map((c) => {
    const sum = summarizeFamily(c.otherFamilyId);
    return {
      ...sum,
      linkId: c.linkId,
      myFamilyId: c.myFamilyId,
      mutualCount: 0,
      tripsTogether: 0, // family-level trip attendance not modeled yet — leave 0 in v1
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const pendingFamiliesData: PendingFamilyData[] = pendingFamilyEntries.map((p) => {
    const sum = summarizeFamily(p.otherFamilyId);
    return {
      ...sum,
      linkId: p.linkId,
      direction: p.direction,
      myFamilyId: p.myFamilyId,
      mutualCount: suggestedFamilyAgg.get(p.otherFamilyId)?.size ?? 0,
      createdAt: p.createdAt,
    };
  }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const suggestedFamiliesData: SuggestedFamilyData[] = suggestedFamilyEntries.map(([fid, introducers]) => {
    const sum = summarizeFamily(fid);
    return {
      ...sum,
      mutualCount: introducers.size,
      mutualNames: Array.from(introducers).slice(0, 2).map((id) => familyNameById.get(id) ?? "Family"),
    };
  });

  const otherFamiliesData: OtherFamilyData[] = otherFamiliesTrimmed.map((f) => {
    const sum = summarizeFamily(f.id);
    return {
      ...sum,
      mutualCount: suggestedFamilyAgg.get(f.id)?.size ?? 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FriendsPage
      user={{
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }}
      ownedFamilies={ownedFamilies}
      friends={friendsData}
      pendingFriends={pendingFriendsData}
      suggestedFriends={suggestedFriendsData}
      otherUsers={otherUsersData}
      connectedFamilies={connectedFamiliesData}
      pendingFamilies={pendingFamiliesData}
      suggestedFamilies={suggestedFamiliesData}
      otherFamilies={otherFamiliesData}
    />
  );
}
