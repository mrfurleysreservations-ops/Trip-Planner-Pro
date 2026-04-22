"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { THEMES, ROLE_PREFERENCES, type ThemeConfig } from "@/lib/constants";
import { type ChatNotificationLevel } from "@/lib/chat-unread";
import type { TripMessage } from "@/types/database.types";
import type { ChatMember, ViewerChatSettings } from "./page";
import TripSubNav from "../trip-sub-nav";
import { useTripData } from "../trip-data-context";

interface ChatPageProps {
  members: ChatMember[];
  initialMessages: TripMessage[];
  /** Viewer's trip_members.role_preference — drives sub-nav order. */
  currentUserRole: string | null;
  /**
   * Viewer's chat-facing member row (id, name, level, role). Null for trip
   * owners without a dedicated trip_members row — in that case the settings
   * control is hidden because there's nothing to update.
   */
  viewerSettings: ViewerChatSettings | null;
}

// ─── Notification level option metadata ───
// Order matches the spec: All → Mentions → Muted.
const NOTIFICATION_OPTIONS: {
  value: ChatNotificationLevel;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "all",
    label: "All messages",
    description: "Ping me for every new message",
    icon: "🔔",
  },
  {
    value: "mentions",
    label: "Only @mentions",
    description: "Only notify when someone @'s me",
    icon: "🔖",
  },
  {
    value: "muted",
    label: "Muted",
    description: "No notifications. Gray dot on the tab instead of a count.",
    icon: "🔕",
  },
];

const SUB_NAV_HEIGHT = 56;
const COMPOSER_HEIGHT = 60;
const MAX_LEN = 4000;
const AUTO_SCROLL_THRESHOLD = 120; // px from bottom

