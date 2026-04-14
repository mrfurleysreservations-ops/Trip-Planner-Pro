"use client";

import { ACCENT } from "../constants";

export default function StepHeader({ step, total, title, subtitle }: { step: number; total: number; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: "16px", textAlign: "center" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Step {step} of {total}</div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px", fontFamily: "'Outfit', system-ui, sans-serif" }}>{title}</h2>
      <p style={{ fontSize: "14px", color: "#777", margin: 0, lineHeight: "1.5" }}>{subtitle}</p>
    </div>
  );
}
