import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════
//  PACKING MOCKUP v3 — Trip Planner Pro
//  Two tabs:
//    1. "What's Coming" — event-based checklist (check off items per event)
//    2. "Pack It" — set up bags, then assign each item via dropdowns
// ═══════════════════════════════════════════════════════════

const ACCENT = "#6C5CE7";
const BG = "#0F0F14";
const CARD = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#E8E6F0";
const TEXT_DIM = "rgba(232,230,240,0.5)";
const GREEN = "#00B894";
const ORANGE = "#FDCB6E";
const RED = "#FF7675";

const CATEGORY_COLORS = {
  Tops: "#74B9FF", Bottoms: "#A29BFE", Shoes: "#FD79A8", Outerwear: "#6C5CE7",
  Toiletries: "#00CEC9", Accessories: "#FDCB6E", Documents: "#FF7675", Electronics: "#55EFC4",
};

const INITIAL_EVENTS = [
  {
    id: 1, name: "Welcome Dinner", icon: "🍽️", dress: "Smart Casual",
    items: [
      { id: "e1-1", name: "White linen button-down", category: "Tops" },
      { id: "e1-2", name: "Navy chinos", category: "Bottoms" },
      { id: "e1-3", name: "Brown loafers", category: "Shoes" },
      { id: "e1-4", name: "Watch", category: "Accessories" },
    ],
  },
  {
    id: 2, name: "Beach Day", icon: "🏖️", dress: "Casual",
    items: [
      { id: "e2-1", name: "Navy polo", category: "Tops" },
      { id: "e2-2", name: "Swim trunks", category: "Bottoms" },
      { id: "e2-3", name: "Sandals", category: "Shoes" },
      { id: "e2-4", name: "Sunscreen SPF 50", category: "Toiletries" },
      { id: "e2-5", name: "Sunglasses", category: "Accessories" },
    ],
  },
  {
    id: 3, name: "Boat Tour", icon: "⛵", dress: "Casual",
    items: [
      { id: "e3-1", name: "Black tee", category: "Tops" },
      { id: "e3-2", name: "Khaki shorts", category: "Bottoms" },
      { id: "e3-3", name: "Light rain jacket", category: "Outerwear" },
      { id: "e3-4", name: "Portable battery", category: "Electronics" },
    ],
  },
  {
    id: 4, name: "Farewell Gala", icon: "🎩", dress: "Formal",
    items: [
      { id: "e4-1", name: "White dress shirt", category: "Tops" },
      { id: "e4-2", name: "Black dress pants", category: "Bottoms" },
      { id: "e4-3", name: "Black oxfords", category: "Shoes" },
      { id: "e4-4", name: "Blazer", category: "Outerwear" },
    ],
  },
];

const ALWAYS_ITEMS = [
  { id: "a-1", name: "Passport", category: "Documents" },
  { id: "a-2", name: "Phone charger", category: "Electronics" },
  { id: "a-3", name: "Toothbrush & paste", category: "Toiletries" },
  { id: "a-4", name: "Deodorant", category: "Toiletries" },
];

const INITIAL_BAGS = [
  {
    id: "bag-1", name: "Carry-On Roller", icon: "🧳", type: "carry-on",
    sections: [
      { id: "s1", name: "Left Side", containers: [{ id: "c1", name: "Tops Cube" }, { id: "c2", name: "Bottoms Cube" }] },
      { id: "s2", name: "Right Side", containers: [{ id: "c3", name: "Shoe Bag" }, { id: "c4", name: "Misc Cube" }] },
    ],
  },
  {
    id: "bag-2", name: "Daypack", icon: "🎒", type: "personal-item",
    sections: [
      { id: "s3", name: "Main Compartment", containers: [] },
      { id: "s4", name: "Front Zip Pocket", containers: [] },
      { id: "s5", name: "Top Pocket", containers: [] },
    ],
  },
];

/* ─── Shared Components ─── */
const selectStyle = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6, color: TEXT, fontSize: 11, padding: "4px 6px",
  outline: "none", cursor: "pointer", minWidth: 0, flex: 1,
};

