"use client";
import { usePathname, useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";

const TOP_NAV_TABS = [
  { key: "trips",   label: "Trips",   icon: "🧳", path: "/dashboard" },
  { key: "chats",   label: "Chats",   icon: "💬", path: "/chats"    },
  { key: "friends", label: "Friends", icon: "👥", path: "/friends"  },
  { key: "gear",    label: "Gear",    icon: "🎒", path: "/gear"     },
  { key: "profile", label: "Profile", icon: "👤", path: "/profile"  },
  { key: "alerts",  label: "Alerts",  icon: "🔔", path: "/alerts"   },
];

function getActiveKey(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "trips";
  if (pathname.startsWith("/chats"))   return "chats";
  if (pathname.startsWith("/friends")) return "friends";
  if (pathname.startsWith("/gear"))    return "gear";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/alerts"))  return "alerts";
  return "";
}

interface TopNavProps {
  /** Count of unread chat messages across all trips the user belongs to. 0 = no bubble. */
  unreadChatCount?: number;
  /** Count of pending friend requests targeting the current user. 0 = no bubble. */
  pendingFriendCount?: number;
  /** Optional future: unread alerts. 0 = no bubble. */
  unreadAlertCount?: number;
}

export default function TopNav({
  unreadChatCount = 0,
  pendingFriendCount = 0,
  unreadAlertCount = 0,
}: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = getActiveKey(pathname);
  const th = THEMES.home; // dashboard-level pages use home theme

  const badgeFor = (key: string): number => {
    if (key === "chats")   return unreadChatCount;
    if (key === "friends") return pendingFriendCount;
    if (key === "alerts")  return unreadAlertCount;
    return 0;
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        height: 56,
        padding: "0 2px",
        background: "transparent",
      }}
    >
      {TOP_NAV_TABS.map((tab) => {
        const active = activeKey === tab.key;
        const badge = badgeFor(tab.key);
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.path)}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              height: "100%",
              background: "none",
              border: "none",
              borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
              cursor: "pointer",
              padding: 0,
              minWidth: 0,
              transition: "all 0.2s ease",
              fontFamily: "'DM Sans', sans-serif",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, position: "relative" }}>
              {tab.icon}
              {badge > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -9,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#e74c3c",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    border: "1.5px solid #fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                color: active ? th.accent : "#999",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
