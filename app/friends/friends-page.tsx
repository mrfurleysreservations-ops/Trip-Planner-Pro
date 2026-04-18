"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { THEMES } from "@/lib/constants";
import TopNav from "@/app/top-nav";
import { PillBtn, SectionHeader } from "@/app/components/ui";
import type {
  FriendRowData,
  PendingFriendData,
  SuggestedFriendData,
  OtherUserData,
  FamilyRowData,
  PendingFamilyData,
  SuggestedFamilyData,
  OtherFamilyData,
  OwnedFamily,
} from "./page";

// ─── Props ──────────────────────────────────────────────────────────

interface FriendsPageProps {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  ownedFamilies: OwnedFamily[];
  friends: FriendRowData[];
  pendingFriends: PendingFriendData[];
  suggestedFriends: SuggestedFriendData[];
  otherUsers: OtherUserData[];
  connectedFamilies: FamilyRowData[];
  pendingFamilies: PendingFamilyData[];
  suggestedFamilies: SuggestedFamilyData[];
  otherFamilies: OtherFamilyData[];
  unreadChatCount: number;
  pendingFriendCount: number;
  unreadAlertCount: number;
}

// ─── Main page ──────────────────────────────────────────────────────

export default function FriendsPage(props: FriendsPageProps) {
  const {
    user,
    ownedFamilies,
    friends,
    pendingFriends,
    suggestedFriends,
    otherUsers,
    connectedFamilies,
    pendingFamilies,
    suggestedFamilies,
    otherFamilies,
    unreadChatCount,
    pendingFriendCount,
    unreadAlertCount,
  } = props;

  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES.home;
  const accent = th.accent;

  const [view, setView] = useState<"friends" | "families">("friends");
  const [pendingOpen, setPendingOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAllOther, setShowAllOther] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Optimistic hide sets — the server is the source of truth, but we hide rows
  // locally while router.refresh() races to catch up so the UI feels instant.
  const [hiddenPendingLinks, setHiddenPendingLinks] = useState<Set<string>>(new Set());
  const [hiddenSuggestedUsers, setHiddenSuggestedUsers] = useState<Set<string>>(new Set());
  const [hiddenOtherUsers, setHiddenOtherUsers] = useState<Set<string>>(new Set());
  const [hiddenSuggestedFamilies, setHiddenSuggestedFamilies] = useState<Set<string>>(new Set());
  const [hiddenOtherFamilies, setHiddenOtherFamilies] = useState<Set<string>>(new Set());

  // ─── Filtering ───────────────────────────────────────────────────
  const lc = (s: string) => s.toLowerCase();
  const q = lc(search.trim());

  const filteredFriends = useMemo(
    () => friends.filter((f) => !q || lc(f.name).includes(q)),
    [friends, q]
  );
  const filteredOtherUsers = useMemo(
    () =>
      otherUsers
        .filter((u) => !hiddenOtherUsers.has(u.userId))
        .filter((u) => !q || lc(u.name).includes(q)),
    [otherUsers, q, hiddenOtherUsers]
  );
  const filteredConnectedFamilies = useMemo(
    () => connectedFamilies.filter((f) => !q || lc(f.name).includes(q)),
    [connectedFamilies, q]
  );
  const filteredOtherFamilies = useMemo(
    () =>
      otherFamilies
        .filter((f) => !hiddenOtherFamilies.has(f.id))
        .filter((f) => !q || lc(f.name).includes(q)),
    [otherFamilies, q, hiddenOtherFamilies]
  );

  const visiblePendingFriends = pendingFriends.filter((p) => !hiddenPendingLinks.has(p.linkId));
  const visiblePendingFamilies = pendingFamilies.filter((p) => !hiddenPendingLinks.has(p.linkId));

  const visibleSuggestedFriends = suggestedFriends.filter((s) => !hiddenSuggestedUsers.has(s.userId));
  const visibleSuggestedFamilies = suggestedFamilies.filter((s) => !hiddenSuggestedFamilies.has(s.id));

  const currentPending = view === "friends" ? visiblePendingFriends : visiblePendingFamilies;
  const incomingCount = currentPending.filter((p) => p.direction === "incoming").length;
  const outgoingCount = currentPending.filter((p) => p.direction === "outgoing").length;

  // ─── Handlers: friend actions ────────────────────────────────────
  async function acceptFriend(linkId: string) {
    setBusyId(linkId);
    setHiddenPendingLinks((prev) => new Set(prev).add(linkId));
    const { error } = await supabase.from("friend_links").update({ status: "accepted" }).eq("id", linkId);
    if (error) {
      alert(`Could not accept: ${error.message}`);
      setHiddenPendingLinks((prev) => { const n = new Set(prev); n.delete(linkId); return n; });
    } else {
      router.refresh();
    }
    setBusyId(null);
  }

  async function declinePendingFriend(linkId: string) {
    setBusyId(linkId);
    setHiddenPendingLinks((prev) => new Set(prev).add(linkId));
    const { error } = await supabase.from("friend_links").delete().eq("id", linkId);
    if (error) {
      alert(`Could not decline: ${error.message}`);
      setHiddenPendingLinks((prev) => { const n = new Set(prev); n.delete(linkId); return n; });
    } else {
      router.refresh();
    }
    setBusyId(null);
  }

  async function sendFriendRequest(targetUserId: string, source: "suggested" | "other") {
    setBusyId(targetUserId);
    if (source === "suggested") {
      setHiddenSuggestedUsers((prev) => new Set(prev).add(targetUserId));
    } else {
      setHiddenOtherUsers((prev) => new Set(prev).add(targetUserId));
    }
    const { error } = await supabase.from("friend_links").insert({
      user_id: user.id,
      friend_id: targetUserId,
      status: "pending",
    });
    if (error) {
      alert(`Could not send request: ${error.message}`);
      if (source === "suggested") {
        setHiddenSuggestedUsers((prev) => { const n = new Set(prev); n.delete(targetUserId); return n; });
      } else {
        setHiddenOtherUsers((prev) => { const n = new Set(prev); n.delete(targetUserId); return n; });
      }
    } else {
      router.refresh();
    }
    setBusyId(null);
  }

  // ─── Handlers: family actions ────────────────────────────────────
  async function acceptFamily(linkId: string) {
    setBusyId(linkId);
    setHiddenPendingLinks((prev) => new Set(prev).add(linkId));
    const { error } = await supabase.from("family_links").update({ status: "accepted" }).eq("id", linkId);
    if (error) {
      alert(`Could not accept: ${error.message}`);
      setHiddenPendingLinks((prev) => { const n = new Set(prev); n.delete(linkId); return n; });
    } else {
      router.refresh();
    }
    setBusyId(null);
  }

  async function declinePendingFamily(linkId: string) {
    setBusyId(linkId);
    setHiddenPendingLinks((prev) => new Set(prev).add(linkId));
    const { error } = await supabase.from("family_links").delete().eq("id", linkId);
    if (error) {
      alert(`Could not decline: ${error.message}`);
      setHiddenPendingLinks((prev) => { const n = new Set(prev); n.delete(linkId); return n; });
    } else {
      router.refresh();
    }
    setBusyId(null);
  }

  async function connectFamily(targetFamilyId: string, source: "suggested" | "other") {
    if (ownedFamilies.length === 0) {
      alert("Create a family on your Profile page before connecting to others.");
      return;
    }
    const myFamilyId = ownedFamilies[0].id;
    const myFamilyName = ownedFamilies[0].name;
    setBusyId(targetFamilyId);
    if (source === "suggested") {
      setHiddenSuggestedFamilies((prev) => new Set(prev).add(targetFamilyId));
    } else {
      setHiddenOtherFamilies((prev) => new Set(prev).add(targetFamilyId));
    }
    const { error } = await supabase.from("family_links").insert({
      family_id: myFamilyId,
      linked_family_id: targetFamilyId,
      requested_by: user.id,
      status: "pending",
    });
    if (error) {
      alert(`Could not connect: ${error.message}`);
      if (source === "suggested") {
        setHiddenSuggestedFamilies((prev) => { const n = new Set(prev); n.delete(targetFamilyId); return n; });
      } else {
        setHiddenOtherFamilies((prev) => { const n = new Set(prev); n.delete(targetFamilyId); return n; });
      }
    } else {
      if (ownedFamilies.length > 1) {
        // Quiet toast via alert — v1 behavior per spec.
        alert(`Connected from ${myFamilyName}`);
      }
      router.refresh();
    }
    setBusyId(null);
  }

  // ─── FAB placeholder ─────────────────────────────────────────────
  function onFabClick() {
    if (view === "friends") {
      alert("Add friend by email — coming soon.");
    } else {
      alert("Connect a family — coming soon.");
    }
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, paddingBottom: 96 }}>
      {/* ─── STICKY TOP (title + TopNav + pill toggle) ─────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(248,248,248,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {/* Row 1 — Title + Share link */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 8px",
              gap: 8,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "'Outfit', sans-serif",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: th.text,
              }}
            >
              Friends
            </h1>
            <button
              onClick={() => alert("Share link — coming soon.")}
              style={{
                background: "#fff",
                border: "1.5px solid #e0e0e0",
                borderRadius: 10,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#555",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Share link
            </button>
          </div>

          {/* Row 2 — Top-level nav */}
          <div style={{ padding: "0 16px" }}>
            <TopNav
              unreadChatCount={unreadChatCount}
              pendingFriendCount={pendingFriendCount}
              unreadAlertCount={unreadAlertCount}
            />
          </div>

          {/* Row 3 — Pill toggle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 16px 10px" }}>
            <div
              style={{
                display: "inline-flex",
                background: th.card,
                border: `1.5px solid ${th.cardBorder}`,
                borderRadius: 20,
              }}
            >
              <PillBtn label="Friends" active={view === "friends"} onClick={() => setView("friends")} accent={accent} muted={th.muted} />
              <PillBtn label="Families" active={view === "families"} onClick={() => setView("families")} accent={accent} muted={th.muted} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ────────────────────────────────────────── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "10px 16px 24px" }}>
        {view === "friends" ? (
          <FriendsView
            accent={accent}
            pending={visiblePendingFriends}
            incomingCount={incomingCount}
            outgoingCount={outgoingCount}
            pendingOpen={pendingOpen}
            setPendingOpen={setPendingOpen}
            suggested={visibleSuggestedFriends}
            search={search}
            setSearch={setSearch}
            friends={filteredFriends}
            totalFriends={friends.length}
            otherUsers={filteredOtherUsers}
            showAllOther={showAllOther}
            setShowAllOther={setShowAllOther}
            busyId={busyId}
            onAcceptFriend={acceptFriend}
            onDeclineFriend={declinePendingFriend}
            onAddSuggested={(id) => sendFriendRequest(id, "suggested")}
            onAddOther={(id) => sendFriendRequest(id, "other")}
          />
        ) : (
          <FamiliesView
            accent={accent}
            pending={visiblePendingFamilies}
            incomingCount={incomingCount}
            outgoingCount={outgoingCount}
            pendingOpen={pendingOpen}
            setPendingOpen={setPendingOpen}
            suggested={visibleSuggestedFamilies}
            search={search}
            setSearch={setSearch}
            families={filteredConnectedFamilies}
            totalFamilies={connectedFamilies.length}
            otherFamilies={filteredOtherFamilies}
            showAllOther={showAllOther}
            setShowAllOther={setShowAllOther}
            busyId={busyId}
            onAcceptFamily={acceptFamily}
            onDeclineFamily={declinePendingFamily}
            onConnectSuggested={(id) => connectFamily(id, "suggested")}
            onConnectOther={(id) => connectFamily(id, "other")}
          />
        )}
      </div>

      {/* ─── FAB ─────────────────────────────────────────────────── */}
      <button
        aria-label={view === "friends" ? "Add friend" : "Connect family"}
        onClick={onFabClick}
        style={{
          position: "fixed",
          bottom: 24,
          right: 16,
          zIndex: 50,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: accent,
          color: "#fff",
          border: "none",
          fontSize: 28,
          fontWeight: 300,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        +
      </button>
    </div>
  );
}

// ─── Friends pill view ──────────────────────────────────────────────

function FriendsView(p: {
  accent: string;
  pending: PendingFriendData[];
  incomingCount: number;
  outgoingCount: number;
  pendingOpen: boolean;
  setPendingOpen: (v: boolean) => void;
  suggested: SuggestedFriendData[];
  search: string;
  setSearch: (s: string) => void;
  friends: FriendRowData[];
  totalFriends: number;
  otherUsers: OtherUserData[];
  showAllOther: boolean;
  setShowAllOther: (v: boolean) => void;
  busyId: string | null;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onAddSuggested: (id: string) => void;
  onAddOther: (id: string) => void;
}) {
  const visibleOther = p.showAllOther ? p.otherUsers : p.otherUsers.slice(0, 20);
  const hasMoreOther = !p.showAllOther && p.otherUsers.length > 20;

  return (
    <>
      {/* 1. Pending invites dropdown */}
      {p.pending.length > 0 && (
        <PendingDropdown
          title="Pending invites"
          accent={p.accent}
          incoming={p.incomingCount}
          outgoing={p.outgoingCount}
          total={p.pending.length}
          open={p.pendingOpen}
          onToggle={() => p.setPendingOpen(!p.pendingOpen)}
        >
          {p.pending.map((inv) => (
            <PendingUserRow
              key={inv.linkId}
              invite={inv}
              accent={p.accent}
              busy={p.busyId === inv.linkId}
              onAccept={() => p.onAcceptFriend(inv.linkId)}
              onDecline={() => p.onDeclineFriend(inv.linkId)}
            />
          ))}
        </PendingDropdown>
      )}

      {/* 2. Suggested slider */}
      {p.suggested.length > 0 ? (
        <>
          <SectionHeader label="Suggested for you" />
          <SectionSubtitle text="People your friends know on Trip Planner Pro" />
          <Slider>
            {p.suggested.map((s) => (
              <SuggestedUserCard
                key={s.userId}
                data={s}
                accent={p.accent}
                busy={p.busyId === s.userId}
                onAdd={() => p.onAddSuggested(s.userId)}
              />
            ))}
          </Slider>
        </>
      ) : (
        p.totalFriends === 0 && p.otherUsers.length > 0 && (
          <>
            <SectionHeader label="Discover travelers" />
            <SectionSubtitle text="Discover travelers on the app" />
          </>
        )
      )}

      {/* 3. Search */}
      <SearchBar value={p.search} onChange={p.setSearch} placeholder="Search friends by name…" />

      {/* 4. Your friends */}
      {p.totalFriends > 0 && (
        <>
          <SectionHeader label={`Your friends · ${p.totalFriends}`} />
          {p.friends.length === 0 ? (
            <EmptyRow text={`No friends match "${p.search}"`} />
          ) : (
            <List>
              {p.friends.map((f) => (
                <FriendRow key={f.userId} f={f} accent={p.accent} />
              ))}
            </List>
          )}
        </>
      )}

      {/* 5. Other people */}
      {p.otherUsers.length > 0 && (
        <>
          <SectionHeader label="Other people on the app" />
          <SectionSubtitle text="Browse everyone else using Trip Planner Pro" />
          <List>
            {visibleOther.map((u) => (
              <OtherUserRow
                key={u.userId}
                u={u}
                accent={p.accent}
                busy={p.busyId === u.userId}
                onAdd={() => p.onAddOther(u.userId)}
              />
            ))}
          </List>
          {hasMoreOther && (
            <ShowMoreButton onClick={() => p.setShowAllOther(true)} />
          )}
        </>
      )}
    </>
  );
}

// ─── Families pill view ─────────────────────────────────────────────

function FamiliesView(p: {
  accent: string;
  pending: PendingFamilyData[];
  incomingCount: number;
  outgoingCount: number;
  pendingOpen: boolean;
  setPendingOpen: (v: boolean) => void;
  suggested: SuggestedFamilyData[];
  search: string;
  setSearch: (s: string) => void;
  families: FamilyRowData[];
  totalFamilies: number;
  otherFamilies: OtherFamilyData[];
  showAllOther: boolean;
  setShowAllOther: (v: boolean) => void;
  busyId: string | null;
  onAcceptFamily: (id: string) => void;
  onDeclineFamily: (id: string) => void;
  onConnectSuggested: (id: string) => void;
  onConnectOther: (id: string) => void;
}) {
  const visibleOther = p.showAllOther ? p.otherFamilies : p.otherFamilies.slice(0, 20);
  const hasMoreOther = !p.showAllOther && p.otherFamilies.length > 20;

  return (
    <>
      {/* 1. Pending family invites */}
      {p.pending.length > 0 && (
        <PendingDropdown
          title="Pending family invites"
          accent={p.accent}
          incoming={p.incomingCount}
          outgoing={p.outgoingCount}
          total={p.pending.length}
          open={p.pendingOpen}
          onToggle={() => p.setPendingOpen(!p.pendingOpen)}
        >
          {p.pending.map((inv) => (
            <PendingFamilyRow
              key={inv.linkId}
              invite={inv}
              accent={p.accent}
              busy={p.busyId === inv.linkId}
              onAccept={() => p.onAcceptFamily(inv.linkId)}
              onDecline={() => p.onDeclineFamily(inv.linkId)}
            />
          ))}
        </PendingDropdown>
      )}

      {/* 2. Suggested slider */}
      {p.suggested.length > 0 ? (
        <>
          <SectionHeader label="Suggested families" />
          <SectionSubtitle text="Families your connected families travel with" />
          <Slider>
            {p.suggested.map((s) => (
              <SuggestedFamilyCard
                key={s.id}
                data={s}
                accent={p.accent}
                busy={p.busyId === s.id}
                onConnect={() => p.onConnectSuggested(s.id)}
              />
            ))}
          </Slider>
        </>
      ) : (
        p.totalFamilies === 0 && p.otherFamilies.length > 0 && (
          <>
            <SectionHeader label="Discover families" />
            <SectionSubtitle text="Discover families on the app" />
          </>
        )
      )}

      {/* 3. Search */}
      <SearchBar value={p.search} onChange={p.setSearch} placeholder="Search families by name…" />

      {/* 4. Connected families */}
      {p.totalFamilies > 0 && (
        <>
          <SectionHeader label={`Connected families · ${p.totalFamilies}`} />
          {p.families.length === 0 ? (
            <EmptyRow text={`No families match "${p.search}"`} />
          ) : (
            <List>
              {p.families.map((f) => (
                <FamilyRow key={f.id} f={f} accent={p.accent} />
              ))}
            </List>
          )}
        </>
      )}

      {/* 5. Other families */}
      {p.otherFamilies.length > 0 && (
        <>
          <SectionHeader label="Other families on the app" />
          <SectionSubtitle text="Browse other families using Trip Planner Pro" />
          <List>
            {visibleOther.map((f) => (
              <OtherFamilyRow
                key={f.id}
                f={f}
                accent={p.accent}
                busy={p.busyId === f.id}
                onConnect={() => p.onConnectOther(f.id)}
              />
            ))}
          </List>
          {hasMoreOther && (
            <ShowMoreButton onClick={() => p.setShowAllOther(true)} />
          )}
        </>
      )}
    </>
  );
}

// ─── Small reusable pieces ──────────────────────────────────────────

function SectionSubtitle({ text }: { text: string }) {
  return <p style={{ fontSize: 11, color: "#888", margin: "0 0 10px" }}>{text}</p>;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #e5e5e5",
        borderRadius: 14,
        padding: 24,
        textAlign: "center",
        color: "#999",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>;
}

function Slider({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        paddingBottom: 6,
        paddingTop: 2,
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        scrollSnapType: "x mandatory",
        scrollbarWidth: "none",
      }}
    >
      {children}
    </div>
  );
}

function ShowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ textAlign: "center", marginTop: 10 }}>
      <button
        onClick={onClick}
        style={{
          background: "transparent",
          border: "1.5px solid #e0e0e0",
          borderRadius: 10,
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 600,
          color: "#555",
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Show more
      </button>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={{ position: "relative", marginTop: 14 }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 13,
          opacity: 0.6,
          pointerEvents: "none",
        }}
      >
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px 10px 36px",
          borderRadius: 12,
          border: "1.5px solid #e0e0e0",
          background: "#fff",
          fontSize: 13,
          color: "#1a1a1a",
          outline: "none",
          fontFamily: "'DM Sans', sans-serif",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ─── Pending dropdown ───────────────────────────────────────────────

function PendingDropdown(props: {
  title: string;
  accent: string;
  incoming: number;
  outgoing: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { title, accent, incoming, outgoing, total, open, onToggle, children } = props;
  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid rgba(232,148,58,0.35)`,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 14,
        boxShadow: "0 1px 4px rgba(232,148,58,0.08)",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          background: "rgba(232,148,58,0.06)",
          border: "none",
          textAlign: "left",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {total}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c75a2a" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
              {incoming} waiting on you{outgoing > 0 ? ` · ${outgoing} sent` : ""}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: accent,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ⌄
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 800 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s ease",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
      </div>
    </div>
  );
}

function PendingUserRow(props: {
  invite: PendingFriendData;
  accent: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { invite, accent, busy, onAccept, onDecline } = props;
  const incoming = invite.direction === "incoming";
  const subtitle = incoming
    ? `invited you${invite.mutualCount > 0 ? ` · ${invite.mutualCount} mutual friend${invite.mutualCount === 1 ? "" : "s"}` : ""}`
    : `invite sent ${relativeTime(invite.createdAt)}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderTop: "1px solid #f0f0f0",
      }}
    >
      <UserAvatar avatarUrl={invite.avatarUrl} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{invite.name}</div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{subtitle}</div>
      </div>
      {incoming ? (
        <div style={{ display: "flex", gap: 5 }}>
          <SmallAccentBtn label="Accept" accent={accent} onClick={onAccept} disabled={busy} />
          <SmallGreyBtn label="✕" onClick={onDecline} disabled={busy} />
        </div>
      ) : (
        <SmallGreyBtn label="Cancel" onClick={onDecline} disabled={busy} />
      )}
    </div>
  );
}

