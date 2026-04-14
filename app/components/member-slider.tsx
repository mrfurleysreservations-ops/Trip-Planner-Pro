"use client";
import { ageIcon } from "@/lib/utils";

interface MemberSliderProps {
  members: { name: string; age_type: string; avatar_url?: string | null }[];
  selectedName: string | null;
  onSelect: (name: string | null) => void;
  badge?: (name: string) => string | number | null;
}

export default function MemberSlider({ members, selectedName, onSelect, badge }: MemberSliderProps) {
  return (
    <div
      className="slider-hide-scrollbar"
      style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px", paddingTop: "4px" }}
    >
      {members.map((m) => {
        const selected = selectedName === m.name;
        const badgeVal = badge ? badge(m.name) : null;
        return (
          <div
            key={m.name}
            onClick={() => onSelect(selected ? null : m.name)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer", flexShrink: 0, width: "72px" }}
          >
            {/* Avatar */}
            <div style={{ position: "relative" }}>
              {m.avatar_url ? (
                <img
                  src={m.avatar_url}
                  alt={m.name}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `3px solid ${selected ? "#e8943a" : "transparent"}`,
                    transition: "border-color 0.2s",
                  }}
                />
              ) : (
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: selected ? "rgba(232,148,58,0.1)" : "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  border: `3px solid ${selected ? "#e8943a" : "transparent"}`,
                  transition: "border-color 0.2s, background 0.2s",
                }}>
                  {ageIcon(m.age_type)}
                </div>
              )}
              {badgeVal != null && (
                <span style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  background: "#e8943a",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  minWidth: "20px",
                  height: "20px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}>{badgeVal}</span>
              )}
            </div>
            {/* Name */}
            <span style={{
              fontSize: "11px",
              fontWeight: selected ? 700 : 500,
              color: selected ? "#e8943a" : "#777",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "72px",
            }}>{m.name}</span>
          </div>
        );
      })}
    </div>
  );
}
