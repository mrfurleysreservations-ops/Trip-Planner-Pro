"use client";
import { THEMES } from "@/lib/constants";
import type { Trip } from "@/types/database.types";
import TripSubNav from "../trip-sub-nav";

export default function MealsPage({ trip }: { trip: Trip }) {
  const th = THEMES[trip.trip_type] || THEMES.home;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
      <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, position: "relative", zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", color: th.text, margin: 0 }}>
          {trip.name}
        </h2>
      </div>
      <TripSubNav tripId={trip.id} theme={th} />
      <div style={{ padding: "40px 20px", maxWidth: "960px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🍽️</div>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "8px" }}>Meals</h3>
        <p style={{ color: th.muted, fontSize: "14px" }}>Coming soon — meal planning for the whole group.</p>
      </div>
    </div>
  );
}
