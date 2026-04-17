"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SLOT_DEFS, getSlotSuggestions, type SlotKey } from "@/lib/slot-suggestions";
import { DRESS_CODES } from "@/lib/constants";
import type { PackingItem } from "@/types/database.types";

// ─── Reusable bottom-sheet picker scoped to a single outfit slot ───
//
// The modal knows nothing about Supabase. It takes the reuse list + current
// items and fires callbacks; the parent (packing-page) does the writes. That
// keeps this component portable and matches the "slot you tap is the slot
// the item lands in" promise — the modal never infers a category.
//
// Sheet contents in priority order (task spec):
//   1. "Reuse from suitcase" chips — items already added to this slot
//      elsewhere in the trip, sorted by reuse count desc. Filters live as
//      the user types.
//   2. "Suggestions for [dress code]" — dashed chips from slot-suggestions.ts.
//   3. "Add new" text input + Add button. Return / Add commits as that slot's
//      category (the parent decides via onAdd; this component just passes
//      the name through).
//
// Accessories is multi-select: taps stack locally, Done commits the batch.
// All other slots commit on first tap and close.

export interface ReuseChip {
  /** Canonical name (deduped across member's packing_items for this slot). */
  name: string;
  /** How many packed copies exist across the trip for this member+slot. */
  count: number;
}

export interface SlotModalProps {
  slotType: SlotKey;
  /** Trip context (identifiers only — the modal doesn't query the DB). */
  tripId: string;
  activeMemberId: string;
  /** Nullable when the current outfit hasn't been persisted yet. */
  outfitGroupId: string | null;
  /** Dress code of the current event (drives suggestion list). */
  dressCode: string | null;
  /** Reuse chips the parent has pre-computed from memberItems. */
  reuseChips: ReuseChip[];
  /** Packing items currently linked to this outfit in this slot. */
  currentInSlot: PackingItem[];
  /** Commit one or more names to this slot. Parent handles category + persistence. */
  onAdd: (names: string[]) => void | Promise<void>;
  /** Remove a previously-added item from this slot. */
  onRemove: (packingItemId: string) => void | Promise<void>;
  onClose: () => void;
}

function dressCodeLabel(code: string | null): string {
  if (!code) return "Casual";
  const found = DRESS_CODES.find(d => d.value === code);
  return found?.label || code;
}

