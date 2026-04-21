"use client";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation, GEAR_ICONS } from "@/lib/constants";
import type { GearBin, GearBinInsert, GearBinUpdate, GearItem, GearItemInsert } from "@/types/database.types";

/**
 * BinEditModal — shared bottom-sheet editor for a gear bin.
 *
 * Drives the same UX on /gear (library) AND the trip Gear view. Supports
 * arbitrary-depth nesting: tapping a child bin pushes it onto an in-modal
 * navigation stack; the breadcrumb + back-crumb pop it.
 *
 * Layout invariant: sticky head + crumb, scrollable body (child bins + items),
 * sticky bottom CTA with "Add item" and "＋ Add a bin inside this bin".
 *
 * Writes bins/items through the passed Supabase client and notifies the parent
 * via onBinsChange / onItemsChange so external state can optimistically track.
 */

type Theme = {
  bg: string;
  text: string;
  muted: string;
  cardBorder: string;
  card: string;
  accent: string;
};

export interface BinEditModalProps {
  ownerId: string;
  rootBinId: string;                     // the bin the user opened
  allBins: GearBin[];                    // full library (flat)
  items: GearItem[];                     // full library items (flat)
  onBinsChange: (next: GearBin[]) => void;
  onItemsChange: (next: GearItem[]) => void;
  onClose: () => void;
  theme?: Theme;
  /** Optional right-side action shown in the crumb row (e.g. "Remove from trip"). */
  rightAction?: React.ReactNode;
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

export default function BinEditModal({
  ownerId,
  rootBinId,
  allBins,
  items,
  onBinsChange,
  onItemsChange,
  onClose,
  theme,
  rightAction,
}: BinEditModalProps) {
  const th = theme ?? DEFAULT_THEME;
  const supabase = createBrowserSupabaseClient();

  // Navigation stack — root of the modal is rootBinId; each tap on a child
  // bin pushes; back-crumb pops. Stays in local state so the modal feels
  // self-contained; closing the modal discards the stack.
  const [navStack, setNavStack] = useState<string[]>([rootBinId]);

  // Reset the stack if the caller opens a different bin.
  useEffect(() => {
    setNavStack([rootBinId]);
  }, [rootBinId]);

  const currentBinId = navStack[navStack.length - 1];
  const currentBin = useMemo(
    () => allBins.find((b) => b.id === currentBinId) ?? null,
    [allBins, currentBinId]
  );

  // Keep the modal consistent if the bin is removed upstream.
  useEffect(() => {
    if (!currentBin) onClose();
  }, [currentBin, onClose]);

  // Ancestor chain for the breadcrumb line. All navigation IDs must exist in
  // allBins; drop any that don't (e.g. deleted mid-session).
  const ancestors = useMemo(() => {
    return navStack
      .map((id) => allBins.find((b) => b.id === id))
      .filter((b): b is GearBin => Boolean(b));
  }, [navStack, allBins]);

  const childBins = useMemo(
    () =>
      allBins
        .filter((b) => b.parent_bin_id === currentBinId && !b.archived_at)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allBins, currentBinId]
  );

  const currentItems = useMemo(
    () =>
      items
        .filter((i) => i.bin_id === currentBinId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items, currentBinId]
  );

  // ─── Item form state ────────────────────────────────────────────────────
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [savingItem, setSavingItem] = useState(false);

  const addItem = async () => {
    if (!currentBin) return;
    const name = newItemName.trim();
    if (!name) return;
    const qty = Math.max(1, Math.floor(Number(newItemQty) || 1));
    const sort = currentItems.length;
    setSavingItem(true);
    const payload: GearItemInsert = {
      bin_id: currentBin.id,
      name,
      quantity: qty,
      sort_order: sort,
    };
    const { data, error } = await supabase
      .from("gear_items")
      .insert(payload)
      .select()
      .single();
    setSavingItem(false);
    if (!error && data) {
      onItemsChange([...items, data as GearItem]);
      setNewItemName("");
      setNewItemQty(1);
    }
  };

