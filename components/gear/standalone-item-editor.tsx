"use client";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation, GEAR_ICONS } from "@/lib/constants";
import type { GearBin, GearBinUpdate } from "@/types/database.types";

/**
 * StandaloneItemEditor — lightweight bottom-sheet for a standalone gear row.
 *
 * A "standalone" gear row is stored in gear_bins with is_standalone=true. It
 * can't nest or hold child items — it represents a thing (or N copies of a
 * thing) that gets loaded into a car zone directly. Tents, camp chairs, the
 * table, the cooler — the stuff that has no internal structure.
 *
 * Compared to BinEditModal this sheet has no nav stack, no "bins inside",
 * no "add item" CTA. Just: name, icon, color, location, quantity, delete.
 */

type Theme = {
  bg: string;
  text: string;
  muted: string;
  cardBorder: string;
  card: string;
  accent: string;
};

export interface StandaloneItemEditorProps {
  ownerId: string;
  bin: GearBin;
  allBins: GearBin[];
  onBinsChange: (next: GearBin[]) => void;
  onClose: () => void;
  theme?: Theme;
  /** Optional right-side action (mirrors BinEditModal — e.g. trip-side "Remove from trip"). */
  rightAction?: React.ReactNode;
  /** Override the default delete-from-library label (trip view uses "Remove from trip" via rightAction instead). */
  allowDeleteFromLibrary?: boolean;
}

