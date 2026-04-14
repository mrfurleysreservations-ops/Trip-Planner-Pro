"use client";

import { useState, useEffect } from "react";
import { CLOTHING_STYLES } from "@/lib/constants";
import { ACCENT, ACCENT2, PACKING_SUB_STEPS } from "../constants";
import type { OnboardingData } from "../types";

interface StepDoneProps {
  data: OnboardingData;
  onFinish: () => void;
}

export default function StepDone({ data, onFinish }: StepDoneProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => { setTimeout(() => setShowConfetti(true), 300); }, []);

  const styleName = (data.clothingStyles || []).map((v) => CLOTHING_STYLES.find((s) => s.value === v)?.label).filter(Boolean).join(", ");
  const packOpt = PACKING_SUB_STEPS[0].options.find((s) => s.value === data.packingStyle);
  const orgOpt = PACKING_SUB_STEPS[1].options.find((s) => s.value === data.orgMethod);
  const foldOpt = PACKING_SUB_STEPS[2].options.find((s) => s.value === data.foldingMethod);
  const compOpt = PACKING_SUB_STEPS[3].options.find((s) => s.value === data.compartmentSystem);
  const totalPeople = (data.connections || []).length + (data.familyMembers || []).length;

  return (
    <div className="fade-in" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "10px" }}>
        <span style={{ display: "inline-block", transform: showConfetti ? "scale(1)" : "scale(0)", transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
      </div>
      <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", fontFamily: "'Outfit', system-ui, sans-serif" }}>You&apos;re all set, {data.name?.split(" ")[0] || "traveler"}!</h1>
      <p style={{ fontSize: "14px", color: "#777", margin: "0 0 16px", lineHeight: "1.5" }}>These preferences are saved to your profile and will be used every time you pack for a trip.</p>

      {/* Saved preferences card */}
      <div style={{ background: "#fff", borderRadius: "20px", padding: "20px", border: "1.5px solid #e0e0e0", textAlign: "left", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: "16px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4caf50", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>✅</span> Your saved preferences
        </div>

        {[
          { label: "Clothing Style", icon: "👕", value: styleName || "Not set" },
          { label: "Packing Style", icon: packOpt?.icon || "📋", value: packOpt?.label || "Not set" },
          { label: "Organization", icon: orgOpt?.icon || "📅", value: orgOpt?.label || "Not set" },
          { label: "Folding Method", icon: foldOpt?.icon || "🌀", value: foldOpt?.label || "Not set" },
          { label: "Compartments", icon: compOpt?.icon || "🧊", value: compOpt?.label || "Not set" },
          { label: "Travelers", icon: "👥", value: totalPeople > 0 ? `You + ${totalPeople} ${totalPeople === 1 ? "person" : "people"}` : "Just you (for now)" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: i < 5 ? "1px solid #f5f5f5" : "none" }}>
            <span style={{ fontSize: "16px", width: "24px", textAlign: "center" }}>{row.icon}</span>
            <span style={{ fontSize: "12px", color: "#999", fontWeight: 600, minWidth: "100px" }}>{row.label}</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginLeft: "auto", textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Change anytime note */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "20px" }}>
        <span style={{ fontSize: "12px", color: "#999" }}>You can update these anytime in</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: ACCENT, cursor: "pointer" }}>Profile → Packing Preferences</span>
      </div>

      {/* Per-trip override note */}
      <div style={{ background: "rgba(232,148,58,0.05)", borderRadius: "14px", padding: "14px 16px", marginBottom: "18px", border: "1px solid rgba(232,148,58,0.12)", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>💡</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT2 }}>These are your defaults — not locked in stone</div>
            <div style={{ fontSize: "11px", color: "#777", lineHeight: "1.5", marginTop: "2px" }}>When you create a trip, you can override any preference for that specific trip. Your profile defaults will always be the starting point.</div>
          </div>
        </div>
      </div>

      {/* Pinterest teaser */}
      <div style={{ background: "linear-gradient(135deg, #fce4ec, #f8bbd0)", borderRadius: "16px", padding: "16px", marginBottom: "16px", textAlign: "center" }}>
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>📌</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#c2185b", marginBottom: "4px" }}>Coming Soon: Style Inspiration</div>
        <div style={{ fontSize: "12px", color: "#ad1457", lineHeight: "1.5" }}>When you create a trip, we&apos;ll pull outfit inspiration from Pinterest based on your destination, style ({styleName || "your picks"}), and itinerary events.</div>
      </div>

      <button onClick={onFinish} style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: ACCENT, color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(232,148,58,0.35)" }}>Start Planning a Trip →</button>
    </div>
  );
}
