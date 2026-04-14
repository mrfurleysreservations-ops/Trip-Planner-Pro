import { useState } from "react";

const th = {
  bg: "#f2f8fa", accent: "#0097a7", accent2: "#e65100", text: "#1a1a1a",
  muted: "#5a7a8a", card: "rgba(0,151,167,0.06)", cardBorder: "rgba(0,151,167,0.2)",
  headerBg: "#e8f4f6",
};
const font = "'DM Sans', system-ui, sans-serif";
const headingFont = "'Outfit', system-ui, sans-serif";

// ─── Mock data ───
const FAMILIES = [
  { id: "f1", label: "Furley Family", members: ["Joe", "Sam", "Lily"], color: "#0097a7", short: "F" },
  { id: "f2", label: "Rivera Family", members: ["Jamie", "Alex", "Max"], color: "#9c27b0", short: "R" },
  { id: "s1", label: "Mike", members: ["Mike"], color: "#e65100", short: "M" },
  { id: "s2", label: "Sarah", members: ["Sarah"], color: "#2e7d32", short: "S" },
];

const EVENTS = [
  { id: "ev1", title: "Snorkeling at Coral Bay", date: "Wed May 15", time: "9:00am", icon: "🤿", participants: ["f1", "f2", "s1", "s2"] },
  { id: "ev2", title: "Oceanview Terrace Dinner", date: "Thu May 16", time: "7:30pm", icon: "🍽️", participants: ["f1", "f2", "s1", "s2"] },
  { id: "ev3", title: "Zip Line Adventure", date: "Fri May 17", time: "10:00am", icon: "🏔️", participants: ["f1", "s1"] },
  { id: "ev4", title: "Sunset Sailing Tour", date: "Fri May 17", time: "5:00pm", icon: "⛵", participants: ["f1", "f2", "s1", "s2"] },
];

const ALL_PEOPLE = [
  { id: "joe", name: "Joe", familyId: "f1" },
  { id: "sam", name: "Sam", familyId: "f1" },
  { id: "jamie", name: "Jamie", familyId: "f2" },
  { id: "alex", name: "Alex", familyId: "f2" },
  { id: "mike", name: "Mike", familyId: "s1" },
  { id: "sarah", name: "Sarah", familyId: "s2" },
];

const CATEGORIES = [
  { value: "activity", label: "Activity", icon: "🎯" },
  { value: "dining", label: "Dining", icon: "🍽️" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "groceries", label: "Groceries", icon: "🛒" },
  { value: "hotel", label: "Lodging", icon: "🏨" },
  { value: "other", label: "Other", icon: "💳" },
];

const fmt = (n) => "$" + Number(n || 0).toFixed(2);

// ─── Flow screens ───
// Screen 0: Itinerary view (showing expense entry point on events)
// Screen 1: Add Expense form (from Expenses tab — blank)
// Screen 2: Add Expense form (from Itinerary event — pre-filled)
// Screen 3: Who paid? (single or multiple payers)
// Screen 4: Split between — pick families/people
// Screen 5: Confirm & save
// Screen 6: Back on itinerary, now showing expense badge on event

