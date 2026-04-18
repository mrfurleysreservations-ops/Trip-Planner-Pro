"use client";
// Shared layout primitives. Extract more from app/friends/friends-page.tsx as second consumers appear.

export function PillBtn({
  label,
  active,
  onClick,
  accent,
  muted,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent: string;
  muted: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? accent : "transparent",
        border: "none",
        padding: "8px 22px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? "#fff" : muted,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function SectionHeader({
  label,
  size = "sm",
  style,
}: {
  label: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}) {
  const sizeStyle: React.CSSProperties =
    size === "md"
      ? {
          fontSize: 14,
          fontWeight: 700,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 12,
          fontFamily: "'DM Sans', sans-serif",
        }
      : {
          fontSize: 11,
          fontWeight: 700,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "16px 0 6px",
          fontFamily: "'DM Sans', sans-serif",
        };
  return <h3 style={{ ...sizeStyle, ...style }}>{label}</h3>;
}
