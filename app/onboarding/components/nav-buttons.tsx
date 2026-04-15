"use client";

import { ACCENT } from "../constants";

export default function NavButtons({ onBack, onNext, backLabel = "Back", nextLabel = "Next", nextDisabled = false, showBack = true }: { onBack?: () => void; onNext: () => void; backLabel?: string; nextLabel?: string; nextDisabled?: boolean; showBack?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: showBack ? "space-between" : "flex-end", alignItems: "center", width: "100%" }}>
      {showBack && <button onClick={onBack} style={{ padding: "12px 24px", borderRadius: "14px", border: "none", background: "#f0f0f0", color: "#555", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>← {backLabel}</button>}
      <button onClick={onNext} disabled={nextDisabled} style={{ padding: "12px 28px", borderRadius: "14px", border: "none", background: nextDisabled ? "#ddd" : ACCENT, color: nextDisabled ? "#999" : "#fff", fontSize: "15px", fontWeight: 700, cursor: nextDisabled ? "default" : "pointer", transition: "all 0.2s ease", flex: 1 }}>{nextLabel} →</button>
    </div>
  );
}
