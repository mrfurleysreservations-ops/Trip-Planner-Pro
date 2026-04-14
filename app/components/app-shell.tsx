"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import TabBar from "./tab-bar";

// Auth routes that should NOT show the shell
const AUTH_ROUTES = ["/auth/login", "/auth/callback", "/"];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (AUTH_ROUTES.includes(pathname)) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile (with last seen timestamp), pending invites, friend requests, and memberships
      const [profileRes, pendingInvitesRes, pendingFriendsRes, memberRes] = await Promise.all([
        supabase.from("user_profiles").select("avatar_url, alerts_last_seen_at").eq("id", user.id).single(),
        supabase.from("trip_members").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
        supabase.from("friend_links").select("id", { count: "exact", head: true }).eq("friend_id", user.id).eq("status", "pending"),
        supabase.from("trip_members").select("trip_id").eq("user_id", user.id),
      ]);
      if (profileRes.data?.avatar_url) setUserAvatarUrl(profileRes.data.avatar_url);

      const lastSeen = profileRes.data?.alerts_last_seen_at || null;
      const pendingInvites = pendingInvitesRes.count ?? 0;
      const pendingFriends = pendingFriendsRes.count ?? 0;
      const tripIds = (memberRes.data ?? []).map((m: any) => m.trip_id);
      let activityCount = 0;
      if (tripIds.length > 0) {
        // Only count activity newer than last seen (or all if never visited alerts)
        let query = supabase
          .from("trip_activity")
          .select("id", { count: "exact", head: true })
          .in("trip_id", tripIds);
        if (lastSeen) {
          query = query.gte("created_at", lastSeen);
        }
        const { count } = await query;
        activityCount = count ?? 0;
      }
      setAlertCount(pendingInvites + pendingFriends + activityCount);
    })();
  }, [pathname]);

  // Don't wrap auth pages
  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f8" }}>
      {/* Top title bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
      }}>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: "16px",
          color: "#1a1a1a",
          letterSpacing: "-0.3px",
        }}>🧭 Trip Planner Pro</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="You" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 20 }}>👤</span>
          )}
        <button
          onClick={signOut}
          style={{
            background: "#f5f5f5",
            border: "1px solid #e0e0e0",
            color: "#777",
            fontSize: "12px",
            padding: "5px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            transition: "background 0.2s",
          }}
        >Sign Out</button>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar badges={alertCount > 0 ? { notifications: alertCount } : {}} />

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
