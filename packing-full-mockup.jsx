import { useState, useMemo, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
//  PACKING FULL SYSTEM MOCKUP — Trip Planner Pro
//  All 4 tabs preserved: Group → Outfits → Consolidate → Pack & Go
//  Pack & Go gets: Bag Setup, inline dropdowns, completion animation, bag summary
//  Nothing removed — bag hierarchy is ADDED to existing Pack & Go
// ═══════════════════════════════════════════════════════════

// ─── Theme (matches existing light theme) ───
const T = {
  bg: "#fafafa", text: "#1a1a1a", muted: "#888", cardBg: "#fff",
  cardBorder: "#e8e8e8", accent: "#6C5CE7", green: "#2e7d32",
  greenBg: "#e8f5e9", orange: "#e65100", orangeBg: "#fff3e0",
  headerBg: "rgba(255,255,255,0.97)",
};

// ─── Sample Data ───
const SAMPLE_EVENTS = [
  { id: "ev1", title: "Welcome Dinner", date: "2026-06-12", time_slot: "evening", dress_code: "smart_casual", event_type: "dining" },
  { id: "ev2", title: "Beach Day", date: "2026-06-13", time_slot: "morning", dress_code: "casual", event_type: "outdoor" },
  { id: "ev3", title: "Boat Tour", date: "2026-06-13", time_slot: "afternoon", dress_code: "casual", event_type: "outdoor" },
  { id: "ev4", title: "Farewell Gala", date: "2026-06-14", time_slot: "evening", dress_code: "formal", event_type: "dining" },
];

const DRESS_CODE_COLORS = {
  casual: "#4caf50", smart_casual: "#0097a7", formal: "#7b1fa2",
  active: "#e65100", swimwear: "#00bcd4", outdoor: "#558b2f",
};

const SAMPLE_OUTFIT_GROUPS = [
  { id: "og1", label: "Day 1 — Evening", dress_code: "smart_casual", date: "2026-06-12", eventIds: ["ev1"] },
  { id: "og2", label: "Day 2 — Daytime", dress_code: "casual", date: "2026-06-13", eventIds: ["ev2", "ev3"] },
  { id: "og3", label: "Day 3 — Evening", dress_code: "formal", date: "2026-06-14", eventIds: ["ev4"] },
];

const INITIAL_ITEMS = [
  { id: "i1", name: "White linen button-down", category: "tops", eventIds: ["ev1", "ev3"], is_packed: false },
  { id: "i2", name: "Navy polo", category: "tops", eventIds: ["ev2"], is_packed: false },
  { id: "i3", name: "Black tee", category: "tops", eventIds: ["ev3"], is_packed: false },
  { id: "i4", name: "White dress shirt", category: "tops", eventIds: ["ev4"], is_packed: false },
  { id: "i5", name: "Khaki shorts", category: "bottoms", eventIds: ["ev2", "ev3"], is_packed: false },
  { id: "i6", name: "Navy chinos", category: "bottoms", eventIds: ["ev1"], is_packed: false },
  { id: "i7", name: "Black dress pants", category: "bottoms", eventIds: ["ev4"], is_packed: false },
  { id: "i8", name: "Swim trunks", category: "swimwear", eventIds: ["ev2"], is_packed: false },
  { id: "i9", name: "Brown loafers", category: "shoes", eventIds: ["ev1", "ev3"], is_packed: false },
  { id: "i10", name: "Sandals", category: "shoes", eventIds: ["ev2"], is_packed: false },
  { id: "i11", name: "Black oxfords", category: "shoes", eventIds: ["ev4"], is_packed: false },
  { id: "i12", name: "Light rain jacket", category: "outerwear", eventIds: ["ev3"], is_packed: false },
  { id: "i13", name: "Blazer", category: "outerwear", eventIds: ["ev4"], is_packed: false },
  { id: "i14", name: "Sunscreen SPF 50", category: "toiletries", eventIds: [], is_packed: false },
  { id: "i15", name: "Toothbrush & paste", category: "toiletries", eventIds: [], is_packed: false },
  { id: "i16", name: "Deodorant", category: "toiletries", eventIds: [], is_packed: false },
  { id: "i17", name: "Sunglasses", category: "accessories", eventIds: ["ev2", "ev3"], is_packed: false },
  { id: "i18", name: "Watch", category: "accessories", eventIds: ["ev1", "ev4"], is_packed: false },
  { id: "i19", name: "Passport", category: "documents", eventIds: [], is_packed: false },
  { id: "i20", name: "Phone charger", category: "electronics", eventIds: [], is_packed: false },
  { id: "i21", name: "Portable battery", category: "electronics", eventIds: ["ev2", "ev3"], is_packed: false },
];

const CATEGORIES = {
  tops: { icon: "👔", label: "Tops" },
  bottoms: { icon: "👖", label: "Bottoms" },
  shoes: { icon: "👟", label: "Shoes" },
  outerwear: { icon: "🧥", label: "Outerwear" },
  swimwear: { icon: "🩳", label: "Swimwear" },
  toiletries: { icon: "🧴", label: "Toiletries" },
  accessories: { icon: "⌚", label: "Accessories" },
  documents: { icon: "📄", label: "Documents" },
  electronics: { icon: "🔌", label: "Electronics" },
};

const INITIAL_BAGS = [
  {
    id: "bag1", name: "Carry-On Roller", icon: "🧳", bag_type: "carry-on",
    sections: [
      { id: "s1", name: "Left Side", containers: [{ id: "c1", name: "Tops Cube" }, { id: "c2", name: "Bottoms Cube" }] },
      { id: "s2", name: "Right Side", containers: [{ id: "c3", name: "Shoe Bag" }, { id: "c4", name: "Misc Cube" }] },
    ],
  },
  {
    id: "bag2", name: "Daypack", icon: "🎒", bag_type: "personal-item",
    sections: [
      { id: "s3", name: "Main Compartment", containers: [] },
      { id: "s4", name: "Front Zip", containers: [] },
      { id: "s5", name: "Top Pocket", containers: [] },
    ],
  },
];

const DONT_FORGET = ["Phone charger", "Medications", "Passport / ID", "Travel insurance docs"];

// ─── Shared Styles ───
const card = { background: T.cardBg, borderRadius: 16, border: `1px solid ${T.cardBorder}`, overflow: "hidden", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" };
const cardHeader = { padding: "14px 18px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" };
const font = "'DM Sans', sans-serif";
const selectStyle = { fontSize: 10, padding: "3px 5px", borderRadius: 4, border: `1px solid ${T.cardBorder}`, background: T.cardBg, color: T.text, cursor: "pointer", minWidth: 0, flex: 1, fontFamily: font };

// ─── Helpers ───
function formatDate(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupByCategory(items) {
  const groups = {};
  items.forEach(item => {
    const cat = item.category || "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  return groups;
}

// ═══════════════════════════════════════════════════════════
//  VIEW: GROUP (existing — dress code grouping)
// ═══════════════════════════════════════════════════════════
function GroupView({ outfitGroups, events }) {
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 12, color: T.muted, margin: "0 0 14px" }}>
        Events auto-grouped by day & dress code. Tap a group to manage its events.
      </p>
      {outfitGroups.map(og => {
        const groupEvents = events.filter(e => og.eventIds.includes(e.id));
        const dcColor = DRESS_CODE_COLORS[og.dress_code] || T.accent;
        return (
          <div key={og.id} style={card}>
            <div style={cardHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: dcColor }} />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: font }}>{og.label}</span>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${dcColor}18`, color: dcColor, fontWeight: 700 }}>
                {og.dress_code.replace("_", " ")}
              </span>
            </div>
            {groupEvents.map((evt, idx) => (
              <div key={evt.id} style={{ padding: "10px 18px", borderBottom: idx < groupEvents.length - 1 ? `1px solid ${T.cardBorder}` : "none", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13 }}>{evt.event_type === "dining" ? "🍽️" : "🏖️"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>{evt.title}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{formatDate(evt.date)} · {evt.time_slot}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  VIEW: OUTFITS (existing — walkthrough)
// ═══════════════════════════════════════════════════════════
function OutfitsView({ outfitGroups, events, items }) {
  const [stepIdx, setStepIdx] = useState(0);
  const group = outfitGroups[stepIdx];
  const groupEvents = events.filter(e => group?.eventIds.includes(e.id));
  const groupItems = items.filter(i => i.eventIds.some(eid => group?.eventIds.includes(eid)));
  const dcColor = DRESS_CODE_COLORS[group?.dress_code] || T.accent;

  return (
    <div style={{ padding: 16 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0}
          style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.cardBg, cursor: stepIdx === 0 ? "default" : "pointer", opacity: stepIdx === 0 ? 0.3 : 1, fontFamily: font, fontSize: 12, fontWeight: 600 }}>
          ← Prev
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, fontFamily: font }}>
          {stepIdx + 1} of {outfitGroups.length}
        </span>
        <button onClick={() => setStepIdx(Math.min(outfitGroups.length - 1, stepIdx + 1))} disabled={stepIdx === outfitGroups.length - 1}
          style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.cardBg, cursor: stepIdx === outfitGroups.length - 1 ? "default" : "pointer", opacity: stepIdx === outfitGroups.length - 1 ? 0.3 : 1, fontFamily: font, fontSize: 12, fontWeight: 600 }}>
          Next →
        </button>
      </div>

      {group && (
        <div style={card}>
          <div style={{ ...cardHeader, background: `${dcColor}08` }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{group.label}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                {groupEvents.map(e => e.title).join(" + ")}
              </div>
            </div>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${dcColor}18`, color: dcColor, fontWeight: 700 }}>
              {group.dress_code.replace("_", " ")}
            </span>
          </div>

          {/* Inspo placeholder */}
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: 10, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📸</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: font }}>Outfit Inspiration</div>
              <div style={{ fontSize: 11, color: T.muted }}>Tap to search or upload inspo</div>
            </div>
          </div>

          {/* Items for this group */}
          {groupItems.map((item, idx) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: idx < groupItems.length - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
              <span style={{ fontSize: 12 }}>{CATEGORIES[item.category]?.icon || "📦"}</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: font, flex: 1 }}>{item.name}</span>
              {item.eventIds.length > 1 && (
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: T.greenBg, color: T.green, fontWeight: 700 }}>↻ ×{item.eventIds.length}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  VIEW: CONSOLIDATE (existing — deduped review)
// ═══════════════════════════════════════════════════════════
function ConsolidateView({ items, outfitGroups, setActiveView }) {
  const multiUse = items.filter(i => i.eventIds.length > 1);
  const grouped = groupByCategory(items);

  return (
    <div style={{ padding: 16 }}>
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { val: items.length, label: "Total Items", color: T.accent },
          { val: multiUse.length, label: "Multi-Use", color: T.green },
          { val: outfitGroups.length, label: "Outfit Groups", color: T.text },
        ].map((s, i) => (
          <div key={i} style={{ background: T.cardBg, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Items by category */}
      {Object.entries(grouped).map(([cat, catItems]) => {
        const info = CATEGORIES[cat] || { icon: "📦", label: cat };
        return (
          <div key={cat} style={card}>
            <div style={cardHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{info.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", fontFamily: font }}>{info.label}</span>
              </div>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{catItems.length}</span>
            </div>
            {catItems.map((item, idx) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: idx < catItems.length - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: font, flex: 1 }}>{item.name}</span>
                {item.eventIds.length > 1 && (
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: T.greenBg, color: T.green, fontWeight: 700 }}>↻ ×{item.eventIds.length}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button onClick={() => setActiveView("checklist")} style={{ padding: "12px 30px", background: T.accent, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
          Ready to Pack →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  VIEW: PACK & GO ✓ (enhanced with bag hierarchy)
// ═══════════════════════════════════════════════════════════
function PackAndGoView({ items, setItems, bags, setBags, assignments, setAssignments, events }) {
  const [dontForgetChecked, setDontForgetChecked] = useState({});
  const [editingBags, setEditingBags] = useState(false);
  const [newBagName, setNewBagName] = useState("");
  const [addingSectionTo, setAddingSectionTo] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [addingContainerTo, setAddingContainerTo] = useState(null);
  const [newContainerName, setNewContainerName] = useState("");
  const [showAllSet, setShowAllSet] = useState(false);

  const packedCount = items.filter(i => i.is_packed).length;
  const totalCount = items.length;
  const allPacked = packedCount === totalCount && totalCount > 0;
  const assignedCount = items.filter(i => assignments[i.id]?.bag).length;

  // Trigger completion animation
  useEffect(() => {
    if (allPacked) {
      const timer = setTimeout(() => setShowAllSet(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowAllSet(false);
    }
  }, [allPacked]);

  const togglePacked = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_packed: !i.is_packed } : i));
  };

  const handleAssign = (itemId, field, value) => {
    setAssignments(prev => {
      const current = prev[itemId] || {};
      const updated = { ...current, [field]: value };
      if (field === "bag") { updated.section = ""; updated.container = ""; }
      if (field === "section") { updated.container = ""; }
      return { ...prev, [itemId]: updated };
    });
    if (field === "bag" && value) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_packed: true } : i));
    }
  };

  const addBag = () => {
    if (!newBagName.trim()) return;
    setBags(prev => [...prev, { id: "bag-" + Date.now(), name: newBagName.trim(), icon: "🧳", bag_type: "bag", sections: [] }]);
    setNewBagName("");
  };

  const addSection = (bagId) => {
    if (!newSectionName.trim()) return;
    setBags(prev => prev.map(b => b.id === bagId ? { ...b, sections: [...b.sections, { id: "s-" + Date.now(), name: newSectionName.trim(), containers: [] }] } : b));
    setNewSectionName("");
    setAddingSectionTo(null);
  };

  const addContainer = (bagId, sectionId) => {
    if (!newContainerName.trim()) return;
    setBags(prev => prev.map(b => b.id === bagId ? { ...b, sections: b.sections.map(s => s.id === sectionId ? { ...s, containers: [...s.containers, { id: "c-" + Date.now(), name: newContainerName.trim() }] } : s) } : b));
    setNewContainerName("");
    setAddingContainerTo(null);
  };

  const grouped = groupByCategory(items);

  // Bag summary data
  const bagSummary = bags.map(bag => {
    const bagItems = items.filter(i => assignments[i.id]?.bag === bag.id);
    return { ...bag, bagItems, itemCount: bagItems.length };
  }).filter(b => b.itemCount > 0);

  return (
    <div style={{ padding: 16 }}>
      {/* CSS animation */}
      <style>{`
        @keyframes checkDraw {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Completion Animation ── */}
      {showAllSet && (
        <div style={{ background: T.cardBg, borderRadius: 16, border: `1px solid ${T.green}30`, padding: "24px 18px", marginBottom: 14, textAlign: "center" }}>
          <div style={{ animation: "checkDraw 0.5s ease-out forwards", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "50%", background: T.green, marginBottom: 10 }}>
            <span style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>✓</span>
          </div>
          <div style={{ animation: "fadeUp 0.4s ease-out 0.3s both", fontSize: 16, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: T.green }}>
            You're all set!
          </div>
          {assignedCount < totalCount && (
            <div style={{ animation: "fadeUp 0.4s ease-out 0.6s both", fontSize: 12, color: T.muted, marginTop: 8 }}>
              Want to organize into bags?{" "}
              <span onClick={() => setEditingBags(true)} style={{ color: T.accent, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                Set up your bags ↓
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Progress Bar ── */}
      <div style={{ background: T.cardBg, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: font }}>
            {allPacked ? "All packed! 🎉" : `${packedCount} of ${totalCount} packed`}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div style={{ height: 8, background: "#f5f5f5", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", background: allPacked ? T.green : T.accent, width: `${totalCount > 0 ? (packedCount / totalCount) * 100 : 0}%`, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* ── Your Bags (NEW — bag setup) ── */}
      <div style={{ background: T.cardBg, borderRadius: 16, border: `1px solid ${T.cardBorder}`, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font }}>🧳 Your Bags</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Optional — organize where things go</div>
          </div>
          <button onClick={() => setEditingBags(!editingBags)} style={{
            background: editingBags ? `${T.accent}18` : "#f5f5f5",
            border: `1px solid ${editingBags ? T.accent : T.cardBorder}`,
            borderRadius: 8, padding: "5px 10px", cursor: "pointer",
            color: editingBags ? T.accent : T.muted, fontSize: 11, fontWeight: 600, fontFamily: font,
          }}>
            {editingBags ? "Done" : "Edit Bags"}
          </button>
        </div>

        {/* Bag pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {bags.map(bag => (
            <div key={bag.id} style={{ background: "#f8f8f8", border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: font }}>
              <span style={{ marginRight: 4 }}>{bag.icon}</span>
              <span style={{ fontWeight: 600 }}>{bag.name}</span>
              <span style={{ color: T.muted, marginLeft: 6, fontSize: 10 }}>
                {bag.sections.length}s{bag.sections.reduce((n, s) => n + s.containers.length, 0) > 0 ? ` · ${bag.sections.reduce((n, s) => n + s.containers.length, 0)}c` : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Edit mode */}
        {editingBags && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 12 }}>
            {bags.map(bag => (
              <div key={bag.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>{bag.icon} {bag.name}</div>
                {bag.sections.map(section => (
                  <div key={section.id} style={{ marginLeft: 14, borderLeft: `2px solid ${T.cardBorder}`, paddingLeft: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 0", fontFamily: font }}>{section.name}</div>
                    {section.containers.map(c => (
                      <div key={c.id} style={{ marginLeft: 10, fontSize: 10, color: T.muted, padding: "2px 0", borderLeft: `2px solid #f0f0f0`, paddingLeft: 8 }}>📦 {c.name}</div>
                    ))}
                    {addingContainerTo === `${bag.id}-${section.id}` ? (
                      <div style={{ display: "flex", gap: 4, marginLeft: 10, marginTop: 3 }}>
                        <input value={newContainerName} onChange={e => setNewContainerName(e.target.value)} onKeyDown={e => e.key === "Enter" && addContainer(bag.id, section.id)} placeholder="Cube name..." autoFocus style={{ ...selectStyle, padding: "3px 6px" }} />
                        <button onClick={() => addContainer(bag.id, section.id)} style={{ background: T.accent, border: "none", borderRadius: 4, color: "#fff", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>Add</button>
                      </div>
                    ) : (
                      <div onClick={() => { setAddingContainerTo(`${bag.id}-${section.id}`); setNewContainerName(""); }} style={{ marginLeft: 10, fontSize: 10, color: T.accent, cursor: "pointer", padding: "2px 0" }}>+ cube / pouch</div>
                    )}
                  </div>
                ))}
                {addingSectionTo === bag.id ? (
                  <div style={{ display: "flex", gap: 4, marginLeft: 14, marginTop: 3 }}>
                    <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSection(bag.id)} placeholder="Section name..." autoFocus style={{ ...selectStyle, padding: "3px 6px" }} />
                    <button onClick={() => addSection(bag.id)} style={{ background: T.accent, border: "none", borderRadius: 4, color: "#fff", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>Add</button>
                  </div>
                ) : (
                  <div onClick={() => { setAddingSectionTo(bag.id); setNewSectionName(""); }} style={{ marginLeft: 14, fontSize: 10, color: T.accent, cursor: "pointer", padding: "3px 0" }}>+ section</div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 6, paddingTop: 8, borderTop: `1px solid #f0f0f0` }}>
              <input value={newBagName} onChange={e => setNewBagName(e.target.value)} onKeyDown={e => e.key === "Enter" && addBag()} placeholder="New bag name..." style={{ ...selectStyle, padding: "5px 8px", fontSize: 11 }} />
              <button onClick={addBag} style={{ background: T.accent, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, padding: "5px 12px", cursor: "pointer", fontWeight: 600, fontFamily: font, whiteSpace: "nowrap" }}>+ Add Bag</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Item Checklist (enhanced with dropdowns) ── */}
      {Object.entries(grouped).map(([cat, catItems]) => {
        const info = CATEGORIES[cat] || { icon: "📦", label: cat };
        const groupPacked = catItems.filter(i => i.is_packed).length;
        return (
          <div key={cat} style={card}>
            <div style={cardHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{info.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", fontFamily: font }}>{info.label}</span>
              </div>
              <span style={{ fontSize: 11, color: groupPacked === catItems.length ? T.green : T.muted, fontWeight: 600 }}>{groupPacked}/{catItems.length}</span>
            </div>
            {catItems.map((item, idx) => {
              const a = assignments[item.id] || {};
              const selectedBag = bags.find(b => b.id === a.bag);
              const selectedSection = selectedBag?.sections.find(s => s.id === a.section);
              const hasContainers = selectedSection?.containers.length > 0;
              return (
                <div key={item.id} style={{ padding: "8px 18px", borderBottom: idx < catItems.length - 1 ? `1px solid ${T.cardBorder}` : "none", background: item.is_packed ? `${T.accent}04` : "transparent" }}>
                  {/* Row 1: checkbox + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div onClick={() => togglePacked(item.id)} style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                      border: `2px solid ${item.is_packed ? T.accent : "#d0d0d0"}`,
                      background: item.is_packed ? T.accent : "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item.is_packed && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: font, color: item.is_packed ? T.muted : T.text, textDecoration: item.is_packed ? "line-through" : "none" }}>
                      {item.name}
                    </span>
                    {item.eventIds.length > 1 && (
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 8, background: T.greenBg, color: T.green, fontWeight: 700 }}>↻ ×{item.eventIds.length}</span>
                    )}
                  </div>
                  {/* Row 2: bag dropdowns */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 32 }}>
                    <select value={a.bag || ""} onChange={e => handleAssign(item.id, "bag", e.target.value)} style={selectStyle}>
                      <option value="">Bag...</option>
                      {bags.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                    </select>
                    <select value={a.section || ""} onChange={e => handleAssign(item.id, "section", e.target.value)} style={{ ...selectStyle, opacity: selectedBag ? 1 : 0.35 }} disabled={!selectedBag}>
                      <option value="">Section...</option>
                      {selectedBag?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={a.container || ""} onChange={e => handleAssign(item.id, "container", e.target.value)} style={{ ...selectStyle, opacity: hasContainers ? 1 : 0.35 }} disabled={!hasContainers}>
                      <option value="">Cube...</option>
                      {selectedSection?.containers.map(c => <option key={c.id} value={c.id}>📦 {c.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Don't Forget ── */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...cardHeader }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: font }}>Don't Forget</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: T.orangeBg, color: T.orange, fontWeight: 700 }}>Reminders</span>
          </div>
        </div>
        {DONT_FORGET.map((name, idx) => (
          <button key={idx} onClick={() => setDontForgetChecked(p => ({ ...p, [name]: !p[name] }))} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 18px",
            background: dontForgetChecked[name] ? `${T.accent}06` : "transparent",
            border: "none", borderBottom: idx < DONT_FORGET.length - 1 ? `1px solid ${T.cardBorder}` : "none",
            cursor: "pointer", textAlign: "left", fontFamily: font,
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${dontForgetChecked[name] ? T.accent : "#d0d0d0"}`, background: dontForgetChecked[name] ? T.accent : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {dontForgetChecked[name] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: dontForgetChecked[name] ? T.muted : T.text, textDecoration: dontForgetChecked[name] ? "line-through" : "none" }}>{name}</span>
          </button>
        ))}
      </div>

      {/* ── Bag Summary (only shows when items assigned) ── */}
      {bagSummary.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🗂️</span> Bag Summary
          </div>
          {bagSummary.map(bag => (
            <div key={bag.id} style={{ ...card }}>
              <div style={cardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{bag.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: font }}>{bag.name}</span>
                </div>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{bag.itemCount} items</span>
              </div>
              {bag.sections.map(section => {
                const sectionItems = bag.bagItems.filter(i => assignments[i.id]?.section === section.id);
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section.id} style={{ padding: "6px 18px 6px 28px", borderBottom: `1px solid #f8f8f8` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 3, fontFamily: font }}>{section.name}</div>
                    {section.containers.map(container => {
                      const cItems = sectionItems.filter(i => assignments[i.id]?.container === container.id);
                      if (cItems.length === 0) return null;
                      return (
                        <div key={container.id} style={{ marginLeft: 10, marginBottom: 3, borderLeft: "2px solid #f0f0f0", paddingLeft: 8 }}>
                          <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 1 }}>📦 {container.name}</div>
                          {cItems.map(item => (
                            <div key={item.id} style={{ fontSize: 11, color: T.text, padding: "1px 0", fontFamily: font }}>{item.name}</div>
                          ))}
                        </div>
                      );
                    })}
                    {sectionItems.filter(i => !assignments[i.id]?.container).map(item => (
                      <div key={item.id} style={{ fontSize: 11, color: T.text, padding: "1px 0", fontFamily: font }}>{item.name}</div>
                    ))}
                  </div>
                );
              })}
              {bag.bagItems.filter(i => !assignments[i.id]?.section).map(item => (
                <div key={item.id} style={{ padding: "4px 18px", fontSize: 11, color: T.text, display: "flex", alignItems: "center", gap: 6, fontFamily: font }}>
                  {item.name}
                  <span style={{ fontSize: 9, color: T.orange }}>unsorted</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 60 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function PackingFullMockup() {
  const [activeView, setActiveView] = useState("checklist");
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [bags, setBags] = useState(INITIAL_BAGS);
  const [assignments, setAssignments] = useState({});

  const accent = T.accent;
  const tabs = [
    { id: "grouping", label: "Group" },
    { id: "walkthrough", label: "Outfits" },
    { id: "consolidation", label: "Consolidate" },
    { id: "checklist", label: "Pack & Go ✓" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, maxWidth: 480, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ background: T.headerBg, padding: "14px 20px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", margin: 0 }}>Cancún 2026</h2>
            <span style={{ fontSize: 12, color: T.muted }}>Fri, Jun 12 – Sun, Jun 14 · Cancún, MX</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${accent}14`, padding: "4px 10px", borderRadius: 20 }}>
            <span style={{ fontSize: 13 }}>🗂️</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>Hyper-Organizer</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Nav Placeholder ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", zIndex: 100, display: "flex", justifyContent: "space-around", alignItems: "center", height: 56, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid #e5e5e5", padding: "0 4px" }}>
        {["Itinerary", "Expenses", "Packing", "Notes", "Meals", "Group"].map((tab, i) => (
          <div key={tab} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>{["📅", "💰", "🧳", "📝", "🍽️", "👥"][i]}</span>
            <span style={{ fontSize: 9, fontWeight: tab === "Packing" ? 700 : 500, color: tab === "Packing" ? accent : T.muted }}>{tab}</span>
          </div>
        ))}
      </div>

      {/* ── Person Tabs ── */}
      <div style={{ display: "flex", gap: 0, padding: "0 16px", background: T.bg, borderBottom: `1px solid ${T.cardBorder}`, overflowX: "auto" }}>
        {["Joe", "Sarah", "Max"].map((name, i) => (
          <button key={name} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${i === 0 ? accent : "transparent"}`, cursor: "pointer" }}>
            <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? T.text : T.muted, fontFamily: font }}>{name}</span>
            {i === 0 && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: `${accent}18`, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Host</span>}
          </button>
        ))}
      </div>

      {/* ── Packing Style Banner ── */}
      <div style={{ margin: "12px 16px 0", padding: "10px 14px", background: `${accent}0a`, border: `1px solid ${T.cardBorder}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: T.muted }}>Full mapping with verification checklist</span>
      </div>

      {/* ── View Switcher (existing 4 tabs) ── */}
      <div style={{ display: "flex", gap: 0, padding: "0 16px", margin: "12px 0 0", overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveView(tab.id)} style={{
            flex: "0 0 auto", padding: "10px 16px", background: "none", border: "none",
            borderBottom: `3px solid ${activeView === tab.id ? accent : "transparent"}`,
            cursor: "pointer", fontSize: 13, fontWeight: activeView === tab.id ? 700 : 500,
            color: activeView === tab.id ? accent : T.muted, fontFamily: font,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Views ── */}
      {activeView === "grouping" && <GroupView outfitGroups={SAMPLE_OUTFIT_GROUPS} events={SAMPLE_EVENTS} />}
      {activeView === "walkthrough" && <OutfitsView outfitGroups={SAMPLE_OUTFIT_GROUPS} events={SAMPLE_EVENTS} items={items} />}
      {activeView === "consolidation" && <ConsolidateView items={items} outfitGroups={SAMPLE_OUTFIT_GROUPS} setActiveView={setActiveView} />}
      {activeView === "checklist" && (
        <PackAndGoView items={items} setItems={setItems} bags={bags} setBags={setBags} assignments={assignments} setAssignments={setAssignments} events={SAMPLE_EVENTS} />
      )}
    </div>
  );
}