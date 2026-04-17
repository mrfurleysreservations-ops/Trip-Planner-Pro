import { useState } from "react";

const THEME = {
  accent: "#e8943a",
  accent2: "#c75a2a",
  text: "#1a1a1a",
  muted: "#777",
  card: "rgba(0,0,0,0.03)",
  cardBorder: "#e0e0e0",
};

const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅" },
  { key: "expenses", label: "Expenses", icon: "💰" },
  { key: "packing", label: "Packing", icon: "🧳" },
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "meals", label: "Meals", icon: "🍽️" },
  { key: "group", label: "Group", icon: "👥" },
];

export default function MockupSaveContinue() {
  const [name, setName] = useState("Italy Anniversary");
  const [location, setLocation] = useState("Amalfi Coast, Italy");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("2026-06-10");
  const [endDate, setEndDate] = useState("2026-06-17");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const dayCount = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
    : 0;

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      background: "#f8f6f2",
      minHeight: "100vh",
      maxWidth: "420px",
      margin: "0 auto",
      position: "relative",
      color: THEME.text,
      paddingBottom: "120px",
    }}>
      {/* ── Status bar mock ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 20px", fontSize: "12px", fontWeight: 600, color: "#fff",
        background: "linear-gradient(135deg, #e8943a 0%, #c75a2a 100%)",
      }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: "4px", fontSize: "14px" }}>📶 🔋</span>
      </div>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #e8943a 0%, #c75a2a 100%)",
        padding: "16px 20px 28px",
        color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "18px", cursor: "pointer", opacity: 0.8 }}>←</span>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 800,
            letterSpacing: "-0.5px",
          }}>
            {name || "New Trip"}
          </span>
        </div>
        <div style={{ fontSize: "11px", opacity: 0.7 }}>
          {location && `📍 ${location}`}
          {location && dayCount > 0 && " · "}
          {dayCount > 0 && `Jun 10 — Jun 17, 2026`}
          {!location && dayCount === 0 && "Fill in your trip details below"}
        </div>
      </div>

      {/* ── Trip Details Form ── */}
      <div style={{ padding: "20px 16px", maxWidth: "600px", margin: "0 auto" }}>
        <h3 style={{
          fontFamily: "'Outfit', sans-serif", fontSize: "18px",
          fontWeight: 700, marginBottom: "12px", marginTop: 0,
        }}>
          🏷️ Trip Details
        </h3>

        <div style={{
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
          borderRadius: "14px", border: `1px solid ${THEME.cardBorder}`,
          padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Trip name"
            style={{
              fontSize: "16px", fontWeight: 600, border: `1px solid ${THEME.cardBorder}`,
              borderRadius: "10px", padding: "10px 14px", background: "rgba(0,0,0,0.02)",
              outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
          <input
            value={location} onChange={e => setLocation(e.target.value)}
            placeholder="📍 Where are you going?"
            style={{
              fontSize: "14px", border: `1px solid ${THEME.cardBorder}`,
              borderRadius: "10px", padding: "10px 14px", background: "rgba(0,0,0,0.02)",
              outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="📝 Notes..." rows={2}
            style={{
              fontSize: "14px", border: `1px solid ${THEME.cardBorder}`,
              borderRadius: "10px", padding: "10px 14px", background: "rgba(0,0,0,0.02)",
              outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: "12px", color: THEME.muted, display: "flex", alignItems: "center" }}>
              Start
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{
                  marginLeft: "6px", border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: "8px", padding: "6px 10px", fontSize: "13px",
                  background: "rgba(0,0,0,0.02)", outline: "none",
                }}
              />
            </label>
            <label style={{ fontSize: "12px", color: THEME.muted, display: "flex", alignItems: "center" }}>
              End
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{
                  marginLeft: "6px", border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: "8px", padding: "6px 10px", fontSize: "13px",
                  background: "rgba(0,0,0,0.02)", outline: "none",
                }}
              />
            </label>
            {dayCount > 0 && (
              <span style={{
                background: THEME.accent, color: "#fff", fontSize: "11px",
                fontWeight: 700, padding: "4px 10px", borderRadius: "20px",
              }}>
                {dayCount} days
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "14px", fontSize: "10px", color: THEME.muted, opacity: 0.5 }}>
          ✓ Auto-saved
        </div>

        {/* ── Annotation callout ── */}
        <div style={{
          margin: "20px 0", padding: "16px 18px",
          background: "#fffbe6", border: "2px dashed #e8943a",
          borderRadius: "12px", fontSize: "13px", lineHeight: 1.5,
        }}>
          <strong style={{ color: THEME.accent, fontSize: "14px" }}>What changed:</strong>
          <div style={{ marginTop: "8px" }}>
            <span style={{ fontWeight: 600 }}>Before:</span> Two buttons inline at the bottom of the form — "← Done Editing" (greyed out for new trips) + "Next: Build Your Group →". The Done button only appeared if the trip already had location + dates saved to the server.
          </div>
          <div style={{ marginTop: "8px" }}>
            <span style={{ fontWeight: 600 }}>After:</span> One sticky button pinned above the bottom tab nav. Always visible, always tappable. Flushes auto-save, then navigates to Group page. No more greyed-out / hidden buttons.
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
           STICKY "Save & Continue" BUTTON
           Sits ABOVE the bottom tab nav (bottom: 56px)
         ══════════════════════════════════════════════ */}
      <div style={{
        position: "fixed",
        bottom: "56px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "420px",
        zIndex: 101,
        padding: "0 16px 12px",
        boxSizing: "border-box",
        background: "linear-gradient(to top, #f8f6f2 70%, transparent)",
        pointerEvents: "none",
      }}>
        <button
          onClick={handleSave}
          style={{
            pointerEvents: "auto",
            width: "100%",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accent2} 100%)`,
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            minHeight: "52px",
          }}
        >
          {saved ? "✓ Saved! Taking you to Your Group..." : "Save & Continue to Your Group →"}
        </button>
      </div>

      {/* ── Bottom Tab Nav (Trip Sub-Nav) ── */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "420px",
        zIndex: 100,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: "56px",
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid #e5e5e5",
        padding: "0 4px",
      }}>
        {SUB_NAV_TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "2px",
              height: "100%", background: "none", border: "none",
              borderTop: `3px solid ${tab.key === "group" ? THEME.accent : "transparent"}`,
              cursor: "pointer", padding: 0, minWidth: 0,
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: "10px",
              fontWeight: tab.key === "group" ? 700 : 500,
              color: tab.key === "group" ? THEME.accent : "#999",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
            }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}