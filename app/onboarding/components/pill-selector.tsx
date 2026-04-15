"use client";

import { ACCENT } from "../constants";

export default function PillSelector({ options, selected, onSelect, multiSelect = false }: { options: readonly { value: string; label: string; icon?: string }[]; selected: string | string[] | null; onSelect: (value: string) => void; multiSelect?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
      {options.map((opt) => {
        const isSelected = multiSelect ? (selected as string[] || []).includes(opt.value) : selected === opt.value;
        return (
          <button key={opt.value} onClick={() => onSelect(opt.value)} style={{ padding: "12px 20px", borderRadius: "24px", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", color: isSelected ? "#fff" : "#1a1a1a", fontSize: "16px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "8px" }}>
            {opt.icon && <span style={{ fontSize: "16px" }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
