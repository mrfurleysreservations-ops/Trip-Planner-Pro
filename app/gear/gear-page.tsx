"use client";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation, GEAR_ICONS, THEMES } from "@/lib/constants";
import type { GearBin, GearBinInsert, GearItem } from "@/types/database.types";
import TopNav from "@/app/top-nav";
import BinEditModal from "@/components/gear/bin-edit-modal";
import StandaloneItemEditor from "@/components/gear/standalone-item-editor";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Convert `#rrggbb` to `rgba(r,g,b,a)` — used for tinted location accents. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const COLOR_SWATCHES = [
  "#5a9a2f",
  ...CAR_LOCATIONS.map((l) => l.color),
];

// ─── Types ───────────────────────────────────────────────────────────────

interface GearPageProps {
  userId: string;
  initialBins: GearBin[];
  initialItems: GearItem[];
  unreadChatCount: number;
  pendingFriendCount: number;
  unreadAlertCount: number;
}

interface NewBinDraft {
  name: string;
  icon: string;
  color: string;
  default_location: CarLocation | null;
}

interface NewStandaloneDraft {
  name: string;
  icon: string;
  color: string;
  default_location: CarLocation | null;
  quantity: number;
}

const emptyDraft = (): NewBinDraft => ({
  name: "",
  icon: "📦",
  color: "#5a9a2f",
  default_location: "trunk",
});

const emptyStandaloneDraft = (): NewStandaloneDraft => ({
  name: "",
  icon: "🏕️",
  color: "#5a9a2f",
  default_location: "trunk",
  quantity: 1,
});

