import { useState } from "react";

const ACCENT = "#e8943a";
const ACCENT2 = "#c75a2a";
const BG = "#f8f8f8";

const FEATURES = [
  { icon: "👕", title: "Smart Packing Lists", desc: "Auto-generated from your itinerary, style & weather" },
  { icon: "👨‍👩‍👧‍👦", title: "Pack for Your Crew", desc: "Family members, friends — everyone's list in one place" },
  { icon: "📋", title: "Your Packing Personality", desc: "Planner? Minimalist? Overpacker? We adapt to you" },
];

export default function WelcomeGateMockup() {
  const [hoveredBtn, setHoveredBtn] = useState(null);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "'Outfit', system-ui, -apple-system, sans-serif", color: "#1a1a1a" }}>
      <div style={{ padding: "0 20px 40px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", paddingTop: "32px", marginBottom: "24px" }}>
          <div style={{ fontSize: "52px", marginBottom: "12px" }}>🧳</div>
          <h1 style={{ fontSize: "30px", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2 }}>
            Welcome to<br />Trip Planner Pro
          </h1>
          <p style={{ fontSize: "16px", color: "#777", margin: 0, lineHeight: 1.5 }}>
            The smartest way to pack for any trip
          </p>
        </div>

        {/* Card 1: Set up profile */}
        <div style={{ background: "#fff", borderRadius: "18px", padding: "20px", marginBottom: "14px", border: "1.5px solid #e8e8e8", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px", textAlign: "center" }}>
            What 2 minutes of setup unlocks
          </div>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "12px 0", borderTop: i > 0 ? "1px solid #f2f2f2" : "none" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(232,148,58,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>{f.title}</div>
                <div style={{ fontSize: "13px", color: "#888", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}

          {/* Time badge */}
          <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 14px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "20px", background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.18)" }}>
              <span style={{ fontSize: "13px" }}>⏱️</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#2e7d32" }}>Takes about 2 minutes</span>
            </div>
          </div>

          {/* Primary CTA inside card */}
          <button
            onMouseEnter={() => setHoveredBtn("setup")}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: hoveredBtn === "setup" ? ACCENT2 : ACCENT,
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(232,148,58,0.35)",
              transition: "all 0.2s ease",
            }}
          >
            Set Up My Profile →
          </button>
        </div>

        {/* Card 2: Explore first */}
        <div style={{ background: "#fff", borderRadius: "18px", padding: "20px", border: "1.5px solid #e8e8e8", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(33,150,243,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
              🗺️
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>Want to look around first?</div>
              <div style={{ fontSize: "13px", color: "#888", lineHeight: 1.5 }}>
                Jump straight into the app — create a trip, explore features, and see how it all works. We&apos;ll ask you to set up your profile when you&apos;re ready to pack.
              </div>
            </div>
          </div>

          <button
            onMouseEnter={() => setHoveredBtn("skip")}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "2px solid #e0e0e0",
              background: hoveredBtn === "skip" ? "#f5f5f5" : "#fff",
              color: "#555",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Explore the App →
          </button>
        </div>

      </div>
    </div>
  );
}
