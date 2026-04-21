"use client";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation, GEAR_ICONS, THEMES } from "@/lib/constants";
import type { GearBin, GearBinInsert, GearItem } from "@/types/database.types";
import TopNav from "@/app/top-nav";
import BinEditModal from "@/components/gear/bin-edit-modal";

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

const emptyDraft = (): NewBinDraft => ({
  name: "",
  icon: "📦",
  color: "#5a9a2f",
  default_location: "trunk",
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

  // FAB → "New bin" mini-sheet. Creates a TOP-LEVEL bin (parent_bin_id = null)
  // and then opens the shared BinEditModal on the fresh bin so the user can
  // immediately add items or child bins.
  const [newBinOpen, setNewBinOpen] = useState(false);
  const [newBinDraft, setNewBinDraft] = useState<NewBinDraft>(emptyDraft());
  const [savingNewBin, setSavingNewBin] = useState(false);

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

  // Stats pills.
  const totalItems = items.length;
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

  const openNewBinSheet = () => {
    setNewBinDraft(emptyDraft());
    setNewBinOpen(true);
  };

  const closeNewBinSheet = () => {
    setNewBinOpen(false);
    setNewBinDraft(emptyDraft());
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

  // ─── Render ────────────────────────────────────────────────────────────

  const renderBinRow = (bin: GearBin) => {
    const counts = rollupCounts(bin.id);
    const loc = CAR_LOCATIONS.find((l) => l.value === bin.default_location);
    const accent = loc?.color ?? bin.color ?? "#5a9a2f";
    const iconBg = hexToRgba(accent, 0.12);

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
          {bin.icon ?? "📦"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: th.text }}>
            {bin.name}
          </div>
          <div style={{ fontSize: 11, color: th.muted, marginTop: 3 }}>
            {counts.items} {counts.items === 1 ? "item" : "items"}
            {counts.bins > 0 && (
              <>
                <span style={{ margin: "0 5px", opacity: 0.5 }}>·</span>
                {counts.bins} child {counts.bins === 1 ? "bin" : "bins"}
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
    const itemCount = groupBins.reduce((sum, b) => sum + rollupCounts(b.id).items, 0);
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
    const itemCount = list.reduce((sum, b) => sum + rollupCounts(b.id).items, 0);
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
          <EmptyState muted={th.muted} border={th.cardBorder} onCreate={openNewBinSheet} />
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

      {/* ─── FAB: bottom-right ＋ to create a new top-level bin ─── */}
      <button
        onClick={openNewBinSheet}
        aria-label="New bin"
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

      {/* ─── BinEditModal: tap a row to open the shared editor ─── */}
      {openBinId && (
        <BinEditModal
          ownerId={userId}
          rootBinId={openBinId}
          allBins={bins}
          items={items}
          onBinsChange={setBins}
          onItemsChange={setItems}
          onClose={() => setOpenBinId(null)}
        />
      )}

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
        Build your first bin to start packing smart trips. Tap the ＋ in the bottom-right to
        get started.
      </p>
      <button
        onClick={onCreate}
        className="btn"
        style={{ background: "#5a9a2f", boxShadow: "0 2px 8px rgba(90,154,47,0.25)" }}
      >
        ＋ Create your first bin
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
