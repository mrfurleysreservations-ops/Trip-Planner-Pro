"use client";

import { ACCENT } from "../constants";

export default function UserRow({ user, isSelected, onToggle, subtitle }: { user: { avatar?: string; avatar_url?: string | null; name: string; email?: string }; isSelected: boolean; onToggle: () => void; subtitle?: string }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", border: `1.5px solid ${isSelected ? ACCENT : "#eee"}`, background: isSelected ? "rgba(232,148,58,0.04)" : "#fff", cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: isSelected ? "rgba(232,148,58,0.1)" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0, overflow: "hidden" }}>
        {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (user.avatar || "🧑")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>{user.name}</div>
        <div style={{ fontSize: "11px", color: "#999" }}>{subtitle || user.email}</div>
      </div>
      <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "14px", fontWeight: 700, transition: "all 0.2s", flexShrink: 0 }}>
        {isSelected ? "✓" : ""}
      </div>
    </div>
  );
}