// ─── Helpers ───

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayDividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  // Within the last 6 days: weekday, e.g. "Wednesday, April 15"
  const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000);
  if (d >= sixDaysAgo) {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function initialOf(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

// ═══════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════

export default function ChatPage({
  members,
  initialMessages,
  currentUserRole,
  viewerSettings,
}: ChatPageProps) {
  const { trip, userId } = useTripData();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [messages, setMessages] = useState<TripMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Notification level state — hydrated from the server prop and mutated
  // locally when the user picks a new option in the settings sheet. We
  // keep a local copy so the UI updates optimistically before the realtime
  // event loops back. Falls back to 'all' for the rare owner-without-
  // member-row case (settings sheet is hidden in that case anyway).
  const [notificationLevel, setNotificationLevel] = useState<ChatNotificationLevel>(
    viewerSettings?.notificationLevel ?? "all"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasFocusRef = useRef<boolean>(typeof document !== "undefined" ? document.hasFocus() : true);
  // Tracks whether the user is near the bottom of the thread. Updated on
  // every scroll event so that when a new message arrives we can decide
  // (BEFORE the render grows the page) whether to auto-follow.
  const nearBottomRef = useRef<boolean>(true);

  // ─── Sender lookup (trip_member rows with an auth account) ───
  const memberByUserId = useMemo(() => {
    const map = new Map<string, ChatMember>();
    members.forEach((m) => map.set(m.userId, m));
    return map;
  }, [members]);

  // ─── Bump last_read_at ───
  const bumpLastRead = useCallback(async () => {
    await supabase.from("trip_message_reads").upsert(
      { trip_id: trip.id, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "trip_id,user_id" }
    );
  }, [supabase, trip.id, userId]);

  // ─── Realtime subscription ───
  useEffect(() => {
    const channel = supabase
      .channel(`trip-chat:${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${trip.id}`,
        },
        (payload) => {
          const row = payload.new as TripMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          // If the window is focused, keep last_read_at in sync so unread stays 0.
          if (hasFocusRef.current) bumpLastRead();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${trip.id}`,
        },
        (payload) => {
          const row = payload.new as TripMessage;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, trip.id, bumpLastRead]);

  // ─── Track window focus for unread bookkeeping ───
  useEffect(() => {
    const onFocus = () => {
      hasFocusRef.current = true;
      bumpLastRead();
    };
    const onBlur = () => {
      hasFocusRef.current = false;
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [bumpLastRead]);

  // ─── Bump on mount (instantaneous on open) ───
  useEffect(() => {
    bumpLastRead();
  }, [bumpLastRead]);

  // ─── Scroll management ───
  const scrollToBottom = (smooth: boolean) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }
  };

  // Keep nearBottomRef fresh. We read it in the "new message" effect to
  // decide whether to auto-follow — and because scroll events only fire on
  // user action, the ref still reflects the PRE-render scroll state when
  // we read it right after setMessages.
  useEffect(() => {
    const recompute = () => {
      const fromBottom =
        document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight);
      nearBottomRef.current = fromBottom < AUTO_SCROLL_THRESHOLD;
    };
    recompute();
    window.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, []);

  // Scroll to bottom on first render (and reset nearBottom)
  useEffect(() => {
    scrollToBottom(false);
    nearBottomRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On new message: always scroll to bottom if it's mine, otherwise only if
  // the user was near the bottom BEFORE the bubble was added.
  const prevLastIdRef = useRef<string | null>(
    initialMessages.length ? initialMessages[initialMessages.length - 1].id : null
  );
  useEffect(() => {
    if (messages.length === 0) {
      prevLastIdRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    if (last.id === prevLastIdRef.current) return;
    prevLastIdRef.current = last.id;

    if (last.sender_id === userId || nearBottomRef.current) {
      // Next frame so DOM has painted the new bubble
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages, userId]);

  // ─── Send message ───
  const sendMessage = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (content.length > MAX_LEN) return;
    setSending(true);

    const { data, error } = await supabase
      .from("trip_messages")
      .insert({
        trip_id: trip.id,
        sender_id: userId,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error("Send message error:", error);
      setSending(false);
      return;
    }

    // Optimistically append — realtime will dedupe via id.
    if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as TripMessage];
      });
    }
    setDraft("");
    setSending(false);
  }, [draft, sending, supabase, trip.id, userId]);

  // ─── Update notification level ───
  // Writes `trip_members.chat_notification_level` for the viewer on this
  // trip. Optimistically flips the local state so the sheet dismiss feels
  // instant; on failure we roll back. The sub-nav badge hook picks up the
  // change via its own realtime subscription on `trip_members`.
  const roleMeta = viewerSettings?.rolePreference
    ? ROLE_PREFERENCES.find((r) => r.value === viewerSettings.rolePreference) ?? null
    : null;
  const roleChatDefault = roleMeta?.chatDefault ?? null;

  const handleChangeNotificationLevel = useCallback(
    async (nextLevel: ChatNotificationLevel) => {
      if (!viewerSettings || savingLevel) return;
      if (nextLevel === notificationLevel) {
        setSettingsOpen(false);
        return;
      }
      const prevLevel = notificationLevel;
      setNotificationLevel(nextLevel);
      setSavingLevel(true);
      const { error } = await supabase
        .from("trip_members")
        .update({
          chat_notification_level: nextLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", viewerSettings.memberId);
      setSavingLevel(false);
      if (error) {
        console.error("chat: failed to update notification level", error);
        setNotificationLevel(prevLevel);
        return;
      }
      setSettingsOpen(false);
    },
    [notificationLevel, savingLevel, supabase, viewerSettings]
  );

  // ─── Delete own message (soft delete) ───
  const deleteMessage = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from("trip_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("sender_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Delete message error:", error);
        return;
      }
      if (data) {
        setMessages((prev) => prev.map((m) => (m.id === data.id ? (data as TripMessage) : m)));
      }
      setConfirmDeleteId(null);
    },
    [supabase, userId]
  );

  // ─── Render helpers ───

  const senderName = (senderId: string): string => {
    if (senderId === userId) return "You";
    return memberByUserId.get(senderId)?.name || "Someone";
  };

  const senderAvatar = (senderId: string): string | null => {
    return memberByUserId.get(senderId)?.avatarUrl ?? null;
  };

  // Decide whether to show a day divider before this message
  const shouldShowDayDivider = (index: number): boolean => {
    if (index === 0) return true;
    const prev = messages[index - 1];
    const cur = messages[index];
    return !sameDay(new Date(prev.created_at), new Date(cur.created_at));
  };

  // Decide whether this message is the first in a run from the same sender
  const isFirstInRun = (index: number): boolean => {
    if (index === 0) return true;
    const prev = messages[index - 1];
    const cur = messages[index];
    if (prev.sender_id !== cur.sender_id) return true;
    // New day breaks the run too
    if (!sameDay(new Date(prev.created_at), new Date(cur.created_at))) return true;
    // More than 10 minute gap also breaks the run
    return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 10 * 60_000;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: th.bg,
        color: th.text,
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: SUB_NAV_HEIGHT + COMPOSER_HEIGHT + 12, // clears composer + sub-nav
      }}
    >
      {th.vibeBg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: th.vibeBg,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* ─── STICKY TOP REGION (Row 1 only) ─── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: th.headerBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${th.cardBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
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
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              ←
            </button>
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: th.text,
                margin: 0,
              }}
            >
              Chat
            </h1>
          </div>

          {/* Header actions — bell (notification settings) + member avatar stack */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {viewerSettings && (
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Chat notification settings"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `${th.accent}1a`,
                  border: `1.5px solid ${th.accent}40`,
                  color: th.accent,
                  fontSize: 16,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {notificationLevel === "muted" ? "🔕" : notificationLevel === "mentions" ? "🔖" : "🔔"}
              </button>
            )}
            <MemberStack members={members} th={th} />
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: "14px 12px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              minHeight: "50vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: th.muted,
              fontSize: 14,
              textAlign: "center",
              padding: 24,
            }}
          >
            No messages yet. Say hi 👋
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === userId;
            const showDivider = shouldShowDayDivider(i);
            const firstInRun = isFirstInRun(i);
            return (
              <div key={m.id}>
                {showDivider && (
                  <div
                    style={{
                      textAlign: "center",
                      margin: "18px 0 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: th.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {dayDividerLabel(m.created_at)}
                  </div>
                )}
                <MessageBubble
                  message={m}
                  mine={mine}
                  firstInRun={firstInRun}
                  senderName={senderName(m.sender_id)}
                  senderAvatar={senderAvatar(m.sender_id)}
                  th={th}
                  confirmDelete={confirmDeleteId === m.id}
                  onAskDelete={() => setConfirmDeleteId(m.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => deleteMessage(m.id)}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* ─── COMPOSER (fixed, above sub-nav) ─── */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: SUB_NAV_HEIGHT,
          maxWidth: 480,
          margin: "0 auto",
          zIndex: 90,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: `1px solid ${th.cardBorder}`,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            lineHeight: 1.35,
            padding: "10px 14px",
            borderRadius: 22,
            border: `1.5px solid ${th.cardBorder}`,
            background: "#fff",
            outline: "none",
            maxHeight: 120,
            minHeight: 40,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: draft.trim() && !sending ? th.accent : th.cardBorder,
            color: "#fff",
            border: "none",
            fontSize: 18,
            fontWeight: 700,
            cursor: draft.trim() && !sending ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          ➤
        </button>
      </div>

      {/* ─── FIXED SUB-NAV ─── */}
      <TripSubNav tripId={trip.id} theme={th} role={currentUserRole} />

      {/* ─── Notification settings sheet ─── */}
      {settingsOpen && viewerSettings && (
        <NotificationSettingsSheet
          currentLevel={notificationLevel}
          roleLabel={roleMeta?.label ?? null}
          roleIcon={roleMeta?.icon ?? null}
          roleChatDefault={roleChatDefault}
          saving={savingLevel}
          th={th}
          onSelect={handleChangeNotificationLevel}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Notification settings sheet
// ═══════════════════════════════════════════

interface NotificationSettingsSheetProps {
  currentLevel: ChatNotificationLevel;
  /** Viewer's role label (e.g. "Just Here") — used to annotate the default option. */
  roleLabel: string | null;
  roleIcon: string | null;
  /** The chat level that's the default for the viewer's role. */
  roleChatDefault: string | null;
  saving: boolean;
  th: ThemeConfig;
  onSelect: (level: ChatNotificationLevel) => void;
  onClose: () => void;
}

function NotificationSettingsSheet({
  currentLevel,
  roleLabel,
  roleIcon,
  roleChatDefault,
  saving,
  th,
  onSelect,
  onClose,
}: NotificationSettingsSheetProps) {
  return (
    <>
      {/* Scrim — tap anywhere outside the sheet to dismiss. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 150,
        }}
      />
      <div
        role="dialog"
        aria-label="Chat notifications"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: "0 auto",
          zIndex: 160,
          background: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "16px 16px 24px",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.18)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "#e0e0e0",
            margin: "0 auto 14px",
          }}
        />
        <div
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 17,
            fontWeight: 800,
            color: th.text,
            marginBottom: 2,
          }}
        >
          Chat notifications
        </div>
        <div style={{ fontSize: 12, color: th.muted, marginBottom: 14 }}>
          Choose how noisy this trip's chat should be for you.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NOTIFICATION_OPTIONS.map((opt) => {
            const active = currentLevel === opt.value;
            const isRoleDefault = roleChatDefault === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                disabled={saving}
                aria-pressed={active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: active ? `${th.accent}0f` : "#fafafa",
                  border: active ? `2px solid ${th.accent}` : `2px solid ${th.cardBorder}`,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  width: "100%",
                  color: th.text,
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: active ? `${th.accent}2e` : "rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 14,
                      fontWeight: 700,
                      color: th.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {opt.label}
                    {isRoleDefault && roleLabel && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: th.muted,
                          background: "rgba(0,0,0,0.06)",
                          padding: "2px 8px",
                          borderRadius: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Default for {roleIcon ? `${roleIcon} ` : ""}{roleLabel}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: th.muted,
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {opt.description}
                  </div>
                </div>
                {active && (
                  <div
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: th.accent,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// Member avatar stack
// ═══════════════════════════════════════════

function MemberStack({
  members,
  th,
}: {
  members: ChatMember[];
  th: ThemeConfig;
}) {
  const MAX_VISIBLE = 3;
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, members.length - MAX_VISIBLE);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{ display: "flex" }}>
        {visible.map((m, i) => (
          <div
            key={m.id}
            title={m.name}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: m.avatarUrl ? "transparent" : th.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              border: "2px solid #fff",
              marginLeft: i === 0 ? 0 : -8,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt={m.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initialOf(m.name)
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: th.card,
              color: th.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              border: "2px solid #fff",
              marginLeft: -8,
              flexShrink: 0,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: th.muted }}>
        {members.length}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════
// Message bubble
// ═══════════════════════════════════════════

interface BubbleProps {
  message: TripMessage;
  mine: boolean;
  firstInRun: boolean;
  senderName: string;
  senderAvatar: string | null;
  th: ThemeConfig;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function MessageBubble({
  message,
  mine,
  firstInRun,
  senderName,
  senderAvatar,
  th,
  confirmDelete,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: BubbleProps) {
  const deleted = !!message.deleted_at;

  const bubbleStyle: React.CSSProperties = deleted
    ? {
        background: "transparent",
        border: `1.5px dashed ${th.cardBorder}`,
        color: th.muted,
        fontStyle: "italic",
      }
    : mine
    ? {
        background: th.accent,
        color: "#fff",
      }
    : {
        background: "#fff",
        border: `1px solid ${th.cardBorder}`,
        color: th.text,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start",
        marginTop: firstInRun ? 10 : 2,
      }}
    >
      {firstInRun && !mine && !deleted && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: th.muted,
            marginLeft: 36,
            marginBottom: 2,
          }}
        >
          {senderName}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          maxWidth: "85%",
          flexDirection: mine ? "row-reverse" : "row",
        }}
      >
        {/* Avatar (others only, only on first-in-run) */}
        {!mine && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: senderAvatar ? "transparent" : th.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              overflow: "hidden",
              flexShrink: 0,
              visibility: firstInRun ? "visible" : "hidden",
            }}
          >
            {senderAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={senderAvatar}
                alt={senderName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initialOf(senderName)
            )}
          </div>
        )}

        <button
          onClick={() => {
            if (!mine || deleted) return;
            if (confirmDelete) onCancelDelete();
            else onAskDelete();
          }}
          style={{
            textAlign: "left",
            borderRadius: 16,
            padding: "8px 12px",
            fontSize: 14,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            cursor: mine && !deleted ? "pointer" : "default",
            ...bubbleStyle,
          }}
        >
          {deleted ? "Message deleted" : message.content}
        </button>
      </div>

      {/* Timestamp + delete affordance for your own messages */}
      {mine && !deleted && confirmDelete && (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onClick={onConfirmDelete}
            style={{
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            style={{
              background: th.card,
              color: th.muted,
              border: `1px solid ${th.cardBorder}`,
              borderRadius: 12,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {firstInRun && (
        <div
          style={{
            fontSize: 10,
            color: th.muted,
            marginTop: 2,
            marginRight: mine ? 4 : 0,
            marginLeft: mine ? 0 : 36,
          }}
        >
          {timeLabel(message.created_at)}
        </div>
      )}
    </div>
  );
}