function PendingFamilyRow(props: {
  invite: PendingFamilyData;
  accent: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { invite, accent, busy, onAccept, onDecline } = props;
  const incoming = invite.direction === "incoming";
  const subtitle = incoming
    ? `invited your family${invite.mutualCount > 0 ? ` · ${invite.mutualCount} mutual` : ""}`
    : `family invite sent ${relativeTime(invite.createdAt)}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderTop: "1px solid #f0f0f0",
      }}
    >
      <FamilyAvatar size={38} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{invite.name}</div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{subtitle}</div>
      </div>
      {incoming ? (
        <div style={{ display: "flex", gap: 5 }}>
          <SmallAccentBtn label="Accept" accent={accent} onClick={onAccept} disabled={busy} />
          <SmallGreyBtn label="✕" onClick={onDecline} disabled={busy} />
        </div>
      ) : (
        <SmallGreyBtn label="Cancel" onClick={onDecline} disabled={busy} />
      )}
    </div>
  );
}

// ─── Rows ───────────────────────────────────────────────────────────

function FriendRow({ f, accent }: { f: FriendRowData; accent: string }) {
  const sub = [f.city, f.mutualCount > 0 ? `${f.mutualCount} mutual` : null].filter(Boolean).join(" · ");
  return (
    <div style={rowCardStyle}>
      <UserAvatar avatarUrl={f.avatarUrl} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowNameStyle}>{f.name}</div>
        {sub && <div style={rowSubStyle}>{sub}</div>}
      </div>
      {f.tripsTogether > 0 && (
        <TripBadge count={f.tripsTogether} accent={accent} />
      )}
      <span style={{ color: "#ccc", fontSize: 18, marginLeft: 2 }}>›</span>
    </div>
  );
}

function OtherUserRow({ u, accent, busy, onAdd }: {
  u: OtherUserData; accent: string; busy: boolean; onAdd: () => void;
}) {
  const sub = [u.city, u.mutualCount > 0 ? `${u.mutualCount} mutual` : "0 mutual"].filter(Boolean).join(" · ");
  return (
    <div style={rowCardStyle}>
      <UserAvatar avatarUrl={u.avatarUrl} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowNameStyle}>{u.name}</div>
        {sub && <div style={rowSubStyle}>{sub}</div>}
      </div>
      <InlineAddBtn label="+ Add" accent={accent} onClick={onAdd} disabled={busy} />
    </div>
  );
}

function FamilyRow({ f, accent }: { f: FamilyRowData; accent: string }) {
  return (
    <div style={rowCardStyle}>
      <FamilyAvatar size={44} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowNameStyle}>{f.name}</div>
        <div style={rowSubStyle}>
          {f.memberCount} {f.memberCount === 1 ? "member" : "members"}
        </div>
        <div style={{ marginTop: 5 }}>
          <MemberStack members={f.memberAvatars} total={f.memberCount} />
        </div>
      </div>
      {f.tripsTogether > 0 && <TripBadge count={f.tripsTogether} accent={accent} />}
      <span style={{ color: "#ccc", fontSize: 18, marginLeft: 2 }}>›</span>
    </div>
  );
}

function OtherFamilyRow({ f, accent, busy, onConnect }: {
  f: OtherFamilyData; accent: string; busy: boolean; onConnect: () => void;
}) {
  return (
    <div style={rowCardStyle}>
      <FamilyAvatar size={44} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowNameStyle}>{f.name}</div>
        <div style={rowSubStyle}>
          {f.memberCount} {f.memberCount === 1 ? "member" : "members"}
          {f.mutualCount > 0 ? ` · ${f.mutualCount} mutual` : ""}
        </div>
        <div style={{ marginTop: 5 }}>
          <MemberStack members={f.memberAvatars} total={f.memberCount} />
        </div>
      </div>
      <InlineAddBtn label="+ Connect" accent={accent} onClick={onConnect} disabled={busy} />
    </div>
  );
}

// ─── Suggested cards ────────────────────────────────────────────────

function SuggestedUserCard({ data, accent, busy, onAdd }: {
  data: SuggestedFriendData; accent: string; busy: boolean; onAdd: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 155,
        background: "#fff",
        border: "1.5px solid #e8e8e8",
        borderRadius: 16,
        padding: "14px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <UserAvatar avatarUrl={data.avatarUrl} size={50} />
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", lineHeight: 1.2, marginTop: 8 }}>
        {data.name}
      </div>
      {data.city && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{data.city}</div>}
      <MutualChip count={data.mutualCount} label="mutual" accent={accent} />
      {data.mutualNames.length > 0 && (
        <div style={{ fontSize: 9, color: "#aaa", marginTop: 4 }}>
          via {data.mutualNames.join(", ")}
        </div>
      )}
      <AddBtnFullWidth label="+ Add Friend" accent={accent} onClick={onAdd} disabled={busy} />
    </div>
  );
}

function SuggestedFamilyCard({ data, accent, busy, onConnect }: {
  data: SuggestedFamilyData; accent: string; busy: boolean; onConnect: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 180,
        background: "#fff",
        border: "1.5px solid #e8e8e8",
        borderRadius: 16,
        padding: "14px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <FamilyAvatar size={50} accent={accent} />
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", lineHeight: 1.2, marginTop: 8 }}>
        {data.name}
      </div>
      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
        {data.memberCount} {data.memberCount === 1 ? "member" : "members"}
      </div>
      <div style={{ marginTop: 8 }}>
        <MemberStack members={data.memberAvatars} total={data.memberCount} />
      </div>
      <MutualChip count={data.mutualCount} label="mutual" accent={accent} />
      {data.mutualNames.length > 0 && (
        <div style={{ fontSize: 9, color: "#aaa", marginTop: 4 }}>
          via {data.mutualNames.join(", ")}
        </div>
      )}
      <AddBtnFullWidth label="+ Connect" accent={accent} onClick={onConnect} disabled={busy} />
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────────

function UserAvatar({ avatarUrl, size }: { avatarUrl: string | null; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.55),
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>👤</span>
      )}
    </div>
  );
}

function FamilyAvatar({ size, accent }: { size: number; accent: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: `${accent}1f`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.55),
        flexShrink: 0,
      }}
    >
      👨‍👩‍👧‍👦
    </div>
  );
}

function MemberStack({ members, total }: {
  members: { name: string; avatarUrl: string | null }[]; total: number;
}) {
  const shown = members.slice(0, 4);
  const extra = total - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((m, i) => (
        <div
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#f0f0f0",
            border: "2px solid #fff",
            marginLeft: i === 0 ? 0 : -7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            overflow: "hidden",
          }}
          title={m.name}
        >
          {m.avatarUrl ? (
            <img src={m.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span>👤</span>
          )}
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#e8e8e8",
            border: "2px solid #fff",
            marginLeft: -7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "#666",
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function MutualChip({ count, label, accent }: { count: number; label: string; accent: string }) {
  if (count <= 0) return null;
  return (
    <div
      style={{
        fontSize: 10,
        color: accent,
        fontWeight: 600,
        padding: "3px 8px",
        background: `${accent}1a`,
        borderRadius: 9,
        marginTop: 8,
      }}
    >
      {count} {label}
    </div>
  );
}

function TripBadge({ count, accent }: { count: number; accent: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: accent,
        background: `${accent}1f`,
        padding: "3px 9px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      {count} trip{count === 1 ? "" : "s"}
    </span>
  );
}

function SmallAccentBtn({ label, accent, onClick, disabled }: {
  label: string; accent: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: accent,
        color: "#fff",
        border: "none",
        borderRadius: 9,
        padding: "6px 12px",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

function SmallGreyBtn({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "#f5f5f5",
        color: "#777",
        border: "none",
        borderRadius: 9,
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

function InlineAddBtn({ label, accent, onClick, disabled }: {
  label: string; accent: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: accent,
        color: "#fff",
        border: "none",
        borderRadius: 9,
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'DM Sans', sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function AddBtnFullWidth({ label, accent, onClick, disabled }: {
  label: string; accent: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginTop: 10,
        width: "100%",
        background: accent,
        color: "#fff",
        border: "none",
        borderRadius: 9,
        padding: "7px 0",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────

const rowCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #e8e8e8",
  borderRadius: 14,
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 11,
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const rowNameStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  color: "#1a1a1a",
};

const rowSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  marginTop: 2,
};

// ─── Utilities ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