function TabBar({ active, onChange, tabs }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            flex: 1, padding: "12px 16px", border: "none", borderRadius: 10, cursor: "pointer",
            background: isActive ? ACCENT : "transparent", color: isActive ? "#fff" : TEXT_DIM,
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: "50%",
              background: isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>
              {tab.icon}
            </span>
            <span style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{tab.title}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{tab.subtitle}</div>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── TAB 1: WHAT'S COMING ─── */
function WhatsComingTab({ events, checkedItems, onToggle }) {
  const totalItems = useMemo(() => {
    const all = new Set();
    events.forEach((e) => e.items.forEach((i) => all.add(i.id)));
    ALWAYS_ITEMS.forEach((i) => all.add(i.id));
    return all.size;
  }, [events]);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Progress */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "10px 14px",
      }}>
        <span style={{ fontSize: 13, color: TEXT_DIM }}>Checked off</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: checkedCount === totalItems ? GREEN : ACCENT }}>{checkedCount}</span>
          <span style={{ color: TEXT_DIM }}> / {totalItems}</span>
        </span>
      </div>

      <p style={{ color: TEXT_DIM, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        Go through each event and check off what you're bringing. Checked items flow into "Pack It."
      </p>

      {/* Event cards */}
      {events.map((evt) => (
        <div key={evt.id} style={{
          background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <span style={{ fontSize: 22 }}>{evt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{evt.name}</div>
              <div style={{ fontSize: 12, color: TEXT_DIM }}>{evt.dress}</div>
            </div>
            <span style={{ fontSize: 12, color: TEXT_DIM }}>
              {evt.items.filter((i) => checkedItems[i.id]).length}/{evt.items.length}
            </span>
          </div>
          <div style={{ padding: "8px 12px" }}>
            {evt.items.map((item) => {
              const checked = !!checkedItems[item.id];
              const color = CATEGORY_COLORS[item.category] || ACCENT;
              return (
                <div key={item.id} onClick={() => onToggle(item.id, item)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 6px",
                  cursor: "pointer", userSelect: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.02)",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${checked ? GREEN : "rgba(255,255,255,0.15)"}`,
                    background: checked ? GREEN : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#fff", transition: "all 0.15s",
                  }}>
                    {checked && "✓"}
                  </div>
                  <span style={{
                    width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 13, color: checked ? TEXT : TEXT_DIM, fontWeight: checked ? 500 : 400,
                    flex: 1,
                  }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>{item.category}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Always-pack section */}
      <div style={{
        background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Essentials</div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>Always bring these</div>
          </div>
        </div>
        <div style={{ padding: "8px 12px" }}>
          {ALWAYS_ITEMS.map((item) => {
            const checked = !!checkedItems[item.id];
            const color = CATEGORY_COLORS[item.category] || ACCENT;
            return (
              <div key={item.id} onClick={() => onToggle(item.id, item)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 6px",
                cursor: "pointer", userSelect: "none",
                borderBottom: "1px solid rgba(255,255,255,0.02)",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${checked ? GREEN : "rgba(255,255,255,0.15)"}`,
                  background: checked ? GREEN : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: "#fff", transition: "all 0.15s",
                }}>
                  {checked && "✓"}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, color: checked ? TEXT : TEXT_DIM, fontWeight: checked ? 500 : 400, flex: 1,
                }}>
                  {item.name}
                </span>
                <span style={{ fontSize: 10, color: TEXT_DIM }}>{item.category}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── TAB 2: PACK IT ─── */
function PackItTab({ checkedItems, bags, setBags, assignments, setAssignments, packedItems, setPackedItems }) {
  const items = Object.values(checkedItems).filter(Boolean);
  const [editingBags, setEditingBags] = useState(false);
  const [newBagName, setNewBagName] = useState("");
  const [addingSectionTo, setAddingSectionTo] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [addingContainerTo, setAddingContainerTo] = useState(null);
  const [newContainerName, setNewContainerName] = useState("");

  const packedCount = items.filter((i) => packedItems[i.id]).length;

  const togglePacked = (itemId) => {
    setPackedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAssign = (itemId, field, value) => {
    setAssignments((prev) => {
      const current = prev[itemId] || {};
      const updated = { ...current, [field]: value };
      // Clear downstream when parent changes
      if (field === "bag") { updated.section = ""; updated.container = ""; }
      if (field === "section") { updated.container = ""; }
      return { ...prev, [itemId]: updated };
    });
    // Auto-check as packed when a bag is assigned
    if (field === "bag" && value) {
      setPackedItems((prev) => ({ ...prev, [itemId]: true }));
    }
  };

  const addBag = () => {
    if (!newBagName.trim()) return;
    const id = "bag-" + Date.now();
    setBags((prev) => [...prev, { id, name: newBagName.trim(), icon: "🧳", type: "bag", sections: [] }]);
    setNewBagName("");
  };

  const addSection = (bagId) => {
    if (!newSectionName.trim()) return;
    setBags((prev) => prev.map((b) =>
      b.id === bagId
        ? { ...b, sections: [...b.sections, { id: "s-" + Date.now(), name: newSectionName.trim(), containers: [] }] }
        : b
    ));
    setNewSectionName("");
    setAddingSectionTo(null);
  };

  const addContainer = (bagId, sectionId) => {
    if (!newContainerName.trim()) return;
    setBags((prev) => prev.map((b) =>
      b.id === bagId
        ? {
          ...b, sections: b.sections.map((s) =>
            s.id === sectionId
              ? { ...s, containers: [...s.containers, { id: "c-" + Date.now(), name: newContainerName.trim() }] }
              : s
          )
        }
        : b
    ));
    setNewContainerName("");
    setAddingContainerTo(null);
  };

  // Build bag summary tree
  const bagSummary = bags.map((bag) => {
    const bagItems = items.filter((i) => assignments[i.id]?.bag === bag.id);
    return { ...bag, itemCount: bagItems.length, bagItems };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── BAG SETUP ── */}
      <div style={{
        background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Your Bags</div>
            <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>Set up your bags and their compartments first</div>
          </div>
          <button onClick={() => setEditingBags(!editingBags)} style={{
            background: editingBags ? `${ACCENT}30` : "rgba(255,255,255,0.06)",
            border: `1px solid ${editingBags ? ACCENT : "rgba(255,255,255,0.1)"}`,
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            color: editingBags ? ACCENT : TEXT_DIM, fontSize: 12, fontWeight: 600,
          }}>
            {editingBags ? "Done" : "Edit Bags"}
          </button>
        </div>

        {/* Bag pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {bags.map((bag) => (
            <div key={bag.id} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "8px 12px", fontSize: 13,
            }}>
              <span style={{ marginRight: 6 }}>{bag.icon}</span>
              <span style={{ color: TEXT, fontWeight: 600 }}>{bag.name}</span>
              <span style={{ color: TEXT_DIM, marginLeft: 8, fontSize: 11 }}>
                {bag.sections.length} sections
                {bag.sections.some((s) => s.containers.length > 0) &&
                  ` · ${bag.sections.reduce((n, s) => n + s.containers.length, 0)} cubes`
                }
              </span>
            </div>
          ))}
        </div>

        {/* Edit mode: show full structure */}
        {editingBags && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            {bags.map((bag) => (
              <div key={bag.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                  {bag.icon} {bag.name}
                </div>
                {bag.sections.map((section) => (
                  <div key={section.id} style={{
                    marginLeft: 16, borderLeft: "2px solid rgba(255,255,255,0.06)",
                    paddingLeft: 12, marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, padding: "4px 0" }}>
                      {section.name}
                    </div>
                    {section.containers.map((c) => (
                      <div key={c.id} style={{
                        marginLeft: 12, fontSize: 11, color: TEXT_DIM, padding: "3px 0",
                        borderLeft: "2px solid rgba(255,255,255,0.03)", paddingLeft: 10,
                      }}>
                        📦 {c.name}
                      </div>
                    ))}
                    {addingContainerTo === `${bag.id}-${section.id}` ? (
                      <div style={{ display: "flex", gap: 6, marginLeft: 12, marginTop: 4 }}>
                        <input value={newContainerName} onChange={(e) => setNewContainerName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addContainer(bag.id, section.id)}
                          placeholder="Cube name..." autoFocus
                          style={{ ...selectStyle, flex: 1, padding: "4px 8px" }} />
                        <button onClick={() => addContainer(bag.id, section.id)} style={{
                          background: ACCENT, border: "none", borderRadius: 6, color: "#fff",
                          fontSize: 11, padding: "4px 10px", cursor: "pointer",
                        }}>Add</button>
                      </div>
                    ) : (
                      <div onClick={() => { setAddingContainerTo(`${bag.id}-${section.id}`); setNewContainerName(""); }}
                        style={{ marginLeft: 12, fontSize: 11, color: ACCENT, cursor: "pointer", padding: "3px 0" }}>
                        + add cube / pouch
                      </div>
                    )}
                  </div>
                ))}
                {addingSectionTo === bag.id ? (
                  <div style={{ display: "flex", gap: 6, marginLeft: 16, marginTop: 4 }}>
                    <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSection(bag.id)}
                      placeholder="Section name..." autoFocus
                      style={{ ...selectStyle, flex: 1, padding: "4px 8px" }} />
                    <button onClick={() => addSection(bag.id)} style={{
                      background: ACCENT, border: "none", borderRadius: 6, color: "#fff",
                      fontSize: 11, padding: "4px 10px", cursor: "pointer",
                    }}>Add</button>
                  </div>
                ) : (
                  <div onClick={() => { setAddingSectionTo(bag.id); setNewSectionName(""); }}
                    style={{ marginLeft: 16, fontSize: 11, color: ACCENT, cursor: "pointer", padding: "4px 0" }}>
                    + add section
                  </div>
                )}
              </div>
            ))}

            {/* Add new bag */}
            <div style={{
              display: "flex", gap: 8, marginTop: 8, paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.04)",
            }}>
              <input value={newBagName} onChange={(e) => setNewBagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBag()}
                placeholder="New bag name (e.g. Checked Suitcase, Tote)..."
                style={{ ...selectStyle, flex: 1, padding: "6px 10px", fontSize: 12 }} />
              <button onClick={addBag} style={{
                background: ACCENT, border: "none", borderRadius: 8, color: "#fff",
                fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 600,
              }}>+ Add Bag</button>
            </div>
          </div>
        )}
      </div>

      {/* ── PROGRESS ── */}
      <div style={{
        background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: TEXT_DIM }}>Packed</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: packedCount === items.length && items.length > 0 ? GREEN : ACCENT }}>{packedCount}</span>
            <span style={{ color: TEXT_DIM }}> / {items.length}</span>
          </span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, transition: "width 0.3s",
            width: items.length > 0 ? `${(packedCount / items.length) * 100}%` : "0%",
            background: packedCount === items.length && items.length > 0 ? GREEN : ACCENT,
          }} />
        </div>
      </div>

      {items.length === 0 && (
        <div style={{
          background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
          padding: 32, textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👈</div>
          <div style={{ fontSize: 14, color: TEXT_DIM }}>Check off items in "What's Coming" first</div>
        </div>
      )}

      {/* ── ITEM LIST: CHECKBOX + OPTIONAL DROPDOWNS ── */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item) => {
            const a = assignments[item.id] || {};
            const isPacked = !!packedItems[item.id];
            const selectedBag = bags.find((b) => b.id === a.bag);
            const selectedSection = selectedBag?.sections.find((s) => s.id === a.section);
            const color = CATEGORY_COLORS[item.category] || ACCENT;
            return (
              <div key={item.id} style={{
                background: isPacked ? `${GREEN}08` : CARD,
                border: `1px solid ${isPacked ? `${GREEN}20` : CARD_BORDER}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                {/* Item name row with checkbox */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div onClick={() => togglePacked(item.id)} style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    border: `2px solid ${isPacked ? GREEN : "rgba(255,255,255,0.15)"}`,
                    background: isPacked ? GREEN : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: "#fff", transition: "all 0.15s",
                  }}>
                    {isPacked && "✓"}
                  </div>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 13, fontWeight: 600, flex: 1,
                    color: isPacked ? TEXT_DIM : TEXT,
                    textDecoration: isPacked ? "line-through" : "none",
                  }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>{item.category}</span>
                </div>
                {/* Optional dropdown row — organize if you want */}
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={a.bag || ""} onChange={(e) => handleAssign(item.id, "bag", e.target.value)} style={selectStyle}>
                    <option value="">Bag...</option>
                    {bags.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                  </select>
                  <select value={a.section || ""} onChange={(e) => handleAssign(item.id, "section", e.target.value)}
                    style={{ ...selectStyle, opacity: selectedBag ? 1 : 0.3 }} disabled={!selectedBag}>
                    <option value="">Section...</option>
                    {selectedBag?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={a.container || ""} onChange={(e) => handleAssign(item.id, "container", e.target.value)}
                    style={{ ...selectStyle, opacity: selectedSection?.containers.length ? 1 : 0.3 }}
                    disabled={!selectedSection || selectedSection.containers.length === 0}>
                    <option value="">Cube...</option>
                    {selectedSection?.containers.map((c) => <option key={c.id} value={c.id}>📦 {c.name}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIVE BAG SUMMARY ── */}
      {bagSummary.some((b) => b.itemCount > 0) && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Bag Summary</div>
          {bagSummary.filter((b) => b.itemCount > 0).map((bag) => (
            <div key={bag.id} style={{
              background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
              padding: 14, marginBottom: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{bag.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{bag.name}</span>
                <span style={{ fontSize: 12, color: TEXT_DIM }}>({bag.itemCount} items)</span>
              </div>
              {bag.sections.map((section) => {
                const sectionItems = bag.bagItems.filter((i) => assignments[i.id]?.section === section.id);
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section.id} style={{
                    marginLeft: 10, borderLeft: "2px solid rgba(255,255,255,0.06)",
                    paddingLeft: 12, marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{section.name}</div>
                    {section.containers.map((container) => {
                      const cItems = sectionItems.filter((i) => assignments[i.id]?.container === container.id);
                      if (cItems.length === 0) return null;
                      return (
                        <div key={container.id} style={{
                          marginLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.03)",
                          paddingLeft: 10, marginBottom: 4,
                        }}>
                          <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 2 }}>📦 {container.name}</div>
                          {cItems.map((item) => (
                            <div key={item.id} style={{
                              fontSize: 12, color: TEXT, padding: "2px 0", display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <span style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: CATEGORY_COLORS[item.category] || ACCENT,
                              }} />
                              {item.name}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {/* Items directly in section (no container) */}
                    {sectionItems.filter((i) => !assignments[i.id]?.container).map((item) => (
                      <div key={item.id} style={{
                        fontSize: 12, color: TEXT, padding: "2px 0", display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: CATEGORY_COLORS[item.category] || ACCENT,
                        }} />
                        {item.name}
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* Items in bag but no section selected */}
              {bag.bagItems.filter((i) => !assignments[i.id]?.section).map((item) => (
                <div key={item.id} style={{
                  fontSize: 12, color: TEXT, padding: "2px 0 2px 10px", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: CATEGORY_COLORS[item.category] || ACCENT,
                  }} />
                  {item.name}
                  <span style={{ fontSize: 10, color: ORANGE }}>no section</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN ─── */
export default function PackingMockup() {
  const [tab, setTab] = useState("whats-coming");
  const [checkedItems, setCheckedItems] = useState({});
  const [bags, setBags] = useState(INITIAL_BAGS);
  const [assignments, setAssignments] = useState({});
  const [packedItems, setPackedItems] = useState({});

  const handleToggle = (id, item) => {
    setCheckedItems((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
        setAssignments((a) => { const na = { ...a }; delete na[id]; return na; });
        setPackedItems((p) => { const np = { ...p }; delete np[id]; return np; });
      } else {
        next[id] = item;
      }
      return next;
    });
  };

  const tabs = [
    { id: "whats-coming", icon: "☑️", title: "What's Coming", subtitle: "Check off by event" },
    { id: "pack-it", icon: "🧳", title: "Pack It", subtitle: "Assign to bags" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: BG, color: TEXT,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "24px 20px", maxWidth: 600, margin: "0 auto",
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Cancún 2026
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0 }}>Packing</h1>
        <div style={{ fontSize: 13, color: TEXT_DIM, marginTop: 4 }}>Joe's packing view · 4 events</div>
      </div>

      <TabBar active={tab} onChange={setTab} tabs={tabs} />

      <div style={{ marginTop: 20 }}>
        {tab === "whats-coming" && (
          <WhatsComingTab events={INITIAL_EVENTS} checkedItems={checkedItems} onToggle={handleToggle} />
        )}
        {tab === "pack-it" && (
          <PackItTab checkedItems={checkedItems} bags={bags} setBags={setBags}
            assignments={assignments} setAssignments={setAssignments}
            packedItems={packedItems} setPackedItems={setPackedItems} />
        )}
      </div>
    </div>
  );
}