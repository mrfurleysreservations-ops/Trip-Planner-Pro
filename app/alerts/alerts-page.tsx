"use client";
import { useState, useCallback, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { TRIP_TYPES, THEMES } from "@/lib/constants";
import { getActivityIcon } from "@/lib/trip-activity";
import TopNav from "@/app/top-nav";
import type { TripActivity } from "@/types/database.types";
import type { AlertsPageProps, PendingInvitation, PendingFriendRequest } from "./page";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start) return "No dates set";
  const s = new Date(start + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString(undefined, opts);
  if (!end) return startStr;
  const e = new Date(end + "T00:00:00");
  const endStr = e.toLocaleDateString(undefined, opts);
  return `${startStr} — ${endStr}`;
}

const th = THEMES.home;

export default function AlertsPage({
  userId,
  alertsLastSeenAt,
  pendingInvitations: initialInvitations,
  pendingFriendRequests: initialFriendRequests,
  activity,
  tripNameMap,
  unreadChatCount,
  pendingFriendCount,
  unreadAlertCount,
}: AlertsPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [invitations, setInvitations] = useState<PendingInvitation[]>(initialInvitations);
  const [friendRequests, setFriendRequests] = useState<PendingFriendRequest[]>(initialFriendRequests);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  // ─── Mark alerts as seen on page visit ───
  useEffect(() => {
    supabase
      .from("user_profiles")
      .update({ alerts_last_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("Failed to update alerts_last_seen_at:", error);
      });
  }, [supabase, userId]);

  // ─── Helper: is an activity item "new" (unseen)? ───
  const isNew = useCallback((createdAt: string) => {
    if (!alertsLastSeenAt) return true; // never visited alerts — everything is new
    return new Date(createdAt) > new Date(alertsLastSeenAt);
  }, [alertsLastSeenAt]);

  // ─── Trip invitation actions ───
  const acceptInvite = useCallback(async (inv: PendingInvitation) => {
    setRespondingTo(inv.member.id);
    const { error } = await supabase
      .from("trip_members")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", inv.member.id);
    if (error) {
      console.error("acceptInvite error:", JSON.stringify(error, null, 2));
    } else {
      setInvitations((prev) => prev.filter((p) => p.member.id !== inv.member.id));
    }
    setRespondingTo(null);
  }, [supabase]);

  const declineInvite = useCallback(async (inv: PendingInvitation) => {
    setRespondingTo(inv.member.id);
    const { error } = await supabase
      .from("trip_members")
      .delete()
      .eq("id", inv.member.id);
    if (error) {
      console.error("declineInvite error:", JSON.stringify(error, null, 2));
    } else {
      setInvitations((prev) => prev.filter((p) => p.member.id !== inv.member.id));
    }
    setRespondingTo(null);
  }, [supabase]);

  // ─── Friend request actions ───
  const acceptFriend = useCallback(async (req: PendingFriendRequest) => {
    setRespondingTo(req.friendLink.id);
    const { error } = await supabase
      .from("friend_links")
      .update({ status: "accepted" })
      .eq("id", req.friendLink.id);
    if (error) {
      console.error("acceptFriend error:", JSON.stringify(error, null, 2));
    } else {
      setFriendRequests((prev) => prev.filter((p) => p.friendLink.id !== req.friendLink.id));
    }
    setRespondingTo(null);
  }, [supabase]);

  const declineFriend = useCallback(async (req: PendingFriendRequest) => {
    setRespondingTo(req.friendLink.id);
    const { error } = await supabase
      .from("friend_links")
      .delete()
      .eq("id", req.friendLink.id);
    if (error) {
      console.error("declineFriend error:", JSON.stringify(error, null, 2));
    } else {
      setFriendRequests((prev) => prev.filter((p) => p.friendLink.id !== req.friendLink.id));
    }
    setRespondingTo(null);
  }, [supabase]);

  const hasActionItems = invitations.length > 0 || friendRequests.length > 0;
  const hasActivity = activity.length > 0;
  const isEmpty = !hasActionItems && !hasActivity;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ─── STICKY TOP ─── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${th.cardBorder}`,
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
          {/* Row 1 — Page header */}
          <div style={{ padding: "14px 0 10px" }}>
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
              Alerts
            </h1>
          </div>

          {/* Row 2 — Top-level nav */}
          <TopNav
            unreadChatCount={unreadChatCount}
            pendingFriendCount={pendingFriendCount}
            unreadAlertCount={unreadAlertCount}
          />
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>

        {/* ═══ EMPTY STATE ═══ */}
        {isEmpty && (
          <div style={{
            background: "#fff", border: "1.5px solid #e5e5e5", borderRadius: 14,
            padding: 48, textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔔</div>
            <p style={{ color: th.muted, fontSize: 15 }}>You're all caught up — no new alerts!</p>
          </div>
        )}

        {/* ═══ PENDING TRIP INVITATIONS ═══ */}
        {invitations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{
              fontSize: "13px", fontWeight: 700, color: "#e53935",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
            }}>
              Trip Invitations ({invitations.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {invitations.map((inv) => {
                const tt = TRIP_TYPES.find((t) => t.value === inv.trip.trip_type) || TRIP_TYPES[0];
                const tth = THEMES[inv.trip.trip_type] || THEMES.camping;
                const isResponding = respondingTo === inv.member.id;
                return (
                  <div
                    key={inv.member.id}
                    style={{
                      background: "#fff", border: "1.5px solid #e5e5e5", borderRadius: 14,
                      padding: "16px 18px", borderLeft: `4px solid ${tth.accent}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                          {tt.icon} {inv.trip.name}
                        </div>
                        {inv.trip.location && (
                          <div style={{ fontSize: 13, color: th.muted, marginBottom: 2 }}>
                            📍 {inv.trip.location}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "#999" }}>
                          {formatDateRange(inv.trip.start_date, inv.trip.end_date)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => acceptInvite(inv)}
                          disabled={isResponding}
                          className="btn"
                          style={{ background: "#28a745", padding: "8px 18px", fontSize: 12, fontWeight: 700, opacity: isResponding ? 0.5 : 1 }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineInvite(inv)}
                          disabled={isResponding}
                          className="btn"
                          style={{ background: "#e74c3c", padding: "8px 18px", fontSize: 12, fontWeight: 700, opacity: isResponding ? 0.5 : 1 }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ PENDING FRIEND REQUESTS ═══ */}
        {friendRequests.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{
              fontSize: "13px", fontWeight: 700, color: th.accent,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
            }}>
              Friend Requests ({friendRequests.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {friendRequests.map((req) => {
                const isResponding = respondingTo === req.friendLink.id;
                return (
                  <div
                    key={req.friendLink.id}
                    style={{
                      background: "#fff", border: "1.5px solid #e5e5e5", borderRadius: 14,
                      padding: "14px 18px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {req.fromAvatar ? (
                          <img src={req.fromAvatar} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", background: th.accent,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 14, fontWeight: 700,
                          }}>
                            {req.fromName[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{req.fromName}</div>
                          <div style={{ fontSize: 12, color: th.muted }}>wants to be your friend</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => acceptFriend(req)}
                          disabled={isResponding}
                          className="btn"
                          style={{ background: "#28a745", padding: "7px 14px", fontSize: 12, fontWeight: 700, opacity: isResponding ? 0.5 : 1 }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineFriend(req)}
                          disabled={isResponding}
                          className="btn"
                          style={{ background: "#e74c3c", padding: "7px 14px", fontSize: 12, fontWeight: 700, opacity: isResponding ? 0.5 : 1 }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TRIP ACTIVITY ═══ */}
        {hasActivity && (
          <div>
            <h3 style={{
              fontSize: "13px", fontWeight: 700, color: th.muted,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
            }}>
              Recent Activity
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {activity.map((a, i) => {
                const tripName = tripNameMap[a.trip_id] || "Trip";
                const unread = isNew(a.created_at);
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      let href: string | null = null;

                      // Best case: we have entity_id — build a guaranteed deep-link
                      if (a.entity_id) {
                        if (a.entity_type === "note") {
                          href = `/trip/${a.trip_id}/notes?note=${a.entity_id}`;
                        } else if (a.entity_type === "itinerary_event") {
                          href = `/trip/${a.trip_id}/itinerary?event=${a.entity_id}`;
                        }
                      }

                      // Fallback: use link_path from DB (may or may not have query params)
                      if (!href && a.link_path) {
                        href = a.link_path;
                      }

                      // Last resort: at least go to the trip page
                      if (!href && a.trip_id) {
                        href = `/trip/${a.trip_id}`;
                      }

                      if (href) router.push(href);
                    }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 16px",
                      background: unread ? "#fff" : "#fafafa",
                      opacity: unread ? 1 : 0.55,
                      borderLeft: unread ? `3px solid ${th.accent}` : "1.5px solid #e5e5e5",
                      borderRight: "1.5px solid #e5e5e5",
                      borderTop: i === 0 ? "1.5px solid #e5e5e5" : "none",
                      borderBottom: "1.5px solid #e5e5e5",
                      borderRadius: i === 0 ? "14px 14px 0 0" : i === activity.length - 1 ? "0 0 14px 14px" : 0,
                      cursor: a.link_path ? "pointer" : "default",
                      transition: "background 0.15s, opacity 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                      {getActivityIcon(a.action, a.entity_type)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: unread ? 600 : 500, lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 700 }}>{a.user_name}</strong>{" "}
                        {a.action} {a.entity_type === "itinerary_event" ? "event" : a.entity_type}{" "}
                        <span style={{ color: unread ? th.accent : th.muted, fontWeight: 600 }}>"{a.entity_name}"</span>
                      </div>
                      {a.detail && (
                        <div style={{ fontSize: 11, color: th.muted, marginTop: 2 }}>{a.detail}</div>
                      )}
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>
                        {tripName} · {timeAgo(a.created_at)}
                      </div>
                    </div>
                    {unread && (
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", background: th.accent,
                        flexShrink: 0, marginTop: 6,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
