"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/constants";
import { moreTabsForRole, primaryTabsForRole } from "@/lib/role-density";
import { useTripChatUnread, type TripChatUnreadState } from "@/lib/use-trip-chat-unread";

// Canonical tab catalog. All 7 tabs render for every role — role only changes
// which 4 ride in the bottom bar vs. which live behind the ⋯ More sheet.
// Do NOT remove tabs or hide them behind a role. See feedback memory
// `role_density_no_feature_loss.md`.
const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅", segment: "itinerary" },
  { key: "expenses", label: "Expenses", icon: "💰", segment: "expenses" },
  { key: "chat", label: "Chat", icon: "💬", segment: "chat" },
  { key: "packing", label: "Packing", icon: "🧳", segment: "packing" },
  { key: "notes", label: "Notes", icon: "📝", segment: "notes" },
  { key: "supplies", label: "Supplies", icon: "🛒", segment: "supplies" },
  { key: "group", label: "Group", icon: "👥", segment: "group" },
];

type SubNavTab = (typeof SUB_NAV_TABS)[number];

function getActiveSegment(pathname: string, tripId: string): string | null {
  const prefix = `/trip/${tripId}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split("/")[0];
  return rest || null;
}

/**
 * Resolve the primary-tabs array for a role against `SUB_NAV_TABS`, with a
 * graceful degrade path. If a role config is malformed (wrong length, or
 * references a segment we don't know about), we fall back to the first 4
 * entries of its `subNavOrder` and dev-warn exactly once per degradation so
 * the breakage surfaces without crashing the bottom nav in prod.
 */
function resolvePrimaryTabs(
  role: string | null | undefined,
  subNavOrder: readonly string[],
  requestedPrimary: readonly string[],
  bySegment: Map<string, SubNavTab>,
  warnedRef: React.MutableRefObject<Set<string>>,
): SubNavTab[] {
  const malformed =
    requestedPrimary.length !== 4 ||
    requestedPrimary.some((seg) => !bySegment.has(seg));

  if (malformed) {
    const key = `primary:${role ?? "unknown"}`;
    if (!warnedRef.current.has(key)) {
      warnedRef.current.add(key);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[TripSubNav] role '${role ?? "unknown"}' has invalid primaryTabs ` +
          `(expected length 4 with segments in SUB_NAV_TABS). ` +
          `Falling back to first 4 of subNavOrder.`,
        );
      }
      const fallback: SubNavTab[] = [];
      for (const seg of subNavOrder) {
        const tab = bySegment.get(seg);
        if (tab) fallback.push(tab);
        if (fallback.length === 4) break;
      }
      return fallback;
    }
  }

  const out: SubNavTab[] = [];
  for (const seg of requestedPrimary) {
    const tab = bySegment.get(seg);
    if (tab) out.push(tab);
  }
  return out;
}

interface TripSubNavProps {
  tripId: string;
  theme: ThemeConfig;
  /** Current viewer's `trip_members.role_preference`. Drives tab split + order. */
  role?: string | null;
}

