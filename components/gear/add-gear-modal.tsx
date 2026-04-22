"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS } from "@/lib/constants";
import type { GearBin, GearItem, TripGearBin, TripGearBinInsert } from "@/types/database.types";

/**
 * AddGearModal — bottom-sheet picker to add library bins onto a trip.
 *
 * Shows the user's full library (flat, grouped by location). Bins already on
 * the trip are shown with a check + disabled tap — the (trip_id, bin_id)
 * unique index means duplicate inserts would fail anyway, but disabling on
 * the UI side is cleaner. Selected-new bins are batched into a single insert
 * on confirm so the round-trip is fast even when adding many bins.
 */

export interface AddGearModalProps {
  tripId: string;
  userId: string;
  libraryBins: GearBin[];
  libraryItems: GearItem[];
  tripGearBins: TripGearBin[];
  onAdded: (next: TripGearBin[]) => void;
  onClose: () => void;
  accent?: string;
  muted?: string;
  cardBorder?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function AddGearModal({
  tripId,
  userId,
  libraryBins,
  libraryItems,
  tripGearBins,
  onAdded,
  onClose,
  accent = "#5a9a2f",
  muted = "#6a7a5a",
  cardBorder = "rgba(90,154,47,0.2)",
}: AddGearModalProps) {
  const supabase = createBrowserSupabaseClient();

  const [search, setSearch] = useState("");
  // Local selection set — bins queued for insert. Separate from the "already
  // on trip" state so the user can distinguish what's already there.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Lock body scroll while the sheet is open so the page underneath can't
  // scroll (user report: the CarViz was scrolling when they tried to swipe
  // inside the sheet). We also stash the previous overflow so we don't
  // stomp on anything set elsewhere.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Render into document.body so the sheet escapes any ancestor that might
  // trap `position: fixed` (transform, filter, contain, etc.) and so
  // z-indexing competes at the root instead of inside a nested stacking
  // context. `mounted` gates the portal until after hydration to avoid SSR
  // mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const onTripBinIds = useMemo(
    () => new Set(tripGearBins.map((t) => t.bin_id)),
    [tripGearBins]
  );

  // Only show TOP-LEVEL bins in the picker. Child bins come along implicitly
  // when their parent is added (Phase 2 doesn't let you pull a child onto a
  // trip without its parent).
  const topLevelBins = useMemo(
    () => libraryBins.filter((b) => b.parent_bin_id === null && !b.archived_at),
    [libraryBins]
  );

  const itemsByBin = useMemo(() => {
    const map = new Map<string, number>();
    libraryItems.forEach((it) => map.set(it.bin_id, (map.get(it.bin_id) ?? 0) + 1));
    return map;
  }, [libraryItems]);

