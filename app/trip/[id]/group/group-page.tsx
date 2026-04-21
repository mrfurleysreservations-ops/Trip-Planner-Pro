"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, ROLE_PREFERENCES } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripMember, FamilyMember } from "@/types/database.types";
import type { GroupPageProps, FriendWithProfile, FamilyWithMembers } from "./page";
import TripSubNav from "../trip-sub-nav";
import BulkInviteModal from "./bulk-invite-modal";

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

export default function GroupPage({ trip, members: initialMembers, friends, familiesWithMembers, otherAppUsers, otherFamilies, userId, isHost }: GroupPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [members, setMembers] = useState<TripMember[]>(initialMembers);
  const currentUserName = initialMembers.find((m) => m.user_id === userId)?.name || "Someone";
  const currentUserRole = members.find((m) => m.user_id === userId)?.role_preference ?? null;
  const [activeTab, setActiveTab] = useState<"friends" | "families">("friends");
  const [search, setSearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSentCount, setBulkSentCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the bulk-invite success toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Basic email shape check — same regex as the server route.
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  // POST to /api/send-invite. Best-effort — surfaces the error but never blocks
  // the DB row that was already created (host can re-send later).
  const triggerInviteEmail = useCallback(async (email: string, name: string) => {
    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, email, inviteeName: name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("send-invite failed:", j?.error || res.statusText);
        return { ok: false, error: j?.error as string | undefined };
      }
      return { ok: true as const };
    } catch (e: any) {
      console.error("send-invite threw:", e);
      return { ok: false, error: e?.message as string | undefined };
    }
  }, [trip.id]);

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

  // ─── Discovery lists: other app users + other families ───
  const discoverFriends = otherAppUsers
    .filter((f) => !memberUserIds.has(f.user_id))
    .filter((f) => !friendQ || (f.full_name || "").toLowerCase().includes(friendQ))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  const discoverFamilies = otherFamilies
    .filter((f) => !isFamilyAdded(f))
    .filter((f) => !familyQ || f.name.toLowerCase().includes(familyQ) || f.family_members.some((m) => m.name.toLowerCase().includes(familyQ)) || (f.owner_name || "").toLowerCase().includes(familyQ));

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
        // Best-effort: email the added app user a magic-link landing on /trip/[id]/invite.
        if (friend.email) {
          triggerInviteEmail(friend.email, friend.full_name || "Friend").catch(() => {});
        }
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

  // Shared per-invite helper: DB insert + email trigger + optimistic member row.
  // Called from BOTH the single-invite form and the bulk-invite modal so the
  // two flows stay in lockstep (same columns, same regex upstream, same email
  // path). Intentionally does NOT call logActivity — callers decide whether to
  // log once per invite (single) or once per batch (bulk).
  const insertExternalMember = useCallback(
    async (
      name: string,
      email: string
    ): Promise<
      | { ok: true; member: TripMember; mailOk: boolean; mailError?: string }
      | { ok: false; error: string }
    > => {
      const token = crypto.randomUUID();
      const { error } = await supabase.from("trip_members").insert({
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
        console.error("insertExternalMember error:", JSON.stringify(error, null, 2));
        return { ok: false, error: "Couldn't save the invite — try again" };
      }

      // Best-effort email. A failed email does NOT roll back the DB row — the
      // host can resend from the roster later.
      const mail = await triggerInviteEmail(email, name);

      const newMember: TripMember = {
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
      } as TripMember;

      return { ok: true, member: newMember, mailOk: mail.ok, mailError: mail.error };
    },
    [supabase, trip.id, userId, triggerInviteEmail]
  );

  const sendExternalInvite = useCallback(async () => {
    const name = inviteName.trim();
    const email = inviteEmail.trim();
    setInviteError(null);

    if (!name) {
      setInviteError("Name is required");
      return;
    }
    if (!email) {
      setInviteError("Email is required — we need to send them an invite link");
      return;
    }
    if (!isValidEmail(email)) {
      setInviteError("That doesn't look like a valid email address");
      return;
    }

    setLoading(true);
    const res = await insertExternalMember(name, email);
    if (!res.ok) {
      setInviteError(res.error);
      setLoading(false);
      return;
    }

    logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "added", entityType: "member", entityName: name, detail: "External invite", linkPath: `/trip/${trip.id}/group` });
    setMembers((prev) => [...prev, res.member]);

    if (res.mailOk) {
      setInviteName("");
      setInviteEmail("");
      setInviteError(null);
    } else {
      setInviteError(
        `Saved ${name} to the roster, but the invite email didn't send${res.mailError ? `: ${res.mailError}` : ""}. Re-send from the members list.`
      );
    }
    setLoading(false);
  }, [supabase, trip.id, userId, inviteName, inviteEmail, currentUserName, insertExternalMember]);

  // Adapter for BulkInviteModal's insertMember prop. Mirrors single-invite
  // behavior: DB insert failure → row failure; email failure → row still
  // counts as success (member is in the DB, host can resend from roster).
  // Avoids the "DB row orphaned from email" retry-duplicate problem.
  const insertMemberForBulk = useCallback(
    async (
      name: string,
      email: string
    ): Promise<{ ok: true; member: TripMember } | { ok: false; error: string }> => {
      const res = await insertExternalMember(name, email);
      if (!res.ok) return res;
      return { ok: true, member: res.member };
    },
    [insertExternalMember]
  );

  // Pre-computed at modal open time (and kept current while modal is open) so
  // the duplicate check against existing trip members is O(1).
  const existingMemberEmails = useMemo(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.email) s.add(m.email);
    });
    return s;
  }, [members]);

  const handleBulkSuccess = useCallback(
    (addedMembers: TripMember[]) => {
      if (addedMembers.length === 0) return;
      setMembers((prev) => [...prev, ...addedMembers]);
      setBulkSentCount((c) => c + addedMembers.length);
      // One aggregate activity entry per batch (not per member) — spec.
      logActivity(supabase, {
        tripId: trip.id,
        userId,
        userName: currentUserName,
        action: "added",
        entityType: "member",
        entityName: `${addedMembers.length} ${addedMembers.length === 1 ? "person" : "people"}`,
        detail: "Bulk invite",
        linkPath: `/trip/${trip.id}/group`,
      });
    },
    [supabase, trip.id, userId, currentUserName]
  );

  const handleBulkClose = useCallback(() => {
    setShowBulkModal(false);
    if (bulkSentCount > 0) {
      setToast(`✓ Sent ${bulkSentCount} invite${bulkSentCount === 1 ? "" : "s"}`);
    }
    setBulkSentCount(0);
  }, [bulkSentCount]);

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

      {/* ─── STICKY TOP REGION (3 rows) ─────────────────────────── */}
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
            const isMe = !!(m.user_id && m.user_id === userId);
            const role = ROLE_PREFERENCES.find((r) => r.value === m.role_preference);
            const statusColor =
              isHostChip ? th.accent :
              m.status === "accepted" ? "#2e7d32" :
              m.status === "pending"  ? "#856404" :
              "#888";
            const statusLabel =
              isHostChip ? "HOST" :
              m.status === "accepted" ? "✓" :
              m.status === "pending"  ? "…" : "×";

            // Click priority: self → role picker; host viewing a non-host → remove.
            // Non-host viewing a non-host chip: no-op.
            const handleChipClick = () => {
              if (isMe) {
                router.push(
                  `/trip/${trip.id}/role?redirectTo=${encodeURIComponent(`/trip/${trip.id}/group`)}`
                );
                return;
              }
              if (isHost && !isHostChip) removeMember(m.id);
            };
            const chipIsInteractive = isMe || (isHost && !isHostChip);

            return (
              <div
                key={m.id}
                onClick={handleChipClick}
                aria-label={isMe ? "Change your role" : undefined}
                style={{
                  flexShrink: 0,
                  background: isMe ? `${th.accent}0f` : "#fff",
                  border: isMe ? `1.5px solid ${th.accent}66` : `1px solid ${th.cardBorder}`,
                  borderRadius: 10,
                  padding: "6px 8px",
                  minWidth: 72,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: chipIsInteractive ? "pointer" : "default",
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
                  maxWidth: 68,
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
                {role && (
                  <div
                    title={role.label}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: th.muted,
                      maxWidth: 68,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {role.icon} {role.label}
                  </div>
                )}
                {isMe && (
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: th.accent,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Change ›
                  </div>
                )}
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

      </div>

      {/* ─── SCROLLABLE BODY ─────────────────────────────────────── */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 16px 24px" }}>

        {/* ─── FRIENDS TAB ─── */}
        {activeTab === "friends" && (
          <div>
            {/* 1. Invite someone new (moved to top) */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${th.cardBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>✉️ Invite someone new</div>
              <div style={{ fontSize: 11, color: th.muted, marginBottom: 8 }}>
                We'll email them a link to join this trip.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  value={inviteName}
                  onChange={(e) => { setInviteName(e.target.value); if (inviteError) setInviteError(null); }}
                  placeholder="Name *"
                  className="input-modern"
                  style={{ flex: "1 1 140px" }}
                />
                <input
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); if (inviteError) setInviteError(null); }}
                  placeholder="Email *"
                  type="email"
                  required
                  className="input-modern"
                  style={{ flex: "1 1 140px" }}
                />
                <button
                  onClick={sendExternalInvite}
                  disabled={loading || !inviteName.trim() || !inviteEmail.trim()}
                  className="btn"
                  style={{
                    background: th.accent,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    opacity: loading || !inviteName.trim() || !inviteEmail.trim() ? 0.5 : 1,
                  }}
                >
                  {loading ? "Sending…" : "Send Invite"}
                </button>
              </div>
              {/* Bulk-invite entry point — sits under the single-invite row. */}
              <div style={{ marginTop: 10, fontSize: 12, color: th.muted, fontWeight: 500 }}>
                Inviting a group?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowBulkModal(true);
                  }}
                  style={{
                    color: th.accent,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Add up to 20 people at once →
                </a>
              </div>
              {inviteError && (
                <div style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  background: "#fff3cd",
                  border: "1px solid #ffeaa7",
                  borderRadius: 8,
                  color: "#856404",
                  fontSize: 12,
                  fontWeight: 500,
                }}>
                  {inviteError}
                </div>
              )}
            </div>

            {/* 2. Search */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 10, top: 9, fontSize: 14, color: th.muted }}>🔍</span>
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

            {/* 3. App friends */}
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

            {/* 4. External invites (greyed) */}
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

            {/* 5. Also on the app (discovery — greyed) */}
            {discoverFriends.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                  Also on the app
                </div>
                {discoverFriends.map((f) => (
                  <div key={f.id} style={{
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
                        {(f.full_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{f.full_name || "Unknown"}</div>
                        <div style={{ fontSize: 11, color: "#bbb" }}>{f.email || ""}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => addFriend(f)}
                      disabled={loading}
                      className="btn"
                      style={{ background: th.accent, padding: "6px 14px", fontSize: 12, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
                    >
                      + Invite
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* No results */}
            {filteredFriends.length === 0 && filteredExternals.length === 0 && discoverFriends.length === 0 && friendQ && (
              <div style={{ textAlign: "center", padding: 24, color: th.muted, fontSize: 14 }}>
                No friends matching "{friendQ}"
              </div>
            )}
          </div>
        )}

        {/* ─── FAMILIES TAB ─── */}
        {activeTab === "families" && (
          <div>
            {/* 1. Search */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 10, top: 9, fontSize: 14, color: th.muted }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === "families" ? "Search families…" : "Search friends…"}
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

            {/* 2. Own families */}
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

            {/* 3. Friends' families */}
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

            {/* 4. Other families on the app (discovery — dimmed) */}
            {discoverFamilies.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>
                  Other families on the app
                </div>
                {discoverFamilies.map((fam) => (
                  <FamilyCard
                    key={fam.id}
                    fam={fam}
                    added={isFamilyAdded(fam)}
                    ownerLabel={`${fam.owner_name || "Someone"}'s family`}
                    theme={th}
                    loading={loading}
                    onAdd={() => addWholeFamily(fam)}
                    dimmed
                  />
                ))}
              </>
            )}

            {/* No results */}
            {ownFamilies.length === 0 && friendFamilies.length === 0 && discoverFamilies.length === 0 && familyQ && (
              <div style={{ textAlign: "center", padding: 24, color: th.muted, fontSize: 14 }}>
                No families matching "{familyQ}"
              </div>
            )}

            {ownFamilies.length === 0 && friendFamilies.length === 0 && discoverFamilies.length === 0 && !familyQ && (
              <div style={{ textAlign: "center", padding: 32, color: th.muted, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
                No families found. Create a family in your <span style={{ color: th.accent, cursor: "pointer" }} onClick={() => router.push("/profile")}>Profile</span> to add them here.
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bulk invite modal (opens from the "Add up to 20 people at once" link) */}
      {showBulkModal && (
        <BulkInviteModal
          tripId={trip.id}
          userId={userId}
          theme={th}
          existingEmails={existingMemberEmails}
          insertMember={insertMemberForBulk}
          onClose={handleBulkClose}
          onSuccess={handleBulkSuccess}
        />
      )}

      {/* Lightweight toast — only fired from bulk-invite success today */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 80, // sit above the sub-nav
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1100,
            background: "#1a1a1a",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            animation: "fadeIn 0.18s ease-out",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {/* Modal keyframes — scoped here to match Add Booking modal's pattern */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <TripSubNav tripId={trip.id} theme={th} role={currentUserRole} />
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
  dimmed?: boolean;
}

function FamilyCard({ fam, added, ownerLabel, theme, loading, onAdd, dimmed }: FamilyCardProps) {
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
      opacity: dimmed ? 0.55 : 1,
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
