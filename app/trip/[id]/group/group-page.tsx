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

const Toggle = ({ checked, disabled, onChange, accent }: { checked: boolean; disabled?: boolean; onChange?: () => void; accent: string }) => (
  <label style={{ position: "relative", display: "inline-block", width: 36, height: 20, flexShrink: 0, marginTop: 2 }}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
    <span style={{
      position: "absolute", inset: 0, borderRadius: 20, cursor: disabled ? "default" : "pointer",
      background: checked ? accent : "#ccc", transition: "0.3s", opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{
        position: "absolute", height: 14, width: 14, left: checked ? 19 : 3, bottom: 3,
        background: "#fff", borderRadius: "50%", transition: "0.3s",
      }} />
    </span>
  </label>
);

export default function GroupPage({ trip, members: initialMembers, friends, familiesWithMembers, userId, isHost }: GroupPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [members, setMembers] = useState<TripMember[]>(initialMembers);
  const currentUserName = initialMembers.find((m) => m.user_id === userId)?.name || "Someone";
  const [activeTab, setActiveTab] = useState<"friends" | "families">("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [familySearch, setFamilySearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Sets for quick lookups
  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id).filter(Boolean)), [members]);
  const memberFamilyMemberIds = useMemo(() => new Set(members.map((m) => m.family_member_id).filter(Boolean)), [members]);

  // ─── Filtered lists ───
  const friendQ = friendSearch.toLowerCase().trim();
  const filteredFriends = friends
    .filter((f) => !friendQ || (f.full_name || "").toLowerCase().includes(friendQ))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  // External invites (trip members with no user_id and no family_member_id)
  const externalMembers = members.filter((m) => !m.user_id && !m.family_member_id);
  const filteredExternals = externalMembers.filter(
    (m) => !friendQ || m.name.toLowerCase().includes(friendQ)
  );

  const familyQ = familySearch.toLowerCase().trim();
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

  const addFamilyMember = useCallback(async (fm: FamilyMember) => {
    // Skip if already on roster by family_member_id OR by linked user account
    if (memberFamilyMemberIds.has(fm.id)) return;
    if (fm.linked_user_id && memberUserIds.has(fm.linked_user_id)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          family_member_id: fm.id,
          name: fm.name,
          role: "member",
          status: "pending",
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
          status: "pending",
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
            status: "pending",
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
            status: "pending",
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

  // ─── Styles ───
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "12px 16px", background: "none", border: "none",
    borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
    fontWeight: active ? 700 : 500, color: active ? th.accent : th.muted,
    textAlign: "center", marginBottom: -2,
  });

  return (
    <div style={{ minHeight: "100vh", background: th.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>
            Group
          </h2>
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 16px 140px" }}>

        {/* ═══ ROSTER: Horizontal scroll ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16 }}>Who's Going</span>
            <span style={{ fontSize: 12, color: th.muted, fontWeight: 500, background: `${th.accent}18`, padding: "2px 10px", borderRadius: 20 }}>
              {members.length} {members.length === 1 ? "person" : "people"}
            </span>
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 24 }}>
          <div style={{
            display: "flex", gap: 12, overflowX: "auto", padding: "4px 0 12px",
            scrollBehavior: "smooth", WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}>
            {/* Host chip */}
            {hostMember && (
              <div style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "12px 14px", minWidth: 90,
                background: `${th.accent}1a`, border: `1.5px solid ${th.accent}`,
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", background: th.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 18,
                }}>
                  {hostMember.name[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {hostMember.name}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, background: th.accent, color: "#fff", padding: "1px 6px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Host
                </span>
                <Toggle checked={true} disabled={true} accent={th.accent} />
              </div>
            )}

            {/* Other member chips */}
            {otherMembers.map((m) => (
              <div key={m.id} style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "12px 14px", minWidth: 90,
                background: `${th.accent}0a`, border: `1.5px solid ${th.cardBorder}`,
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: `${th.accent}1a`, color: th.text,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 18,
                }}>
                  {m.name[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.name}
                </div>
                <StatusChip status={m.status} />
                <Toggle
                  checked={true}
                  accent={th.accent}
                  onChange={() => { if (isHost) removeMember(m.id); }}
                />
              </div>
            ))}

            {/* Empty state chip if only host */}
            {otherMembers.length === 0 && (
              <div style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 4, padding: "12px 20px", minWidth: 90,
                background: `${th.accent}08`, border: `1.5px dashed ${th.cardBorder}`,
                borderRadius: 14, textAlign: "center", color: th.muted, fontSize: 12,
              }}>
                <span style={{ fontSize: 24 }}>+</span>
                Add people below
              </div>
            )}
          </div>
          {/* Fade edge */}
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 12, width: 40, background: `linear-gradient(to right, transparent, ${th.bg})`, pointerEvents: "none" }} />
        </div>

        {/* ═══ ADD PEOPLE ═══ */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Add People</div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `2px solid ${th.cardBorder}` }}>
          <button style={tabBtnStyle(activeTab === "friends")} onClick={() => setActiveTab("friends")}>👥 Friends</button>
          <button style={tabBtnStyle(activeTab === "families")} onClick={() => setActiveTab("families")}>🏠 Families</button>
        </div>

        {/* ─── FRIENDS TAB ─── */}
        {activeTab === "friends" && (
          <div>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="Search friends..."
                className="input-modern"
                style={{ paddingLeft: 36 }}
              />
            </div>

            {/* App friends */}
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

            {/* External invites (greyed) */}
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

            {/* External invite form */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${th.cardBorder}` }}>
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
          </div>
        )}

        {/* ─── FAMILIES TAB ─── */}
        {activeTab === "families" && (
          <div>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
              <input
                value={familySearch}
                onChange={(e) => setFamilySearch(e.target.value)}
                placeholder="Search families..."
                className="input-modern"
                style={{ paddingLeft: 36 }}
              />
            </div>

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

      {/* ── Sticky "Save & Continue" CTA ── */}
      <div style={{
        position: "fixed",
        bottom: "56px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "480px",
        zIndex: 101,
        padding: "0 16px 12px",
        boxSizing: "border-box" as const,
        background: `linear-gradient(to top, ${th.bg} 70%, transparent)`,
        pointerEvents: "none" as const,
      }}>
        <button
          onClick={async () => { router.push(`/trip/${trip.id}`); }}
          style={{
            pointerEvents: "auto" as const,
            width: "100%",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2} 100%)`,
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            minHeight: "52px",
          }}
        >
          {"Save & Continue to Your Trip →"}
        </button>
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
                                                                                                                                                                                                                                                                                                                                                                                                        