  // Descendant counts (bins + items) for the rollup on each row.
  const rollupByBin = useMemo(() => {
    const byParent = new Map<string, GearBin[]>();
    libraryBins.forEach((b) => {
      if (b.parent_bin_id) {
        const list = byParent.get(b.parent_bin_id) ?? [];
        list.push(b);
        byParent.set(b.parent_bin_id, list);
      }
    });
    const rollup = new Map<string, { items: number; bins: number }>();
    const walk = (id: string, seen: Set<string>): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      let n = itemsByBin.get(id) ?? 0;
      (byParent.get(id) ?? []).forEach((c) => {
        n += walk(c.id, seen);
      });
      return n;
    };
    const descBinCount = (id: string, seen: Set<string>): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      const kids = byParent.get(id) ?? [];
      return kids.length + kids.reduce((s, c) => s + descBinCount(c.id, seen), 0);
    };
    libraryBins.forEach((b) => {
      rollup.set(b.id, {
        items: walk(b.id, new Set()),
        bins: descBinCount(b.id, new Set()),
      });
    });
    return rollup;
  }, [libraryBins, itemsByBin]);

  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchLower) return topLevelBins;
    return topLevelBins.filter((b) => {
      if (b.name.toLowerCase().includes(searchLower)) return true;
      // Also surface parents whose descendant items match.
      return libraryItems.some(
        (it) => it.bin_id === b.id && it.name.toLowerCase().includes(searchLower)
      );
    });
  }, [topLevelBins, libraryItems, searchLower]);

  // Group by default_location in canonical order — same grouping as /gear.
  const grouped = useMemo(() => {
    const groups = new Map<string, GearBin[]>();
    CAR_LOCATIONS.forEach((l) => groups.set(l.value, []));
    const unassigned: GearBin[] = [];
    filtered.forEach((b) => {
      if (b.default_location && groups.has(b.default_location)) {
        groups.get(b.default_location)!.push(b);
      } else {
        unassigned.push(b);
      }
    });
    return { groups, unassigned };
  }, [filtered]);

  const toggle = (binId: string) => {
    if (onTripBinIds.has(binId)) return; // already on trip
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });
  };

  const confirm = async () => {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setSaving(true);
    const rows: TripGearBinInsert[] = Array.from(selected).map((bin_id) => ({
      trip_id: tripId,
      bin_id,
      added_by: userId,
    }));
    const { data, error } = await supabase
      .from("trip_gear_bins")
      .insert(rows)
      .select();
    setSaving(false);
    if (!error && data) {
      onAdded([...tripGearBins, ...(data as TripGearBin[])]);
      onClose();
    }
    // On error we leave the modal open so the user can retry — RLS errors or
    // unique-index conflicts will surface in the console via the supabase
    // client; a silent retry loop would mask the real problem.
  };

  const renderRow = (b: GearBin) => {
    const onTrip = onTripBinIds.has(b.id);
    const isSelected = selected.has(b.id);
    const standalone = b.is_standalone === true;
    const roll = rollupByBin.get(b.id) ?? { items: 0, bins: 0 };
    const loc = CAR_LOCATIONS.find((l) => l.value === b.default_location);
    const zoneColor = loc?.color ?? accent;
    return (
      <div
        key={b.id}
        onClick={() => toggle(b.id)}
        aria-disabled={onTrip}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: onTrip ? hexToRgba(accent, 0.05) : isSelected ? hexToRgba(accent, 0.12) : "#fff",
          border: `1.5px solid ${
            onTrip ? cardBorder : isSelected ? accent : cardBorder
          }`,
          borderLeft: `3px solid ${zoneColor}`,
          borderRadius: 10,
          marginBottom: 6,
          cursor: onTrip ? "default" : "pointer",
          opacity: onTrip ? 0.75 : 1,
        }}
      >
        {/* Checkbox */}
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `1.5px solid ${onTrip || isSelected ? accent : cardBorder}`,
            background: onTrip || isSelected ? accent : "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {onTrip || isSelected ? "✓" : ""}
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: hexToRgba(zoneColor, 0.12),
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            flexShrink: 0,
          }}
        >
          {b.icon ?? (standalone ? "🏕️" : "📦")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>{b.name}</span>
            {standalone && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: hexToRgba(zoneColor, 0.14),
                  color: zoneColor,
                }}
              >
                Standalone
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: muted, marginTop: 3 }}>
            {standalone ? (
              <>×{b.quantity ?? 1}</>
            ) : (
              <>
                {roll.items} {roll.items === 1 ? "item" : "items"}
                {roll.bins > 0 && (
                  <>
                    <span style={{ margin: "0 4px", opacity: 0.5 }}>·</span>
                    {roll.bins} child {roll.bins === 1 ? "bin" : "bins"}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {onTrip && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            On trip
          </span>
        )}
      </div>
    );
  };

  const renderGroup = (loc: (typeof CAR_LOCATIONS)[number], bins: GearBin[]) => {
    if (bins.length === 0) return null;
    return (
      <div key={loc.value} style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "4px 0 6px",
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: loc.color }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: muted,
            }}
          >
            {loc.label}
          </span>
        </div>
        {bins.map(renderRow)}
      </div>
    );
  };

  const unassignedList = grouped.unassigned;
  const hasAny = topLevelBins.length > 0;
  const hasMatches = filtered.length > 0;
  const newSelectedCount = selected.size;

  if (!mounted) return null;

  // Sub-nav is 56px tall, pinned at bottom:0 zIndex:100. We lift the sheet
  // 56px off the bottom so it sits ABOVE the sub-nav — the sticky "Add"
  // footer is no longer hidden behind the tab bar.
  const NAV_HEIGHT = 56;

  return createPortal(
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
        touchAction: "none",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: `calc(92vh - ${NAV_HEIGHT}px)`,
          marginBottom: NAV_HEIGHT,
          background: "#f6f8f4",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.2s ease-out",
          fontFamily: "'DM Sans', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Drag grip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0 4px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 36,
              height: 4,
              background: muted,
              borderRadius: 999,
              opacity: 0.4,
            }}
          />
        </div>

        {/* Sticky head */}
        <div
          style={{
            padding: "4px 18px 12px",
            borderBottom: `1px solid ${cardBorder}`,
            background: "#f6f8f4",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 17,
                margin: 0,
              }}
            >
              Add gear from library
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                color: muted,
                cursor: "pointer",
                padding: 4,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library…"
            style={{
              width: "100%",
              padding: "9px 12px",
              fontSize: 13,
              border: `1.5px solid ${cardBorder}`,
              borderRadius: 10,
              background: "#fff",
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {!hasAny ? (
            <div
              style={{
                padding: 36,
                textAlign: "center",
                color: muted,
                fontSize: 13,
                background: "#fff",
                border: `1px dashed ${cardBorder}`,
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
              Your gear library is empty.
              <br />
              Head to <b>Gear Library</b> to build some bins first.
            </div>
          ) : !hasMatches ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: muted,
                fontSize: 13,
              }}
            >
              No bins match "{search}".
            </div>
          ) : (
            <>
              {CAR_LOCATIONS.map((loc) =>
                renderGroup(loc, grouped.groups.get(loc.value) ?? [])
              )}
              {unassignedList.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0 6px",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: muted,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: muted,
                      }}
                    >
                      No location set
                    </span>
                  </div>
                  {unassignedList.map(renderRow)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky bottom CTA */}
        <div
          style={{
            padding: "12px 16px 14px",
            borderTop: `1px solid ${cardBorder}`,
            background: "#fff",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, fontSize: 12, color: muted }}>
            {newSelectedCount > 0 ? (
              <>
                <b style={{ color: accent }}>{newSelectedCount}</b> selected
              </>
            ) : (
              "Tap bins to add"
            )}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              border: `1px solid ${cardBorder}`,
              background: "#fff",
              color: muted,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={saving || newSelectedCount === 0}
            style={{
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "#fff",
              cursor: newSelectedCount > 0 ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
              opacity: newSelectedCount > 0 ? 1 : 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Adding…" : `Add ${newSelectedCount || ""}`.trim()}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
}
