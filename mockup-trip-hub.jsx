import { useState } from "react";

// ─── Theme (Flying trip type for mockup) ───
const th = {
  bg: "#f2f8fa",
  accent: "#0097a7",
  accent2: "#e65100",
  text: "#1a1a1a",
  muted: "#5a7a8a",
  card: "rgba(0,151,167,0.06)",
  cardBorder: "rgba(0,151,167,0.2)",
  headerBg: "#e8f4f6",
  vibeBg: "radial-gradient(ellipse at 80% 20%, rgba(0,151,167,0.06) 0%, transparent 50%)",
};

const font = "'DM Sans', system-ui, sans-serif";
const headingFont = "'Outfit', system-ui, sans-serif";

// ─── Mock Data ───
const TRIP = {
  name: "Cabo San Lucas 2026",
  location: "Cabo San Lucas, Mexico",
  startDate: "May 14",
  endDate: "May 19",
  days: 6,
  members: 8,
};

const WEATHER = [
  { day: "Thu", date: "5/14", icon: "☀️", high: 92, low: 74, rain: 0 },
  { day: "Fri", date: "5/15", icon: "⛅", high: 89, low: 73, rain: 10 },
  { day: "Sat", date: "5/16", icon: "☀️", high: 91, low: 75, rain: 0 },
  { day: "Sun", date: "5/17", icon: "☀️", high: 93, low: 76, rain: 5 },
  { day: "Mon", date: "5/18", icon: "⛅", high: 88, low: 72, rain: 15 },
  { day: "Tue", date: "5/19", icon: "☀️", high: 90, low: 74, rain: 0 },
];

const BOOKINGS = {
  hotel: {
    name: "Grand Solmar Resort",
    confirmation: "GS-44892",
    dates: "May 14 – May 19",
    details: "Ocean-view suite, 2 bedrooms",
    cost: "$2,840",
    address: "Av. Solmar 1, Zona Hotelera, Cabo San Lucas, BCS, Mexico",
    notes: "Gate code: 4421#  ·  Check-in desk closes at 11pm — call front desk if arriving late: +52 624-555-0100",
  },
  flights: [
    { who: "Joe + Sam", flight: "AA 2247", route: "LAX → SJD", date: "May 14", time: "8:40am", conf: "BKFT42" },
    { who: "Jamie + Alex", flight: "DL 891", route: "DFW → SJD", date: "May 14", time: "10:15am", conf: "MXPL99" },
    { who: "Mike + Sarah + Kids", flight: "UA 567", route: "ORD → SJD", date: "May 14", time: "11:30am", conf: "UALZ77" },
  ],
  carRental: {
    provider: "Hertz",
    vehicle: "Suburban (8-seat)",
    pickup: "May 14, 12:00pm",
    dropoff: "May 19, 10:00am",
    confirmation: "H-992841",
    cost: "$680",
    address: "SJD Airport — Hertz Counter, Terminal 1 Arrivals",
    notes: "Joe is primary driver. Second driver (Jamie) added — bring license. Gas policy: return full.",
  },
};

const SUB_TABS = [
  { icon: "👥", label: "Group" },
  { icon: "📝", label: "Notes" },
  { icon: "📅", label: "Itinerary" },
  { icon: "🧳", label: "Packing" },
  { icon: "🍽️", label: "Meals" },
  { icon: "💰", label: "Expenses" },
];

