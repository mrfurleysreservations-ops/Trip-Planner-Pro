"use client";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";
import type { Trip } from "@/types/database.types";
import TripSubNav from "../trip-sub-nav";

export default function MealsPage({ trip }: { trip: Trip }) {
  const router = useRouter();
  const th = THEMES[trip.trip_type] || THEMES.home;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
      <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
        <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>Meals</h2>
      </div>
      <TripSubNav tripId={trip.id} theme={th} />
      <div style={{ padding: "24px 16px", maxWidth: "600px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🍽️</div>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "8px" }}>Meals</h3>
        <p style={{ color: th.muted, fontSize: "14px" }}>Coming soon — meal planning for the whole group.</p>
      </div>
    </div>
  );
}
