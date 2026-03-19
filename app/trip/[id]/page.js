"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useParams, useRouter } from "next/navigation";
import { TRIP_TYPES, THEMES, AGE_TYPES, APPETITE_TYPES, ITEM_CATEGORIES, CAR_ZONES, MEALS, SUGGESTED_MEALS } from "@/lib/constants";
import { getPortionCount, scaleIngredientLine, generateDays, formatDate, mealIcon, ageIcon, catIcon } from "@/lib/utils";

const Chk = ({ checked, onClick, accent = "#7cb342" }) => (
  <div onClick={onClick} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${checked ? accent : "rgba(255,255,255,0.15)"}`, background: checked ? accent : "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.2s" }}>
    {checked && <span style={{ color: "#fff", fontSize: "13px", fontWeight: 700 }}>✓</span>}
  </div>
);

export default function TripPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("setup");
  const [actFam, setActFam] = useState("all");
  const [invView, setInvView] = useState("bins");

  // Trip core (from `trips` table)
  const [trip, setTrip] = useState(null);
  // Trip families (from `trip_families` table)
  const [families, setFamilies] = useState([]);
  // Trip data (from `trip_data` table — JSON fields)
  const [att, setAtt] = useState({});
  const [meals, setMeals] = useState({});
  const [carSnacks, setCarSnacks] = useState({});
  const [campSnacks, setCampSnacks] = useState("");
  const [campSnackFam, setCampSnackFam] = useState("");
  const [drinks, setDrinks] = useState({ na: "", alc: "" });
  const [drinkFam, setDrinkFam] = useState({ na: "", alc: "" });
  const [babyItems, setBabyItems] = useState({});
  // Trip inventory (from `trip_inventory` table — per family)
  const [tripInv, setTripInv] = useState({}); // { tripFamilyId: { bins: [], loose: [] } }

  const [suggestFor, setSuggestFor] = useState(null);
  const saveRef = useRef(null);

  // ─── Load everything ───
  useEffect(() => {
    (async () => {
      const { data: tripData } = await supabase.from("trips").select("*").eq("id", id).single();
      if (!tripData) { router.push("/dashboard"); return; }
      setTrip(tripData);

      const { data: fams } = await supabase.from("trip_families").select("*").eq("trip_id", id);
      setFamilies(fams || []);

      const { data: td } = await supabase.from("trip_data").select("*").eq("trip_id", id).single();
      if (td) {
        setAtt(td.attendance || {});
        setMeals(td.meals || {});
        setCarSnacks(td.car_snacks || {});
        setCampSnacks(td.camp_snacks || "");
        setCampSnackFam(td.camp_snack_family || "");
        setDrinks(td.drinks || { na: "", alc: "" });
        setDrinkFam(td.drink_family || { na: "", alc: "" });
        setBabyItems(td.baby_items || {});
      }

      const { data: inv } = await supabase.from("trip_inventory").select("*").eq("trip_id", id);
      if (inv) {
        const invMap = {};
        inv.forEach((row) => { invMap[row.trip_family_id] = { id: row.id, bins: row.bins || [], loose: row.loose_items || [] }; });
        setTripInv(invMap);
      }

      setLoading(false);
    })();
  }, [id]);

  // ─── Auto-save trip_data (debounced) ───
  const tripDataState = useMemo(() => ({
    attendance: att, meals, car_snacks: carSnacks, camp_snacks: campSnacks,
    camp_snack_family: campSnackFam, drinks, drink_family: drinkFam, baby_items: babyItems,
  }), [att, meals, carSnacks, campSnacks, campSnackFam, drinks, drinkFam, babyItems]);

  useEffect(() => {
    if (loading) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      await supabase.from("trip_data").update(tripDataState).eq("trip_id", id);
    }, 1000);
    return () => clearTimeout(saveRef.current);
  }, [tripDataState, loading, id]);

  // Save inventory for a specific family
  const saveInv = useCallback(async (tfId) => {
    const data = tripInv[tfId];
    if (!data) return;
    if (data.id) {
      await supabase.from("trip_inventory").update({ bins: data.bins, loose_items: data.loose }).eq("id", data.id);
    } else {
      const { data: row } = await supabase.from("trip_inventory").insert({ trip_id: id, trip_family_id: tfId, bins: data.bins, loose_items: data.loose }).select().single();
      if (row) setTripInv((prev) => ({ ...prev, [tfId]: { ...prev[tfId], id: row.id } }));
    }
  }, [tripInv, id, supabase]);

  // Debounced inventory save
  const invSaveRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    if (invSaveRef.current) clearTimeout(invSaveRef.current);
    invSaveRef.current = setTimeout(() => {
      Object.keys(tripInv).forEach((tfId) => saveInv(tfId));
    }, 1000);
    return () => clearTimeout(invSaveRef.current);
  }, [tripInv, loading, saveInv]);

  const updateTrip = async (field, value) => {
    await supabase.from("trips").update({ [field]: value }).eq("id", id);
    setTrip((t) => ({ ...t, [field]: value }));
  };

  // ─── Helpers ───
  const days = useMemo(() => generateDays(trip?.start_date, trip?.end_date), [trip?.start_date, trip?.end_date]);
  const togAtt = (fid, key) => setAtt((a) => ({ ...a, [fid]: { ...a[fid], [key]: !a[fid]?.[key] } }));
  const updMeal = (key, f, v) => setMeals((m) => ({ ...m, [key]: { ...m[key], [f]: v } }));
  const getHC = (key) => { let c = 0; families.forEach((f) => { if (att[f.id]?.[key]) c += (f.members || []).length; }); return c; };
  const hasBabies = useMemo(() => families.some((f) => (f.members || []).some((m) => m.age_type === "baby" || m.ageType === "baby")), [families]);
  const visFams = actFam === "all" ? families : families.filter((f) => f.id === actFam);

  // Inventory helpers (operate on tripInv state)
  const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const addBin = (tfId) => {
    setTripInv((prev) => {
      const fam = prev[tfId] || { bins: [], loose: [] };
      return { ...prev, [tfId]: { ...fam, bins: [...fam.bins, { id: gid(), name: "New Bin", zone: "none", items: [] }] } };
    });
  };
  const updBin = (tfId, binId, field, val) => {
    setTripInv((prev) => {
      const fam = prev[tfId]; if (!fam) return prev;
      return { ...prev, [tfId]: { ...fam, bins: fam.bins.map((b) => b.id === binId ? { ...b, [field]: val } : b) } };
    });
  };
  const remBin = (tfId, binId) => {
    setTripInv((prev) => {
      const fam = prev[tfId]; if (!fam) return prev;
      return { ...prev, [tfId]: { ...fam, bins: fam.bins.filter((b) => b.id !== binId) } };
    });
  };
  const addBinItem = (tfId, binId) => {
    setTripInv((prev) => {
      const fam = prev[tfId]; if (!fam) return prev;
      return { ...prev, [tfId]: { ...fam, bins: fam.bins.map((b) => b.id === binId ? { ...b, items: [...b.items, { id: gid(), name: "", category: "gear", isConsumable: false, qtyNeeded: 1, packed: false }] } : b) } };
    });
  };
  const updBinItem = (tfId, binId, itemId, field, val) => {
    setTripInv((prev) => {
      const fam = prev[tfId]; if (!fam) return prev;
      return { ...prev, [tfId]: { ...fam, bins: fam.bins.map((b) => b.id === binId ? { ...b, items: b.items.map((i) => i.id === itemId ? { ...i, [field]: val } : i) } : b) } };
    });
  };
  const remBinItem = (tfId, binId, itemId) => {
    setTripInv((prev) => {
      const fam = prev[tfId]; if (!fam) return prev;
      return { ...prev, [tfId]: { ...fam, bins: fam.bins.map((b) => b.id === binId ? { ...b, items: b.items.filter((i) => i.id !== itemId) } : b) } };
    });
  };

  // Dupe detection across all families
  const dupeMap = useMemo(() => {
    const map = {};
    Object.entries(tripInv).forEach(([tfId, data]) => {
      (data.bins || []).forEach((b) => b.items.forEach((i) => {
        if (!i.name?.trim()) return;
        const k = i.name.toLowerCase().trim();
        if (!map[k]) map[k] = [];
        map[k].push(tfId);
      }));
      (data.loose || []).forEach((i) => {
        if (!i.name?.trim()) return;
        const k = i.name.toLowerCase().trim();
        if (!map[k]) map[k] = [];
        map[k].push(tfId);
      });
    });
    return map;
  }, [tripInv]);

  const isDupe = (name) => {
    const k = name?.toLowerCase().trim();
    if (!k) return null;
    const e = dupeMap[k] || [];
    const u = [...new Set(e)];
    return u.length > 1 ? u.map((tfId) => families.find((f) => f.id === tfId)?.name || "?") : null;
  };

  // All items flat for checklist
  const allItemsForFam = (tfId) => {
    const data = tripInv[tfId];
    if (!data) return [];
    const items = [];
    (data.bins || []).forEach((b) => (b.items || []).forEach((i) => items.push({ ...i, binId: b.id, binName: b.name, zone: b.zone })));
    (data.loose || []).forEach((i) => items.push({ ...i, binId: null, binName: "Loose" }));
    return items;
  };

  // Grocery
  const grocery = useMemo(() => {
    const r = {};
    families.forEach((f) => { r[f.id] = { name: f.name, mealItems: [], restockItems: [] }; });
    Object.entries(meals).forEach(([key, meal]) => {
      if (!meal?.assignedFamily || !meal?.ingredients || !r[meal.assignedFamily]) return;
      const p = getPortionCount(families.map((f) => ({ ...f, members: f.members || [] })), att, key);
      const base = meal.baseServings || 4;
      const lines = meal.ingredients.split("\n").filter((l) => l.trim());
      const scaled = lines.map((l) => scaleIngredientLine(l, p.total, base));
      r[meal.assignedFamily].mealItems.push({ meal: meal.name || key, ingredients: scaled, orig: lines, portions: p, base });
    });
    Object.entries(tripInv).forEach(([tfId, data]) => {
      if (!r[tfId]) return;
      (data.bins || []).forEach((b) => (b.items || []).forEach((i) => { if (i.isConsumable) r[tfId].restockItems.push(i); }));
      (data.loose || []).forEach((i) => { if (i.isConsumable && r[tfId]) r[tfId].restockItems.push(i); });
    });
    return r;
  }, [meals, families, att, tripInv]);

  if (loading || !trip) return <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8e6e3", opacity: 0.5 }}>Loading...</div>;

  const tt = TRIP_TYPES.find((t) => t.value === trip.trip_type) || TRIP_TYPES[0];
  const th = THEMES[trip.trip_type] || THEMES.camping;

  const campTabs = [["setup", "📅", "Setup"], ["attendance", "✋", "Attendance"], ["meals", "🍳", "Meals"], ["snacks", "🥨", "Snacks"], ["inventory", "📦", "Inventory"], ...(hasBabies ? [["baby", "🍼", "Baby"]] : []), ["grocery", "🛒", "Grocery"]];
  const curTabs = trip.trip_type === "camping" ? campTabs : [["setup", "📅", "Setup"]];

  const tabStyle = (active) => ({ padding: "8px 16px", background: active ? th.accent : "rgba(255,255,255,0.05)", color: active ? "#fff" : th.muted, border: `1.5px solid ${active ? th.accent : (th.cardBorder || "rgba(255,255,255,0.1)")}`, borderRadius: "10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: active ? 700 : 500, display: "inline-flex", alignItems: "center", gap: "5px" });

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}

      {/* Header */}
      <div style={{ background: th.headerBg, padding: "14px 20px", backdropFilter: "blur(20px)", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push("/dashboard")} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)" }}>← Dashboard</button>
          <div>
            <input value={trip.name} onChange={(e) => updateTrip("name", e.target.value)} style={{ background: "transparent", border: "none", color: th.text, fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 800, outline: "none", width: "100%", minWidth: "120px" }} />
            <div style={{ fontSize: "11px", opacity: 0.5 }}>
              {tt.icon} {tt.label}{trip.location && ` · 📍 ${trip.location}`}
              {days.length > 0 && ` · ${formatDate(days[0])} — ${formatDate(days[days.length - 1])}`}
            </div>
          </div>
        </div>
        <select value={actFam} onChange={(e) => setActFam(e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "11px", padding: "5px 8px" }}>
          <option value="all">🔧 All</option>
          {families.map((f) => <option key={f.id} value={f.id}>🏠 {f.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", padding: "10px 20px", background: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${th.cardBorder}`, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        {curTabs.map(([k, ic, lb]) => <button key={k} onClick={() => setTab(k)} style={tabStyle(tab === k)}>{ic} {lb}</button>)}
      </div>

      <div style={{ padding: "20px", maxWidth: "960px", margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* SETUP */}
        {tab === "setup" && (
          <div className="fade-in">
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>🏷️ Trip Details</h3>
            <div className="card-glass" style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <input value={trip.name} onChange={(e) => updateTrip("name", e.target.value)} placeholder="Trip name" className="input-modern" style={{ fontSize: "16px", fontWeight: 600 }} />
              <input value={trip.location || ""} onChange={(e) => updateTrip("location", e.target.value)} placeholder="📍 Location" className="input-modern" />
              <textarea value={trip.notes || ""} onChange={(e) => updateTrip("notes", e.target.value)} placeholder="📝 Notes..." className="input-modern" rows={2} style={{ resize: "vertical" }} />
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "12px", opacity: 0.5 }}>Start <input type="date" value={trip.start_date || ""} onChange={(e) => updateTrip("start_date", e.target.value)} className="input-modern" style={{ width: "auto", marginLeft: "6px" }} /></label>
                <label style={{ fontSize: "12px", opacity: 0.5 }}>End <input type="date" value={trip.end_date || ""} onChange={(e) => updateTrip("end_date", e.target.value)} className="input-modern" style={{ width: "auto", marginLeft: "6px" }} /></label>
                {days.length > 0 && <span className="badge" style={{ background: th.accent, alignSelf: "flex-end" }}>{days.length} days</span>}
              </div>
            </div>

            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>👨‍👩‍👧‍👦 Families on this trip</h3>
            {families.length === 0 && <div className="card-glass" style={{ padding: "24px", textAlign: "center", opacity: 0.5 }}>No families added yet. Add families from the trip creation flow.</div>}
            {families.map((fam) => (
              <div key={fam.id} className="card-glass" style={{ marginBottom: "8px" }}>
                <strong>🏠 {fam.name}</strong>
                <div style={{ marginTop: "4px" }}>
                  {(fam.members || []).map((m, i) => (
                    <div key={i} style={{ fontSize: "13px", opacity: 0.7, marginBottom: "2px" }}>
                      {ageIcon(m.age_type || m.ageType)} {m.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === "attendance" && (
          <div className="fade-in">
            {days.length === 0 ? <div className="card-glass" style={{ padding: "32px", textAlign: "center", opacity: 0.5 }}>Set trip dates first.</div> :
              visFams.map((fam) => (
                <div key={fam.id} style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>🏠 {fam.name}</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "380px" }}>
                      <thead><tr>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${th.cardBorder}`, fontSize: "12px", opacity: 0.6 }}>Day</th>
                        {MEALS.map((m) => <th key={m} style={{ padding: "8px", borderBottom: `1px solid ${th.cardBorder}`, fontSize: "12px", textAlign: "center", opacity: 0.6 }}>{mealIcon(m)} {m}</th>)}
                      </tr></thead>
                      <tbody>
                        {days.map((day) => (
                          <tr key={day} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "8px", fontWeight: 600, fontSize: "13px" }}>{formatDate(day)}</td>
                            {MEALS.map((meal) => (
                              <td key={meal} style={{ textAlign: "center", padding: "8px" }}>
                                <Chk checked={!!att[fam.id]?.[`${day}-${meal}`]} onClick={() => togAtt(fam.id, `${day}-${meal}`)} accent={th.accent} />
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr><td style={{ padding: "8px" }}>
                          <button onClick={() => { const k = {}; days.forEach((d) => MEALS.forEach((m) => { k[`${d}-${m}`] = true; })); setAtt((a) => ({ ...a, [fam.id]: k })); }} className="btn btn-sm" style={{ background: th.accent }}>All</button>{" "}
                          <button onClick={() => setAtt((a) => ({ ...a, [fam.id]: {} }))} className="btn btn-sm" style={{ background: "rgba(160,50,50,0.5)" }}>Clear</button>
                        </td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* MEALS */}
        {tab === "meals" && (
          <div className="fade-in">
            {days.map((day) => (
              <div key={day} style={{ marginBottom: "20px" }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>📆 {formatDate(day)}</h3>
                {MEALS.map((meal) => {
                  const key = `${day}-${meal}`;
                  const md = meals[key] || {};
                  const hc = getHC(key);
                  const p = getPortionCount(families.map((f) => ({ ...f, members: f.members || [] })), att, key);
                  const attF = families.filter((f) => att[f.id]?.[key]);
                  const assF = families.find((f) => f.id === md.assignedFamily);
                  return (
                    <div key={meal} className="card-glass" style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span>{mealIcon(meal)}</span><strong>{meal}</strong>
                          <span className="badge" style={{ background: hc > 0 ? th.accent : th.muted }}>{hc} ppl</span>
                          <span className="badge" style={{ background: th.accent2 || th.accent }}>~{p.total}</span>
                          {assF && <span className="badge" style={{ background: "#c75a2a" }}>🍴 {assF.name}</span>}
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button onClick={() => setSuggestFor(key)} className="btn btn-sm" style={{ background: th.accent2 || th.accent }}>💡</button>
                          <select value={md.assignedFamily || ""} onChange={(e) => updMeal(key, "assignedFamily", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "11px", padding: "4px" }}>
                            <option value="">— Assign —</option>
                            {attF.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <input placeholder="Meal name" value={md.name || ""} onChange={(e) => updMeal(key, "name", e.target.value)} className="input-modern" style={{ marginBottom: "6px" }} />
                      <textarea placeholder="Ingredients (one per line)" value={md.ingredients || ""} onChange={(e) => updMeal(key, "ingredients", e.target.value)} rows={3} className="input-modern" style={{ resize: "vertical" }} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* SNACKS */}
        {tab === "snacks" && (
          <div className="fade-in">
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>🚗 Car Snacks</h3>
            {visFams.map((f) => (
              <div key={f.id} className="card-glass" style={{ marginBottom: "8px" }}>
                <strong>🏠 {f.name}</strong>
                <textarea value={carSnacks[f.id] || ""} onChange={(e) => setCarSnacks((s) => ({ ...s, [f.id]: e.target.value }))} rows={3} className="input-modern" style={{ marginTop: "6px", resize: "vertical" }} placeholder="Goldfish, juice boxes..." />
              </div>
            ))}

            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px", marginTop: "20px" }}>🥨 Camp Snacks</h3>
            <div className="card-glass" style={{ marginBottom: "20px" }}>
              <select value={campSnackFam} onChange={(e) => setCampSnackFam(e.target.value)} className="input-modern" style={{ width: "auto", marginBottom: "6px" }}>
                <option value="">— Assign family —</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <textarea value={campSnacks} onChange={(e) => setCampSnacks(e.target.value)} rows={4} className="input-modern" style={{ resize: "vertical" }} placeholder="Trail mix, s'mores..." />
            </div>

            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>🥤 Drinks</h3>
            <div className="card-glass" style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap" }}>
                <strong>🧃 Non-Alcoholic</strong>
                <select value={drinkFam.na || ""} onChange={(e) => setDrinkFam((d) => ({ ...d, na: e.target.value }))} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  <option value="">— Assign —</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <textarea value={drinks.na || ""} onChange={(e) => setDrinks((d) => ({ ...d, na: e.target.value }))} rows={3} className="input-modern" style={{ resize: "vertical" }} placeholder="Water, lemonade, coffee..." />
            </div>
            <div className="card-glass">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap" }}>
                <strong>🍺 Alcoholic</strong>
                <select value={drinkFam.alc || ""} onChange={(e) => setDrinkFam((d) => ({ ...d, alc: e.target.value }))} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  <option value="">— Assign —</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <textarea value={drinks.alc || ""} onChange={(e) => setDrinks((d) => ({ ...d, alc: e.target.value }))} rows={3} className="input-modern" style={{ resize: "vertical" }} placeholder="Beer, wine, mixers..." />
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {tab === "inventory" && (
          <div className="fade-in">
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>📦 Trip Inventory</h3>
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
              {[["bins", "📦 Bins"], ["carmap", "🚗 Car Map"], ["checklist", "✅ Checklist"]].map(([k, l]) =>
                <button key={k} onClick={() => setInvView(k)} style={tabStyle(invView === k)}>{l}</button>
              )}
            </div>

            {invView === "bins" && visFams.map((fam) => {
              const data = tripInv[fam.id] || { bins: [], loose: [] };
              return (
                <div key={fam.id} style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif" }}>🏠 {fam.name}</h4>
                    <button onClick={() => addBin(fam.id)} className="btn btn-sm" style={{ background: th.accent }}>+ Bin</button>
                  </div>
                  {data.bins.map((bin) => (
                    <div key={bin.id} className="card-glass" style={{ marginBottom: "10px", borderLeft: `3px solid ${th.accent}` }}>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                        <input value={bin.name} onChange={(e) => updBin(fam.id, bin.id, "name", e.target.value)} className="input-modern" style={{ flex: "1 1 150px", fontWeight: 600 }} />
                        <select value={bin.zone} onChange={(e) => updBin(fam.id, bin.id, "zone", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                          {CAR_ZONES.map((z) => <option key={z.value} value={z.value}>🚗 {z.label}</option>)}
                        </select>
                        <button onClick={() => remBin(fam.id, bin.id)} className="btn btn-sm" style={{ background: "rgba(160,50,50,0.5)" }}>✕</button>
                      </div>
                      {(bin.items || []).map((item) => {
                        const dupe = isDupe(item.name);
                        return (
                          <div key={item.id} style={{ display: "flex", gap: "4px", marginBottom: "3px", alignItems: "center", flexWrap: "wrap", background: dupe ? "rgba(255,143,0,0.1)" : "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "5px 8px", border: dupe ? `2px solid ${th.accent2}` : "1px solid rgba(255,255,255,0.05)" }}>
                            <input value={item.name} onChange={(e) => updBinItem(fam.id, bin.id, item.id, "name", e.target.value)} placeholder="Item" className="input-modern" style={{ flex: "1 1 100px", minWidth: "70px", padding: "5px 8px", fontSize: "12px" }} />
                            <select value={item.category} onChange={(e) => updBinItem(fam.id, bin.id, item.id, "category", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "11px", padding: "3px" }}>
                              {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                            </select>
                            <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "2px", opacity: 0.6 }}>
                              <input type="checkbox" checked={item.isConsumable || false} onChange={(e) => updBinItem(fam.id, bin.id, item.id, "isConsumable", e.target.checked)} /> Use
                            </label>
                            {item.isConsumable && <input type="number" min="1" value={item.qtyNeeded || 1} onChange={(e) => updBinItem(fam.id, bin.id, item.id, "qtyNeeded", parseInt(e.target.value) || 1)} className="input-modern" style={{ width: "45px", fontSize: "11px", padding: "3px" }} />}
                            {dupe && <span title={`Also: ${dupe.join(", ")}`} style={{ cursor: "help" }}>⚠️</span>}
                            <span onClick={() => remBinItem(fam.id, bin.id, item.id)} style={{ cursor: "pointer", opacity: 0.3, fontSize: "11px" }}>✕</span>
                          </div>
                        );
                      })}
                      <button onClick={() => addBinItem(fam.id, bin.id)} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.08)", color: th.text, marginTop: "4px", fontSize: "11px" }}>+ Item</button>
                    </div>
                  ))}
                </div>
              );
            })}

            {invView === "carmap" && CAR_ZONES.filter((z) => z.value !== "none").map((zone) => {
              let items = [];
              Object.entries(tripInv).forEach(([tfId, data]) => {
                (data.bins || []).filter((b) => b.zone === zone.value).forEach((b) => items.push({ type: "bin", name: b.name, count: b.items?.length || 0, family: families.find((f) => f.id === tfId)?.name }));
              });
              const empty = items.length === 0;
              return (
                <div key={zone.value} className="card-glass" style={{ marginBottom: "8px", opacity: empty ? 0.3 : 1, borderLeft: `3px solid ${empty ? th.cardBorder : th.accent}` }}>
                  <strong>🚗 {zone.label}</strong>
                  {empty ? <span style={{ opacity: 0.5 }}> — Empty</span> : (
                    <div style={{ marginTop: "6px" }}>{items.map((i, j) => <div key={j} style={{ fontSize: "13px", marginBottom: "2px" }}><span className="badge" style={{ background: th.accent }}>📦 {i.name}</span> ({i.count} items · {i.family})</div>)}</div>
                  )}
                </div>
              );
            })}

            {invView === "checklist" && visFams.map((fam) => {
              const items = allItemsForFam(fam.id);
              if (!items.length) return null;
              const packed = items.filter((i) => i.packed).length;
              return (
                <div key={fam.id} style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif" }}>🏠 {fam.name}</h4>
                    <span className="badge" style={{ background: packed === items.length ? th.accent : th.muted }}>{packed}/{items.length}</span>
                  </div>
                  {items.map((item) => {
                    const toggle = () => {
                      if (item.binId) updBinItem(fam.id, item.binId, item.id, "packed", !item.packed);
                    };
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: item.packed ? "rgba(124,179,66,0.1)" : "rgba(255,255,255,0.03)", borderRadius: "10px", opacity: item.packed ? 0.5 : 1, marginBottom: "4px" }}>
                        <Chk checked={item.packed} onClick={toggle} accent={th.accent} />
                        <span style={{ fontSize: "13px", textDecoration: item.packed ? "line-through" : "none", flex: 1 }}>{catIcon(item.category)} {item.name || "unnamed"}</span>
                        <span style={{ fontSize: "10px", opacity: 0.4 }}>{item.binName}</span>
                        {item.category === "electronics" && !item.packed && <span>🔋</span>}
                        {item.isConsumable && <span className="badge" style={{ background: th.accent2 || th.accent }}>×{item.qtyNeeded || 1}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* BABY */}
        {tab === "baby" && (
          <div className="fade-in">
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>🍼 Baby Items</h3>
            {visFams.filter((f) => (f.members || []).some((m) => (m.age_type || m.ageType) === "baby")).map((fam) => (
              <div key={fam.id} className="card-glass" style={{ marginBottom: "10px" }}>
                <strong>🏠 {fam.name}</strong>
                <textarea value={babyItems[fam.id] || ""} onChange={(e) => setBabyItems((b) => ({ ...b, [fam.id]: e.target.value }))} rows={5} className="input-modern" style={{ marginTop: "6px", resize: "vertical" }} placeholder="Formula, diapers, wipes..." />
              </div>
            ))}
          </div>
        )}

        {/* GROCERY */}
        {tab === "grocery" && (
          <div className="fade-in">
            <p style={{ opacity: 0.5, fontSize: "13px", marginBottom: "14px" }}>Scaled by portions. Consumable restocks included.</p>
            {visFams.map((fam) => {
              const g = grocery?.[fam.id];
              if (!g) return null;
              const has = g.mealItems.length > 0 || g.restockItems.length > 0;
              return (
                <div key={fam.id} style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>🛒 {fam.name}'s List</h3>
                  {!has && <div className="card-glass" style={{ opacity: 0.5, fontStyle: "italic" }}>Nothing assigned yet.</div>}
                  {g.mealItems.map((item, i) => (
                    <div key={i} className="card-glass" style={{ padding: "12px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", marginBottom: "6px" }}>
                        <strong>{item.meal}</strong>
                        <span className="badge" style={{ background: th.accent }}>~{item.portions.total}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "18px" }}>
                        {item.ingredients.map((ing, j) => (
                          <li key={j} style={{ fontSize: "13px", marginBottom: "2px" }}>
                            <strong>{ing}</strong>
                            {ing !== item.orig[j] && <span style={{ opacity: 0.4, fontSize: "10px", marginLeft: "4px" }}>(was: {item.orig[j]})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {g.restockItems.length > 0 && (
                    <div className="card-glass" style={{ padding: "12px", borderColor: th.accent2 }}>
                      <strong style={{ fontSize: "13px" }}>🔄 Restock</strong>
                      <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                        {g.restockItems.map((i, j) => <li key={j} style={{ fontSize: "12px" }}>{catIcon(i.category)} {i.name} <strong>×{i.qtyNeeded || 1}</strong></li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "16px", fontSize: "10px", opacity: 0.3 }}>✓ Auto-saved to database</div>
      </div>
    </div>
  );
}