const DEFAULT_THEME: Theme = {
  bg: "#f6f8f4",
  text: "#1a1a1a",
  muted: "#6a7a5a",
  cardBorder: "rgba(90,154,47,0.2)",
  card: "rgba(90,154,47,0.06)",
  accent: "#5a9a2f",
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const COLOR_SWATCHES = ["#5a9a2f", ...CAR_LOCATIONS.map((l) => l.color)];

export default function StandaloneItemEditor({
  ownerId: _ownerId, // reserved for future writes; unused today
  bin,
  allBins,
  onBinsChange,
  onClose,
  theme,
  rightAction,
  allowDeleteFromLibrary = true,
}: StandaloneItemEditorProps) {
  const th = theme ?? DEFAULT_THEME;
  const supabase = createBrowserSupabaseClient();

  // Local copy for optimistic name/quantity edits — synced back to server on
  // blur / +/- tap. Keeps typing snappy without a round-trip per keystroke.
  const [nameDraft, setNameDraft] = useState(bin.name);
  const [renaming, setRenaming] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<number>(bin.quantity ?? 1);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setNameDraft(bin.name);
    setQtyDraft(bin.quantity ?? 1);
    setRenaming(false);
  }, [bin.id, bin.name, bin.quantity]);

  const accent = bin.color ?? th.accent;
  const iconBg = hexToRgba(accent, 0.12);
  const loc = useMemo(
    () => CAR_LOCATIONS.find((l) => l.value === bin.default_location),
    [bin.default_location]
  );

  // ─── Writes ─────────────────────────────────────────────────────────────

  const patchBin = async (patch: GearBinUpdate) => {
    const { data, error } = await supabase
      .from("gear_bins")
      .update(patch)
      .eq("id", bin.id)
      .select()
      .single();
    if (!error && data) {
      onBinsChange(allBins.map((b) => (b.id === bin.id ? (data as GearBin) : b)));
    }
  };

  const saveRename = async () => {
    const next = nameDraft.trim();
    setRenaming(false);
    if (!next || next === bin.name) {
      setNameDraft(bin.name);
      return;
    }
    await patchBin({ name: next });
  };

  const setIcon = (ic: string) => patchBin({ icon: ic });
  const setColor = (c: string) => patchBin({ color: c });
  const setLocation = (l: CarLocation) => {
    if (bin.default_location === l) return;
    patchBin({ default_location: l });
  };

  const bumpQty = (delta: number) => {
    const next = Math.max(1, qtyDraft + delta);
    setQtyDraft(next);
    patchBin({ quantity: next });
  };

  const setQtyFromInput = (val: string) => {
    const parsed = parseInt(val, 10);
    const next = Math.max(1, Number.isFinite(parsed) ? parsed : 1);
    setQtyDraft(next);
  };

  const commitQty = () => {
    if (qtyDraft !== (bin.quantity ?? 1)) patchBin({ quantity: qtyDraft });
  };

  const deleteFromLibrary = async () => {
    if (!allowDeleteFromLibrary) return;
    if (!confirm(`Delete "${bin.name}" from your gear library?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("gear_bins").delete().eq("id", bin.id);
    setDeleting(false);
    if (!error) {
      onBinsChange(allBins.filter((b) => b.id !== bin.id));
      onClose();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          background: th.bg,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.2s ease-out",
          fontFamily: "'DM Sans', sans-serif",
          color: th.text,
          overflow: "hidden",
        }}
      >
        {/* Drag grip */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px", flexShrink: 0 }}>
          <span
            style={{
              width: 36,
              height: 4,
              background: th.muted,
              borderRadius: 999,
              opacity: 0.4,
            }}
          />
        </div>

        {/* Sticky head */}
        <div
          style={{
            padding: "4px 18px 10px",
            borderBottom: `1px solid ${th.cardBorder}`,
            background: th.bg,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: iconBg,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {bin.icon ?? "🏕️"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {renaming ? (
                <input
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={saveRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") {
                      setRenaming(false);
                      setNameDraft(bin.name);
                    }
                  }}
                  style={{
                    width: "100%",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 17,
                    fontWeight: 800,
                    border: `1.5px solid ${th.cardBorder}`,
                    borderRadius: 8,
                    padding: "3px 8px",
                    background: "#fff",
                    color: th.text,
                  }}
                />
              ) : (
                <h3
                  onClick={() => setRenaming(true)}
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: 17,
                    margin: 0,
                    lineHeight: 1.2,
                    cursor: "text",
                  }}
                  title="Tap to rename"
                >
                  {bin.name}
                </h3>
              )}
              <div
                style={{
                  fontSize: 10,
                  color: th.muted,
                  marginTop: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    background: hexToRgba(accent, 0.15),
                    color: accent,
                    padding: "2px 7px",
                    borderRadius: 999,
                    marginRight: 6,
                    fontSize: 9,
                  }}
                >
                  Standalone
                </span>
                {loc ? (
                  <>
                    <span style={{ color: loc.color }}>●</span> {loc.label}
                  </>
                ) : (
                  "No location"
                )}
                <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>×{qtyDraft}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                color: th.muted,
                cursor: "pointer",
                padding: 4,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {rightAction && <div style={{ marginTop: 10 }}>{rightAction}</div>}
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px 14px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Quantity */}
          <Label muted={th.muted}>Quantity</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => bumpQty(-1)}
              disabled={qtyDraft <= 1}
              aria-label="Decrease quantity"
              style={qtyStepperStyle(th, qtyDraft <= 1)}
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qtyDraft}
              onChange={(e) => setQtyFromInput(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              style={{
                width: 72,
                padding: "10px 12px",
                fontSize: 16,
                fontWeight: 700,
                border: `1.5px solid ${th.cardBorder}`,
                borderRadius: 10,
                textAlign: "center",
                background: "#fff",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button
              onClick={() => bumpQty(1)}
              aria-label="Increase quantity"
              style={qtyStepperStyle(th, false)}
            >
              ＋
            </button>
            <span style={{ fontSize: 11, color: th.muted }}>
              How many of this item you own.
            </span>
          </div>

          {/* Location */}
          <Label muted={th.muted}>Default car location</Label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 16,
            }}
          >
            {CAR_LOCATIONS.map((l) => {
              const active = bin.default_location === l.value;
              return (
                <button
                  key={l.value}
                  onClick={() => setLocation(l.value)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 999,
                    border: `1.5px solid ${active ? l.color : th.cardBorder}`,
                    background: active ? l.color : "#fff",
                    color: active ? "#fff" : th.muted,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* Icon */}
          <Label muted={th.muted}>Icon</Label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, 1fr)",
              gap: 5,
              marginBottom: 16,
            }}
          >
            {GEAR_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                style={{
                  aspectRatio: "1 / 1",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 17,
                  borderRadius: 8,
                  border: `1.5px solid ${bin.icon === ic ? th.accent : th.cardBorder}`,
                  background: bin.icon === ic ? hexToRgba(th.accent, 0.1) : "#fff",
                  cursor: "pointer",
                }}
              >
                {ic}
              </button>
            ))}
          </div>

          {/* Color */}
          <Label muted={th.muted}>Accent color</Label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {COLOR_SWATCHES.map((sw) => (
              <button
                key={sw}
                onClick={() => setColor(sw)}
                aria-label={`Color ${sw}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: sw,
                  border:
                    bin.color === sw
                      ? "3px solid #1a1a1a"
                      : `2px solid ${th.cardBorder}`,
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* Danger zone */}
          {allowDeleteFromLibrary && (
            <button
              onClick={deleteFromLibrary}
              disabled={deleting}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 10,
                border: `1px solid rgba(200,80,58,0.4)`,
                background: "#fff",
                color: "#c8503a",
                cursor: deleting ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? "Deleting…" : "🗑 Delete from library"}
            </button>
          )}
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

function Label({ children, muted }: { children: React.ReactNode; muted: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: muted,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function qtyStepperStyle(th: Theme, disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: `1.5px solid ${th.cardBorder}`,
    background: disabled ? "#f0f0f0" : "#fff",
    color: disabled ? th.muted : th.text,
    fontSize: 18,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1,
    padding: 0,
  };
}