  const deleteItem = async (item: GearItem) => {
    const { error } = await supabase.from("gear_items").delete().eq("id", item.id);
    if (!error) {
      onItemsChange(items.filter((i) => i.id !== item.id));
    }
  };

  // ─── Child-bin form state ──────────────────────────────────────────────
  const [addingChild, setAddingChild] = useState(false);
  const [childDraftName, setChildDraftName] = useState("");
  const [childDraftIcon, setChildDraftIcon] = useState("📦");
  const [savingChild, setSavingChild] = useState(false);

  const startAddChild = () => {
    setChildDraftName("");
    setChildDraftIcon("📦");
    setAddingChild(true);
  };

  const cancelAddChild = () => {
    setAddingChild(false);
    setChildDraftName("");
  };

  const saveChildBin = async () => {
    if (!currentBin) return;
    const name = childDraftName.trim();
    if (!name) return;
    setSavingChild(true);
    // Child inherits parent's default_location — user can change it later in
    // the library. Keeps the common "everything in this container goes in
    // the trunk" case one-click.
    const payload: GearBinInsert = {
      owner_id: ownerId,
      name,
      icon: childDraftIcon,
      color: currentBin.color,
      default_location: currentBin.default_location,
      parent_bin_id: currentBin.id,
    };
    const { data, error } = await supabase
      .from("gear_bins")
      .insert(payload)
      .select()
      .single();
    setSavingChild(false);
    if (!error && data) {
      onBinsChange([...allBins, data as GearBin]);
      cancelAddChild();
    }
  };

  // ─── Bin meta editing (current bin) ────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentBin?.name ?? "");

  useEffect(() => {
    setNameDraft(currentBin?.name ?? "");
    setRenaming(false);
  }, [currentBin?.id, currentBin?.name]);

  const saveRename = async () => {
    if (!currentBin) return;
    const next = nameDraft.trim();
    if (!next || next === currentBin.name) {
      setRenaming(false);
      return;
    }
    const payload: GearBinUpdate = { name: next };
    const { data, error } = await supabase
      .from("gear_bins")
      .update(payload)
      .eq("id", currentBin.id)
      .select()
      .single();
    if (!error && data) {
      onBinsChange(allBins.map((b) => (b.id === currentBin.id ? (data as GearBin) : b)));
    }
    setRenaming(false);
  };

  const setLocation = async (loc: CarLocation) => {
    if (!currentBin || currentBin.default_location === loc) return;
    const { data, error } = await supabase
      .from("gear_bins")
      .update({ default_location: loc })
      .eq("id", currentBin.id)
      .select()
      .single();
    if (!error && data) {
      onBinsChange(allBins.map((b) => (b.id === currentBin.id ? (data as GearBin) : b)));
    }
  };

  // ─── Navigation ────────────────────────────────────────────────────────
  const drillInto = (childId: string) => {
    setNavStack((prev) => [...prev, childId]);
  };