export default function ExpenseFlowMockup() {
  const [screen, setScreen] = useState(0);
  const [fromEvent, setFromEvent] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("activity");
  const [linkedEvent, setLinkedEvent] = useState(null);
  const [payers, setPayers] = useState([]); // { personId, amount }
  const [splitFamilies, setSplitFamilies] = useState([]);
  const [splitType, setSplitType] = useState("family"); // family | per_person

  const resetForm = () => {
    setTitle(""); setAmount(""); setCategory("activity"); setLinkedEvent(null);
    setPayers([]); setSplitFamilies([]); setSplitType("family"); setFromEvent(null);
  };

  // Start from itinerary event
  const startFromEvent = (ev) => {
    setFromEvent(ev);
    setTitle(ev.title);
    setCategory("activity");
    setLinkedEvent(ev.id);
    setSplitFamilies(ev.participants);
    setScreen(2);
  };

  // Start from expenses tab (blank)
  const startFromExpenses = () => {
    resetForm();
    setScreen(1);
  };

  const StepIndicator = ({ current, total = 3 }) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8, height: 8, borderRadius: 4,
          background: i === current ? th.accent : `${th.accent}25`,
          transition: "all 0.3s",
        }} />
      ))}
    </div>
  );

  const FamilyChip = ({ fam, selected, onToggle }) => (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 10,
        border: `1.5px solid ${selected ? fam.color : th.cardBorder}`,
        background: selected ? `${fam.color}12` : th.card,
        cursor: "pointer", fontFamily: font, transition: "all 0.15s",
        width: "100%", textAlign: "left",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: selected ? fam.color : `${th.muted}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "#fff",
        transition: "background 0.15s",
      }}>
        {fam.short}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? th.text : th.muted }}>{fam.label}</div>
        <div style={{ fontSize: 11, color: th.muted }}>{fam.members.join(", ")}</div>
      </div>
      {selected && <span style={{ fontSize: 16, color: fam.color }}>✓</span>}
    </button>
  );

  const PersonPill = ({ person, selected, onToggle }) => (
    <button
      onClick={onToggle}
      style={{
        padding: "8px 16px", borderRadius: 20,
        border: `1.5px solid ${selected ? th.accent : th.cardBorder}`,
        background: selected ? `${th.accent}15` : "transparent",
        cursor: "pointer", fontFamily: font, fontSize: 13,
        fontWeight: selected ? 700 : 500,
        color: selected ? th.accent : th.muted,
        transition: "all 0.15s",
      }}
    >
      {person.name}
    </button>
  );

  // Wrapper
  const Shell = ({ children, headerTitle, onBack }) => (
    <div style={{
      minHeight: "100vh", background: th.bg, color: th.text, fontFamily: font,
      maxWidth: 430, margin: "0 auto", position: "relative",
      boxShadow: "0 0 60px rgba(0,0,0,0.08)",
    }}>
      <div style={{
        background: th.headerBg, padding: "14px 20px",
        borderBottom: `1px solid ${th.cardBorder}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: th.muted, padding: "4px" }}>←</button>
        )}
        <h2 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 18, margin: 0 }}>{headerTitle}</h2>
      </div>
      <div style={{ padding: "16px 16px 100px" }}>
        {children}
      </div>
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        padding: "8px 20px", borderRadius: 20, background: "rgba(0,0,0,0.75)",
        color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: font,
        zIndex: 100, letterSpacing: "0.03em",
      }}>
        MOCKUP — Expense Flow
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // SCREEN 0: Itinerary with expense entry points
  // ═══════════════════════════════════════
  if (screen === 0) return (
    <Shell headerTitle="Itinerary" onBack={null}>
      <div style={{
        padding: "12px 16px", marginBottom: 16, borderRadius: 12,
        background: `${th.accent}08`, border: `1px dashed ${th.accent}40`,
        fontSize: 12, color: th.accent, fontWeight: 600, textAlign: "center", lineHeight: 1.6,
      }}>
        This shows how expense entry points appear on itinerary events.<br />
        Tap the 💰 button on any event, or use the Expenses tab button below.
      </div>

      {EVENTS.map((ev) => {
        const hasExpense = ev.id === "ev2"; // simulate: dinner already has an expense
        return (
          <div key={ev.id} style={{
            background: th.card, border: `1.5px solid ${th.cardBorder}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{ev.icon}</span>
                <div>
                  <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 14, color: th.text }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>{ev.date} · {ev.time}</div>
                  <div style={{ fontSize: 11, color: th.muted, marginTop: 4 }}>
                    {ev.participants.map((pid) => FAMILIES.find((f) => f.id === pid)?.label).join(", ")}
                  </div>
                </div>
              </div>

              {/* ─── EXPENSE ENTRY POINT ─── */}
              {hasExpense ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
                }}>
                  <div style={{
                    padding: "4px 10px", borderRadius: 8,
                    background: "#d4edda", fontSize: 11, fontWeight: 700, color: "#155724",
                  }}>
                    💰 $680
                  </div>
                  <span style={{ fontSize: 10, color: th.muted }}>Jamie paid</span>
                </div>
              ) : (
                <button
                  onClick={() => startFromEvent(ev)}
                  style={{
                    padding: "8px 12px", borderRadius: 10,
                    border: `1.5px solid ${th.cardBorder}`, background: "none",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: th.muted, fontFamily: font,
                    display: "flex", alignItems: "center", gap: 4,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = th.accent; e.currentTarget.style.color = th.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = th.cardBorder; e.currentTarget.style.color = th.muted; }}
                >
                  💰 Add
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Expenses tab entry */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: th.muted, marginBottom: 10 }}>Or add a standalone expense (groceries, Uber, etc.)</div>
        <button
          onClick={startFromExpenses}
          style={{
            padding: "14px 28px", borderRadius: 12, border: "none",
            background: th.accent, cursor: "pointer", fontSize: 14, fontWeight: 700,
            color: "#fff", fontFamily: font,
          }}
        >
          + Add Expense (from Expenses tab)
        </button>
      </div>
    </Shell>
  );

  // ═══════════════════════════════════════
  // SCREEN 1: Blank expense form (from Expenses tab)
  // ═══════════════════════════════════════
  if (screen === 1) return (
    <Shell headerTitle="Add Expense" onBack={() => { resetForm(); setScreen(0); }}>
      <StepIndicator current={0} />

      <div style={{ fontSize: 13, color: th.muted, marginBottom: 16 }}>
        What was the expense? Fill in the basics, then we'll ask who paid and how to split it.
      </div>

      {/* Title */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>What was it for?</label>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Costco grocery run, Uber to airport"
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: `1.5px solid ${th.cardBorder}`, background: th.card,
          fontFamily: font, fontSize: 14, color: th.text, marginBottom: 14,
          outline: "none", boxSizing: "border-box",
        }}
      />

      {/* Amount */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>Total amount</label>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: th.muted }}>$</span>
        <input
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          type="number"
          style={{
            width: "100%", padding: "12px 14px 12px 32px", borderRadius: 10,
            border: `1.5px solid ${th.cardBorder}`, background: th.card,
            fontFamily: font, fontSize: 18, fontWeight: 700, color: th.text,
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 6 }}>Category</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: `1.5px solid ${category === c.value ? th.accent : th.cardBorder}`,
              background: category === c.value ? `${th.accent}12` : "transparent",
              cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 600,
              color: category === c.value ? th.accent : th.muted,
              transition: "all 0.15s",
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Link to event (optional) */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>Link to itinerary event (optional)</label>
      <select
        value={linkedEvent || ""}
        onChange={(e) => {
          const evId = e.target.value;
          setLinkedEvent(evId || null);
          if (evId) {
            const ev = EVENTS.find((x) => x.id === evId);
            if (ev && !title) setTitle(ev.title);
            if (ev) setSplitFamilies(ev.participants);
          }
        }}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: `1.5px solid ${th.cardBorder}`, background: th.card,
          fontFamily: font, fontSize: 13, color: th.text, marginBottom: 20,
          outline: "none", boxSizing: "border-box",
        }}
      >
        <option value="">No linked event</option>
        {EVENTS.map((ev) => (
          <option key={ev.id} value={ev.id}>{ev.icon} {ev.title} — {ev.date}</option>
        ))}
      </select>

      <button
        onClick={() => setScreen(3)}
        disabled={!title.trim() || !amount}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          background: th.accent, cursor: "pointer", fontSize: 14, fontWeight: 700,
          color: "#fff", fontFamily: font,
          opacity: !title.trim() || !amount ? 0.4 : 1,
        }}
      >
        Next: Who Paid? →
      </button>
    </Shell>
  );

  // ═══════════════════════════════════════
  // SCREEN 2: Pre-filled from itinerary event
  // ═══════════════════════════════════════
  if (screen === 2) return (
    <Shell headerTitle="Add Expense" onBack={() => { resetForm(); setScreen(0); }}>
      <StepIndicator current={0} />

      {/* Pre-filled event context */}
      {fromEvent && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          borderRadius: 10, background: `${th.accent}08`, border: `1px solid ${th.accent}20`,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 24 }}>{fromEvent.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{fromEvent.title}</div>
            <div style={{ fontSize: 12, color: th.muted }}>{fromEvent.date} · {fromEvent.time} · 📅 Linked to event</div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: th.muted, marginBottom: 16 }}>
        Event details are pre-filled. Just add the amount and who's involved.
      </div>

      {/* Title (pre-filled but editable) */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>Expense title</label>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: `1.5px solid ${th.cardBorder}`, background: th.card,
          fontFamily: font, fontSize: 14, color: th.text, marginBottom: 14,
          outline: "none", boxSizing: "border-box",
        }}
      />

      {/* Amount */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>Total amount</label>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: th.muted }}>$</span>
        <input
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00" type="number"
          style={{
            width: "100%", padding: "12px 14px 12px 32px", borderRadius: 10,
            border: `1.5px solid ${th.cardBorder}`, background: th.card,
            fontFamily: font, fontSize: 18, fontWeight: 700, color: th.text,
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category */}
      <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 6 }}>Category</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: `1.5px solid ${category === c.value ? th.accent : th.cardBorder}`,
              background: category === c.value ? `${th.accent}12` : "transparent",
              cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 600,
              color: category === c.value ? th.accent : th.muted,
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setScreen(3)}
        disabled={!amount}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          background: th.accent, cursor: "pointer", fontSize: 14, fontWeight: 700,
          color: "#fff", fontFamily: font, opacity: !amount ? 0.4 : 1,
        }}
      >
        Next: Who Paid? →
      </button>
    </Shell>
  );

  // ═══════════════════════════════════════
  // SCREEN 3: Who paid?
  // ═══════════════════════════════════════
  if (screen === 3) {
    const addPayer = (personId) => {
      if (payers.find((p) => p.personId === personId)) {
        setPayers(payers.filter((p) => p.personId !== personId));
      } else {
        setPayers([...payers, { personId, amount: amount || "" }]);
      }
    };

    const totalAssigned = payers.reduce((s, p) => s + Number(p.amount || 0), 0);
    const remaining = Number(amount || 0) - totalAssigned;

    return (
      <Shell headerTitle="Who Paid?" onBack={() => setScreen(fromEvent ? 2 : 1)}>
        <StepIndicator current={1} />

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", borderRadius: 10, background: th.card,
          border: `1.5px solid ${th.cardBorder}`, marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{title}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: th.accent, fontFamily: headingFont }}>{fmt(amount)}</span>
        </div>

        <div style={{ fontSize: 13, color: th.muted, marginBottom: 4 }}>
          Who covered this? Tap one person if they paid it all, or tap multiple if the cost was split between payers.
        </div>
        <div style={{ fontSize: 11, color: th.accent, fontWeight: 600, marginBottom: 14 }}>
          Example: Bob pays $200 deposit, Jamie covers $160 balance → tap both
        </div>

        {/* Person list */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {ALL_PEOPLE.map((p) => {
            const selected = payers.some((x) => x.personId === p.id);
            return (
              <PersonPill key={p.id} person={p} selected={selected} onToggle={() => addPayer(p.id)} />
            );
          })}
        </div>

        {/* Amount per payer (if multiple) */}
        {payers.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              How much did each person pay?
            </div>
            {payers.map((p, i) => {
              const person = ALL_PEOPLE.find((x) => x.id === p.personId);
              return (
                <div key={p.personId} style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: th.text, width: 60 }}>{person?.name}</span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: th.muted }}>$</span>
                    <input
                      value={p.amount}
                      onChange={(e) => {
                        const updated = [...payers];
                        updated[i] = { ...updated[i], amount: e.target.value };
                        setPayers(updated);
                      }}
                      placeholder="0.00" type="number"
                      style={{
                        width: "100%", padding: "10px 10px 10px 26px", borderRadius: 8,
                        border: `1.5px solid ${th.cardBorder}`, background: th.card,
                        fontFamily: font, fontSize: 14, fontWeight: 700, color: th.text,
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {remaining > 0.01 && (
              <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginTop: 4 }}>
                {fmt(remaining)} still unassigned
              </div>
            )}
            {remaining < -0.01 && (
              <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginTop: 4 }}>
                Over by {fmt(Math.abs(remaining))}
              </div>
            )}
            {Math.abs(remaining) < 0.02 && remaining !== 0 && (
              <div style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600, marginTop: 4 }}>✓ Adds up</div>
            )}
          </div>
        )}

        {/* Single payer: auto-assign full amount */}
        {payers.length === 1 && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, background: `${th.accent}08`,
            fontSize: 13, color: th.text, marginBottom: 16,
          }}>
            <strong>{ALL_PEOPLE.find((x) => x.id === payers[0].personId)?.name}</strong> paid the full <strong>{fmt(amount)}</strong>
          </div>
        )}

        <button
          onClick={() => {
            // Auto-assign full amount if single payer
            if (payers.length === 1) {
              setPayers([{ ...payers[0], amount }]);
            }
            setScreen(4);
          }}
          disabled={payers.length === 0}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, border: "none",
            background: th.accent, cursor: "pointer", fontSize: 14, fontWeight: 700,
            color: "#fff", fontFamily: font, opacity: payers.length === 0 ? 0.4 : 1,
          }}
        >
          Next: Split Between →
        </button>
      </Shell>
    );
  }

  // ═══════════════════════════════════════
  // SCREEN 4: Split between families/people
  // ═══════════════════════════════════════
  if (screen === 4) {
    const toggleFamily = (fid) => {
      setSplitFamilies((prev) => prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid]);
    };

    // Compute shares
    const totalAmt = Number(amount || 0);
    let shares = [];
    if (splitType === "family" && splitFamilies.length > 0) {
      const perUnit = totalAmt / splitFamilies.length;
      shares = splitFamilies.map((fid) => {
        const fam = FAMILIES.find((f) => f.id === fid);
        return { id: fid, label: fam.label, amount: perUnit, members: fam.members.length };
      });
    } else if (splitType === "per_person" && splitFamilies.length > 0) {
      const totalPeople = splitFamilies.reduce((s, fid) => s + FAMILIES.find((f) => f.id === fid).members.length, 0);
      const perPerson = totalAmt / totalPeople;
      shares = splitFamilies.map((fid) => {
        const fam = FAMILIES.find((f) => f.id === fid);
        return { id: fid, label: fam.label, amount: perPerson * fam.members.length, members: fam.members.length, perPerson };
      });
    }

    return (
      <Shell headerTitle="Split Between" onBack={() => setScreen(3)}>
        <StepIndicator current={2} />

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", borderRadius: 10, background: th.card,
          border: `1.5px solid ${th.cardBorder}`, marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{title}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: th.accent, fontFamily: headingFont }}>{fmt(amount)}</span>
        </div>

        {/* Split type toggle */}
        <div style={{
          display: "flex", background: `${th.accent}0a`, borderRadius: 20, padding: 3, marginBottom: 16,
        }}>
          {[
            { key: "family", label: "Split by Family/Person" },
            { key: "per_person", label: "Split Per Head" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setSplitType(v.key)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 18, border: "none",
                cursor: "pointer", fontFamily: font, fontSize: 12,
                fontWeight: splitType === v.key ? 700 : 500,
                background: splitType === v.key ? th.accent : "transparent",
                color: splitType === v.key ? "#fff" : th.muted,
                transition: "all 0.2s",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 13, color: th.muted, marginBottom: 12 }}>
          {splitType === "family"
            ? "Each family or single counts as one equal share."
            : "Divided by total headcount — families pay more because they have more people."}
        </div>

        {/* Family/person selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {FAMILIES.map((fam) => (
            <FamilyChip
              key={fam.id}
              fam={fam}
              selected={splitFamilies.includes(fam.id)}
              onToggle={() => toggleFamily(fam.id)}
            />
          ))}
        </div>

        {/* Live split preview */}
        {shares.length > 0 && (
          <div style={{
            padding: 14, borderRadius: 12, background: `${th.accent}06`,
            border: `1px solid ${th.accent}15`, marginBottom: 18,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Split Preview
            </div>
            {shares.map((s) => (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: `1px solid ${th.accent}10`,
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{s.label}</span>
                  {splitType === "per_person" && s.members > 1 && (
                    <span style={{ fontSize: 11, color: th.muted, marginLeft: 6 }}>
                      ({s.members} × {fmt(s.perPerson)})
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: th.text, fontFamily: headingFont }}>
                  {fmt(s.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setScreen(5)}
          disabled={splitFamilies.length === 0}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, border: "none",
            background: th.accent, cursor: "pointer", fontSize: 14, fontWeight: 700,
            color: "#fff", fontFamily: font, opacity: splitFamilies.length === 0 ? 0.4 : 1,
          }}
        >
          Review & Save →
        </button>
      </Shell>
    );
  }

  // ═══════════════════════════════════════
  // SCREEN 5: Confirm & save
  // ═══════════════════════════════════════
  if (screen === 5) {
    const totalAmt = Number(amount || 0);
    const totalPeople = splitFamilies.reduce((s, fid) => s + FAMILIES.find((f) => f.id === fid).members.length, 0);

    let shares = [];
    if (splitType === "family") {
      const perUnit = totalAmt / splitFamilies.length;
      shares = splitFamilies.map((fid) => {
        const fam = FAMILIES.find((f) => f.id === fid);
        return { id: fid, label: fam.label, amount: perUnit, color: fam.color };
      });
    } else {
      const perPerson = totalAmt / totalPeople;
      shares = splitFamilies.map((fid) => {
        const fam = FAMILIES.find((f) => f.id === fid);
        return { id: fid, label: fam.label, amount: perPerson * fam.members.length, color: fam.color };
      });
    }

    return (
      <Shell headerTitle="Review Expense" onBack={() => setScreen(4)}>
        {/* Summary card */}
        <div style={{
          background: th.card, border: `1.5px solid ${th.accent}`,
          borderRadius: 14, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 18, color: th.text }}>{title}</div>
              <div style={{ fontSize: 12, color: th.muted, marginTop: 4 }}>
                {CATEGORIES.find((c) => c.value === category)?.icon} {CATEGORIES.find((c) => c.value === category)?.label}
                {linkedEvent && ` · 📅 Linked to event`}
              </div>
            </div>
            <div style={{ fontFamily: headingFont, fontWeight: 900, fontSize: 24, color: th.accent }}>
              {fmt(totalAmt)}
            </div>
          </div>

          {/* Paid by */}
          <div style={{
            padding: "10px 14px", borderRadius: 10, background: `${th.accent}08`,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Paid by</div>
            {payers.map((p) => {
              const person = ALL_PEOPLE.find((x) => x.id === p.personId);
              return (
                <div key={p.personId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{person?.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: th.accent }}>{fmt(p.amount || amount)}</span>
                </div>
              );
            })}
          </div>

          {/* Split breakdown */}
          <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Split ({splitType === "family" ? "by family" : "per head"})
          </div>
          {shares.map((s) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: `1px solid ${th.cardBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: s.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {s.label[0]}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{s.label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: th.text, fontFamily: headingFont }}>{fmt(s.amount)}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setScreen(6)}
          style={{
            width: "100%", padding: "16px", borderRadius: 12, border: "none",
            background: th.accent, cursor: "pointer", fontSize: 15, fontWeight: 700,
            color: "#fff", fontFamily: font,
          }}
        >
          Save Expense ✓
        </button>
      </Shell>
    );
  }

  // ═══════════════════════════════════════
  // SCREEN 6: Success — back to itinerary showing badge
  // ═══════════════════════════════════════
  if (screen === 6) return (
    <Shell headerTitle="Itinerary" onBack={null}>
      {/* Success toast */}
      <div style={{
        padding: "14px 18px", borderRadius: 12, marginBottom: 16,
        background: "#d4edda", border: "1.5px solid #a3d9a5",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#155724" }}>Expense saved!</div>
          <div style={{ fontSize: 12, color: "#1e7e34" }}>{title} — {fmt(amount)} added to expenses</div>
        </div>
      </div>

      {EVENTS.map((ev) => {
        const hasExpense = ev.id === "ev2" || (fromEvent && ev.id === fromEvent.id);
        const isNew = fromEvent && ev.id === fromEvent.id;
        return (
          <div key={ev.id} style={{
            background: th.card,
            border: `1.5px solid ${isNew ? th.accent : th.cardBorder}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
            transition: "border-color 0.3s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{ev.icon}</span>
                <div>
                  <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 14, color: th.text }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>{ev.date} · {ev.time}</div>
                </div>
              </div>
              {hasExpense && (
                <div style={{
                  padding: "4px 10px", borderRadius: 8,
                  background: isNew ? `${th.accent}15` : "#d4edda",
                  fontSize: 11, fontWeight: 700,
                  color: isNew ? th.accent : "#155724",
                  border: isNew ? `1.5px solid ${th.accent}` : "none",
                }}>
                  💰 {isNew ? fmt(amount) : "$680"}
                </div>
              )}
              {!hasExpense && (
                <button style={{
                  padding: "8px 12px", borderRadius: 10,
                  border: `1.5px solid ${th.cardBorder}`, background: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  color: th.muted, fontFamily: font,
                }}>
                  💰 Add
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button
          onClick={() => { resetForm(); setScreen(0); }}
          style={{
            padding: "12px 28px", borderRadius: 12, border: `1.5px solid ${th.accent}`,
            background: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
            color: th.accent, fontFamily: font,
          }}
        >
          ← Restart Demo
        </button>
      </div>
    </Shell>
  );

  return null;
}
