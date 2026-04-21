"use client";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { CAR_LOCATIONS, CarLocation, GEAR_ICONS, THEMES } from "@/lib/constants";
import type { GearBin, GearBinInsert, GearBinUpdate, GearItem } from "@/types/database.types";
import TopNav from "@/app/top-nav";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Convert `#rrggbb` to `rgba(r,g,b,a)` — used for tinted location accents. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "location", label: "By location" },
  { value: "use", label: "By use" },
  { value: "recent", label: "Recently used" },
] as const;
type FilterValue = typeof FILTER_OPTIONS[number]["value"];

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

interface BinDraft {
  name: string;
  icon: string;
  color: string;
  default_location: CarLocation | null;
  description: string;
  notes: string;
}

const emptyDraft = (): BinDraft => ({
  name: "",
  icon: "📦",
  color: "#5a9a2f",
  default_location: "trunk",
  description: "",
  notes: "",
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

  const [expandedBinId, setExpandedBinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  const [modalMode, setModalMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingBin, setEditingBin] = useState<GearBin | null>(null);
  const [draft, setDraft] = useState<BinDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  // Expanded-card inline state
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);

  // ─── Derived data ──────────────────────────────────────────────────────

  const itemsByBin = useMemo(() => {
    const map = new Map<string, GearItem[]>();
    items.forEach((it) => {
      const list = map.get(it.bin_id) ?? [];
      list.push(it);
      map.set(it.bin_id, list);
    });
    return map;
  }, [items]);

  const totalItems = items.length;
  const locationsUsed = useMemo(() => {
    const set = new Set<string>();
    bins.forEach((b) => { if (b.default_location) set.add(b.default_location); });
    return set.size;
  }, [bins]);

  const searchLower = search.trim().toLowerCase();

  const visibleBins = useMemo(() => {
    if (!searchLower) return bins;
    return bins.filter((bin) => {
      if (bin.name.toLowerCase().includes(searchLower)) return true;
      const binItems = itemsByBin.get(bin.id) ?? [];
      return binItems.some((it) => it.name.toLowerCase().includes(searchLower));
    });
  }, [bins, searchLower, itemsByBin]);

  // Group bins by default_location, preserving CAR_LOCATIONS order.
  const binsByLocation = useMemo(() => {
    const groups = new Map<string, GearBin[]>();
    CAR_LOCATIONS.forEach((loc) => groups.set(loc.value, []));
    const unassigned: GearBin[] = [];
    visibleBins.forEach((b) => {
      if (b.default_location && groups.has(b.default_location)) {
        groups.get(b.default_location)!.push(b);
      } else {
        unassigned.push(b);
      }
    });
    return { groups, unassigned };
  }, [visibleBins]);

  // ─── Modal ─────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setEditingBin(null);
    setDraft(emptyDraft());
    setModalMode("create");
  };

  const openEditModal = (bin: GearBin) => {
    setEditingBin(bin);
    setDraft({
      name: bin.name,
      icon: bin.icon ?? "📦",
      color: bin.color ?? "#5a9a2f",
      default_location: (bin.default_location as CarLocation | null) ?? null,
      description: bin.description ?? "",
      notes: bin.notes ?? "",
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("closed");
    setEditingBin(null);
    setDraft(emptyDraft());
  };

  const saveBin = async () => {
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);

    if (modalMode === "create") {
      const payload: GearBinInsert = {
        owner_id: userId,
        name,
        icon: draft.icon,
        color: draft.color,
        default_location: draft.default_location,
        description: draft.description.trim() || null,
        notes: draft.notes.trim() || null,
      };
      const { data, error } = await supabase
        .from("gear_bins")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setBins((prev) => [...prev, data as GearBin]);
      }
    } else if (modalMode === "edit" && editingBin) {
      const payload: GearBinUpdate = {
        name,
        icon: draft.icon,
        color: draft.color,
        default_location: draft.default_location,
        description: draft.description.trim() || null,
        notes: draft.notes.trim() || null,
      };
      const { data, error } = await supabase
        .from("gear_bins")
        .update(payload)
        .eq("id", editingBin.id)
        .select()
        .single();
      if (!error && data) {
        setBins((prev) => prev.map((b) => (b.id === editingBin.id ? (data as GearBin) : b)));
      }
    }

    setSaving(false);
    closeModal();
  };

  // ─── Bin actions ───────────────────────────────────────────────────────

  const archiveBin = async (bin: GearBin) => {
    const confirmed = window.confirm(`Archive "${bin.name}"? You can restore it from the database later.`);
    if (!confirmed) return;
    const { error } = await supabase
      .from("gear_bins")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", bin.id);
    if (!error) {
      setBins((prev) => prev.filter((b) => b.id !== bin.id));
      if (expandedBinId === bin.id) setExpandedBinId(null);
    }
  };

  const duplicateBin = async (bin: GearBin) => {
    const payload: GearBinInsert = {
      owner_id: userId,
      name: `${bin.name} (copy)`,
      icon: bin.icon,
      color: bin.color,
      default_location: bin.default_location,
      description: bin.description,
      notes: bin.notes,
    };
    const { data, error } = await supabase
      .from("gear_bins")
      .insert(payload)
      .select()
      .single();
    if (error || !data) return;

    const newBin = data as GearBin;
    setBins((prev) => [...prev, newBin]);

    // Clone its items too.
    const sourceItems = itemsByBin.get(bin.id) ?? [];
    if (sourceItems.length > 0) {
      const itemRows = sourceItems.map((it) => ({
        bin_id: newBin.id,
        name: it.name,
        quantity: it.quantity,
        notes: it.notes,
        sort_order: it.sort_order,
      }));
      const { data: newItems } = await supabase.from("gear_items").insert(itemRows).select();
      if (newItems) setItems((prev) => [...prev, ...(newItems as GearItem[])]);
    }
  };

  const changeBinLocation = async (bin: GearBin, loc: CarLocation) => {
    const { data, error } = await supabase
      .from("gear_bins")
      .update({ default_location: loc })
      .eq("id", bin.id)
      .select()
      .single();
    if (!error && data) {
      setBins((prev) => prev.map((b) => (b.id === bin.id ? (data as GearBin) : b)));
    }
  };

  const updateBinNotes = async (bin: GearBin, notes: string) => {
    const trimmed = notes.trim() || null;
    setBins((prev) => prev.map((b) => (b.id === bin.id ? { ...b, notes: trimmed } : b)));
    await supabase.from("gear_bins").update({ notes: trimmed }).eq("id", bin.id);
  };

  // ─── Item actions ──────────────────────────────────────────────────────

  const addItem = async (binId: string) => {
    const name = newItemName.trim();
    if (!name) return;
    const qty = Math.max(1, Math.floor(Number(newItemQty) || 1));
    const sort = (itemsByBin.get(binId)?.length ?? 0);
    const { data, error } = await supabase
      .from("gear_items")
      .insert({ bin_id: binId, name, quantity: qty, sort_order: sort })
      .select()
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as GearItem]);
      setNewItemName("");
      setNewItemQty(1);
    }
  };

  const deleteItem = async (item: GearItem) => {
    const { error } = await supabase.from("gear_items").delete().eq("id", item.id);
    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const renderBinCard = (bin: GearBin) => {
    const binItems = itemsByBin.get(bin.id) ?? [];
    const loc = CAR_LOCATIONS.find((l) => l.value === bin.default_location);
    const accent = loc?.color ?? "#5a9a2f";
    const iconBg = hexToRgba(accent, 0.12);
    const isExpanded = expandedBinId === bin.id;
    const tripsLabel = "New"; // Placeholder until Phase 2 — no trip integration yet.

    if (!isExpanded) {
      return (
        <div
          key={bin.id}
          onClick={() => setExpandedBinId(bin.id)}
          style={{
            background: "#fff",
            border: `1px solid ${th.cardBorder}`,
            borderRadius: 14,
            padding: "14px 14px 12px",
            boxShadow: "0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.04)",
            cursor: "pointer",
            transition: "transform 0.12s, box-shadow 0.12s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: iconBg,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {bin.icon ?? "📦"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{bin.name}</h3>
              <div style={{ fontSize: 11, color: th.muted, marginTop: 3 }}>
                {binItems.length} {binItems.length === 1 ? "item" : "items"}
                <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                {tripsLabel}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              paddingTop: 10,
              borderTop: `1px dashed ${th.cardBorder}`,
            }}
          >
            {loc ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 999,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  background: accent,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />
                {loc.label}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: th.muted }}>No location</span>
            )}
            <span style={{ color: th.muted, fontSize: 13 }}>›</span>
          </div>
        </div>
      );
    }

    // Expanded card — spans full grid row.
    return (
      <div
        key={bin.id}
        style={{
          gridColumn: "1 / -1",
          background: "linear-gradient(180deg, #fff 0%, #fbfdf9 100%)",
          border: `1.5px solid ${th.accent}`,
          borderRadius: 14,
          padding: "18px 18px 14px",
          boxShadow: "0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.04)",
        }}
      >
        {/* Head */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: iconBg,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            {bin.icon ?? "📦"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{bin.name}</h3>
            <div style={{ fontSize: 11, color: th.muted, marginTop: 3 }}>
              {binItems.length} {binItems.length === 1 ? "item" : "items"}
              <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
              {tripsLabel}
            </div>
          </div>
          {loc && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 999,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                background: accent,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />
              {loc.label}
            </span>
          )}
          <button
            onClick={() => setExpandedBinId(null)}
            aria-label="Collapse bin"
            style={{
              background: "none",
              border: "none",
              color: th.muted,
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 20,
          }}
        >
          {/* Items */}
          <div>
            <h4 style={itemsHeadStyle(th.muted)}>Items</h4>
            {binItems.length === 0 && (
              <div style={{ fontSize: 12, color: th.muted, padding: "4px 0 8px" }}>
                No items yet — add one below.
              </div>
            )}
            {binItems.map((item) => (
              <ItemRow key={item.id} item={item} accent={th.accent} muted={th.muted} cardBorder={th.cardBorder} onDelete={() => deleteItem(item)} />
            ))}

            {/* Inline add */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem(bin.id); }}
                placeholder="Add item…"
                className="input-modern"
                style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
              />
              <input
                type="number"
                min={1}
                value={newItemQty}
                onChange={(e) => setNewItemQty(parseInt(e.target.value, 10) || 1)}
                aria-label="Quantity"
                className="input-modern"
                style={{ width: 60, fontSize: 13, padding: "8px 10px", textAlign: "center" }}
              />
              <button
                onClick={() => addItem(bin.id)}
                className="btn btn-sm"
                style={{ background: th.accent }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Details */}
          <div>
            <h4 style={itemsHeadStyle(th.muted)}>Details</h4>

            <div style={metaCardStyle(th.cardBorder)}>
              <div style={metaLabelStyle(th.muted)}>Default car location</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {CAR_LOCATIONS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => changeBinLocation(bin, l.value)}
                    style={{
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 999,
                      border: `1px solid ${bin.default_location === l.value ? l.color : th.cardBorder}`,
                      background: bin.default_location === l.value ? l.color : "#fff",
                      color: bin.default_location === l.value ? "#fff" : th.muted,
                      cursor: "pointer",
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={metaCardStyle(th.cardBorder)}>
              <div style={metaLabelStyle(th.muted)}>Notes</div>
              <textarea
                defaultValue={bin.notes ?? ""}
                onBlur={(e) => updateBinNotes(bin, e.target.value)}
                placeholder="Pack order, reminders, who uses it…"
                rows={3}
                className="input-modern"
                style={{ marginTop: 6, fontSize: 13, resize: "vertical" }}
              />
            </div>

            <h4 style={{ ...itemsHeadStyle(th.muted), marginTop: 14 }}>Recent trips</h4>
            <div
              style={{
                fontSize: 12,
                color: th.muted,
                padding: "10px 12px",
                background: "#fff",
                border: `1px dashed ${th.cardBorder}`,
                borderRadius: 10,
              }}
            >
              Will populate once you've used this bin on a trip.
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${th.cardBorder}`,
            flexWrap: "wrap",
          }}
        >
          <button onClick={() => openEditModal(bin)} style={ghostBtnStyle(th)}>Edit bin</button>
          <button onClick={() => duplicateBin(bin)} style={ghostBtnStyle(th)}>Duplicate</button>
          <button onClick={() => archiveBin(bin)} style={{ ...ghostBtnStyle(th), color: "#c8503a" }}>Archive</button>
        </div>
      </div>
    );
  };

  const renderGroup = (loc: typeof CAR_LOCATIONS[number], groupBins: GearBin[]) => {
    if (groupBins.length === 0) return null;
    const itemCount = groupBins.reduce((sum, b) => sum + (itemsByBin.get(b.id)?.length ?? 0), 0);
    return (
      <div key={loc.value} style={{ marginTop: 26 }}>
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
            {groupBins.length} {groupBins.length === 1 ? "bin" : "bins"} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {groupBins.map(renderBinCard)}
        </div>
      </div>
    );
  };

  const renderUnassignedGroup = () => {
    const list = binsByLocation.unassigned;
    if (list.length === 0) return null;
    const itemCount = list.reduce((sum, b) => sum + (itemsByBin.get(b.id)?.length ?? 0), 0);
    return (
      <div key="unassigned" style={{ marginTop: 26 }}>
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
            {list.length} {list.length === 1 ? "bin" : "bins"} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {list.map(renderBinCard)}
        </div>
      </div>
    );
  };

  const binCount = bins.length;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif", paddingBottom: 96 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

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
          {/* Row 1 — Page header */}
          <div
            style={{
              padding: "14px 0 10px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
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
            <button
              onClick={openCreateModal}
              className="btn"
              style={{
                background: "#5a9a2f",
                boxShadow: "0 2px 8px rgba(90,154,47,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              ＋ New bin
            </button>
          </div>

          {/* Row 2 — Top-level nav */}
          <TopNav
            unreadChatCount={unreadChatCount}
            pendingFriendCount={pendingFriendCount}
            unreadAlertCount={unreadAlertCount}
          />

          {/* Row 3 — Stats pills */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 0 6px",
              flexWrap: "wrap",
            }}
          >
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{binCount}</b> {binCount === 1 ? "bin" : "bins"}
            </StatPill>
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{totalItems}</b> {totalItems === 1 ? "item" : "items"} total
            </StatPill>
            <StatPill muted={th.muted} border={th.cardBorder}>
              <b>{locationsUsed}</b> car {locationsUsed === 1 ? "location" : "locations"} used
            </StatPill>
          </div>

          {/* Row 4 — Filter pills + search */}
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "8px 0 12px",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                background: "#fff",
                border: `1.5px solid ${th.cardBorder}`,
                borderRadius: 20,
                padding: 3,
              }}
            >
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 18,
                    fontSize: 12,
                    fontWeight: filter === opt.value ? 700 : 500,
                    color: filter === opt.value ? "#fff" : th.muted,
                    background: filter === opt.value ? "#5a9a2f" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bins and items…"
              className="input-modern"
              style={{ flex: 1, minWidth: 180, maxWidth: 320, fontSize: 13, padding: "9px 14px" }}
            />
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        {binCount === 0 ? (
          <EmptyState muted={th.muted} onCreate={openCreateModal} border={th.cardBorder} />
        ) : visibleBins.length === 0 ? (
          <div
            className="card-glass"
            style={{ padding: 36, textAlign: "center", marginTop: 24 }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <p style={{ color: th.muted, fontSize: 14, margin: 0 }}>No bins or items match "{search}".</p>
          </div>
        ) : (
          <>
            {CAR_LOCATIONS.map((loc) => renderGroup(loc, binsByLocation.groups.get(loc.value) ?? []))}
            {renderUnassignedGroup()}
          </>
        )}
      </div>

      {/* ─── Create/Edit Modal (bottom-sheet) ─── */}
      {modalMode !== "closed" && (
        <div
          onClick={closeModal}
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
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, margin: 0 }}>
                {modalMode === "create" ? "New bin" : "Edit bin"}
              </h3>
              <button
                onClick={closeModal}
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

            <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Name *</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
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
                      onClick={() => setDraft((d) => ({ ...d, icon: ic }))}
                      style={{
                        aspectRatio: "1 / 1",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        borderRadius: 10,
                        border: `1.5px solid ${draft.icon === ic ? "#5a9a2f" : th.cardBorder}`,
                        background: draft.icon === ic ? hexToRgba("#5a9a2f", 0.1) : "#fff",
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
                      onClick={() => setDraft((d) => ({ ...d, color: sw }))}
                      aria-label={`Color ${sw}`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: sw,
                        border: draft.color === sw ? "3px solid #1a1a1a" : `2px solid ${th.cardBorder}`,
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
                      onClick={() => setDraft((d) => ({ ...d, default_location: l.value }))}
                      style={{
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        border: `1.5px solid ${draft.default_location === l.value ? l.color : th.cardBorder}`,
                        background: draft.default_location === l.value ? l.color : "#fff",
                        color: draft.default_location === l.value ? "#fff" : th.muted,
                        cursor: "pointer",
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="What belongs in this bin?"
                  rows={2}
                  className="input-modern"
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={modalLabelStyle(th.muted)}>Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Pack order, reminders, who uses it…"
                  rows={2}
                  className="input-modern"
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={closeModal}
                  className="btn"
                  style={{ background: "#f0f0f0", color: "#1a1a1a" }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveBin}
                  className="btn"
                  style={{ background: "#5a9a2f" }}
                  disabled={saving || !draft.name.trim()}
                >
                  {saving ? "Saving…" : modalMode === "create" ? "Create bin" : "Save changes"}
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

function ItemRow({
  item,
  accent,
  muted,
  cardBorder,
  onDelete,
}: {
  item: GearItem;
  accent: string;
  muted: string;
  cardBorder: string;
  onDelete: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 8px",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <button
        onClick={() => setChecked((v) => !v)}
        aria-label={checked ? "Uncheck" : "Check"}
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `1.5px solid ${checked ? accent : cardBorder}`,
          background: checked ? accent : "#fff",
          color: "#fff",
          fontSize: 11,
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
        {checked ? "✓" : ""}
      </button>
      <span
        style={{
          flex: 1,
          textDecoration: checked ? "line-through" : "none",
          color: checked ? muted : "inherit",
        }}
      >
        {item.name}
      </span>
      <span
        style={{
          fontSize: 11,
          color: muted,
          background: "rgba(90,154,47,0.08)",
          padding: "2px 8px",
          borderRadius: 999,
        }}
      >
        ×{item.quantity}
      </span>
      <button
        onClick={onDelete}
        aria-label="Remove item"
        style={{
          background: "none",
          border: "none",
          color: muted,
          fontSize: 14,
          cursor: "pointer",
          padding: "0 4px",
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
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
        Build your first bin to start packing smart trips.
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

function itemsHeadStyle(muted: string): React.CSSProperties {
  return {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: muted,
    margin: "0 0 10px",
    fontWeight: 700,
  };
}

function metaCardStyle(border: string): React.CSSProperties {
  return {
    background: "rgba(90,154,47,0.04)",
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 10,
  };
}

function metaLabelStyle(muted: string): React.CSSProperties {
  return {
    fontSize: 11,
    color: muted,
  };
}

function ghostBtnStyle(th: { muted: string; cardBorder: string; card: string }): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: "transparent",
    color: th.muted,
    border: `1px solid ${th.cardBorder}`,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
  };
}

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
