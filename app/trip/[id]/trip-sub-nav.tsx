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
      {SUB_NAV_TABS.map((tab) => {
        const active = activeSegment === tab.segment;
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
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>{tab.icon}</span>
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
