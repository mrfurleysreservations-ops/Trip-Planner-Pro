"use client";

import { ACCENT } from "../constants";

export default function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "28px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === current ? "28px" : "8px", height: "8px", borderRadius: "4px", background: i <= current ? ACCENT : "#ddd", transition: "all 0.4s ease" }} />
      ))}
    </div>
  );
}
