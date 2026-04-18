"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { TRIP_TYPES, THEMES } from "@/lib/constants";
import { fetchChatList, type ChatListRow } from "@/lib/chat-list";

interface ChatsPageProps {
  userId: string;
  initialRows: ChatListRow[];
}

// ─── Helpers ───

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

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const yesterday = new Date(Date.now() - 86_400_000);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  // Within same year: "Mar 12", otherwise include year
  const thisYear = new Date().getFullYear();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === thisYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString(undefined, opts);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export default function ChatsPage({ userId, initialRows }: ChatsPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES.home;

  const [rows, setRows] = useState<ChatListRow[]>(initialRows);

  // ─── Refetch on window focus ───
  const refresh = useCallback(async () => {
    const next = await fetchChatList(supabase, userId);
    setRows(next);
  }, [supabase, userId]);

  useEffect(() => {
    const onFocus = () => { refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return (
    <div style={{ color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 32px" }}>
        {/* Page title */}
        <div style={{ marginBottom: 16 }}>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: th.text,
              margin: 0,
            }}
          >
            Chats
          </h1>
          <div style={{ fontSize: 13, color: th.muted, marginTop: 2 }}>
            All your trip conversations in one place
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState muted={th.muted} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((row) => (
              <ChatRow
                key={row.trip.id}
                row={row}
                onOpen={() => router.push(`/trip/${row.trip.id}/chat`)}
                muted={th.muted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Row
// ═══════════════════════════════════════════

function ChatRow({
  row,
  onOpen,
  muted,
}: {
  row: ChatListRow;
  onOpen: () => void;
  muted: string;
}) {
  const { trip, latestMessage, latestSenderName, unreadCount } = row;
  const tt = TRIP_TYPES.find((t) => t.value === trip.trip_type) || TRIP_TYPES[0];
  const tth = THEMES[trip.trip_type] || THEMES.home;

  return (
    <div
      className="card-glass slide-in"
      style={{
        cursor: "pointer",
        borderLeft: `4px solid ${tth.accent}`,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
      onClick={onOpen}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: trip name + relative time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tt.icon} {trip.name}
          </div>
          {latestMessage && (
            <div style={{ fontSize: 11, color: muted, flexShrink: 0 }}>
              {relativeTime(latestMessage.created_at)}
            </div>
          )}
        </div>

        {/* Last message preview or CTA */}
        {latestMessage ? (
          <div
            style={{
              fontSize: 13,
              color: muted,
              marginBottom: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontStyle: latestMessage.deleted_at ? "italic" : "normal",
            }}
          >
            {latestMessage.deleted_at
              ? "Message deleted"
              : `${latestSenderName}: ${truncate(latestMessage.content, 120)}`}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: muted, marginBottom: 6, fontStyle: "italic" }}>
            No messages yet — start the conversation
          </div>
        )}

        {/* Bottom row: trip type badge + date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="badge" style={{ background: tth.accent }}>
            {tt.label}
          </span>
          <span style={{ fontSize: 12, color: "#999" }}>
            {formatDateRange(trip.start_date, trip.end_date)}
          </span>
        </div>
      </div>

      {/* Right rail: unread pill + chevron */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {unreadCount > 0 && (
          <span
            style={{
              background: "#e53935",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              padding: "0 7px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span style={{ color: "#ccc", fontSize: 20, marginTop: unreadCount > 0 ? 0 : 6 }}>›</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════

function EmptyState({ muted }: { muted: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 20px",
        color: muted,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#333", marginBottom: 4 }}>
        No trips yet
      </div>
      <div style={{ fontSize: 13 }}>
        Create a trip from the Trips tab, then invite people to chat.
      </div>
    </div>
  );
}
