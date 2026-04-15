"use client";

import { GENDERS } from "@/lib/constants";
import AvatarPicker from "@/app/components/avatar-picker";
import PillSelector from "../components/pill-selector";
import { ACCENT } from "../constants";
import type { OnboardingData } from "../types";

interface StepProfileProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  userId: string;
}

export default function StepProfile({ data, onChange, userId }: StepProfileProps) {
  return (
    <div className="fade-in">
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🧳</div>
        <h1 style={{ fontSize: "30px", fontWeight: 800, margin: "0 0 6px", fontFamily: "'Outfit', system-ui, sans-serif" }}>Welcome to Trip Planner Pro</h1>
        <p style={{ fontSize: "16px", color: "#777", margin: 0 }}>Let&apos;s get you set up in about 2 minutes</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
        <AvatarPicker
          currentUrl={data.avatarUrl}
          fallbackEmoji="📸"
          size={110}
          storagePath={`profiles/${userId}`}
          onUploaded={(url) => onChange({ avatarUrl: url })}
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "14px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>Your Name</label>
        <input value={data.name || ""} onChange={(e) => onChange({ name: e.target.value })} placeholder="What should we call you?" style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "18px", fontWeight: 600, outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "14px", fontWeight: 600, color: "#999", display: "block", marginBottom: "8px" }}>I identify as</label>
        <PillSelector options={GENDERS} selected={data.gender} onSelect={(v) => onChange({ gender: v })} />
      </div>
    </div>
  );
}
