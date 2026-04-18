"use client";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { key: "trips", icon: "🧭", label: "Trips", path: "/dashboard" },
  { key: "chats", icon: "💬", label: "Chats", path: "/chats" },
  { key: "gear", icon: "⚙️", label: "Gear", path: "/gear" },
  { key: "friends", icon: "👥", label: "Friends", path: "/friends" },
  { key: "profile", icon: "👤", label: "Profile", path: "/profile" },
  { key: "notifications", icon: "🔔", label: "Alerts", path: "/alerts" },
];

function isActive(tabPath: string, pathname: string): boolean {
  if (!tabPath) return false;
  if (tabPath === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/trip/");
  return pathname.startsWith(tabPath);
}

interface TabBarProps {
  badges?: Record<string, number>;
}

export default function TabBar({ badges = {} }: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const accent = "#e8943a";
  const muted = "#999";

  return (
    <nav style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      height: "56px",
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid #e5e5e5",
      padding: "0 8px",
    }}>
      {TABS.map((tab) => {
        const active = isActive(tab.path, pathname);
        const badge = badges[tab.key] || 0;
        return (
          <button
            key={tab.key}
            onClick={() => tab.path && router.push(tab.path)}
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
              borderBottom: `3px solid ${active ? accent : "transparent"}`,
              cursor: tab.path ? "pointer" : "default",
              opacity: tab.path ? 1 : 0.4,
              padding: "0 4px",
              position: "relative",
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            <span style={{ position: "relative", fontSize: "22px", lineHeight: 1 }}>
              {tab.icon}
              {badge > 0 && (
                <span style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-8px",
                  background: "#e53935",
                  color: "#fff",
                  fontSize: "9px",
                  fontWeight: 800,
                  minWidth: "16px",
                  height: "16px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  lineHeight: 1,
                }}>{badge}</span>
              )}
            </span>
            <span style={{
              fontSize: "11px",
              fontWeight: active ? 700 : 500,
              color: active ? accent : muted,
              fontFamily: "'DM Sans', sans-serif",
              transition: "color 0.2s",
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