export default function TripSubNav({ tripId, theme, role }: TripSubNavProps) {
  const pathname = usePathname();
  const activeSegment = getActiveSegment(pathname, tripId);

  const [moreOpen, setMoreOpen] = useState(false);

  // Drives the Chat tab (or ⋯ More tile aggregate) badge. Honors the viewer's
  // chat_notification_level for this trip — muted → gray dot, mentions/all →
  // red badge with the count (hidden at 0).
  const chatUnread = useTripChatUnread(tripId);

  // Dev-warn dedup cache — keyed by role string, so a bad config only shouts
  // once per session instead of every render.
  const warnedRolesRef = useRef<Set<string>>(new Set());

  const { primaryTabs, moreTabs } = useMemo(() => {
    const bySegment = new Map(SUB_NAV_TABS.map((t) => [t.segment, t]));
    const primarySegments = primaryTabsForRole(role);
    const moreSegments = moreTabsForRole(role);

    // Resolve primary from the role config (with graceful degrade) and then
    // derive `moreTabs` as every catalog tab NOT in the resolved primary set.
    // This keeps the "all 7 tabs reachable" invariant even if the role's
    // subNavOrder drifts out of sync with SUB_NAV_TABS.
    const resolvedPrimary = resolvePrimaryTabs(
      role,
      // subNavOrder is only used for fallback ordering here
      moreSegments.length + primarySegments.length > 0
        ? [...primarySegments, ...moreSegments]
        : SUB_NAV_TABS.map((t) => t.segment),
      primarySegments,
      bySegment,
      warnedRolesRef,
    );

    const primarySet = new Set(resolvedPrimary.map((t) => t.segment));
    const resolvedMore: SubNavTab[] = [];
    // First: role-ordered More tabs (subNavOrder minus resolved primary).
    for (const seg of moreSegments) {
      if (primarySet.has(seg)) continue;
      const tab = bySegment.get(seg);
      if (tab) resolvedMore.push(tab);
    }
    // Safety net: any catalog tab neither in primary nor the role's More list
    // gets appended so we never silently drop a tab.
    const seenMore = new Set(resolvedMore.map((t) => t.segment));
    for (const tab of SUB_NAV_TABS) {
      if (primarySet.has(tab.segment)) continue;
      if (seenMore.has(tab.segment)) continue;
      resolvedMore.push(tab);
    }

    return { primaryTabs: resolvedPrimary, moreTabs: resolvedMore };
  }, [role]);

  const primarySegmentSet = useMemo(
    () => new Set(primaryTabs.map((t) => t.segment)),
    [primaryTabs],
  );
  const moreSegmentSet = useMemo(
    () => new Set(moreTabs.map((t) => t.segment)),
    [moreTabs],
  );

  const chatInPrimary = primarySegmentSet.has("chat");
  const chatInMore = moreSegmentSet.has("chat");

  // Close the sheet any time the route changes — covers tile taps, back
  // button, deep links, programmatic nav from child pages, etc.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = activeSegment !== null && moreSegmentSet.has(activeSegment);

  return (
    <>
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
        {primaryTabs.map((tab) => {
          const active = activeSegment === tab.segment;
          const showChatBadge = tab.segment === "chat" && chatInPrimary && chatUnread;
          const chatBadgeStyle = showChatBadge ? resolveChatBadgeStyle(chatUnread) : null;

          return (
            <Link
              key={tab.key}
              href={`/trip/${tripId}/${tab.segment}`}
              prefetch
              style={primaryButtonStyle(active, theme.accent)}
            >
              <span style={{ fontSize: "18px", lineHeight: 1, position: "relative" }}>
                {tab.icon}
                {chatBadgeStyle === "count" && <ChatCountBadge count={chatUnread!.count} />}
                {chatBadgeStyle === "muted-dot" && <ChatMutedDot />}
              </span>
              <span style={primaryLabelStyle(active, theme.accent)}>{tab.label}</span>
            </Link>
          );
        })}

        {/* 5th slot: ⋯ More */}
        {(() => {
          // Aggregate badge on More: for v1 the only source is chat, and only
          // when chat lives behind More. We explicitly don't scaffold for
          // other tabs' activity yet — add here when that arrives.
          const showMoreChatBadge = chatInMore && chatUnread;
          const moreBadgeStyle = showMoreChatBadge ? resolveChatBadgeStyle(chatUnread) : null;

          return (
            <button
              key="__more__"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              style={primaryButtonStyle(moreActive, theme.accent)}
            >
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 900,
                  letterSpacing: "1px",
                  lineHeight: 1,
                  position: "relative",
                  color: moreActive ? theme.accent : "#333",
                }}
              >
                ⋯
                {moreBadgeStyle === "count" && <ChatCountBadge count={chatUnread!.count} />}
                {moreBadgeStyle === "muted-dot" && <ChatMutedDot />}
              </span>
              <span style={primaryLabelStyle(moreActive, theme.accent)}>More</span>
            </button>
          );
        })()}
      </nav>

      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 200,
              animation: "fadeIn 0.15s ease-out",
            }}
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More in this trip"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              maxWidth: "480px",
              margin: "0 auto",
              zIndex: 201,
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              animation: "slideUp 0.2s ease-out",
              maxHeight: "75vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drag handle */}
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "#ddd",
                margin: "10px auto 2px",
              }}
            />

            {/* Header */}
            <div style={{ padding: "10px 20px 4px" }}>
              <div
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                  fontSize: "15px",
                  color: theme.text,
                }}
              >
                More in this trip
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "11px",
                  color: theme.muted,
                }}
              >
                Everything else for this trip
              </div>
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "10px",
                padding: "14px 16px 24px",
              }}
            >
              {moreTabs.map((tab) => {
                const active = activeSegment === tab.segment;
                return (
                  <Link
                    key={tab.key}
                    href={`/trip/${tripId}/${tab.segment}`}
                    prefetch
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "14px 8px",
                      background: active ? `${theme.accent}15` : theme.card,
                      border: `1px solid ${active ? `${theme.accent}55` : theme.cardBorder}`,
                      borderRadius: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: "22px", lineHeight: 1 }}>{tab.icon}</span>
                    <span
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: active ? theme.accent : theme.text,
                      }}
                    >
                      {tab.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Style helpers ───

function primaryButtonStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    height: "100%",
    background: "none",
    border: "none",
    borderTop: `3px solid ${active ? accent : "transparent"}`,
    cursor: "pointer",
    padding: 0,
    minWidth: 0,
    position: "relative",
    transition: "all 0.2s ease",
    textDecoration: "none",
    color: "inherit",
  };
}

function primaryLabelStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    fontSize: "10px",
    fontWeight: active ? 700 : 500,
    color: active ? accent : "#999",
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  };
}

// ─── Chat badge helpers ───
// Shared by the Chat primary tab and the ⋯ More aggregate rendering so the
// two paths never visually drift.

function resolveChatBadgeStyle(
  unread: TripChatUnreadState | null,
): "muted-dot" | "count" | null {
  if (!unread) return null;
  if (unread.level === "muted") return "muted-dot";
  if (unread.count > 0) return "count";
  return null;
}

function ChatCountBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread`}
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
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChatMutedDot() {
  return (
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
  );
}
