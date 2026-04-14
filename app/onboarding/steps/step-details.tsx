"use client";

import { AGE_RANGES } from "@/lib/constants";
import StepHeader from "../components/step-header";
import PillSelector from "../components/pill-selector";
import NavButtons from "../components/nav-buttons";
import { ACCENT } from "../constants";
import type { StepProps } from "../types";

export default function StepDetails({ data, onChange, onNext, onBack }: StepProps) {
  return (
    <div className="fade-in">
      <StepHeader step={2} total={7} title="A little about you" subtitle="This helps us tailor suggestions to your age group and keep your account secure" />
      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "8px" }}>Age Range</label>
        <PillSelector options={AGE_RANGES} selected={data.ageRange} onSelect={(v) => onChange({ ageRange: v })} />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>Phone Number <span style={{ fontWeight: 400, color: "#bbb" }}>(optional)</span></label>
        <input value={data.phone || ""} onChange={(e) => onChange({ phone: e.target.value })} placeholder="(555) 123-4567" type="tel" style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "16px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
        <p style={{ fontSize: "11px", color: "#bbb", margin: "6px 0 0", lineHeight: "1.4" }}>Used for trip alerts and reminders only. Never shared.</p>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!data.ageRange} />
    </div>
  );
}
