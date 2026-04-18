"use client";
import { useState, useCallback, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripMember, FamilyMember } from "@/types/database.types";
import type { GroupPageProps, FriendWithProfile, FamilyWithMembers } from "./page";
import TripSubNav from "../trip-sub-nav";

// ─── Small UI components ───

const StatusChip = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pending:  { bg: "#fef3cd", text: "#856404", label: "Pending" },
    accepted: { bg: "#d4edda", text: "#155724", label: "Accepted" },
    declined: { bg: "#f0f0f0", text: "#666",    label: "Declined" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: "10px",
      fontSize: "9px", fontWeight: 600, background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  );
};

export default function GroupPage({ trip, members: initialMembers, friends, familiesWithMembers, userId, isHost }: GroupPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [members, setMembers] = useState<TripMember[]>(initialMembers);
  const currentUserName = initialMembers.find((m) => m.user_id === userId)?.name || "Someone";
  const [activeTab, setActiveTab] = useState<"friends" | "families">("friends");
  const [search, setSearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Sets for quick lookups
  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id).filter(Boolean)), [members]);
  const memberFamilyMemberIds = useMemo(() => new Set(members.map((m) => m.family_member_id).filter(Boolean)), [members]);

  // ─── Filtered lists ───
  const friendQ = activeTab === "friends" ? search.toLowerCase().trim() : "";
  const filteredFriends = friends
    .filter((f) => !friendQ || (f.full_name || "").toLowerCase().includes(friendQ))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  // External invites (trip members with no user_id and no family_member_id)
  const externalMembers = members.filter((m) => !m.user_id && !m.family_member_id);
  const filteredExternals = externalMembers.filter(
    (m) => !friendQ || m.name.toLowerCase().includes(friendQ)
  );

  const familyQ = activeTab === "families" ? search.toLowerCase().trim() : "";
  const ownFamilies = familiesWithMembers
    .filter((f) => f.is_own)
    .filter((f) => !familyQ || f.name.toLowerCase().includes(familyQ) || f.family_members.some((m) => m.name.toLowerCase().includes(familyQ)));
  const friendFamilies = familiesWithMembers
    .filter((f) => !f.is_own)
    .filter((f) => !familyQ || f.name.toLowerCase().includes(familyQ) || f.family_members.some((m) => m.name.toLowerCase().includes(familyQ)) || (f.owner_name || "").toLowerCase().includes(familyQ));

  // Check if a family is "fully added" (all members on roster)
  const isFamilyAdded = useCallback((fam: FamilyWithMembers) => {
    return fam.family_members.length > 0 && fam.family_members.every(
      (fm) => memberFamilyMemberIds.has(fm.id) || (fm.linked_user_id && memberUserIds.has(fm.linked_user_id))
    );
  }, [memberFamilyMemberIds, memberUserIds]);

  // ─── Actions ───

  const addFriend = useCallback(async (friend: FriendWithProfile) => {
    if (memberUserIds.has(friend.user_id)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          user_id: friend.user_id,
          name: friend.full_name || "Friend",
          email: friend.email,
          role: "member",
          status: "pending",
          invited_by: userId,
        });
      if (error) {
        console.error("addFriend error:", JSON.stringify(error, null, 2));
      } else {
        logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "added", entityType: "member", entityName: friend.full_name || "Friend", linkPath: `/trip/${trip.id}/group` });
        // Build a local placeholder — avoids .select() triggering SELECT RLS recursion
        setMembers((prev) => [...prev, {
          id: crypto.randomUUID(),
          trip_id: trip.id,
          user_id: friend.user_id,
          family_member_id: null,
          name: friend.full_name || "Friend",
          email: friend.email || null,
          role: "member",
          status: "pending",
          invited_by: userId,
          invite_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TripMember]);
      }
    } catch (e) {
      console.error("addFriend CAUGHT:", e);
    }
    setLoading(false);
  }, [supabase, trip.id, userId, memberUserIds]);

  const addFamilyMember = useCallback(async (fm: FamilyMember, isOwnFamily: boolean) => {
    // Skip if already on roster by family_member_id OR by linked user account
    if (memberFamilyMemberIds.has(fm.id)) return;
    if (fm.linked_user_id && memberUserIds.has(fm.linked_user_id)) return;
    // Own family → auto-accepted (no invite needed), friend's family → pending
    const memberStatus = isOwnFamily ? "accepted" : "pending";
    setLoading(true);
    try {
      const { error } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          family_member_id: fm.id,
          name: fm.name,
          role: "member",
          status: memberStatus,
          invited_by: userId,
        });
      if (error) {
        console.error("addFamilyMember error:", JSON.stringify(error, null, 2));
      } else {
        logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "added", entityType: "member", entityName: fm.name, linkPath: `/trip/${trip.id}/group` });
        setMembers((prev) => [...prev, {
          id: crypto.randomUUID(),
          trip_id: trip.id,
          user_id: null,
          family_member_id: fm.id,
          name: fm.name,
          email: null,
          role: "member",
          status: memberStatus,
          invited_by: userId,
          invite_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TripMember]);
      }
    } catch (e) {
      console.error("addFamilyMember CAUGHT:", e);
    }
    setLoading(false);
  }, [supabase, trip.id, userId, memberFamilyMemberIds]);

  const addWholeFamily = useCallback(async (fam: FamilyWithMembers) => {
    setLoading(true);
    // Own family → auto-accepted (no invite needed), friend's family → pending
    const memberStatus = fam.is_own ? "accepted" : "pending";
    const toAdd = fam.family_members.filter(
      (fm) => !memberFamilyMemberIds.has(fm.id) && !(fm.linked_user_id && memberUserIds.has(fm.linked_user_id))
    );
    for (const fm of toAdd) {
      try {
        const { error } = await supabase
          .from("trip_members")
          .insert({
            trip_id: trip.id,
            family_member_id: fm.id,
            name: fm.name,
            role: "member",
            status: memberStatus,
            invited_by: userId,
          });
        if (error) {
          console.error("addWholeFamily error for", fm.name, ":", JSON.stringify(error, null, 2));
        } else {
          setMembers((prev) => [...prev, {
            id: crypto.randomUUID(),
            trip_id: trip.id,
            user_id: null,
            family_member_id: fm.id,
            name: fm.name,
            email: null,
            role: "member",
            status: memberStatus,
            invited_by: userId,
            invite_token: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as TripMember]);
        }
      } catch (e) {
        console.error("addWholeFamily CAUGHT for", fm.name, ":", e);
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, memberFamilyMemberIds]);

  const sendExternalInvite = useCallback(async () => {
    if (!inviteName.trim()) return;
    setLoading(true);
    const token = crypto.randomUUID();
    const name = inviteName.trim();
    const email = inviteEmail.trim() || null;
    const { error } = await supabase
      .from("trip_members")
      .insert({
        trip_id: trip.id,
        user_id: null,
        name,
        email,
        role: "member",
        status: "pending",
        invited_by: userId,
        invite_token: token,
      });
    if (error) {
      console.error("sendExternalInvite error:", JSON.stringify(error, null, 2));
    } else {
      logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "added", entityType: "member", entityName: name, detail: "External invite", linkPath: `/trip/${trip.id}/group` });
      setMembers((prev) => [...prev, {
        id: crypto.randomUUID(),
        trip_id: trip.id,
        user_id: null,
        family_member_id: null,
        name,
        email,
        role: "member",
        status: "pending",
        invited_by: userId,
        invite_token: token,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TripMember]);
      setInviteName("");
      setInviteEmail("");
    }
    setLoading(false);
  }, [supabase, trip.id, userId, inviteName, inviteEmail]);

  const removeMember = useCallback(async (memberId: string) => {
    setLoading(true);
    const removedMember = members.find((m) => m.id === memberId);
    await supabase.from("trip_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (removedMember) {
      logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "removed", entityType: "member", entityName: removedMember.name, linkPath: `/trip/${trip.id}/group` });
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, members]);

  const isFriendAdded = (friendUserId: string) => memberUserIds.has(friendUserId);

  // Host is always first in roster
  const hostMember = members.find((m) => m.role === "host");
  const otherMembers = members.filter((m) => m.role !== "host");
  const orderedMembers = hostMember ? [hostMember, ...otherMembers] : members;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif", paddingBottom: 56 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ─── STICKY TOP REGION (4 rows) ─────────────────────────── */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: th.headerBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${th.cardBorder}`,
      }}>
        {/* Row 1 — Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 8px",
          gap: 8,
        }}>
          <button
            onClick={() => router.push(`/trip/${trip.id}`)}
            aria-label="Back to trip hub"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `${th.accent}1a`,
              border: `1.5px solid ${th.accent}40`,
              color: th.accent,
              fontSize: 22,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <h2 style={{
            flex: 1,
            margin: "0 0 0 10px",
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 20,
            color: th.text,
          }}>
            Group
          </h2>
          <button
            onClick={() => router.push(`/trip/${trip.id}?from=group`)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: `0 2px 8px ${th.accent}4d`,
              flexShrink: 0,
            }}
          >
            Save ✓
          </button>
        </div>

        {/* Row 2 — Crew roster (compact chips) */}
        <div style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          scrollbarWidth: "none",
          padding: "4px 16px 10px",
        }}>
          {orderedMembers.map((m) => {
            const isHostChip = m.role === "host";
            const statusColor =
              isHostChip ? th.accent :
              m.status === "accepted" ? "#2e7d32" :
              m.status === "pending"  ? "#856404" :
              "#888";
            const statusLabel =
              isHostChip ? "HOST" :
              m.status === "accepted" ? "✓" :
              m.status === "pending"  ? "…" : "×";
            return (
              <div
                key={m.id}
                onClick={() => { if (!isHostChip && isHost) removeMember(m.id); }}
                style={{
                  flexShrink: 0,
                  background: "#fff",
                  border: `1px solid ${th.cardBorder}`,
                  borderRadius: 10,
                  padding: "6px 8px",
                  minWidth: 62,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: isHostChip ? "default" : (isHost ? "pointer" : "default"),
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: isHostChip ? th.accent : `${th.accent}1a`,
                    color: isHostChip ? "#fff" : th.text,
                    fontWeight: 700,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${statusColor}`,
                  }}
                >
                  {m.name[0]?.toUpperCase() || "?"}
                </div>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: th.text,
                  maxWidth: 58,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {m.name}
                </div>
                <div style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: statusColor,
                }}>
                  {statusLabel}
                </div>
              </div>
            );
          })}

          {/* Empty state chip if only host */}
          {otherMembers.length === 0 && (
            <div style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 12px",
              minWidth: 62,
              background: `${th.accent}08`,
              border: `1.5px dashed ${th.cardBorder}`,
              borderRadius: 10,
              color: th.muted,
              fontSize: 10,
              fontWeight: 600,
              textAlign: "center",
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              Add below
            </div>
          )}
        </div>

        {/* Row 3 — Friends/Families pill (canonical) */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 16px 6px" }}>
          <div style={{
            display: "inline-flex",
            background: th.card,
            border: `1.5px solid ${th.cardBorder}`,
            borderRadius: 20,
          }}>
            {(["friends", "families"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  background: activeTab === t ? th.accent : "transparent",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: activeTab === t ? 700 : 500,
                  color: activeTab === t ? "#fff" : th.muted,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {t === "friends" ? "👥 Friends" : "🏠 Families"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 4 — Search */}
        <div style={{ padding: "2px 16px 10px", position: "relative" }}>
          <span style={{ position: "absolute", left: "26px", top: 9, fontSize: 14, color: th.muted }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "friends" ? "Search friends…" : "Search families…"}
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              border: `1px solid ${th.cardBorder}`,
              borderRadius: 10,
              background: "#fff",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─────────────────────────────────────── */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 16px 24px" }}>

        {/* ─── FRIENDS TAB ─── */}
        {activeTab === "friends" && (
          <div>
            {/* 1. Invite someone new (moved to top) */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${th.cardBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✉️ Invite someone new</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Name"
                  className="input-modern"
                  style={{ flex: "1 1 140px" }}
                />
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="input-modern"
                  style={{ flex: "1 1 140px" }}
                />
                <button
                  onClick={sendExternalInvite}
                  disabled={loading || !inviteName.trim()}
                  className="btn"
                  style={{ background: th.accent, padding: "8px 16px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", opacity: loading || !inviteName.trim() ? 0.5 : 1 }}
                >
                  Send Invite
                </button>
              </div>
            </div>

            {/* 2. App friends */}
            {filteredFriends.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Your Friends
                </div>
                {filteredFriends.map((f) => {
                  const added = isFriendAdded(f.user_id);
                  return (
                    <div key={f.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                      border: `1px solid ${th.cardBorder}`, background: th.card,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", background: th.accent,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 14, fontWeight: 700,
                          }}>
                            {(f.full_name || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{f.full_name || "Unknown"}</div>
                      </div>
                      {added ? (
                        <span style={{ padding: "6px 14px", background: "#d4edda", color: "#155724", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✓ Added</span>
                      ) : (
                        <button
                          onClick={() => addFriend(f)}
                          disabled={loading}
                          className="btn"
                          style={{ background: th.accent, padding: "6px 14px", fontSize: 12, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* 3. External invites (greyed) */}
            {filteredExternals.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                  Not on the app yet
                </div>
                {filteredExternals.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                    border: "1px solid #e0e0e0", background: "#f0f0f0", opacity: 0.45,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", background: "#bbb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 14, fontWeight: 700,
                      }}>
                        {m.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>Invited — hasn't joined yet</div>
                      </div>
                    </div>
                    <span style={{ padding: "6px 14px", background: "#d4edda", color: "#155724", borderRadius: 8, fontSize: 12, fontWeight: 600, opacity: 0.5 }}>✓ Invited</span>
                  </div>
                ))}
              </>
            )}

            {/* No results */}
            {filteredFriends.length === 0 && filteredExternals.length === 0 && friendQ && (
              <div style={{ textAlign: "center", padding: 24, color: th.muted, fontSize: 14 }}>
                No friends matching "{friendQ}"
              </div>
            )}
          </div>
        )}

        {/* ─── FAMILIES TAB ─── */}
        {activeTab === "families" && (
          <div>
            {/* Own families */}
            {ownFamilies.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Your Families
                </div>
                {ownFamilies.map((fam) => (
                  <FamilyCard key={fam.id} fam={fam} added={isFamilyAdded(fam)} ownerLabel="Your family" theme={th} loading={loading} onAdd={() => addWholeFamily(fam)} />
                ))}
              </>
            )}

            {/* Friends' families */}
            {friendFamilies.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                  Friends' Families
                </div>
                {friendFamilies.map((fam) => (
                  <FamilyCard key={fam.id} fam={fam} added={isFamilyAdded(fam)} ownerLabel={`${fam.owner_name || "Friend"}'s family`} theme={th} loading={loading} onAdd={() => addWholeFamily(fam)} />
                ))}
              </>
            )}

            {/* No results */}
            {ownFamilies.length === 0 && friendFamilies.length === 0 && familyQ && (
              <div style={{ textAlign: "center", padding: 24, color: th.muted, fontSize: 14 }}>
                No families matching "{familyQ}"
              </div>
            )}

            {ownFamilies.length === 0 && friendFamilies.length === 0 && !familyQ && (
              <div style={{ textAlign: "center", padding: 32, color: th.muted, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
                No families found. Create a family in your <span style={{ color: th.accent, cursor: "pointer" }} onClick={() => router.push("/profile")}>Profile</span> to add them here.
              </div>
            )}
          </div>
        )}

      </div>

      <TripSubNav tripId={trip.id} theme={th} />
    </div>
  );
}

