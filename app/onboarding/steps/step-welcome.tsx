"use client";

import { useRouter } from "next/navigation";
import { ACCENT } from "../constants";

interface StepWelcomeProps {
  onSetup: () => void;
  onSkip: () => void;
}

const FEATURES = [
  { icon: "👕", title: "Smart Packing Lists", desc: "Auto-generated from your itinerary, style & weather" },
  { icon: "👨‍👩‍👧‍👦", title: "Pack for Your Crew", desc: "Family members, friends — everyone's list in one place" },
  { icon: "📋", title: "Your Packing Personality", desc: "Planner? Minimalist? Overpacker? We adapt to you" },
];

export default function StepWelcome({ onSetup, onSkip }: StepWelcomeProps) {
  const router = useRouter();

  return (
    <div style={{ padding: "0 20px 40px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "28px", marginTop: "20px" }}>
        <div style={{ fontSize: "52px", marginBottom: "12px" }}>🧳</div>
        <h1 style={{ fontSize: "30px", fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
          Welcome to<br />Trip Planner Pro
        </h1>
        <p style={{ fontSize: "16px", color: "#777", marginTop: "10px" }}>
          The smartest way to pack for any trip
        </p>
      </div>

      {/* Card 1 — Set Up My Profile */}
      <div style={{
        borderRadius: "18px",
        border: "1.5px solid #e8e8e8",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        background: "#fff",
        padding: "22px 20px 20px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            What 2 minutes of setup unlocks
          </div>
        </div>

        {FEATURES.map((f, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: "1px", background: "#f2f2f2", margin: "0" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0" }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(232,148,58,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{f.title}</div>
                <div style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>{f.desc}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Time badge */}
        <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 18px" }}>
          <span style={{
            display: "inline-block",
            padding: "6px 16px",
            borderRadius: "20px",
            background: "rgba(76,175,80,0.08)",
            border: "1px solid rgba(76,175,80,0.18)",
            fontSize: "12px",
            fontWeight: 600,
            color: "#2e7d32",
          }}>
            ⏱️ Takes about 2 minutes
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={onSetup}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: ACCENT,
            color: "#fff",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(232,148,58,0.35)",
          }}
        >
          Set Up My Profile →
        </button>
      </div>

      {/* Card 2 — Explore First */}
      <div style={{
        borderRadius: "18px",
        border: "1.5px solid #e8e8e8",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        background: "#fff",
        padding: "22px 20px 20px",
        marginTop: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "rgba(33,150,243,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            flexShrink: 0,
          }}>
            🗺️
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>Want to look around first?</div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>
              Jump straight into the app — create a trip, explore features, and see how it all works. We'll ask you to set up your profile when you're ready to pack.
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "2px solid #e0e0e0",
            background: "#fff",
            color: "#555",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Explore the App →
        </button>
      </div>
    </div>
  );
}
