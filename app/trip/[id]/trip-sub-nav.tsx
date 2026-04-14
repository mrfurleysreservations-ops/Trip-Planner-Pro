"use client";
import { usePathname, useRouter } from "next/navigation";
import type { ThemeConfig } from "@/lib/constants";

const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅", segment: "itinerary" },
  { key: "expenses", label: "Expenses", icon: "💰", segment: "expenses" },
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
}

export default function TripSubNav({ tripId, theme }: TripSubNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSegment = getActiveSegment(pathname, tripId);

  return (
    <nav style={{
      display: "flex",
      gap: "0",
      background: theme.headerBg,
      borderBottom: `1px solid ${theme.cardBorder}`,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      position: "relative",
      zIndex: 1,
      scrollbarWidth: "none",
    }}>
      {SUB_NAV_TABS.map((tab) => {
        const active = activeSegment === tab.segment;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(`/trip/${tripId}/${tab.segment}`)}
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: `3px solid ${active ? theme.accent : "transparent"}`,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: active ? 700 : 500,
              color: active ? theme.accent : theme.muted,
              whiteSpace: "nowrap",
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            <span style={{ fontSize: "14px" }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