// ─── Family card component (outside main component to avoid remount) ───

interface FamilyCardProps {
  fam: FamilyWithMembers;
  added: boolean;
  ownerLabel: string;
  theme: { accent: string; accent2: string; cardBorder: string; card: string };
  loading: boolean;
  onAdd: () => void;
}

function FamilyCard({ fam, added, ownerLabel, theme, loading, onAdd }: FamilyCardProps) {
  const ageIcon = (age: string | null) => {
    if (!age) return "🧑";
    const map: Record<string, string> = { adult: "🧑", kid: "🧒", toddler: "👶", baby: "🍼", teen: "🧑", senior: "🧑" };
    return map[age] || "🧑";
  };

  return (
    <div style={{
      background: added ? "rgba(40,167,69,0.06)" : theme.card,
      border: `1.5px solid ${added ? "#28a745" : theme.cardBorder}`,
      borderRadius: 14, padding: 16, marginBottom: 10, cursor: added ? "default" : "pointer",
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>🏠 {fam.name}</div>
          <div style={{ fontSize: 11, color: "#8a8a8a", fontWeight: 500 }}>{ownerLabel}</div>
        </div>
        {added ? (
          <span style={{ padding: "6px 16px", background: "#d4edda", color: "#155724", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✓ Added</span>
        ) : (
          <button
            onClick={onAdd}
            disabled={loading}
            className="btn"
            style={{ background: theme.accent, padding: "6px 16px", fontSize: 12, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
          >
            + Add All
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {fam.family_members.map((fm) => (
          <span key={fm.id} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", background: added ? "rgba(40,167,69,0.1)" : `${theme.accent}14`,
            borderRadius: 20, fontSize: 12, fontWeight: 500,
          }}>
            {ageIcon(fm.age_type)} {fm.name}
          </span>
        ))}
      </div>
    </div>
  );
}