export default function GearPage({
  userId,
  initialBins,
  initialItems,
  unreadChatCount,
  pendingFriendCount,
  unreadAlertCount,
}: GearPageProps) {
  const supabase = createBrowserSupabaseClient();
  const th = THEMES.home;

  const [bins, setBins] = useState<GearBin[]>(initialBins);
  const [items, setItems] = useState<GearItem[]>(initialItems);

  const [openBinId, setOpenBinId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // FAB chooser: after tapping ＋, pick between a regular bin (can hold items
  // and child bins) or a "standalone item" (tent, cooler, chairs — one row,
  // one quantity, no children).
  const [fabChooserOpen, setFabChooserOpen] = useState(false);

  // FAB → "New bin" mini-sheet. Creates a TOP-LEVEL bin (parent_bin_id = null)
  // and then opens the shared BinEditModal on the fresh bin so the user can
  // immediately add items or child bins.
  const [newBinOpen, setNewBinOpen] = useState(false);
  const [newBinDraft, setNewBinDraft] = useState<NewBinDraft>(emptyDraft());
  const [savingNewBin, setSavingNewBin] = useState(false);

  // FAB → "Standalone item" mini-sheet. Creates a gear_bins row with
  // is_standalone=true; tapping the row later opens StandaloneItemEditor.
  const [newStandaloneOpen, setNewStandaloneOpen] = useState(false);
  const [newStandaloneDraft, setNewStandaloneDraft] = useState<NewStandaloneDraft>(
    emptyStandaloneDraft()
  );
  const [savingNewStandalone, setSavingNewStandalone] = useState(false);

  // ─── Derived data ──────────────────────────────────────────────────────

  // Items per bin — direct only. Used for top-level row counts we display;
  // nested totals roll up via descendantBinIds below.
  const itemsByBin = useMemo(() => {
    const map = new Map<string, GearItem[]>();
    items.forEach((it) => {
      const list = map.get(it.bin_id) ?? [];
      list.push(it);
      map.set(it.bin_id, list);
    });
    return map;
  }, [items]);

  // Only top-level bins appear on this page; children are visible inside the
  // modal when you drill into a parent.
  const topLevelBins = useMemo(
    () => bins.filter((b) => b.parent_bin_id === null),
    [bins]
  );

  // Build parent → children map for transitive counts + search.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, GearBin[]>();
    bins.forEach((b) => {
      if (b.parent_bin_id) {
        const list = map.get(b.parent_bin_id) ?? [];
        list.push(b);
        map.set(b.parent_bin_id, list);
      }
    });
    return map;
  }, [bins]);

  // Returns the full descendant bin id set for a given bin (inclusive of itself).
  const descendantIds = useMemo(() => {
    const memo = new Map<string, string[]>();
    const walk = (id: string, seen: Set<string>): string[] => {
      if (memo.has(id)) return memo.get(id)!;
      if (seen.has(id)) return []; // guard against cycles (shouldn't happen)
      seen.add(id);
      const kids = childrenByParent.get(id) ?? [];
      const all = [id, ...kids.flatMap((c) => walk(c.id, seen))];
      memo.set(id, all);
      return all;
    };
    const result = new Map<string, string[]>();
    bins.forEach((b) => result.set(b.id, walk(b.id, new Set())));
    return result;
  }, [bins, childrenByParent]);

  // Totals for a top-level bin, rolled up over the whole subtree.
  const rollupCounts = (binId: string): { items: number; bins: number } => {
    const ids = descendantIds.get(binId) ?? [binId];
    const itemTotal = ids.reduce(
      (sum, id) => sum + (itemsByBin.get(id)?.length ?? 0),
      0
    );
    // bins count: descendants excluding self
    return { items: itemTotal, bins: ids.length - 1 };
  };

  // Stats pills. Standalone rows have no child gear_items, so their `quantity`
  // is the "item count" contribution; otherwise it would look like you have
  // zero chairs in your library.
  const standaloneQty = useMemo(
    () =>
      bins.reduce((sum, b) => (b.is_standalone ? sum + (b.quantity ?? 1) : sum), 0),
    [bins]
  );
  const totalItems = items.length + standaloneQty;
  const locationsUsed = useMemo(() => {
    const set = new Set<string>();
    topLevelBins.forEach((b) => {
      if (b.default_location) set.add(b.default_location);
    });
    return set.size;
  }, [topLevelBins]);

  const searchLower = search.trim().toLowerCase();

  // Top-level bins that match the search. A top-level bin matches if its name,
  // any descendant's name, or any descendant item's name contains the query.
  const visibleTopLevel = useMemo(() => {
    if (!searchLower) return topLevelBins;
    return topLevelBins.filter((bin) => {
      const ids = descendantIds.get(bin.id) ?? [bin.id];
      // Any bin in the subtree whose name matches?
      const nameHit = ids.some((id) => {
        const b = bins.find((x) => x.id === id);
        return b?.name.toLowerCase().includes(searchLower);
      });
      if (nameHit) return true;
      // Any item in the subtree whose name matches?
      return items.some(
        (it) => ids.includes(it.bin_id) && it.name.toLowerCase().includes(searchLower)
      );
    });
  }, [topLevelBins, searchLower, descendantIds, bins, items]);

  // Group the visible top-level bins by default_location, preserving canonical order.
  const binsByLocation = useMemo(() => {
    const groups = new Map<string, GearBin[]>();
    CAR_LOCATIONS.forEach((loc) => groups.set(loc.value, []));
    const unassigned: GearBin[] = [];
    visibleTopLevel.forEach((b) => {
      if (b.default_location && groups.has(b.default_location)) {
        groups.get(b.default_location)!.push(b);
      } else {
        unassigned.push(b);
      }
    });
    return { groups, unassigned };
  }, [visibleTopLevel]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const openFabChooser = () => setFabChooserOpen(true);
  const closeFabChooser = () => setFabChooserOpen(false);

  const openNewBinSheet = () => {
    setFabChooserOpen(false);
    setNewBinDraft(emptyDraft());
    setNewBinOpen(true);
  };

  const closeNewBinSheet = () => {
    setNewBinOpen(false);
    setNewBinDraft(emptyDraft());
  };

  const openNewStandaloneSheet = () => {
    setFabChooserOpen(false);
    setNewStandaloneDraft(emptyStandaloneDraft());
    setNewStandaloneOpen(true);
  };

  const closeNewStandaloneSheet = () => {
    setNewStandaloneOpen(false);
    setNewStandaloneDraft(emptyStandaloneDraft());
  };

  const createNewBin = async () => {
    const name = newBinDraft.name.trim();
    if (!name) return;
    setSavingNewBin(true);
    const payload: GearBinInsert = {
      owner_id: userId,
      name,
      icon: newBinDraft.icon,
      color: newBinDraft.color,
      default_location: newBinDraft.default_location,
      // parent_bin_id omitted → NULL → top-level.
    };
    const { data, error } = await supabase
      .from("gear_bins")
      .insert(payload)
      .select()
      .single();
    setSavingNewBin(false);
    if (!error && data) {
      const created = data as GearBin;
      setBins((prev) => [...prev, created]);
      setNewBinOpen(false);
      setNewBinDraft(emptyDraft());
      // Jump straight into the bin so the user can add items/child bins.
      setOpenBinId(created.id);
    }
  };

  const createNewStandalone = async () => {
    const name = newStandaloneDraft.name.trim();
    if (!name) return;
    setSavingNewStandalone(true);
    const payload: GearBinInsert = {
      owner_id: userId,
      name,
      icon: newStandaloneDraft.icon,
      color: newStandaloneDraft.color,
      default_location: newStandaloneDraft.default_location,
      is_standalone: true,
      quantity: Math.max(1, newStandaloneDraft.quantity || 1),
    };
    const { data, error } = await supabase
      .from("gear_bins")
      .insert(payload)
      .select()
      .single();
    setSavingNewStandalone(false);
    if (!error && data) {
      const created = data as GearBin;
      setBins((prev) => [...prev, created]);
      setNewStandaloneOpen(false);
      setNewStandaloneDraft(emptyStandaloneDraft());
      // Open standalone editor on the fresh row so the user can tweak.
      setOpenBinId(created.id);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const renderBinRow = (bin: GearBin) => {
    const loc = CAR_LOCATIONS.find((l) => l.value === bin.default_location);
    const accent = loc?.color ?? bin.color ?? "#5a9a2f";
    const iconBg = hexToRgba(accent, 0.12);
    const standalone = bin.is_standalone === true;
    const counts = standalone ? { items: 0, bins: 0 } : rollupCounts(bin.id);

    return (
      <div
        key={bin.id}
        onClick={() => setOpenBinId(bin.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "#fff",
          border: `1px solid ${th.cardBorder}`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: 12,
          cursor: "pointer",
          transition: "transform 0.08s, box-shadow 0.12s",
          boxShadow: "0 1px 2px rgba(26,26,26,0.03)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 1px 2px rgba(26,26,26,0.03)";
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {bin.icon ?? (standalone ? "🏕️" : "📦")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.2,
              color: th.text,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>{bin.name}</span>
            {standalone && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: hexToRgba(accent, 0.14),
                  color: accent,
                }}
              >
                Standalone
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: th.muted, marginTop: 3 }}>
            {standalone ? (
              <>×{bin.quantity ?? 1}</>
            ) : (
              <>
                {counts.items} {counts.items === 1 ? "item" : "items"}
                {counts.bins > 0 && (
                  <>
                    <span style={{ margin: "0 5px", opacity: 0.5 }}>·</span>
                    {counts.bins} child {counts.bins === 1 ? "bin" : "bins"}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <span style={{ color: th.muted, fontSize: 16, flexShrink: 0 }}>›</span>
      </div>
    );
  };

  const renderGroup = (loc: typeof CAR_LOCATIONS[number], groupBins: GearBin[]) => {
    if (groupBins.length === 0) return null;
    // Standalone rows have no child items; their `quantity` is their item count.
    const itemCount = groupBins.reduce((sum, b) => {
      if (b.is_standalone) return sum + (b.quantity ?? 1);
      return sum + rollupCounts(b.id).items;
    }, 0);
    return (
      <div key={loc.value} style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: loc.color }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: th.muted,
            }}
          >
            {loc.label}
          </span>
          <span
            style={{
              fontSize: 11,
              color: th.muted,
              background: "#fff",
              border: `1px solid ${th.cardBorder}`,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {groupBins.length} {groupBins.length === 1 ? "bin" : "bins"} · {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groupBins.map(renderBinRow)}
        </div>
      </div>
    );
  };

  const renderUnassignedGroup = () => {
    const list = binsByLocation.unassigned;
    if (list.length === 0) return null;
    const itemCount = list.reduce((sum, b) => {
      if (b.is_standalone) return sum + (b.quantity ?? 1);
      return sum + rollupCounts(b.id).items;
    }, 0);
    return (
      <div key="unassigned" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: th.muted }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: th.muted,
            }}
          >
            No location
          </span>
          <span
            style={{
              fontSize: 11,
              color: th.muted,
              background: "#fff",
              border: `1px solid ${th.cardBorder}`,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {list.length} {list.length === 1 ? "bin" : "bins"} · {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(renderBinRow)}
        </div>
      </div>
    );
  };

  const topLevelCount = topLevelBins.length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: th.bg,
        color: th.text,
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: 96,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* ─── STICKY TOP ─── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${th.cardBorder}`,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
          {/* Row 1 — Page header (no "+ New bin" button; that's now the FAB) */}
          <div style={{ padding: "14px 0 10px" }}>
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: th.text,
                margin: 0,
              }}
            >
              🎒 Gear Library
            </h1>
            <p style={{ fontSize: 13, color: th.muted, margin: "4px 0 0" }}>
              Reusable bins for your family trips — build once, pack fast.
            </p>
          </div>

          {/* Row 2 — Top-level nav */}
          <TopNav
            unreadChatCount={unreadChatCount}
            pendingFriendCount={pendingFriendCount}
            unreadAlertCount={unreadAlertCount}
          />

          {/* Row 3 — Stats pills + search */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 0 12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{topLevelCount}</b> top-level {topLevelCount === 1 ? "bin" : "bins"}
            </StatPill>
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{totalItems}</b> {totalItems === 1 ? "item" : "items"} total
            </StatPill>
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{locationsUsed}</b> car {locationsUsed === 1 ? "location" : "locations"} used
            </StatPill>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bins and items…"
              className="input-modern"
              style={{
                flex: 1,
                minWidth: 180,
                maxWidth: 320,
                fontSize: 13,
                padding: "8px 12px",
                marginLeft: "auto",
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        {topLevelCount === 0 ? (
          <EmptyState muted={th.muted} border={th.cardBorder} onCreate={openFabChooser} />
        ) : visibleTopLevel.length === 0 ? (
          <div
            className="card-glass"
            style={{ padding: 36, textAlign: "center", marginTop: 24 }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <p style={{ color: th.muted, fontSize: 14, margin: 0 }}>
              No bins or items match "{search}".
            </p>
          </div>
        ) : (
          <>
            {CAR_LOCATIONS.map((loc) =>
              renderGroup(loc, binsByLocation.groups.get(loc.value) ?? [])
            )}
            {renderUnassignedGroup()}
          </>
        )}
      </div>

      {/* ─── FAB: bottom-right ＋ opens a Bin-vs-Standalone chooser ─── */}
      <button
        onClick={openFabChooser}
        aria-label="Add gear"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#5a9a2f",
          border: "none",
          color: "#fff",
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(90,154,47,0.35), 0 2px 6px rgba(0,0,0,0.12)",
          zIndex: 30,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        ＋
      </button>

      {/* ─── Tap a row to edit — fork by is_standalone ─── */}
      {openBinId && (() => {
        const openBin = bins.find((b) => b.id === openBinId);
        if (!openBin) return null;
        if (openBin.is_standalone) {
          return (
            <StandaloneItemEditor
              ownerId={userId}
              bin={openBin}
              allBins={bins}
              onBinsChange={setBins}
              onClose={() => setOpenBinId(null)}
            />
          );
        }
        return (
          <BinEditModal
            ownerId={userId}
            rootBinId={openBinId}
            allBins={bins}
            items={items}
            onBinsChange={setBins}
            onItemsChange={setItems}
            onClose={() => setOpenBinId(null)}
          />
        );
      })()}

      {/* ─── New-bin bottom sheet (FAB target) ─── */}
      {newBinOpen && (
        <div
          onClick={closeNewBinSheet}
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
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
              background: th.bg,
              animation: "slideUp 0.2s ease-out",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                padding: "18px 20px 14px",
                borderBottom: `1px solid ${th.cardBorder}`,
                background: th.bg,
                borderRadius: "20px 20px 0 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                  margin: 0,
                }}
              >
                New bin
              </h3>
              <button
                onClick={closeNewBinSheet}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: th.muted,
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "16px 20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Name */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Name *</label>
                <input
                  value={newBinDraft.name}
                  onChange={(e) =>
                    setNewBinDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newBinDraft.name.trim()) createNewBin();
                  }}
                  placeholder="Camp Kitchen, First Aid, Fishing…"
                  className="input-modern"
                  autoFocus
                />
              </div>

              {/* Icon */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Icon</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 1fr)",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {GEAR_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewBinDraft((d) => ({ ...d, icon: ic }))}
                      style={{
                        aspectRatio: "1 / 1",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        borderRadius: 10,
                        border: `1.5px solid ${
                          newBinDraft.icon === ic ? "#5a9a2f" : th.cardBorder
                        }`,
                        background:
                          newBinDraft.icon === ic ? hexToRgba("#5a9a2f", 0.1) : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Accent color</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() => setNewBinDraft((d) => ({ ...d, color: sw }))}
                      aria-label={`Color ${sw}`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: sw,
                        border:
                          newBinDraft.color === sw
                            ? "3px solid #1a1a1a"
                            : `2px solid ${th.cardBorder}`,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Default car location</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {CAR_LOCATIONS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() =>
                        setNewBinDraft((d) => ({ ...d, default_location: l.value }))
                      }
                      style={{
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        border: `1.5px solid ${
                          newBinDraft.default_location === l.value
                            ? l.color
                            : th.cardBorder
                        }`,
                        background:
                          newBinDraft.default_location === l.value ? l.color : "#fff",
                        color: newBinDraft.default_location === l.value ? "#fff" : th.muted,
                        cursor: "pointer",
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: th.muted, margin: "6px 0 0" }}>
                  You can rename, add items, and create child bins after creating.
                </p>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={closeNewBinSheet}
                  className="btn"
                  style={{ background: "#f0f0f0", color: "#1a1a1a" }}
                  disabled={savingNewBin}
                >
                  Cancel
                </button>
                <button
                  onClick={createNewBin}
                  className="btn"
                  style={{ background: "#5a9a2f" }}
                  disabled={savingNewBin || !newBinDraft.name.trim()}
                >
                  {savingNewBin ? "Saving…" : "Create & open"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FAB chooser: Bin vs. Standalone item ─── */}
      {fabChooserOpen && (
        <div
          onClick={closeFabChooser}
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
              borderRadius: "20px 20px 0 0",
              background: th.bg,
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
              animation: "slideUp 0.2s ease-out",
              padding: "18px 20px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", margin: "-8px 0 10px" }}>
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
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                margin: "0 0 4px",
              }}
            >
              What are you adding?
            </h3>
            <p style={{ fontSize: 12, color: th.muted, margin: "0 0 14px" }}>
              A bin holds items and can nest. A standalone item is one thing that goes
              straight in the car — tent, chairs, cooler, table.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ChooserRow
                icon="📦"
                title="Bin"
                subtitle="Holds items. Can contain child bins (e.g. Camp Kitchen → Spices)."
                onClick={openNewBinSheet}
                accent="#5a9a2f"
                th={th}
              />
              <ChooserRow
                icon="🏕️"
                title="Standalone item"
                subtitle="No items inside — just this thing. Track how many you own."
                onClick={openNewStandaloneSheet}
                accent="#4a7bc8"
                th={th}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                onClick={closeFabChooser}
                className="btn"
                style={{ background: "#f0f0f0", color: "#1a1a1a" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── New standalone-item bottom sheet (FAB → Standalone) ─── */}
      {newStandaloneOpen && (
        <div
          onClick={closeNewStandaloneSheet}
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
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
              background: th.bg,
              animation: "slideUp 0.2s ease-out",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                padding: "18px 20px 14px",
                borderBottom: `1px solid ${th.cardBorder}`,
                background: th.bg,
                borderRadius: "20px 20px 0 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                  margin: 0,
                }}
              >
                New standalone item
              </h3>
              <button
                onClick={closeNewStandaloneSheet}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: th.muted,
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "16px 20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Name */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Name *</label>
                <input
                  value={newStandaloneDraft.name}
                  onChange={(e) =>
                    setNewStandaloneDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStandaloneDraft.name.trim())
                      createNewStandalone();
                  }}
                  placeholder="Tent, Camp chairs, Folding table…"
                  className="input-modern"
                  autoFocus
                />
              </div>

              {/* Quantity */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={newStandaloneDraft.quantity}
                  onChange={(e) =>
                    setNewStandaloneDraft((d) => ({
                      ...d,
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="input-modern"
                  style={{ width: 100, textAlign: "center" }}
                />
                <p style={{ fontSize: 11, color: th.muted, margin: "6px 0 0" }}>
                  How many copies of this thing you own (e.g. 4 chairs).
                </p>
              </div>

              {/* Icon */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Icon</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 1fr)",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {GEAR_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() =>
                        setNewStandaloneDraft((d) => ({ ...d, icon: ic }))
                      }
                      style={{
                        aspectRatio: "1 / 1",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        borderRadius: 10,
                        border: `1.5px solid ${
                          newStandaloneDraft.icon === ic ? "#5a9a2f" : th.cardBorder
                        }`,
                        background:
                          newStandaloneDraft.icon === ic
                            ? hexToRgba("#5a9a2f", 0.1)
                            : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Accent color</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() =>
                        setNewStandaloneDraft((d) => ({ ...d, color: sw }))
                      }
                      aria-label={`Color ${sw}`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: sw,
                        border:
                          newStandaloneDraft.color === sw
                            ? "3px solid #1a1a1a"
                            : `2px solid ${th.cardBorder}`,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Car location</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {CAR_LOCATIONS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() =>
                        setNewStandaloneDraft((d) => ({
                          ...d,
                          default_location: l.value,
                        }))
                      }
                      style={{
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        border: `1.5px solid ${
                          newStandaloneDraft.default_location === l.value
                            ? l.color
                            : th.cardBorder
                        }`,
                        background:
                          newStandaloneDraft.default_location === l.value
                            ? l.color
                            : "#fff",
                        color:
                          newStandaloneDraft.default_location === l.value
                            ? "#fff"
                            : th.muted,
                        cursor: "pointer",
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={closeNewStandaloneSheet}
                  className="btn"
                  style={{ background: "#f0f0f0", color: "#1a1a1a" }}
                  disabled={savingNewStandalone}
                >
                  Cancel
                </button>
                <button
                  onClick={createNewStandalone}
                  className="btn"
                  style={{ background: "#5a9a2f" }}
                  disabled={
                    savingNewStandalone || !newStandaloneDraft.name.trim()
                  }
                >
                  {savingNewStandalone ? "Saving…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────

function StatPill({
  children,
  muted,
  border,
}: {
  children: React.ReactNode;
  muted: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: "6px 12px",
        background: "#fff",
        border: `1px solid ${border}`,
        borderRadius: 999,
        fontSize: 12,
        color: muted,
      }}
    >
      {children}
    </span>
  );
}

function ChooserRow({
  icon,
  title,
  subtitle,
  onClick,
  accent,
  th,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent: string;
  th: { bg: string; text: string; muted: string; cardBorder: string; card: string; accent: string };
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "#fff",
        border: `1px solid ${th.cardBorder}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "'DM Sans', sans-serif",
        color: th.text,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(0,0,0,0.03)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: th.muted, marginTop: 3 }}>{subtitle}</div>
      </div>
      <span style={{ color: th.muted, fontSize: 16 }}>›</span>
    </button>
  );
}

function EmptyState({
  onCreate,
  muted,
  border,
}: {
  onCreate: () => void;
  muted: string;
  border: string;
}) {
  return (
    <div
      style={{
        marginTop: 32,
        padding: "48px 24px",
        background: "#fff",
        border: `1px dashed ${border}`,
        borderRadius: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 12 }}>📦</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>
        Your gear library is empty.
      </h2>
      <p style={{ color: muted, fontSize: 13, margin: "0 auto 18px", maxWidth: 360 }}>
        Build your first bin or add a standalone item (like a tent or cooler). Tap the ＋
        in the bottom-right to get started.
      </p>
      <button
        onClick={onCreate}
        className="btn"
        style={{ background: "#5a9a2f", boxShadow: "0 2px 8px rgba(90,154,47,0.25)" }}
      >
        ＋ Add gear
      </button>
    </div>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────────

function modalLabelStyle(muted: string): React.CSSProperties {
  return {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: muted,
    marginBottom: 6,
  };
}
