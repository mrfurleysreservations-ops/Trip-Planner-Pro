"use client";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";
import type { SavedGear } from "@/types/database.types";

const GEAR_CATEGORIES = [
  { value: "camping", label: "Camping", icon: "🏕️" },
  { value: "cooking", label: "Cooking", icon: "🍳" },
  { value: "electronics", label: "Electronics", icon: "🔌" },
  { value: "clothing", label: "Clothing", icon: "👕" },
  { value: "safety", label: "Safety", icon: "🩹" },
  { value: "tools", label: "Tools", icon: "🔧" },
  { value: "comfort", label: "Comfort", icon: "🛏️" },
  { value: "water", label: "Water/Swim", icon: "🏊" },
  { value: "travel", label: "Travel", icon: "✈️" },
  { value: "other", label: "Other", icon: "📦" },
];

const catEmoji: Record<string, string> = {};
GEAR_CATEGORIES.forEach((c) => { catEmoji[c.value] = c.icon; });

interface GearPageProps {
  userId: string;
  initialGear: SavedGear[];
}

export default function GearPage({ userId, initialGear }: GearPageProps) {
  const [gear, setGear] = useState<SavedGear[]>(initialGear);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("other");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState("");
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const th = THEMES.home;

  const grouped = gear.reduce<Record<string, SavedGear[]>>((acc, g) => {
    const key = g.category || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const addGear = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data } = await supabase.from("saved_gear").insert({
      owner_id: userId,
      name,
      category: newCat,
    }).select().single();
    if (data) {
      setGear((prev) => [...prev, data as SavedGear]);
      setNewName("");
    }
  };

  const startEdit = (g: SavedGear) => {
    setEditId(g.id);
    setEditName(g.name);
    setEditCat(g.category || "other");
  };

  const saveEdit = async () => {
    if (!editId) return;
    await supabase.from("saved_gear").update({ name: editName, category: editCat }).eq("id", editId);
    setGear((prev) => prev.map((g) => g.id === editId ? { ...g, name: editName, category: editCat } : g));
    setEditId(null);
  };

  const deleteGear = async (id: string) => {
    await supabase.from("saved_gear").delete().eq("id", id);
    setGear((prev) => prev.filter((g) => g.id !== id));
    if (editId === id) setEditId(null);
  };

  const deleteAll = async () => {
    await supabase.from("saved_gear").delete().eq("owner_id", userId);
    setGear([]);
    setEditId(null);
  };

  return (
    <div style={{ color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 24px" }}>
        {/* Add gear */}
        <div className="card-glass" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGear()}
            placeholder="Gear name (e.g., Tent, Cooler, Headlamp)"
            className="input-modern"
            style={{ flex: 1, minWidth: "160px" }}
          />
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="input-modern" style={{ width: "auto", minWidth: "130px" }}>
            {GEAR_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
            ))}
          </select>
          <button onClick={addGear} className="btn" style={{ background: th.accent, whiteSpace: "nowrap" }}>+ Add Gear</button>
          {gear.length > 0 && (
            <button onClick={deleteAll} className="btn btn-sm" style={{ background: "#e74c3c", whiteSpace: "nowrap" }}>🗑 Delete All</button>
          )}
        </div>

        {/* Gear grouped by category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="card-glass" style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "42px", marginBottom: "10px" }}>⚙️</div>
            <p style={{ opacity: 0.5, fontSize: "15px" }}>No saved gear yet. Add your first item above!</p>
          </div>
        ) : (
          GEAR_CATEGORIES.filter((c) => grouped[c.value]).map((cat) => (
            <div key={cat.value} style={{ marginBottom: "24px" }}>
              <h2 className="display" style={{ fontSize: "18px", marginBottom: "12px" }}>{cat.icon} {cat.label}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {grouped[cat.value].map((g) => (
                  <div key={g.id} className="card-glass slide-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {editId === g.id ? (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, flexWrap: "wrap" }}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-modern" style={{ flex: 1, minWidth: "120px" }} />
                        <select value={editCat} onChange={(e) => setEditCat(e.target.value)} className="input-modern" style={{ width: "auto", minWidth: "120px" }}>
                          {GEAR_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                        <button onClick={saveEdit} className="btn btn-sm" style={{ background: th.accent }}>Save</button>
                        <button onClick={() => setEditId(null)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{catEmoji[g.category || "other"] || "📦"} {g.name}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => startEdit(g)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a", fontSize: "11px" }}>Edit</button>
                          <button onClick={() => deleteGear(g.id)} className="btn btn-sm" style={{ background: "#e74c3c", fontSize: "11px" }}>✕</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