// ─── Booking Section Component ───
const BookingSection = ({ icon, title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: open ? "12px 12px 0 0" : 12,
          background: th.card, border: `1.5px solid ${th.cardBorder}`,
          borderBottom: open ? "none" : `1.5px solid ${th.cardBorder}`,
          cursor: "pointer", fontFamily: font,
          transition: "all 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 14, color: th.text }}>{title}</span>
        </div>
        <span style={{ fontSize: 12, color: th.muted, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
      </button>
      {open && (
        <div style={{
          padding: "14px 16px", background: th.card,
          border: `1.5px solid ${th.cardBorder}`, borderTop: "none",
          borderRadius: "0 0 12px 12px",
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value, accent = false }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
    <span style={{ fontSize: 12, color: th.muted, fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: 13, color: accent ? th.accent : th.text, fontWeight: accent ? 700 : 600, fontFamily: accent ? "monospace" : font }}>{value}</span>
  </div>
);

const LocationRow = ({ address }) => (
  <a
    href={`https://www.google.com/maps/search/${encodeURIComponent(address)}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px",
      borderRadius: 8, background: `${th.accent}08`, border: `1px solid ${th.accent}15`,
      marginBottom: 8, textDecoration: "none", cursor: "pointer",
      transition: "background 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = `${th.accent}15`; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = `${th.accent}08`; }}
  >
    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: th.accent, lineHeight: 1.4 }}>{address}</div>
      <div style={{ fontSize: 10, color: th.muted, marginTop: 2 }}>Tap to open in Maps</div>
    </div>
    <span style={{ fontSize: 12, color: th.muted, flexShrink: 0, marginTop: 2 }}>↗</span>
  </a>
);

const NotesRow = ({ notes }) => (
  <div style={{
    display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px",
    borderRadius: 8, background: "#fff8e1", border: "1px solid #ffe0826e",
    marginTop: 6,
  }}>
    <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>📌</span>
    <div style={{ fontSize: 12, color: "#5d4e37", lineHeight: 1.5, fontWeight: 500 }}>{notes}</div>
  </div>
);

export default function TripHubMockup() {
  const [activeTab, setActiveTab] = useState("Hub");

  return (
    <div style={{
      minHeight: "100vh", background: th.bg, color: th.text, fontFamily: font,
      maxWidth: 430, margin: "0 auto", position: "relative",
      boxShadow: "0 0 60px rgba(0,0,0,0.08)",
    }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: th.headerBg, padding: "14px 20px",
        borderBottom: `1px solid ${th.cardBorder}`,
        position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: th.muted, cursor: "pointer" }}>←</span>
              <h1 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 20, margin: 0, color: th.text }}>
                {TRIP.name}
              </h1>
            </div>
            <div style={{ fontSize: 12, color: th.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>📍 {TRIP.location}</span>
              <span>📅 {TRIP.startDate} – {TRIP.endDate}</span>
              <span>👥 {TRIP.members} people</span>
            </div>
          </div>
          <button style={{
            padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${th.cardBorder}`,
            background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            color: th.muted, fontFamily: font,
          }}>
            Edit
          </button>
        </div>
      </div>

      {/* ═══ SUB NAV ═══ */}
      <div style={{
        display: "flex", overflowX: "auto", padding: "0 16px",
        background: th.headerBg, borderBottom: `1px solid ${th.cardBorder}`,
        position: "relative", zIndex: 2,
      }}>
        {SUB_TABS.map((tab) => {
          const active = tab.label === "Group";
          return (
            <button
              key={tab.label}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "10px 14px", background: "none", border: "none",
                borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
                cursor: "pointer", fontFamily: font, fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? th.accent : th.muted,
                whiteSpace: "nowrap", transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ padding: "16px 16px 32px", position: "relative", zIndex: 1 }}>

        {/* ─── WEATHER FORECAST ─── */}
        <div style={{
          background: th.card, border: `1.5px solid ${th.cardBorder}`,
          borderRadius: 14, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🌤️</span>
              <span style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 14, color: th.text }}>Weather Forecast</span>
            </div>
            <span style={{ fontSize: 11, color: th.muted, fontWeight: 600 }}>Avg 91°/74°F</span>
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {WEATHER.map((w) => (
              <div key={w.date} style={{
                flex: "0 0 auto", minWidth: 56, textAlign: "center",
                padding: "8px 6px", borderRadius: 10,
                background: `${th.accent}08`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: th.muted }}>{w.day}</div>
                <div style={{ fontSize: 10, color: th.muted }}>{w.date}</div>
                <div style={{ fontSize: 22, margin: "4px 0" }}>{w.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{w.high}°</div>
                <div style={{ fontSize: 11, color: th.muted }}>{w.low}°</div>
                {w.rain > 0 && <div style={{ fontSize: 9, color: "#4a90d9", marginTop: 2 }}>💧 {w.rain}%</div>}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: `${th.accent}0a`, fontSize: 12, color: th.muted,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>🧳</span> Bring lightweight, breathable clothing — pack sunscreen!
          </div>
        </div>

        {/* ─── TRAVEL & LODGING (NEW SECTION) ─── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 16, margin: 0, color: th.text }}>
              Travel & Lodging
            </h3>
            <button style={{
              padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${th.accent}`,
              background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              color: th.accent, fontFamily: font,
            }}>
              + Add
            </button>
          </div>

          {/* Hotel */}
          <BookingSection icon="🏨" title={BOOKINGS.hotel.name} defaultOpen={true}>
            <LocationRow address={BOOKINGS.hotel.address} />
            <DetailRow label="Confirmation" value={BOOKINGS.hotel.confirmation} accent />
            <DetailRow label="Dates" value={BOOKINGS.hotel.dates} />
            <DetailRow label="Room" value={BOOKINGS.hotel.details} />
            <DetailRow label="Total Cost" value={BOOKINGS.hotel.cost} />
            <NotesRow notes={BOOKINGS.hotel.notes} />
          </BookingSection>

          {/* Flights */}
          <BookingSection icon="✈️" title={`Flights (${BOOKINGS.flights.length})`} defaultOpen={true}>
            {BOOKINGS.flights.map((f, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: i < BOOKINGS.flights.length - 1 ? 8 : 0,
                background: `${th.accent}06`, border: `1px solid ${th.accent}15`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{f.who}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: th.accent, fontFamily: "monospace", background: `${th.accent}12`, padding: "2px 8px", borderRadius: 6 }}>
                    {f.conf}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: th.muted }}>
                  <span>{f.flight} · {f.route}</span>
                  <span>{f.date} · {f.time}</span>
                </div>
              </div>
            ))}
          </BookingSection>

          {/* Car Rental */}
          <BookingSection icon="🚗" title={`${BOOKINGS.carRental.provider} — ${BOOKINGS.carRental.vehicle}`}>
            <LocationRow address={BOOKINGS.carRental.address} />
            <DetailRow label="Confirmation" value={BOOKINGS.carRental.confirmation} accent />
            <DetailRow label="Pickup" value={BOOKINGS.carRental.pickup} />
            <DetailRow label="Dropoff" value={BOOKINGS.carRental.dropoff} />
            <DetailRow label="Total Cost" value={BOOKINGS.carRental.cost} />
            <NotesRow notes={BOOKINGS.carRental.notes} />
          </BookingSection>
        </div>

        {/* ─── QUICK ACTIONS ─── */}
        <div style={{
          textAlign: "center", padding: "24px 20px",
          background: th.card, border: `1.5px solid ${th.cardBorder}`,
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧭</div>
          <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 16, color: th.text, marginBottom: 4 }}>
            Ready to plan?
          </div>
          <div style={{ fontSize: 13, color: th.muted, marginBottom: 16 }}>
            Use the tabs above to build your itinerary, invite your group, and more.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { icon: "📝", label: "Add Notes" },
              { icon: "📅", label: "Plan Itinerary" },
              { icon: "💰", label: "Track Expenses" },
            ].map((a) => (
              <button key={a.label} style={{
                padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${th.cardBorder}`,
                background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: th.text, fontFamily: font, display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ─── MOCKUP LABEL ─── */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        padding: "8px 20px", borderRadius: 20, background: "rgba(0,0,0,0.75)",
        color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: font,
        zIndex: 100, letterSpacing: "0.03em",
      }}>
        MOCKUP — Trip Hub (Redesigned)
      </div>
    </div>
  );
}
