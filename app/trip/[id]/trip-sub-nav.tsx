"use client";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ThemeConfig } from "@/lib/constants";
import { subNavOrderForRole } from "@/lib/role-density";
import { useTripChatUnread } from "@/lib/use-trip-chat-unread";

// Canonical tab catalog. All 7 tabs render for every role — role only changes
// order. Do NOT remove tabs or hide them behind a role. See feedback memory
// `role_density_no_feature_loss.md`.
const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅", segment: "itinerary" },
  { key: "expenses", label: "Expenses", icon: "💰", segment: "expenses" },
  { key: "chat", label: "Chat", icon: "💬", segment: "chat" },
  { key: "packing", label: "Packing", icon: "🧳", segment: "packing" },
  { key: "notes", label: "Notes", icon: "📝", segment: "notes" },
  { key: "meals", label: "Meals", icon: "🍽️", segment: "meals" },
  { key: "group", label: "Group", icon: "👥", segment: "group" },
];

function getActiveSegment(pathname: string, tripId: string): string | null {
  const prefix = `/trip/${tripId}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split("/")[0];
  return rest || null;
}

interface TripSubNavProps {
  tripId: string;
  theme: ThemeConfig;
  /** Current viewer's `trip_members.role_preference`. Drives tab ordering. */
  role?: string | null;
}

export default function TripSubNav({ tripId, theme, role }: TripSubNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSegment = getActiveSegment(pathname, tripId);

  // Drives the Chat tab badge. Honors the viewer's chat_notification_level
  // for this trip — muted trips render a gray dot, mentions-only trips
  // only count @mentions, 'all' trips show the full unread count.
  const chatUnread = useTripChatUnread(tripId);

  // Reorder the canonical tab list per role. Unknown segments from the role
  // config are skipped; any tab missing from the role config gets appended
  // so we never silently drop a tab.
  const orderedTabs = useMemo(() => {
    const order = subNavOrderForRole(role);
    const bySegment = new Map(SUB_NAV_TABS.map((t) => [t.segment, t]));
    const seen = new Set<string>();
    const out: typeof SUB_NAV_TABS = [];
    for (const seg of order) {
      const tab = bySegment.get(seg);
      if (tab && !seen.has(seg)) {
        out.push(tab);
        seen.add(seg);
      }
    }
    // Safety net: append any tab not referenced by the role config so the
    // "all 7 tabs always render" invariant holds even if the constants drift.
    for (const tab of SUB_NAV_TABS) {
      if (!seen.has(tab.segment)) out.push(tab);
    }
    return out;
  }, [role]);

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: "480px",
      margin: "0 auto",
      zIndex: 100,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      height: "56px",
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid #e5e5e5",
      padding: "0 4px",
    }}>
      {orderedTabs.map((tab) => {
        const active = activeSegment === tab.segment;
        // Chat tab: render a level-aware badge on the icon.
        //  muted       → gray dot (no number), even if unread > 0
        //  mentions    → red badge with mention count (hidden if 0)
        //  all         → red badge with full unread count (hidden if 0)
        const showChatBadge = tab.segment === "chat" && chatUnread;
        const chatBadgeStyle: "muted-dot" | "count" | null = showChatBadge
          ? chatUnread!.level === "muted"
            ? "muted-dot"
            : chatUnread!.count > 0
            ? "count"
            : null
          : null;

        return (
          <button
            key={tab.key}
            onClick={() => router.push(`/trip/${tripId}/${tab.segment}`)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              height: "100%",
              background: "none",
              border: "none",
              borderTop: `3px solid ${active ? theme.accent : "transparent"}`,
              cursor: "pointer",
              padding: 0,
              minWidth: 0,
              position: "relative",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1, position: "relative" }}>
              {tab.icon}
              {chatBadgeStyle === "count" && (
                <span
                  aria-label={`${chatUnread!.count} unread`}
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    background: "#d32f2f",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    padding: "0 4px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {chatUnread!.count > 99 ? "99+" : chatUnread!.count}
                </span>
              )}
              {chatBadgeStyle === "muted-dot" && (
                <span
                  aria-label="Chat muted"
                  style={{
                    position: "absolute",
                    top: -1,
                    right: -6,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#bbb",
                  }}
                />
              )}
            </span>
            <span style={{
              fontSize: "10px",
              fontWeight: active ? 700 : 500,
              color: active ? theme.accent : "#999",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