  const goBack = () => {
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const jumpTo = (index: number) => {
    setNavStack((prev) => prev.slice(0, index + 1));
  };

  // ─── Counts helper for child bin rows ──────────────────────────────────
  const countBinContents = (binId: string): { items: number; children: number } => {
    const children = allBins.filter((b) => b.parent_bin_id === binId && !b.archived_at);
    const itemsDirect = items.filter((i) => i.bin_id === binId).length;
    return { items: itemsDirect, children: children.length };
  };

  if (!currentBin) return null;

  const accent = currentBin.color ?? th.accent;
  const iconBg = hexToRgba(accent, 0.12);
  const loc = CAR_LOCATIONS.find((l) => l.value === currentBin.default_location);
  const locColor = loc?.color ?? th.muted;

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
        {/* ─── Drag grip ─── */}
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

        {/* ─── Sticky head ─── */}
        <div
          style={{
            padding: "4px 18px 10px",
            borderBottom: `1px solid ${th.cardBorder}`,
            background: th.bg,
            flexShrink: 0,
          }}
        >
          {/* Back-crumb row (only when nested beyond root) */}
          {navStack.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button
                onClick={goBack}
                style={{
                  background: "none",
                  border: "none",
                  color: th.accent,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 4,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ‹ {ancestors[ancestors.length - 2]?.name ?? "Back"}
              </button>
            </div>
          )}

          {/* Head row */}
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
              {currentBin.icon ?? "📦"}
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
                      setNameDraft(currentBin.name);
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
                  {currentBin.name}
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
                {loc ? (
                  <>
                    <span style={{ color: locColor }}>●</span> {loc.label}
                  </>
                ) : (
                  "No location"
                )}
                <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                {currentItems.length} {currentItems.length === 1 ? "item" : "items"}
                {childBins.length > 0 && (
                  <>
                    <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                    {childBins.length} child {childBins.length === 1 ? "bin" : "bins"}
                  </>
                )}
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

          {/* Location chips (current bin's default_location) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 10,
            }}
          >
            {CAR_LOCATIONS.map((l) => {
              const active = currentBin.default_location === l.value;
              return (
                <button
                  key={l.value}
                  onClick={() => setLocation(l.value)}
                  style={{
                    padding: "5px 10px",
                    fontSize: 11,
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

          {/* Crumb path (when nested) */}
          {ancestors.length > 1 && (
            <div
              style={{
                fontSize: 10,
                color: th.muted,
                marginTop: 10,
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.4,
              }}
            >
              {ancestors.map((a, i) => (
                <span key={a.id}>
                  <button
                    onClick={() => jumpTo(i)}
                    disabled={i === ancestors.length - 1}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: i === ancestors.length - 1 ? "default" : "pointer",
                      fontSize: 10,
                      fontWeight: i === ancestors.length - 1 ? 700 : 500,
                      color: i === ancestors.length - 1 ? th.text : th.muted,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {a.name}
                  </button>
                  {i < ancestors.length - 1 && (
                    <span style={{ margin: "0 6px", opacity: 0.4 }}>›</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {rightAction && <div style={{ marginTop: 10 }}>{rightAction}</div>}
        </div>

        {/* ─── Scrollable body ─── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px 14px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Child bins first */}
          {childBins.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: th.muted,
                  margin: "0 0 8px",
                }}
              >
                Bins inside
              </div>
              {childBins.map((c) => {
                const counts = countBinContents(c.id);
                const cLoc = CAR_LOCATIONS.find((l) => l.value === c.default_location);
                const cAccent = cLoc?.color ?? accent;
                return (
                  <div
                    key={c.id}
                    onClick={() => drillInto(c.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      border: `1px solid ${th.cardBorder}`,
                      borderLeft: `3px solid ${cAccent}`,
                      borderRadius: 10,
                      marginBottom: 6,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: hexToRgba(cAccent, 0.12),
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 17,
                        flexShrink: 0,
                      }}
                    >
                      {c.icon ?? "📦"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: th.muted, marginTop: 3 }}>
                        {counts.items} {counts.items === 1 ? "item" : "items"}
                        {counts.children > 0 && (
                          <>
                            <span style={{ margin: "0 4px", opacity: 0.5 }}>·</span>
                            {counts.children} child {counts.children === 1 ? "bin" : "bins"}
                          </>
                        )}
                      </div>
                    </div>
                    <span style={{ color: th.muted, fontSize: 14 }}>›</span>
                  </div>
                );
              })}
            </>
          )}

          {/* Items */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: th.muted,
              margin: `${childBins.length > 0 ? 14 : 0}px 0 8px`,
            }}
          >
            {childBins.length > 0 ? "Loose items in this bin" : "Items"}
          </div>
          {currentItems.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 12,
                color: th.muted,
                background: th.card,
                borderRadius: 10,
                border: `1px dashed ${th.cardBorder}`,
                fontStyle: "italic",
              }}
            >
              {childBins.length > 0
                ? "Nothing loose — every item is inside a child bin."
                : "No items yet. Add one below."}
            </div>
          ) : (
            currentItems.map((it) => (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 2px",
                  fontSize: 12,
                  borderBottom: `1px dashed ${th.cardBorder}`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{it.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    background: th.card,
                    color: th.muted,
                    borderRadius: 999,
                    flexShrink: 0,
                  }}
                >
                  ×{it.quantity}
                </span>
                <button
                  onClick={() => deleteItem(it)}
                  aria-label={`Remove ${it.name}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: th.muted,
                    fontSize: 13,
                    cursor: "pointer",
                    padding: "0 4px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}

          {/* Child-bin inline form (opens when ＋ Add a bin inside is tapped) */}
          {addingChild && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "#fff",
                border: `1.5px solid ${th.accent}`,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: th.muted,
                  marginBottom: 8,
                }}
              >
                New child bin
              </div>
              <input
                value={childDraftName}
                onChange={(e) => setChildDraftName(e.target.value)}
                placeholder="Cookware Tote, Spices, …"
                autoFocus
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  border: `1.5px solid ${th.cardBorder}`,
                  borderRadius: 10,
                  background: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 10,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveChildBin();
                }}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(10, 1fr)",
                  gap: 5,
                  marginBottom: 10,
                }}
              >
                {GEAR_ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setChildDraftIcon(ic)}
                    style={{
                      aspectRatio: "1 / 1",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                      borderRadius: 8,
                      border: `1.5px solid ${childDraftIcon === ic ? th.accent : th.cardBorder}`,
                      background: childDraftIcon === ic ? hexToRgba(th.accent, 0.1) : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={cancelAddChild}
                  disabled={savingChild}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 10,
                    border: `1px solid ${th.cardBorder}`,
                    background: "#fff",
                    color: th.muted,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveChildBin}
                  disabled={savingChild || !childDraftName.trim()}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 10,
                    border: "none",
                    background: th.accent,
                    color: "#fff",
                    cursor: childDraftName.trim() ? "pointer" : "not-allowed",
                    fontFamily: "'DM Sans', sans-serif",
                    opacity: childDraftName.trim() ? 1 : 0.5,
                  }}
                >
                  {savingChild ? "Saving…" : "Create bin"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Sticky bottom CTA ─── */}
        <div
          style={{
            padding: "10px 14px 14px",
            borderTop: `1px solid ${th.cardBorder}`,
            background: "#fff",
            display: "flex",
            gap: 8,
            alignItems: "stretch",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add item to this bin…"
            disabled={addingChild}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            style={{
              flex: "1 1 160px",
              minWidth: 140,
              padding: "9px 12px",
              fontSize: 13,
              border: `1.5px solid ${th.cardBorder}`,
              borderRadius: 10,
              background: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              opacity: addingChild ? 0.5 : 1,
            }}
          />
          <input
            type="number"
            min={1}
            value={newItemQty}
            onChange={(e) => setNewItemQty(parseInt(e.target.value, 10) || 1)}
            aria-label="Quantity"
            disabled={addingChild}
            style={{
              width: 60,
              padding: "9px 10px",
              fontSize: 13,
              border: `1.5px solid ${th.cardBorder}`,
              borderRadius: 10,
              textAlign: "center",
              fontFamily: "'DM Sans', sans-serif",
              background: "#fff",
              opacity: addingChild ? 0.5 : 1,
            }}
          />
          <button
            onClick={addItem}
            disabled={savingItem || !newItemName.trim() || addingChild}
            style={{
              background: th.accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: newItemName.trim() && !addingChild ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
              opacity: newItemName.trim() && !addingChild ? 1 : 0.5,
              whiteSpace: "nowrap",
            }}
          >
            ＋ Add
          </button>
          <button
            onClick={addingChild ? cancelAddChild : startAddChild}
            style={{
              flex: "1 1 100%",
              background: "#fff",
              color: th.accent,
              border: `1.5px solid ${th.accent}`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textAlign: "center",
            }}
          >
            {addingChild ? "✕ Cancel new bin" : "＋ Add a bin inside this bin"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
