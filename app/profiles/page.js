"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { THEMES, AGE_TYPES, APPETITE_TYPES, ITEM_CATEGORIES, CAR_ZONES } from "@/lib/constants";
import { ageIcon, catIcon } from "@/lib/utils";

export default function ProfilesPage() {
  const [user, setUser] = useState(null);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newMemName, setNewMemName] = useState("");
  const [newMemAge, setNewMemAge] = useState("adult");
  const [newMemApp, setNewMemApp] = useState("normal");
  const supabase = createClient();
  const router = useRouter();
  const th = THEMES.home;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUser(user);
    const { data } = await supabase
      .from("families")
      .select("*, family_members(*), inventory_bins(*, inventory_items:inventory_items(*))")
      .eq("owner_id", user.id)
      .order("created_at");
    if (data) setFamilies(data);
    setLoading(false);
  };

  const addFamily = async () => {
    const name = newName.trim() || "New Family";
    const { data } = await supabase.from("families").insert({ owner_id: user.id, name }).select("*, family_members(*), inventory_bins(*, inventory_items:inventory_items(*))").single();
    if (data) { setFamilies((f) => [...f, data]); setEditId(data.id); setNewName(""); }
  };

  const updateFamily = async (id, field, value) => {
    await supabase.from("families").update({ [field]: value }).eq("id", id);
    setFamilies((f) => f.map((x) => x.id === id ? { ...x, [field]: value } : x));
  };

  const deleteFamily = async (id) => {
    await supabase.from("families").delete().eq("id", id);
    setFamilies((f) => f.filter((x) => x.id !== id));
    if (editId === id) setEditId(null);
  };

  const addMember = async (famId) => {
    if (!newMemName.trim()) return;
    const { data } = await supabase.from("family_members").insert({
      family_id: famId, name: newMemName.trim(), age_type: newMemAge, appetite: newMemApp,
    }).select().single();
    if (data) {
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: [...(x.family_members || []), data] } : x));
      setNewMemName("");
    }
  };

  const deleteMember = async (famId, memId) => {
    await supabase.from("family_members").delete().eq("id", memId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: (x.family_members || []).filter((m) => m.id !== memId) } : x));
  };

  const updateMember = async (famId, memId, field, value) => {
    await supabase.from("family_members").update({ [field]: value }).eq("id", memId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: (x.family_members || []).map((m) => m.id === memId ? { ...m, [field]: value } : m) } : x));
  };

  const addBin = async (famId) => {
    const { data } = await supabase.from("inventory_bins").insert({ family_id: famId, name: "New Bin" }).select("*, inventory_items:inventory_items(*)").single();
    if (data) {
      data.inventory_items = data.inventory_items || [];
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: [...(x.inventory_bins || []), data] } : x));
    }
  };

  const updateBin = async (famId, binId, field, value) => {
    await supabase.from("inventory_bins").update({ [field]: value }).eq("id", binId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, [field]: value } : b) } : x));
  };

  const deleteBin = async (famId, binId) => {
    await supabase.from("inventory_bins").delete().eq("id", binId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).filter((b) => b.id !== binId) } : x));
  };

  const addBinItem = async (famId, binId) => {
    const { data } = await supabase.from("inventory_items").insert({ family_id: famId, bin_id: binId, name: "" }).select().single();
    if (data) {
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: [...(b.inventory_items || []), data] } : b) } : x));
    }
  };

  const updateBinItem = async (famId, binId, itemId, field, value) => {
    await supabase.from("inventory_items").update({ [field]: value }).eq("id", itemId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: (b.inventory_items || []).map((i) => i.id === itemId ? { ...i, [field]: value } : i) } : b) } : x));
  };

  const deleteBinItem = async (famId, binId, itemId) => {
    await supabase.from("inventory_items").delete().eq("id", itemId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: (b.inventory_items || []).filter((i) => i.id !== itemId) } : b) } : x));
  };

  const editFam = editId ? families.find((f) => f.id === editId) : null;

  if (loading) return <div style={{ minHeight: "100vh", background: th.bg, display: "flex", alignItems: "center", justifyContent: "center", color: th.text, opacity: 0.5 }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text }}>
      <div style={{ background: "linear-gradient(90deg, #4a3000, #6d4500)", padding: "20px 24px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1 className="display" style={{ fontSize: "24px", margin: 0 }}>👥 Family Profiles</h1>
          <p style={{ opacity: 0.4, fontSize: "13px", marginTop: "4px" }}>Permanent members, gear, and inventory</p>
        </div>
        <button onClick={() => { setEditId(null); router.push("/dashboard"); }} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)" }}>← Dashboard</button>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        {!editFam ? (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFamily()} placeholder="Family name" className="input-modern" style={{ maxWidth: "300px" }} />
              <button onClick={addFamily} className="btn" style={{ background: th.accent }}>+ New Family</button>
            </div>

            {families.length === 0 && <div className="card-glass" style={{ padding: "32px", textAlign: "center", opacity: 0.5 }}>No family profiles yet.</div>}

            {families.map((f) => (
              <div key={f.id} className="card-glass slide-in" style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setEditId(f.id)}>
                <div>
                  <div style={{ fontWeight: 700 }}>🏠 {f.name}</div>
                  <div style={{ fontSize: "12px", opacity: 0.5 }}>
                    {(f.family_members || []).length} members · {(f.inventory_bins || []).length} bins
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={(e) => { e.stopPropagation(); deleteFamily(f.id); }} className="btn btn-sm" style={{ background: "rgba(160,50,50,0.5)", opacity: 0.7 }}>Delete</button>
                  <span style={{ opacity: 0.3 }}>Edit →</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fade-in">
            <button onClick={() => setEditId(null)} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)", marginBottom: "16px" }}>← All Profiles</button>

            {/* Family Name */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, opacity: 0.5, display: "block", marginBottom: "6px" }}>Family Name</label>
              <input value={editFam.name} onChange={(e) => updateFamily(editFam.id, "name", e.target.value)} className="input-modern" style={{ fontSize: "18px", fontWeight: 700 }} />
            </div>

            {/* Members */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "12px" }}>👨‍👩‍👧‍👦 Members</h3>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                <input placeholder="Name" value={newMemName} onChange={(e) => setNewMemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember(editFam.id)} className="input-modern" style={{ flex: "1 1 100px", minWidth: "80px" }} />
                <select value={newMemAge} onChange={(e) => setNewMemAge(e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                </select>
                <select value={newMemApp} onChange={(e) => setNewMemApp(e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <button onClick={() => addMember(editFam.id)} className="btn btn-sm" style={{ background: th.accent }}>+</button>
              </div>
              {(editFam.family_members || []).map((m) => (
                <div key={m.id} className="card-glass" style={{ padding: "8px 12px", marginBottom: "4px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{ageIcon(m.age_type)} {m.name}</span>
                  <select value={m.age_type || "adult"} onChange={(e) => updateMember(editFam.id, m.id, "age_type", e.target.value)} className="input-modern" style={{ width: "auto", padding: "3px 6px", fontSize: "11px" }}>
                    {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                  </select>
                  {m.age_type !== "baby" && (
                    <select value={m.appetite || "normal"} onChange={(e) => updateMember(editFam.id, m.id, "appetite", e.target.value)} className="input-modern" style={{ width: "auto", padding: "3px 6px", fontSize: "11px" }}>
                      {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  )}
                  <span onClick={() => deleteMember(editFam.id, m.id)} style={{ cursor: "pointer", opacity: 0.3, fontSize: "11px", marginLeft: "auto" }}>✕</span>
                </div>
              ))}
            </div>

            {/* Car Snack Prefs */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "12px" }}>🚗 Car Snack Preferences</h3>
              <textarea value={editFam.car_snack_pref || ""} onChange={(e) => updateFamily(editFam.id, "car_snack_pref", e.target.value)} placeholder="Goldfish, juice boxes, trail mix..." className="input-modern" rows={3} style={{ resize: "vertical" }} />
            </div>

            {/* Inventory Bins */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, margin: 0 }}>📦 Inventory Bins</h3>
                <button onClick={() => addBin(editFam.id)} className="btn btn-sm" style={{ background: th.accent }}>+ Bin</button>
              </div>

              {(editFam.inventory_bins || []).map((bin) => (
                <div key={bin.id} className="card-glass" style={{ marginBottom: "10px", borderLeft: `3px solid ${th.accent}` }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <input value={bin.name} onChange={(e) => updateBin(editFam.id, bin.id, "name", e.target.value)} className="input-modern" style={{ flex: "1 1 150px", fontWeight: 600 }} />
                    <select value={bin.zone || "none"} onChange={(e) => updateBin(editFam.id, bin.id, "zone", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                      {CAR_ZONES.map((z) => <option key={z.value} value={z.value}>🚗 {z.label}</option>)}
                    </select>
                    <button onClick={() => deleteBin(editFam.id, bin.id)} className="btn btn-sm" style={{ background: "rgba(160,50,50,0.5)" }}>✕</button>
                  </div>

                  {(bin.inventory_items || []).map((item) => (
                    <div key={item.id} style={{ display: "flex", gap: "4px", marginBottom: "3px", alignItems: "center", flexWrap: "wrap", background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "5px 8px" }}>
                      <input value={item.name} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "name", e.target.value)} placeholder="Item name" className="input-modern" style={{ flex: "1 1 100px", minWidth: "70px", padding: "5px 8px", fontSize: "12px" }} />
                      <select value={item.category || "gear"} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "category", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "11px", padding: "3px" }}>
                        {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                      </select>
                      <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "2px", opacity: 0.6 }}>
                        <input type="checkbox" checked={item.is_consumable || false} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "is_consumable", e.target.checked)} /> Consumable
                      </label>
                      {item.is_consumable && (
                        <input type="number" min="1" value={item.qty_needed || 1} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "qty_needed", parseInt(e.target.value) || 1)} className="input-modern" style={{ width: "45px", fontSize: "11px", padding: "3px" }} />
                      )}
                      <span onClick={() => deleteBinItem(editFam.id, bin.id, item.id)} style={{ cursor: "pointer", opacity: 0.3, fontSize: "11px" }}>✕</span>
                    </div>
                  ))}
                  <button onClick={() => addBinItem(editFam.id, bin.id)} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.08)", color: th.text, marginTop: "4px", fontSize: "11px" }}>+ Item</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
