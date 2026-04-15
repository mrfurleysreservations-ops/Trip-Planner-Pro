"use client";

import { useState, useEffect } from "react";
import StepHeader from "../components/step-header";
import PackingVisual from "../components/packing-visual";
import { ACCENT, PACKING_SUB_STEPS } from "../constants";
import { PACKING_STYLE_DEFAULTS } from "@/lib/constants";
import type { StepProps, OnboardingData } from "../types";

// Use the first sub-step (packing style) options — the only screen we need
const STYLE_OPTIONS = PACKING_SUB_STEPS[0].options;

export default function StepPacking({ data, onChange }: StepProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentValue = data.packingStyle as string | null;
  const option = STYLE_OPTIONS[selectedIndex];

  // Sync selectedIndex if packingStyle already has a saved value, or auto-select first option
  useEffect(() => {
    if (currentValue) {
      const idx = STYLE_OPTIONS.findIndex((o) => o.value === currentValue);
      if (idx >= 0) setSelectedIndex(idx);
    } else {
      // Auto-commit the first option so "Next" works without tapping a pill
      const defaults = PACKING_STYLE_DEFAULTS[STYLE_OPTIONS[0].value] || {};
      onChange({
        packingStyle: STYLE_OPTIONS[0].value,
        orgMethod: defaults.organization_method || null,
        foldingMethod: defaults.folding_method || null,
        compartmentSystem: defaults.compartment_system || null,
      } as Partial<OnboardingData>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectOption = (idx: number) => {
    setSelectedIndex(idx);
    const style = STYLE_OPTIONS[idx].value;
    const defaults = PACKING_STYLE_DEFAULTS[style] || {};
    onChange({
      packingStyle: style,
      orgMethod: defaults.organization_method || null,
      foldingMethod: defaults.folding_method || null,
      compartmentSystem: defaults.compartment_system || null,
    } as Partial<OnboardingData>);
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <StepHeader
        step={6}
        total={7}
        title="How do you pack?"
        subtitle="Pick the one that sounds most like you — we'll set everything else up automatically."
      />

      {/* Animated visual preview */}
      <div key={`visual-${selectedIndex}`} style={{ marginBottom: "16px" }}>
        <PackingVisual type={option.visual} isActive={true} />
      </div>

      {/* Horizontal scrolling pill selector */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "14px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {STYLE_OPTIONS.map((opt, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button key={opt.value} onClick={() => selectOption(i)} style={{ padding: "10px 18px", borderRadius: "24px", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", color: isSelected ? "#fff" : "#1a1a1a", fontSize: "15px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail card */}
      <div key={`detail-${selectedIndex}`} style={{ background: "rgba(232,148,58,0.05)", borderRadius: "16px", padding: "18px", marginBottom: "8px", border: "1px solid rgba(232,148,58,0.15)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "28px" }}>{option.icon}</span>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>{option.label}</div>
            <div style={{ fontSize: "13px", color: "#999", fontStyle: "italic" }}>{option.tagline}</div>
          </div>
        </div>
        <p style={{ fontSize: "15px", color: "#555", lineHeight: "1.6", margin: "0 0 14px" }}>{option.description}</p>
        <div style={{ borderTop: "1px solid rgba(232,148,58,0.15)", paddingTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>How this works in your trip</div>
          {option.howItWorks.map((point, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px", fontSize: "14px", color: "#555", lineHeight: "1.5" }}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Green confirmation banner */}
      {currentValue && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "12px", background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.18)", marginBottom: "8px" }}>
          <span style={{ fontSize: "14px" }}>✅</span>
          <span style={{ fontSize: "13px", color: "#2e7d32", fontWeight: 600, flex: 1 }}>
            {option.icon} {option.label} selected — sub-preferences auto-filled. You can fine-tune anytime in your profile.
          </span>
        </div>
      )}

    </div>
  );
}
