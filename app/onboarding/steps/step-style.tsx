"use client";

import { CLOTHING_STYLES } from "@/lib/constants";
import StepHeader from "../components/step-header";
import { ACCENT } from "../constants";
import type { StepProps } from "../types";

export default function StepStyle({ data, onChange }: StepProps) {
  const selected = data.clothingStyles || [];
  const toggleStyle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange({ clothingStyles: next });
  };
  return (
    <div className="fade-in">
      <StepHeader step={3} total={7} title="What's your style?" subtitle="Pick one or more — this helps us suggest outfits and packing ideas that match your vibe" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "8px" }}>
        {CLOTHING_STYLES.map((style) => {
          const isSelected = selected.includes(style.value);
          return (
            <div key={style.value} onClick={() => toggleStyle(style.value)} style={{ borderRadius: "14px", border: `2.5px solid ${isSelected ? ACCENT : "#e0e0e0"}`, overflow: "hidden", cursor: "pointer", transition: "all 0.25s ease", transform: isSelected ? "scale(1.02)" : "scale(1)", boxShadow: isSelected ? "0 4px 16px rgba(232,148,58,0.25)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: "85px", background: style.image, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontSize: "38px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{style.icon}</span>
                {isSelected && <div style={{ position: "absolute", top: "8px", right: "8px", width: "22px", height: "22px", borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px", fontWeight: 700 }}>✓</div>}
                <div style={{ position: "absolute", bottom: "8px", right: "8px", display: "flex", gap: "3px" }}>
                  {style.palette.map((color, i) => <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, border: "1px solid rgba(255,255,255,0.6)" }} />)}
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: "#fff" }}>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{style.label}</div>
                <div style={{ fontSize: "12px", color: "#999", lineHeight: "1.3", marginTop: "2px" }}>{style.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      {selected.length > 0 && <div style={{ textAlign: "center", fontSize: "12px", color: ACCENT, fontWeight: 600, margin: "12px 0 0" }}>{selected.length} style{selected.length > 1 ? "s" : ""} selected</div>}
    </div>
  );
}
