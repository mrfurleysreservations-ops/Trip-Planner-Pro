"use client";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { TRIP_TYPES, THEMES } from "@/lib/constants";
import type { UserProfile, Trip } from "@/types/database.types";
import type { FamilyWithMembers } from "./page";
import TopNav from "@/app/top-nav";

interface DashboardProps {
  user: { id: string; email: string };
  profile: UserProfile | null;
  initialTrips: Trip[];
  initialFamilies: FamilyWithMembers[];
  unreadChatCount: number;
  pendingFriendCount: number;
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

interface TripCardProps {
  trip: Trip;
  past: boolean;
  theme: typeof THEMES.home;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
}

function TripCard({ trip, past, theme, onDelete, onNavigate }: TripCardProps) {
  const tt = TRIP_TYPES.find((t) => t.value === trip.trip_type) || TRIP_TYPES[0];
  const tth = THEMES[trip.trip_type] || THEMES.camping;
  return (
    <div
      className="card-glass slide-in"
      style={{
        cursor: "pointer",
        borderLeft: `4px solid ${tth.accent}`,
        opacity: past ? 0.65 : 1,
        padding: "16px 18px",
      }}
      onClick={() => onNavigate(trip.id)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Trip name */}
          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
            {tt.icon} {trip.name}
          </div>
          {/* Location */}
          {trip.location && (
            <div style={{ fontSize: "14px", color: theme.muted, marginBottom: "4px" }}>
              📍 {trip.location}
            </div>
          )}
          {/* Dates + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
            <span className="badge" style={{ background: tth.accent }}>{tt.label}</span>
            <span style={{ fontSize: "13px", color: "#999" }}>
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, marginLeft: "12px" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}
            className="btn btn-sm"
            style={{ background: "#e74c3c", fontSize: "11px" }}
          >Delete</button>
          <span style={{ color: "#ccc", fontSize: "20px" }}>›</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({
  user,
  profile,
  initialTrips,
  initialFamilies,
  unreadChatCount,
  pendingFriendCount,
}: DashboardProps) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [families] = useState<FamilyWithMembers[]>(initialFamilies);
  const [creating, setCreating] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const th = THEMES.home;

  const createTrip = async () => {
    if (creating) return;
    setCreating(true);
    const { data } = await supabase.from("trips").insert({
      owner_id: user.id,
      name: "New Trip",
      trip_type: "meetup",
    }).select().single();

    if (data) {
      // Initialize trip_data (host member is auto-created by DB trigger)
      await supabase.from("trip_data").insert({ trip_id: data.id });
      router.push(`/trip/${data.id}`);
    }
    setCreating(false);
  };

  const deleteTrip = async (id: string) => {
    await supabase.from("trips").delete().eq("id", id);
    setTrips((t) => t.filter((x) => x.id !== id));
  };

  const now = new Date();
  const upcomingTrips = trips
    .filter((t) => !t.end_date || new Date(t.end_date) >= now)
    .sort((a, b) => {
      // Soonest start date first; trips without dates go to bottom
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });

  const pastTrips = trips
    .filter((t) => t.end_date && new Date(t.end_date) < now)
    .sort((a, b) => {
      // Most recent end date first
      return new Date(b.end_date!).getTime() - new Date(a.end_date!).getTime();
    });

  const navigateToTrip = (id: string) => router.push(`/trip/${id}`);

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, paddingBottom: 96 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "You"}
                onClick={() => router.push("/profile")}
                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
              />
            ) : (
              <div
                onClick={() => router.push("/profile")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {(profile?.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="display" style={{ fontSize: 22, flex: 1, marginLeft: 4 }}>
              Your Trips
            </h2>
          </div>

          {/* Row 2 — Top-level nav */}
          <TopNav
            unreadChatCount={unreadChatCount}
            pendingFriendCount={pendingFriendCount}
          />
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>

        {/* Onboarding reminder card */}
        {profile && !profile.onboarding_completed && !reminderDismissed && (
          <div style={{
            borderRadius: "18px",
            border: "1.5px solid #e8e8e8",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            background: "#fff",
            padding: "18px 20px",
            marginBottom: "20px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}>
            <button
              onClick={() => setReminderDismissed(true)}
              style={{
                position: "absolute",
                top: "10px",
                right: "12px",
                background: "none",
                border: "none",
                fontSize: "18px",
                color: "#bbb",
                cursor: "pointer",
                padding: "2px 6px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div style={{ fontSize: "32px", flexShrink: 0 }}>🧳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 700 }}>Finish setting up your profile</div>
              <div style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>Get personalized packing lists, style suggestions, and more</div>
            </div>
            <button
              onClick={() => router.push("/onboarding")}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                background: th.accent,
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Set Up →
            </button>
          </div>
        )}

        {/* First-time setup prompt */}
        {families.length === 0 && (
          <div className="card-glass fade-in" style={{
            padding: "24px",
            marginBottom: "24px",
            borderColor: th.accent,
            background: `linear-gradient(135deg, rgba(232,148,58,0.06), #fff)`,
          }}>
            <strong style={{ color: th.accent, fontSize: "17px" }}>👋 Welcome! Let's get started</strong>
            <p style={{ opacity: 0.6, fontSize: "14px", marginTop: "6px" }}>
              Create your family profile first — add your members and gear. Then when you start a trip, everything loads automatically.
            </p>
            <button onClick={() => router.push("/profile")} className="btn" style={{ background: th.accent, marginTop: "12px" }}>
              Create Family Profile →
            </button>
          </div>
        )}

        {/* Empty state */}
        {trips.length === 0 && (
          <div className="card-glass" style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "42px", marginBottom: "10px" }}>🧭</div>
            <p style={{ color: th.muted, fontSize: "15px" }}>No trips yet! Create your first one above.</p>
          </div>
        )}

        {/* Upcoming trips */}
        {upcomingTrips.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "12px",
            }}>
              Upcoming
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {upcomingTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} past={false} theme={th} onDelete={deleteTrip} onNavigate={navigateToTrip} />
              ))}
            </div>
          </div>
        )}

        {/* Past trips */}
        {pastTrips.length > 0 && (
          <div>
            <h3 style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#bbb",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "12px",
            }}>
              Past Trips
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pastTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} past={true} theme={th} onDelete={deleteTrip} onNavigate={navigateToTrip} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── FAB — New Trip ─── */}
      <button
        onClick={createTrip}
        disabled={creating}
        aria-label="New trip"
        style={{
          position: "fixed",
          bottom: 20,
          right: 18,
          zIndex: 50,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
          color: "#fff",
          border: "none",
          fontSize: 28,
          fontWeight: 300,
          cursor: creating ? "default" : "pointer",
          opacity: creating ? 0.5 : 1,
          boxShadow: `0 4px 20px ${th.accent}8c`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.1s",
        }}
      >
        {creating ? "…" : "+"}
      </button>
    </div>
  );
}
