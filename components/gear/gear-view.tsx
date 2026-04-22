"use client";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation } from "@/lib/constants";
import type {
  GearBin,
  GearItem,
  TripGearBin,
} from "@/types/database.types";
import BinEditModal from "./bin-edit-modal";
import StandaloneItemEditor from "./standalone-item-editor";
import AddGearModal from "./add-gear-modal";
import CarViz, { CarVizLegend } from "./car-viz";

/**
 * GearView — trip-side Gear tab.
 *
 * Layout:
 *   1. Car card (name, change ›, SVG visualizer with tappable zones, legend)
 *   2. Zone-focus banner (when a zone is selected)
 *   3. Bins-on-trip section (add button, list grouped by effective location)
 *   4. Pack Photos stub (Phase 3)
 *
 * A bin's "effective location" is its `location_override` on the join row,
 * falling back to the library bin's `default_location`. Tapping a zone on
 * the SVG filters bins to that zone; tapping the same zone again clears.
 *
 * Only top-level bins appear as rows; child bins live inside the BinEditModal
 * (they drill in on tap). Counts shown reflect rollup totals.
 */

type Theme = {
  bg: string;
  text: string;
  muted: string;
  cardBorder: string;
  card: string;
  accent: string;
};

export interface GearViewProps {
  tripId: string;
  userId: string;
  isHost: boolean;
  initialLibraryBins: GearBin[];
  initialLibraryItems: GearItem[];
  initialTripGearBins: TripGearBin[];
  primaryVehicleName: string | null;
  theme: Theme;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function GearView({
  tripId,
  userId,
  isHost,
  initialLibraryBins,
  initialLibraryItems,
  initialTripGearBins,
  primaryVehicleName,
  theme,
}: GearViewProps) {
  const supabase = createBrowserSupabaseClient();

  const [libraryBins, setLibraryBins] = useState<GearBin[]>(initialLibraryBins);
  const [libraryItems, setLibraryItems] = useState<GearItem[]>(initialLibraryItems);
  const [tripGearBins, setTripGearBins] = useState<TripGearBin[]>(initialTripGearBins);

  const [selectedZone, setSelectedZone] = useState<CarLocation | null>(null);
  const [openBinId, setOpenBinId] = useState<string | null>(null);
  const [addGearOpen, setAddGearOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState<string | null>(primaryVehicleName);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState(primaryVehicleName ?? "");

  // ─── Derived maps ──────────────────────────────────────────────────────

  const binsById = useMemo(() => {
    const m = new Map<string, GearBin>();
    libraryBins.forEach((b) => m.set(b.id, b));
    return m;
  }, [libraryBins]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, GearBin[]>();
    libraryBins.forEach((b) => {
      if (b.parent_bin_id) {
        const list = m.get(b.parent_bin_id) ?? [];
        list.push(b);
        m.set(b.parent_bin_id, list);
      }
    });
    return m;
  }, [libraryBins]);

  const itemsByBin = useMemo(() => {
    const m = new Map<string, GearItem[]>();
    libraryItems.forEach((it) => {
      const list = m.get(it.bin_id) ?? [];
      list.push(it);
      m.set(it.bin_id, list);
    });
    return m;
  }, [libraryItems]);

  /** Recursive item total for a bin and all descendants. */
  const rollupItems = (binId: string, seen: Set<string> = new Set()): number => {
    if (seen.has(binId)) return 0;
    seen.add(binId);
    let total = itemsByBin.get(binId)?.length ?? 0;
    (childrenByParent.get(binId) ?? []).forEach((c) => {
      total += rollupItems(c.id, seen);
    });
    return total;
  };

  /** A trip row's effective zone: override wins, else the bin's default. */
  const effectiveZone = (row: TripGearBin): CarLocation | null => {
    if (row.location_override) return row.location_override as CarLocation;
    const b = binsById.get(row.bin_id);
    return (b?.default_location as CarLocation | null) ?? null;
  };

  // Counts by zone (for the SVG + legend), scoped to bins that are on THIS trip.
  const zoneCounts = useMemo(() => {
    const counts: Partial<Record<CarLocation, number>> = {};
    tripGearBins.forEach((row) => {
      const z = effectiveZone(row);
      if (z) counts[z] = (counts[z] ?? 0) + 1;
    });
    return counts;
  }, [tripGearBins, binsById]);

  // Visible trip rows, filtered by the selected zone if any.
  const visibleRows = useMemo(() => {
    if (!selectedZone) return tripGearBins;
    return tripGearBins.filter((r) => effectiveZone(r) === selectedZone);
  }, [tripGearBins, selectedZone, binsById]);

  // Sort rows by bin name for consistent ordering.
  const sortedVisibleRows = useMemo(() => {
    return [...visibleRows].sort((a, b) => {
      const an = binsById.get(a.bin_id)?.name ?? "";
      const bn = binsById.get(b.bin_id)?.name ?? "";
      return an.localeCompare(bn);
    });
  }, [visibleRows, binsById]);

  // Total item count for the banner when a zone is filtered.
  const filteredItemTotal = useMemo(() => {
    return visibleRows.reduce((sum, r) => sum + rollupItems(r.bin_id), 0);
  }, [visibleRows]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const toggleSelectZone = (z: CarLocation) => {
    setSelectedZone((prev) => (prev === z ? null : z));
  };

  const toggleLoaded = async (row: TripGearBin) => {
    const nextLoaded = !row.loaded;
    // Optimistic
    const optimistic = {
      ...row,
      loaded: nextLoaded,
      loaded_at: nextLoaded ? new Date().toISOString() : null,
      loaded_by: nextLoaded ? userId : null,
    };
    setTripGearBins((prev) => prev.map((r) => (r.id === row.id ? optimistic : r)));
    const { data, error } = await supabase
      .from("trip_gear_bins")
      .update({
        loaded: nextLoaded,
        loaded_at: nextLoaded ? new Date().toISOString() : null,
        loaded_by: nextLoaded ? userId : null,
      })
      .eq("id", row.id)
      .select()
      .single();
    if (error) {
      // Revert on failure so the UI reflects truth.
      setTripGearBins((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    } else if (data) {
      setTripGearBins((prev) =>
        prev.map((r) => (r.id === row.id ? (data as TripGearBin) : r))
      );
    }
  };

  const removeFromTrip = async (row: TripGearBin) => {
    const b = binsById.get(row.bin_id);
    const confirmed = window.confirm(
      `Remove "${b?.name ?? "this bin"}" from this trip?`
    );
    if (!confirmed) return;
    const { error } = await supabase
      .from("trip_gear_bins")
      .delete()
      .eq("id", row.id);
    if (!error) {
      setTripGearBins((prev) => prev.filter((r) => r.id !== row.id));
      if (openBinId === row.bin_id) setOpenBinId(null);
    }
  };

  const setLocationOverride = async (row: TripGearBin, loc: CarLocation | null) => {
    const { data, error } = await supabase
      .from("trip_gear_bins")
      .update({ location_override: loc })
      .eq("id", row.id)
      .select()
      .single();
    if (!error && data) {
      setTripGearBins((prev) =>
        prev.map((r) => (r.id === row.id ? (data as TripGearBin) : r))
      );
    }
  };

  const saveVehicleName = async () => {
    const next = vehicleDraft.trim() || null;
    setEditingVehicle(false);
    if (next === vehicleName) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ primary_vehicle_name: next })
      .eq("id", userId);
    if (!error) {
      setVehicleName(next);
    }
  };

  // ─── Render guards ─────────────────────────────────────────────────────

  if (!isHost) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: theme.muted,
          fontSize: 13,
        }}
      >
        Gear is managed by the trip host in this phase.
      </div>
    );
  }

  // ─── Row renderer ──────────────────────────────────────────────────────

  const renderRow = (row: TripGearBin) => {
    const b = binsById.get(row.bin_id);
    if (!b) return null; // bin was archived upstream; skip silently
    const zone = effectiveZone(row);
    const loc = CAR_LOCATIONS.find((l) => l.value === zone);
    const accent = loc?.color ?? b.color ?? theme.accent;
    const standalone = b.is_standalone === true;
    const items = standalone ? 0 : rollupItems(b.id);
    const kids = standalone ? 0 : childrenByParent.get(b.id)?.length ?? 0;

    return (
      <div
        key={row.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: row.loaded ? hexToRgba(accent, 0.06) : "#fff",
          border: `1px solid ${theme.cardBorder}`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: 12,
          marginBottom: 6,
        }}
      >
        {/* Loaded toggle */}
        <button
          onClick={() => toggleLoaded(row)}
          aria-label={row.loaded ? "Mark as not loaded" : "Mark as loaded"}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1.5px solid ${row.loaded ? accent : theme.cardBorder}`,
            background: row.loaded ? accent : "#fff",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {row.loaded ? "✓" : ""}
        </button>

        {/* Tap surface → open BinEditModal */}
        <div
          onClick={() => setOpenBinId(b.id)}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: hexToRgba(accent, 0.12),
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            {b.icon ?? "📦"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.2,
                textDecoration: row.loaded ? "none" : "none",
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
                    background: hexToRgba(accent, 0.14),
                    color: accent,
                  }}
                >
                  Standalone
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: theme.muted,
                marginTop: 3,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span>
                {standalone ? (
                  <>×{b.quantity ?? 1}</>
                ) : (
                  <>
                    {items} {items === 1 ? "item" : "items"}
                    {kids > 0 && (
                      <>
                        <span style={{ margin: "0 4px", opacity: 0.5 }}>·</span>
                        {kids} child {kids === 1 ? "bin" : "bins"}
                      </>
                    )}
                  </>
                )}
              </span>
              {row.loaded && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  · Loaded
                </span>
              )}
              {row.location_override && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: theme.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: hexToRgba(accent, 0.12),
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  Override · {loc?.label ?? row.location_override}
                </span>
              )}
            </div>
          </div>
          <span style={{ color: theme.muted, fontSize: 14, flexShrink: 0 }}>›</span>
        </div>
      </div>
    );
  };

  // ─── Main render ───────────────────────────────────────────────────────

  const hasAny = tripGearBins.length > 0;
  const activeLoc = selectedZone
    ? CAR_LOCATIONS.find((l) => l.value === selectedZone)
    : null;

  // Location-override picker shown inside the BinEditModal head (rightAction).
  const openRow = openBinId
    ? tripGearBins.find((r) => r.bin_id === openBinId) ?? null
    : null;
  const openBin = openBinId ? binsById.get(openBinId) ?? null : null;

  const rightAction =
    openRow && openBin ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "6px 8px",
          background: hexToRgba(theme.accent, 0.06),
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: theme.muted,
          }}
        >
          On this trip
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <button
            onClick={() => setLocationOverride(openRow, null)}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 999,
              border: `1.5px solid ${
                openRow.location_override === null ? theme.accent : theme.cardBorder
              }`,
              background: openRow.location_override === null ? theme.accent : "#fff",
              color: openRow.location_override === null ? "#fff" : theme.muted,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Library default
          </button>
          {CAR_LOCATIONS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLocationOverride(openRow, l.value)}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 999,
                border: `1.5px solid ${
                  openRow.location_override === l.value ? l.color : theme.cardBorder
                }`,
                background:
                  openRow.location_override === l.value ? l.color : "#fff",
                color: openRow.location_override === l.value ? "#fff" : theme.muted,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => removeFromTrip(openRow)}
          style={{
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid rgba(200,80,58,0.4)`,
            background: "#fff",
            color: "#c8503a",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 2,
          }}
        >
          Remove from trip
        </button>
      </div>
    ) : null;

  return (
    <div style={{ padding: "12px 0 40px" }}>
      {/* ─── Car card ─── */}
      <div
        style={{
          background: "#fff",
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 14,
          padding: "14px 14px 10px",
          margin: "0 0 14px",
          boxShadow: "0 1px 2px rgba(26,26,26,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: theme.muted,
              }}
            >
              Your car
            </div>
            {editingVehicle ? (
              <input
                value={vehicleDraft}
                autoFocus
                onChange={(e) => setVehicleDraft(e.target.value)}
                onBlur={saveVehicleName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveVehicleName();
                  if (e.key === "Escape") {
                    setEditingVehicle(false);
                    setVehicleDraft(vehicleName ?? "");
                  }
                }}
                placeholder="e.g. 🚙 The Rivian · R1S"
                style={{
                  width: "100%",
                  padding: "4px 8px",
                  marginTop: 3,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  border: `1.5px solid ${theme.cardBorder}`,
                  borderRadius: 8,
                  background: "#fff",
                }}
              />
            ) : (
              <div
                onClick={() => {
                  setEditingVehicle(true);
                  setVehicleDraft(vehicleName ?? "");
                }}
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  marginTop: 3,
                  cursor: "text",
                }}
                title="Tap to rename"
              >
                {vehicleName || "Name your car"}
              </div>
            )}
          </div>
          {!editingVehicle && (
            <button
              onClick={() => {
                setEditingVehicle(true);
                setVehicleDraft(vehicleName ?? "");
              }}
              style={{
                background: "none",
                border: "none",
                color: theme.accent,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                padding: 4,
              }}
            >
              {vehicleName ? "Change ›" : "Add ›"}
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0 4px",
          }}
        >
          <CarViz
            counts={zoneCounts}
            selectedZone={selectedZone}
            onSelectZone={toggleSelectZone}
          />
        </div>

        <CarVizLegend
          counts={zoneCounts}
          selectedZone={selectedZone}
          onSelectZone={toggleSelectZone}
        />
      </div>

      {/* ─── Zone-focus banner ─── */}
      {activeLoc && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: hexToRgba(activeLoc.color, 0.08),
            border: `1px solid ${hexToRgba(activeLoc.color, 0.3)}`,
            borderRadius: 10,
            margin: "0 0 12px",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: activeLoc.color,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: theme.text }}>
            <b>Showing {activeLoc.label}</b>
            <span style={{ color: theme.muted }}>
              {" · "}
              {visibleRows.length} {visibleRows.length === 1 ? "bin" : "bins"}
              {" · "}
              {filteredItemTotal} {filteredItemTotal === 1 ? "item" : "items"}
            </span>
          </div>
          <button
            onClick={() => setSelectedZone(null)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${hexToRgba(activeLoc.color, 0.4)}`,
              background: "#fff",
              color: activeLoc.color,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            Show all ✕
          </button>
        </div>
      )}

      {/* ─── Bins section ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "4px 0 10px",
        }}
      >
        <h3
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 15,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Bins on this trip
        </h3>
        <button
          onClick={() => setAddGearOpen(true)}
          style={{
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background: theme.accent,
            color: "#fff",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          ＋ Add from library
        </button>
      </div>

      {!hasAny ? (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            color: theme.muted,
            fontSize: 13,
            background: "#fff",
            border: `1px dashed ${theme.cardBorder}`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎒</div>
          No gear on this trip yet.
          <br />
          Tap <b>＋ Add from library</b> to pull bins you've already built.
        </div>
      ) : sortedVisibleRows.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: theme.muted,
            fontSize: 12,
          }}
        >
          No bins in {activeLoc?.label ?? "this zone"} yet.
        </div>
      ) : (
        <div>{sortedVisibleRows.map(renderRow)}</div>
      )}

      {/* ─── Pack Photos (Phase 3 stub) ─── */}
      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          background: "#fff",
          border: `1px dashed ${theme.cardBorder}`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: theme.muted,
            marginBottom: 4,
          }}
        >
          Pack Photos
        </div>
        <div style={{ fontSize: 12, color: theme.muted }}>
          Coming in Phase 3 — attach reference photos per zone so you can pack
          the car the same way every time.
        </div>
      </div>

      {/* ─── Modals ─── */}
      {openBinId && openBin?.is_standalone ? (
        <StandaloneItemEditor
          ownerId={userId}
          bin={openBin}
          allBins={libraryBins}
          onBinsChange={setLibraryBins}
          onClose={() => setOpenBinId(null)}
          allowDeleteFromLibrary={false}
          rightAction={rightAction}
        />
      ) : openBinId ? (
        <BinEditModal
          ownerId={userId}
          rootBinId={openBinId}
          allBins={libraryBins}
          items={libraryItems}
          onBinsChange={setLibraryBins}
          onItemsChange={setLibraryItems}
          onClose={() => setOpenBinId(null)}
          rightAction={rightAction}
        />
      ) : null}

      {addGearOpen && (
        <AddGearModal
          tripId={tripId}
          userId={userId}
          libraryBins={libraryBins}
          libraryItems={libraryItems}
          tripGearBins={tripGearBins}
          onAdded={setTripGearBins}
          onClose={() => setAddGearOpen(false)}
          accent={theme.accent}
          muted={theme.muted}
          cardBorder={theme.cardBorder}
        />
      )}
    </div>
  );
}
