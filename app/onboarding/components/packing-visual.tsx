"use client";

// ═══════════════════════════════════════════════════════════
//  PACKING VISUAL — all 18+ animated visual types
// ═══════════════════════════════════════════════════════════

export default function PackingVisual({ type, isActive }: { type: string; isActive: boolean }) {
  const baseStyle: React.CSSProperties = {
    width: "100%", height: "200px", borderRadius: "16px",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.4s ease", overflow: "hidden", position: "relative",
  };

  if (type === "planner") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fef3e2, #fde8cc)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {["🌅 Morning Hike", "🍽️ Lunch Reservation", "🌙 Dinner & Show"].map((event, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.8)", borderRadius: "12px", padding: "10px 14px", transform: isActive ? "translateX(0)" : "translateX(-20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontSize: "14px" }}>{event}</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#999" }}>→</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["👕", "👖", "👟"].map((item, j) => (
                  <span key={j} style={{ fontSize: "16px", transform: isActive ? "scale(1)" : "scale(0)", transition: `transform 0.3s ease ${i * 0.12 + 0.2 + j * 0.08}s` }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "minimalist") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8f5e9, #c8e6c9)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "48px", transform: isActive ? "scale(1)" : "scale(0.5)", opacity: isActive ? 1 : 0.3, transition: "all 0.5s ease" }}>🎒</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["👕", "👕", "👖", "👟", "🧢"].map((item, i) => (
              <span key={i} style={{ fontSize: "24px", background: "rgba(255,255,255,0.7)", borderRadius: "12px", padding: "8px", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${0.2 + i * 0.08}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#2e7d32", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>5 items — one bag</span>
        </div>
      </div>
    );
  }

  if (type === "overpacker") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e3f2fd, #bbdefb)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", maxWidth: "260px" }}>
            {["👕", "👕", "👕", "👗", "👖", "👖", "👟", "👠", "🧥", "☂️", "🩱", "👔", "🧳", "🧳"].map((item, i) => (
              <span key={i} style={{ fontSize: "20px", background: "rgba(255,255,255,0.6)", borderRadius: "8px", padding: "4px 6px", transform: isActive ? "scale(1)" : "scale(0)", transition: `transform 0.3s ease ${i * 0.04}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1565c0", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.8s" }}>What if there&apos;s a pool? What if it snows?</span>
        </div>
      </div>
    );
  }

  if (type === "spontaneous") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff3e0, #ffe0b2)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            {["👕×5", "👖×3", "👟×2"].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.8)", borderRadius: "14px", padding: "14px 18px", fontSize: "18px", fontWeight: 700, textAlign: "center", transform: isActive ? "rotate(0deg)" : `rotate(${(i - 1) * 15}deg)`, transition: `transform 0.5s ease ${i * 0.1}s` }}>{item}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>
            {["🔌 Charger", "💊 Meds", "🛂 Passport"].map((item, i) => (
              <span key={i} style={{ fontSize: "11px", fontWeight: 600, background: "#e65100", color: "#fff", padding: "4px 10px", borderRadius: "20px" }}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "hyper_organizer") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f3e5f5, #e1bee7)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px", width: "100%" }}>
          {[{ event: "Day 1 — Hike", items: "👕👖👟🧢", status: "✅ Verified" }, { event: "Day 1 — Dinner", items: "👔👖👞⌚", status: "✅ Verified" }, { event: "Day 2 — Beach", items: "🩱🩴🕶️🧴", status: "⬜ Not packed" }].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.8)", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", transform: isActive ? "translateX(0)" : "translateX(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontWeight: 600, flex: "1 1 auto", minWidth: "100px" }}>{row.event}</span>
              <span style={{ letterSpacing: "2px" }}>{row.items}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: row.status.startsWith("✅") ? "#2e7d32" : "#999", whiteSpace: "nowrap" }}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_day") {
    const days = [{ label: "Day 1", color: "#e3f2fd", items: ["👕", "👖", "👟", "🧴"] }, { label: "Day 2", color: "#fce4ec", items: ["👗", "👠", "👜"] }, { label: "Day 3", color: "#e8f5e9", items: ["🩱", "🩴", "🕶️"] }];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f5f5f5, #eeeeee)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {days.map((day, i) => (
            <div key={i} style={{ background: day.color, borderRadius: "14px", padding: "12px", textAlign: "center", minWidth: "80px", transform: isActive ? "translateY(0)" : "translateY(30px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>{day.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>{day.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_category") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff8e1, #ffecb3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {[{ label: "Tops", items: ["👕", "👕", "👔"] }, { label: "Bottoms", items: ["👖", "👖"] }, { label: "Shoes", items: ["👟", "👠"] }].map((cat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.7)", borderRadius: "10px", padding: "8px 14px", transform: isActive ? "translateX(0)" : "translateX(-20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "60px" }}>🏷️ {cat.label}</span>
              <div style={{ display: "flex", gap: "6px" }}>{cat.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_activity") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f1f8e9, #dcedc8)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          {[{ label: "🏔️ Hiking", items: ["👕", "👖", "🥾", "🧢"], color: "#e8f5e9" }, { label: "🍽️ Dinner", items: ["👔", "👖", "👞"], color: "#fce4ec" }, { label: "🏖️ Beach", items: ["🩱", "🩴", "🕶️"], color: "#e3f2fd" }].map((act, i) => (
            <div key={i} style={{ background: act.color, borderRadius: "14px", padding: "12px", textAlign: "center", minWidth: "80px", transform: isActive ? "scale(1)" : "scale(0.8)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>{act.label}</div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>{act.items.map((item, j) => <span key={j} style={{ fontSize: "18px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_outfit") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #ede7f6, #d1c4e9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {[{ label: "Outfit 1", items: ["👕", "👖", "👟", "⌚"] }, { label: "Outfit 2", items: ["👗", "👠", "👜", "💍"] }, { label: "Outfit 3", items: ["🩱", "🩴", "🕶️", "🧴"] }].map((outfit, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.7)", borderRadius: "14px", padding: "12px", textAlign: "center", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", color: "#7b1fa2" }}>👔 {outfit.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>{outfit.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "rolling") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e0f7fa, #b2ebf2)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} style={{ width: "36px", height: isActive ? "36px" : "50px", borderRadius: isActive ? "50%" : "6px", background: ["#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1"][i], transition: `all 0.6s ease ${i * 0.1}s`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>{isActive ? "🌀" : ""}</div>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#00838f", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>Rolled tight → 30% more space</span>
        </div>
      </div>
    );
  }

  if (type === "konmari") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fce4ec, #f8bbd0)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "3px", padding: "12px", background: "rgba(255,255,255,0.6)", borderRadius: "12px" }}>
            {["👕", "👕", "👔", "👖", "👖", "👗"].map((item, i) => (
              <div key={i} style={{ width: "32px", height: isActive ? "60px" : "32px", background: "rgba(233,30,99,0.1)", borderRadius: "6px", display: "flex", alignItems: isActive ? "flex-start" : "center", justifyContent: "center", paddingTop: isActive ? "6px" : "0", fontSize: "16px", transition: `all 0.5s ease ${i * 0.08}s` }}>{item}</div>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#c2185b", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>Filed upright — see everything at a glance</span>
        </div>
      </div>
    );
  }

  if (type === "bundle") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f3e5f5, #e1bee7)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative", width: "140px", height: "140px" }}>
            {["🧥", "👔", "👕", "🧴"].map((item, i) => {
              const size = isActive ? 140 - i * 28 : 50;
              const opacity = isActive ? 0.2 + i * 0.25 : 0.5;
              return (
                <div key={i} style={{ position: "absolute", width: `${size}px`, height: `${size}px`, borderRadius: "50%", border: `2px solid rgba(156,39,176,${opacity})`, background: `rgba(156,39,176,${opacity * 0.15})`, top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: i === 3 ? "24px" : "0px", transition: `all 0.6s ease ${i * 0.12}s` }}>{i === 3 && isActive ? item : ""}</div>
              );
            })}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b1fa2", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>Layers wrapped around a core — zero wrinkles</span>
        </div>
      </div>
    );
  }

  if (type === "flat_fold") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #efebe9, #d7ccc8)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {["👕", "👕", "👖", "👔"].map((item, i) => (
            <div key={i} style={{ width: isActive ? "120px" : "80px", height: "32px", background: ["#d7ccc8", "#bcaaa4", "#a1887f", "#8d6e63"][i], borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#fff", transition: `all 0.4s ease ${i * 0.1}s`, transform: isActive ? `translateY(${i * -4}px)` : "translateY(0)" }}>{item}</div>
          ))}
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#5d4037", marginTop: "8px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>Fold, stack, done</span>
        </div>
      </div>
    );
  }

  if (type === "cubes") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8eaf6, #c5cae9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {[{ label: "Tops", color: "#42a5f5", items: "👕👕👔" }, { label: "Bottoms", color: "#66bb6a", items: "👖👖" }, { label: "Misc", color: "#ffa726", items: "🧴🩱🕶️" }].map((cube, i) => (
            <div key={i} style={{ border: `3px solid ${cube.color}`, borderRadius: "12px", padding: "10px", textAlign: "center", background: "rgba(255,255,255,0.7)", minWidth: "75px", transform: isActive ? "scale(1)" : "scale(0.7)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: cube.color, marginBottom: "6px" }}>🧊 {cube.label}</div>
              <div style={{ fontSize: "18px", letterSpacing: "2px" }}>{cube.items}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "compression") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e0f2f1, #b2dfdb)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ width: isActive ? "60px" : "90px", height: isActive ? "40px" : "70px", background: "rgba(0,150,136,0.2)", borderRadius: "10px", border: "2px dashed #009688", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", transition: "all 0.6s ease" }}>🧥</div>
            <span style={{ fontSize: "20px", opacity: isActive ? 1 : 0.3, transition: "opacity 0.4s ease 0.3s" }}>→</span>
            <div style={{ width: "60px", height: "40px", background: "rgba(0,150,136,0.3)", borderRadius: "10px", border: "2px solid #009688", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>🫧</div>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#00796b", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>Compressed — 50% less space</span>
        </div>
      </div>
    );
  }

  if (type === "ziplock") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff9c4, #fff59d)" }}>
        <div style={{ display: "flex", gap: "12px", padding: "16px" }}>
          {[{ label: "Toiletries", items: "🧴🪥💊", size: "Quart" }, { label: "Clothes", items: "👕👖", size: "Gallon" }, { label: "Dirty", items: "🧦", size: "Gallon" }].map((bag, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.6)", border: "2px solid rgba(249,168,37,0.4)", borderRadius: "4px 4px 12px 12px", borderTop: "4px solid #f9a825", padding: "10px", textAlign: "center", minWidth: "70px", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#f57f17", marginBottom: "4px" }}>{bag.size}</div>
              <div style={{ fontSize: "16px", letterSpacing: "1px" }}>{bag.items}</div>
              <div style={{ fontSize: "10px", color: "#999", marginTop: "4px" }}>{bag.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "toss") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fafafa, #eeeeee)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "160px", height: "100px", background: "rgba(0,0,0,0.04)", borderRadius: "14px", border: "2px solid #ccc", display: "flex", flexWrap: "wrap", gap: "2px", padding: "10px", justifyContent: "center", alignContent: "center" }}>
            {["👕", "👖", "👗", "👟", "🧴", "👔", "🩱", "📱"].map((item, i) => (
              <span key={i} style={{ fontSize: "18px", transform: isActive ? `rotate(${(i % 2 === 0 ? 1 : -1) * (5 + i * 3)}deg)` : "rotate(0deg)", transition: `transform 0.5s ease ${i * 0.06}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#757575", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>One big suitcase. Freedom.</span>
        </div>
      </div>
    );
  }

  // Fallback — no_preference variants
  return (
    <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fafafa, #f0f0f0)" }}>
      <div style={{ textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>🤷</div>
        <div style={{ fontSize: "13px", color: "#999" }}>We&apos;ll pick a sensible default</div>
      </div>
    </div>
  );
}