export default function SlotModal({
  slotType,
  dressCode,
  reuseChips,
  currentInSlot,
  onAdd,
  onRemove,
  onClose,
}: SlotModalProps) {
  const def = SLOT_DEFS[slotType];
  const isMulti = def.multi;

  const [query, setQuery] = useState("");
  const [staged, setStaged] = useState<string[]>([]); // multi-select buffer
  const [keyboardUp, setKeyboardUp] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ESC closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Live-filter reuse chips against the query. Case-insensitive substring.
  const filteredReuse = useMemo(() => {
    if (!query.trim()) return reuseChips;
    const q = query.toLowerCase().trim();
    return reuseChips.filter(c => c.name.toLowerCase().includes(q));
  }, [reuseChips, query]);

  // Names that are already either in the slot or staged — used to show
  // "added" state on chips and avoid dupes inside a single session.
  const addedLookup = useMemo(() => {
    const set = new Set<string>();
    currentInSlot.forEach(i => set.add(i.name.toLowerCase()));
    staged.forEach(n => set.add(n.toLowerCase()));
    return set;
  }, [currentInSlot, staged]);

  const pickChip = (name: string) => {
    if (isMulti) {
      if (addedLookup.has(name.toLowerCase())) return; // already staged / already in slot
      setStaged(prev => [...prev, name]);
    } else {
      void onAdd([name]);
      onClose();
    }
  };

  const commitTyped = () => {
    const name = query.trim();
    if (!name) return;
    if (isMulti) {
      if (!addedLookup.has(name.toLowerCase())) setStaged(prev => [...prev, name]);
      setQuery("");
    } else {
      void onAdd([name]);
      onClose();
    }
  };

  const done = () => {
    if (staged.length > 0) void onAdd(staged);
    onClose();
  };

  const canAdd = query.trim().length > 0;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 90,
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add a ${def.label}`}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          background: "white", borderRadius: "22px 22px 0 0",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.35)",
          zIndex: 100, display: "flex", flexDirection: "column",
          maxHeight: keyboardUp ? "55%" : "85%",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Handle */}
        <div style={{ width: "38px", height: "4px", background: "#d0c8b8", borderRadius: "2px", margin: "8px auto 4px", flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "8px 18px 12px", borderBottom: "1px solid #f0ebe4", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "24px" }}>{def.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "16px", color: "#2a2a2a" }}>Add a {def.label}</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "1px" }}>
              {dressCodeLabel(dressCode)}{isMulti ? " · tap multiple, then Done" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "#f4efe4", border: "none", width: "30px", height: "30px", borderRadius: "50%", fontSize: "16px", cursor: "pointer", color: "#666" }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "10px 16px 14px" }}>

          {/* Already in this slot (removable) */}
          {currentInSlot.length > 0 && (
            <>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#2e7d32", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 6px" }}>
                ✓ In this outfit
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingBottom: "6px" }}>
                {currentInSlot.map(item => (
                  <span
                    key={item.id}
                    style={{
                      fontSize: "12px", fontWeight: 600, padding: "7px 11px",
                      border: "1px solid #c8e6c9", borderRadius: "16px",
                      background: "#e8f5e9", color: "#2e7d32",
                      display: "inline-flex", gap: "6px", alignItems: "center",
                    }}
                  >
                    {item.name}
                    <button
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.name}`}
                      style={{ background: "none", border: "none", color: "#2e7d32", cursor: "pointer", fontSize: "13px", padding: 0, lineHeight: 1 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Staged (multi mode) */}
          {isMulti && staged.length > 0 && (
            <>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#c77013", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 6px" }}>
                Ready to add
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingBottom: "6px" }}>
                {staged.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    style={{
                      fontSize: "12px", fontWeight: 600, padding: "7px 11px",
                      border: "1px solid #ffe0b2", borderRadius: "16px",
                      background: "#fff8ec", color: "#c77013",
                      display: "inline-flex", gap: "6px", alignItems: "center",
                    }}
                  >
                    {name}
                    <button
                      onClick={() => setStaged(prev => prev.filter((_, i) => i !== idx))}
                      aria-label={`Unstage ${name}`}
                      style={{ background: "none", border: "none", color: "#c77013", cursor: "pointer", fontSize: "13px", padding: 0, lineHeight: 1 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Reuse from suitcase */}
          {filteredReuse.length > 0 && (
            <>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#c77013", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 6px", display: "flex", alignItems: "center", gap: "6px" }}>
                📦 {query.trim() ? "Matches in your suitcase" : "Reuse from suitcase"}
                <span style={{ fontWeight: 600, color: "#888", letterSpacing: 0, textTransform: "none" }}>
                  · {filteredReuse.length} {filteredReuse.length === 1 ? def.label.toLowerCase() : def.label.toLowerCase() + "s"} {query.trim() ? "matching" : "packed"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingBottom: "6px" }}>
                {filteredReuse.map(chip => {
                  const already = addedLookup.has(chip.name.toLowerCase());
                  return (
                    <button
                      key={chip.name}
                      onClick={() => pickChip(chip.name)}
                      disabled={already}
                      style={{
                        fontSize: "12px", fontWeight: 600, padding: "7px 11px",
                        border: `1px solid ${already ? "#c8e6c9" : "#e8e0d0"}`,
                        borderRadius: "16px",
                        background: already ? "#e8f5e9" : "white",
                        color: already ? "#2e7d32" : "#2a2a2a",
                        cursor: already ? "default" : "pointer",
                        display: "inline-flex", gap: "5px", alignItems: "center",
                        fontFamily: "inherit",
                      }}
                    >
                      {already ? "✓ " : ""}{chip.name}
                      <span style={{ fontSize: "9px", background: already ? "#c8e6c9" : "#fff0d8", color: already ? "#2e7d32" : "#c77013", padding: "0 5px", borderRadius: "6px", fontWeight: 700 }}>×{chip.count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Suggestions (hidden while typing to keep focus on matches) */}
          {!query.trim() && (() => {
            const suggs = getSlotSuggestions(slotType, dressCode);
            const filtered = suggs.filter(s => !addedLookup.has(s.toLowerCase()));
            if (filtered.length === 0) return null;
            return (
              <>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#c77013", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 6px" }}>
                  💡 Suggestions for {dressCodeLabel(dressCode)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {filtered.map(s => (
                    <button
                      key={s}
                      onClick={() => pickChip(s)}
                      style={{
                        fontSize: "11px", fontWeight: 500, padding: "5px 10px",
                        border: "1px dashed #d8cfbd", borderRadius: "14px",
                        background: "#fffbf3", color: "#977a5a",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >+ {s}</button>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Add new */}
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#c77013", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 6px" }}>
            ➕ Add new
          </div>
          <div
            style={{
              border: "2px solid #e8943a", borderRadius: "14px",
              padding: "10px 12px", background: "#fff8ec",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Type a ${def.label.toLowerCase()} you want to pack…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setKeyboardUp(true)}
              onBlur={() => setKeyboardUp(false)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commitTyped(); }
              }}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: "14px", fontWeight: 600, fontFamily: "inherit",
                color: "#2a2a2a", caretColor: "#e8943a",
              }}
            />
            <button
              onClick={commitTyped}
              disabled={!canAdd}
              style={{
                padding: "6px 12px", borderRadius: "10px",
                background: canAdd ? "#e8943a" : "#e8e0d0",
                color: canAdd ? "white" : "#888",
                border: "none", fontSize: "11px", fontWeight: 700,
                cursor: canAdd ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >Add</button>
          </div>
          <div style={{ fontSize: "10px", color: "#977a5a", marginTop: "6px" }}>
            Saves as a <strong style={{ color: "#c77013" }}>{def.label}</strong>. No category picker needed.
          </div>

          {/* Multi-select Done */}
          {isMulti && (
            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={done}
                disabled={staged.length === 0}
                style={{
                  padding: "10px 18px", borderRadius: "12px",
                  background: staged.length > 0 ? "linear-gradient(135deg, #e8943a 0%, #c77013 100%)" : "#e8e0d0",
                  color: staged.length > 0 ? "white" : "#888",
                  border: "none", fontSize: "13px", fontWeight: 700,
                  cursor: staged.length > 0 ? "pointer" : "default",
                  fontFamily: "inherit",
                  boxShadow: staged.length > 0 ? "0 2px 10px rgba(232,148,58,0.3)" : "none",
                }}
              >Done{staged.length > 0 ? ` · ${staged.length}` : ""}</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
