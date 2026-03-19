"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { TRIP_TYPES, THEMES } from "@/lib/constants";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [trips, setTrips] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const th = THEMES.home;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUser(user);

    const [profileRes, tripsRes, familiesRes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).single(),
      supabase.from("trips").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("families").select("*, family_members(*)").eq("owner_id", user.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (tripsRes.data) setTrips(tripsRes.data);
    if (familiesRes.data) setFamilies(familiesRes.data);
    setLoading(false);
  };

  const createTrip = async (type) => {
    const tt = TRIP_TYPES.find((t) => t.value === type);
    const { data, error } = await supabase.from("trips").insert({
      owner_id: user.id,
      name: "New " + tt.label + " Trip",
      trip_type: type,
    }).select().single();

    if (data) {
      // Create trip_data row
      await supabase.from("trip_data").insert({ trip_id: data.id });
      router.push(`/trip/${data.id}`);
    }
  };

  const deleteTrip = async (id) => {
    await supabase.from("trips").delete().eq("id", id);
    setTrips((t) => t.filter((x) => x.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: th.bg, display: "flex", alignItems: "center", justifyContent: "center", color: th.text }}>
        <div style={{ fontSize: "18px", opacity: 0.5 }}>Loading...</div>
      </div>
    );
  }

  const pastTrips = trips.filter((t) => t.end_date && new Date(t.end_date) < new Date());
  const upcomingTrips = trips.filter((t) => !t.end_date || new Date(t.end_date) >= new Date());

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text }}>
      {/* Header */}
      <div style={{
        background: th.headerBg,
        padding: "20px 24px",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${th.cardBorder}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div>
          <h1 className="display" style={{ fontSize: "28px", margin: 0 }}>🧭 Trip Planner Pro</h1>
          <p style={{ opacity: 0.5, fontSize: "13px", marginTop: "4px" }}>
            Welcome back, {profile?.full_name || user?.email}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => router.push("/profiles")} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)" }}>
            👥 Family Profiles
          </button>
          <button onClick={signOut} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.06)" }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 24px" }}>
        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "28px" }}>
          {[
            { label: "Trips", value: trips.length, icon: "🧭" },
            { label: "Families", value: families.length, icon: "👨‍👩‍👧‍👦" },
            { label: "Upcoming", value: upcomingTrips.length, icon: "📅" },
            { label: "Past", value: pastTrips.length, icon: "📖" },
          ].map((stat) => (
            <div key={stat.label} className="card-glass" style={{ textAlign: "center", padding: "16px" }}>
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>{stat.icon}</div>
              <div className="display" style={{ fontSize: "24px" }}>{stat.value}</div>
              <div style={{ fontSize: "12px", opacity: 0.5 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* First-time setup prompt */}
        {families.length === 0 && (
          <div className="card-glass fade-in" style={{
            padding: "24px",
            marginBottom: "24px",
            borderColor: th.accent,
            background: `linear-gradient(135deg, rgba(232,148,58,0.08), ${th.card})`,
          }}>
            <strong style={{ color: th.accent, fontSize: "16px" }}>👋 Welcome! Let's get started</strong>
            <p style={{ opacity: 0.6, fontSize: "14px", marginTop: "6px" }}>
              Create your family profile first — add your members and gear. Then when you start a trip, everything loads automatically.
            </p>
            <button onClick={() => router.push("/profiles")} className="btn" style={{ background: th.accent, marginTop: "12px" }}>
              Create Family Profile →
            </button>
          </div>
        )}

        {/* New Trip */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 className="display" style={{ fontSize: "22px" }}>Your Trips</h2>
          <button onClick={() => setShowNewTrip(!showNewTrip)} className="btn" style={{ background: th.accent, padding: "10px 24px" }}>
            + New Trip
          </button>
        </div>

        {showNewTrip && (
          <div className="fade-in" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}>
            {TRIP_TYPES.map((tt) => {
              const tth = THEMES[tt.value];
              return (
                <div key={tt.value} onClick={() => createTrip(tt.value)} className="card-glass" style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: "24px 16px",
                  borderColor: tth.accent,
                  background: `linear-gradient(135deg, ${tth.card}, rgba(255,255,255,0.02))`,
                }}>
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>{tt.icon}</div>
                  <div className="display" style={{ fontSize: "16px", color: tth.accent }}>{tt.label}</div>
                  <div style={{ fontSize: "12px", opacity: 0.4, marginTop: "4px", fontStyle: "italic" }}>{tt.tagline}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trip list */}
        {trips.length === 0 ? (
          <div className="card-glass" style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "42px", marginBottom: "10px" }}>🧭</div>
            <p style={{ opacity: 0.5, fontSize: "15px" }}>No trips yet! Create your first one above.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {trips.map((trip) => {
              const tt = TRIP_TYPES.find((t) => t.value === trip.trip_type) || TRIP_TYPES[0];
              const tth = THEMES[trip.trip_type] || THEMES.camping;
              return (
                <div key={trip.id} className="card-glass slide-in" style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  borderLeft: `4px solid ${tth.accent}`,
                }}
                onClick={() => router.push(`/trip/${trip.id}`)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px" }}>{tt.icon} {trip.name}</div>
                    {trip.location && <div style={{ fontSize: "12px", opacity: 0.5 }}>📍 {trip.location}</div>}
                    <div style={{ fontSize: "11px", opacity: 0.4, marginTop: "3px" }}>
                      <span className="badge" style={{ background: tth.accent }}>{tt.label}</span>
                      {" · "}{new Date(trip.created_at).toLocaleDateString()}
                      {trip.start_date && ` · ${new Date(trip.start_date + "T00:00:00").toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }}
                      className="btn btn-sm"
                      style={{ background: "rgba(160,50,50,0.5)", opacity: 0.7 }}
                    >Delete</button>
                    <span style={{ opacity: 0.3, fontSize: "18px" }}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
