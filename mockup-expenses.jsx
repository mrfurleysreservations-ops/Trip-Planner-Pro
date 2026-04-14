import { useState } from "react";

// ─── Theme (Flying trip type) ───
const th = {
  bg: "#f2f8fa",
  accent: "#0097a7",
  accent2: "#e65100",
  text: "#1a1a1a",
  muted: "#5a7a8a",
  card: "rgba(0,151,167,0.06)",
  cardBorder: "rgba(0,151,167,0.2)",
  headerBg: "#e8f4f6",
};

const font = "'DM Sans', system-ui, sans-serif";
const headingFont = "'Outfit', system-ui, sans-serif";

// ─── Mock Families & Singles ───
const FAMILIES = [
  { id: "f1", label: "Furley Family", members: ["Joe", "Sam", "Lily"], color: "#0097a7" },
  { id: "f2", label: "Rivera Family", members: ["Jamie", "Alex", "Max"], color: "#9c27b0" },
  { id: "s1", label: "Mike", members: ["Mike"], color: "#e65100" },
  { id: "s2", label: "Sarah", members: ["Sarah"], color: "#2e7d32" },
];

const ALL_MEMBERS = FAMILIES.flatMap((f) => f.members);

// ─── Mock Expenses ───
const EXPENSES = [
  {
    id: "e1",
    title: "Grand Solmar Resort",
    category: "hotel",
    icon: "🏨",
    amount: 2840,
    paidBy: "Joe",
    paidByFamily: "f1",
    date: "May 14",
    splitType: "family",
    splits: [
      { id: "f1", label: "Furley Family", share: 946.67 },
      { id: "f2", label: "Rivera Family", share: 946.67 },
      { id: "s1", label: "Mike", share: 473.33 },
      { id: "s2", label: "Sarah", share: 473.33 },
    ],
    eventName: null,
    settled: ["f2"],
  },
  {
    id: "e2",
    title: "Oceanview Terrace Dinner",
    category: "dining",
    icon: "🍽️",
    amount: 680,
    paidBy: "Jamie",
    paidByFamily: "f2",
    date: "May 16",
    splitType: "family",
    splits: [
      { id: "f1", label: "Furley Family", share: 226.67 },
      { id: "f2", label: "Rivera Family", share: 226.67 },
      { id: "s1", label: "Mike", share: 113.33 },
      { id: "s2", label: "Sarah", share: 113.33 },
    ],
    eventName: "Oceanview Terrace — Thu 7:30pm",
    settled: [],
  },
  {
    id: "e3",
    title: "Snorkeling Tour",
    category: "activity",
    icon: "🤿",
    amount: 360,
    paidBy: "Joe",
    paidByFamily: "f1",
    date: "May 15",
    splitType: "per_person",
    splits: [
      { id: "f1", label: "Furley Family", share: 135, note: "3 people × $45" },
      { id: "f2", label: "Rivera Family", share: 135, note: "3 people × $45" },
      { id: "s1", label: "Mike", share: 45 },
      { id: "s2", label: "Sarah", share: 45 },
    ],
    eventName: "Snorkeling at Coral Bay — Wed 9am",
    settled: ["s2"],
  },
  {
    id: "e4",
    title: "Costco Grocery Run",
    category: "groceries",
    icon: "🛒",
    amount: 247.83,
    paidBy: "Mike",
    paidByFamily: "s1",
    date: "May 14",
    splitType: "family",
    splits: [
      { id: "f1", label: "Furley Family", share: 82.61 },
      { id: "f2", label: "Rivera Family", share: 82.61 },
      { id: "s1", label: "Mike", share: 41.30 },
      { id: "s2", label: "Sarah", share: 41.31 },
    ],
    eventName: null,
    settled: ["f1"],
  },
  {
    id: "e5",
    title: "Hertz Car Rental",
    category: "transport",
    icon: "🚗",
    amount: 680,
    paidBy: "Joe",
    paidByFamily: "f1",
    date: "May 14",
    splitType: "family",
    splits: [
      { id: "f1", label: "Furley Family", share: 226.67 },
      { id: "f2", label: "Rivera Family", share: 226.67 },
      { id: "s1", label: "Mike", share: 113.33 },
      { id: "s2", label: "Sarah", share: 113.33 },
    ],
    eventName: null,
    settled: [],
  },
];

// ─── Compute balances ───
const computeSettlements = () => {
  const balances = {};
  FAMILIES.forEach((f) => { balances[f.id] = 0; });

  EXPENSES.forEach((exp) => {
    // Payer gets credited
    balances[exp.paidByFamily] += exp.amount;
    // Everyone owes their share
    exp.splits.forEach((s) => {
      balances[s.id] -= s.share;
    });
  });

  // Build settlement transfers (simplified)
  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([id, bal]) => {
    const family = FAMILIES.find((f) => f.id === id);
    if (bal > 1) creditors.push({ id, label: family.label, amount: bal });
    else if (bal < -1) debtors.push({ id, label: family.label, amount: Math.abs(bal) });
  });

  const transfers = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
    if (transfer > 0.5) {
      transfers.push({
        from: debtors[di],
        to: creditors[ci],
        amount: transfer,
      });
    }
    debtors[di].amount -= transfer;
    creditors[ci].amount -= transfer;
    if (debtors[di].amount < 0.5) di++;
    if (creditors[ci].amount < 0.5) ci++;
  }
  return { balances, transfers };
};

const CATEGORY_FILTERS = [
  { value: "all", label: "All", icon: "" },
  { value: "hotel", label: "Hotel", icon: "🏨" },
  { value: "dining", label: "Dining", icon: "🍽️" },
  { value: "activity", label: "Activities", icon: "🤿" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "groceries", label: "Groceries", icon: "🛒" },
];

// ─── Format currency ───
const fmt = (n) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ─── Components ───

const SettlementCard = ({ transfers }) => (
  <div style={{
    background: th.card, border: `1.5px solid ${th.cardBorder}`,
    borderRadius: 14, padding: 16, marginBottom: 20,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🤝</span>
        <span style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 15, color: th.text }}>
          Settle Up
        </span>
      </div>
      <span style={{ fontSize: 11, color: th.muted, fontWeight: 600 }}>
        {transfers.length} transfer{transfers.length === 1 ? "" : "s"} needed
      </span>
    </div>

    {transfers.map((t, i) => (
      <div key={i} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderRadius: 10, marginBottom: i < transfers.length - 1 ? 8 : 0,
        background: `${th.accent}06`, border: `1px solid ${th.accent}15`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: FAMILIES.find((f) => f.id === t.from.id)?.color || th.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {t.from.label[0]}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{t.from.label}</span>
          </div>
          <span style={{ fontSize: 18, color: th.muted }}>→</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: FAMILIES.find((f) => f.id === t.to.id)?.color || th.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {t.to.label[0]}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{t.to.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: th.text, fontFamily: headingFont }}>
            {fmt(t.amount)}
          </div>
          <button style={{
            marginTop: 4, padding: "4px 12px", borderRadius: 6,
            border: `1.5px solid ${th.accent}`, background: "none",
            cursor: "pointer", fontSize: 10, fontWeight: 700,
            color: th.accent, fontFamily: font,
          }}>
            Venmo
          </button>
        </div>
      </div>
    ))}
  </div>
);

export default function ExpensesMockup() {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState("e1");
  const [view, setView] = useState("expenses"); // expenses | summary

  const { transfers } = computeSettlements();

  const totalSpent = EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  const filtered = filter === "all" ? EXPENSES : EXPENSES.filter((e) => e.category === filter);

  // Summary: total each family/single has paid vs owes
  const spentByFamily = {};
  const owesByFamily = {};
  FAMILIES.forEach((f) => { spentByFamily[f.id] = 0; owesByFamily[f.id] = 0; });
  EXPENSES.forEach((exp) => {
    spentByFamily[exp.paidByFamily] += exp.amount;
    exp.splits.forEach((s) => { owesByFamily[s.id] += s.share; });
  });

  return (
    <div style={{
      minHeight: "100vh", background: th.bg, color: th.text, fontFamily: font,
      maxWidth: 430, margin: "0 auto", position: "relative",
      boxShadow: "0 0 60px rgba(0,0,0,0.08)",
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: th.headerBg, padding: "14px 20px",
        borderBottom: `1px solid ${th.cardBorder}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, color: th.muted, cursor: "pointer" }}>←</span>
          <h2 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 20, margin: 0, color: th.text }}>
            Expenses
          </h2>
        </div>
        <button style={{
          padding: "10px 20px", borderRadius: 10, border: "none",
          background: th.accent, cursor: "pointer", fontSize: 13, fontWeight: 700,
          color: "#fff", fontFamily: font,
        }}>
          + Add Expense
        </button>
      </div>

      {/* ═══ SUB NAV ═══ */}
      <div style={{
        display: "flex", overflowX: "auto", padding: "0 16px",
        background: th.headerBg, borderBottom: `1px solid ${th.cardBorder}`,
        position: "relative", zIndex: 2,
      }}>
        {[
          { icon: "👥", label: "Group" },
          { icon: "📝", label: "Notes" },
          { icon: "📅", label: "Itinerary" },
          { icon: "🧳", label: "Packing" },
          { icon: "🍽️", label: "Meals" },
          { icon: "💰", label: "Expenses", active: true },
        ].map((tab) => (
          <button key={tab.label} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "10px 14px", background: "none", border: "none",
            borderBottom: `3px solid ${tab.active ? th.accent : "transparent"}`,
            cursor: "pointer", fontFamily: font, fontSize: 13,
            fontWeight: tab.active ? 700 : 500,
            color: tab.active ? th.accent : th.muted,
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ padding: "16px 16px 100px", position: "relative", zIndex: 1 }}>

        {/* ─── TRIP TOTAL BANNER ─── */}
        <div style={{
          background: `linear-gradient(135deg, ${th.accent}, ${th.accent}dd)`,
          borderRadius: 14, padding: "18px 20px", marginBottom: 16,
          color: "#fff",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>Trip Total</div>
          <div style={{ fontFamily: headingFont, fontWeight: 900, fontSize: 32, letterSpacing: "-0.02em" }}>
            {fmt(totalSpent)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            {EXPENSES.length} expenses · {FAMILIES.length} parties · {ALL_MEMBERS.length} people
          </div>
        </div>

        {/* ─── VIEW TOGGLE ─── */}
        <div style={{
          display: "flex", background: `${th.accent}0a`, borderRadius: 24, padding: 3, marginBottom: 16,
        }}>
          {[
            { key: "expenses", label: "Expenses" },
            { key: "summary", label: "Summary" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                flex: 1, padding: "9px 16px", borderRadius: 20, border: "none",
                cursor: "pointer", fontFamily: font, fontSize: 13,
                fontWeight: view === v.key ? 700 : 500,
                background: view === v.key ? th.accent : "transparent",
                color: view === v.key ? "#fff" : th.muted,
                transition: "all 0.2s",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* ═══ EXPENSES VIEW ═══ */}
        {view === "expenses" && (
          <>
            {/* Category filters */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
              {CATEGORY_FILTERS.map((c) => {
                const active = filter === c.value;
                const count = c.value === "all" ? EXPENSES.length : EXPENSES.filter((e) => e.category === c.value).length;
                if (c.value !== "all" && count === 0) return null;
                return (
                  <button
                    key={c.value}
                    onClick={() => setFilter(c.value)}
                    style={{
                      padding: "6px 14px", borderRadius: 16, border: "none",
                      cursor: "pointer", fontFamily: font, fontSize: 12,
                      fontWeight: active ? 700 : 500, whiteSpace: "nowrap",
                      background: active ? th.accent : `${th.accent}0a`,
                      color: active ? "#fff" : th.muted,
                      transition: "all 0.2s",
                    }}
                  >
                    {c.icon} {c.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Expense Cards */}
            {filtered.map((exp) => {
              const expanded = expandedId === exp.id;
              return (
                <div
                  key={exp.id}
                  onClick={() => setExpandedId(expanded ? null : exp.id)}
                  style={{
                    background: th.card, border: `1.5px solid ${expanded ? th.accent : th.cardBorder}`,
                    borderRadius: 14, marginBottom: 10, overflow: "hidden",
                    cursor: "pointer", transition: "border-color 0.2s",
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{exp.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 14, color: th.text, marginBottom: 2 }}>
                          {exp.title}
                        </div>
                        <div style={{ fontSize: 11, color: th.muted }}>
                          {exp.date} · Paid by <strong style={{ color: th.text }}>{exp.paidBy}</strong>
                        </div>
                        {exp.eventName && (
                          <div style={{ fontSize: 11, color: th.accent, fontWeight: 600, marginTop: 2 }}>
                            📅 {exp.eventName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 16, color: th.text }}>
                        {fmt(exp.amount)}
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 600, marginTop: 2,
                        color: exp.splitType === "family" ? "#6a7a5a" : th.accent,
                      }}>
                        {exp.splitType === "family" ? "Split by family" : "Per person"}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Split breakdown */}
                  {expanded && (
                    <div style={{
                      padding: "0 16px 14px",
                      borderTop: `1px solid ${th.cardBorder}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 0 8px" }}>
                        Split Breakdown
                      </div>
                      {exp.splits.map((s) => {
                        const isPayer = s.id === exp.paidByFamily;
                        const isSettled = exp.settled.includes(s.id) || isPayer;
                        const family = FAMILIES.find((f) => f.id === s.id);
                        return (
                          <div key={s.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 10px", borderRadius: 8, marginBottom: 4,
                            background: isPayer ? `${th.accent}08` : isSettled ? "#d4edda10" : "transparent",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: "50%",
                                background: family?.color || th.accent,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 700, color: "#fff",
                              }}>
                                {s.label[0]}
                              </div>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{s.label}</span>
                                {family?.members.length > 1 && (
                                  <span style={{ fontSize: 11, color: th.muted, marginLeft: 6 }}>
                                    ({family.members.length})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{fmt(s.share)}</span>
                              {isPayer ? (
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  background: th.accent, color: "#fff",
                                }}>PAID</span>
                              ) : isSettled ? (
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  background: "#d4edda", color: "#155724",
                                }}>SETTLED</span>
                              ) : (
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  background: "#fff3cd", color: "#856404",
                                }}>OWES</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {exp.splits.some((s) => s.note) && (
                        <div style={{ fontSize: 11, color: th.muted, fontStyle: "italic", marginTop: 6, paddingLeft: 10 }}>
                          {exp.splits.filter((s) => s.note).map((s) => `${s.label}: ${s.note}`).join(" · ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ═══ SUMMARY VIEW ═══ */}
        {view === "summary" && (
          <>
            {/* Per-family summary cards */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                By Family / Person
              </div>
              {FAMILIES.map((fam) => {
                const paid = spentByFamily[fam.id];
                const owes = owesByFamily[fam.id];
                const net = paid - owes;
                return (
                  <div key={fam.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: 12, marginBottom: 8,
                    background: th.card, border: `1.5px solid ${th.cardBorder}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: fam.color, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: "#fff",
                      }}>
                        {fam.label[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{fam.label}</div>
                        <div style={{ fontSize: 11, color: th.muted }}>
                          {fam.members.join(", ")} · Paid {fmt(paid)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 15, fontWeight: 800, fontFamily: headingFont,
                        color: net > 0 ? "#2e7d32" : net < 0 ? "#c0392b" : th.text,
                      }}>
                        {net > 0 ? "+" : ""}{fmt(net)}
                      </div>
                      <div style={{ fontSize: 10, color: th.muted, fontWeight: 600 }}>
                        {net > 0 ? "is owed" : net < 0 ? "owes" : "settled"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Settle Up section */}
            <SettlementCard transfers={transfers} />

            {/* Category breakdown */}
            <div style={{
              background: th.card, border: `1.5px solid ${th.cardBorder}`,
              borderRadius: 14, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>📊</span>
                <span style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 15, color: th.text }}>
                  Spending by Category
                </span>
              </div>
              {CATEGORY_FILTERS.filter((c) => c.value !== "all").map((cat) => {
                const catTotal = EXPENSES.filter((e) => e.category === cat.value).reduce((s, e) => s + e.amount, 0);
                if (catTotal === 0) return null;
                const pct = (catTotal / totalSpent) * 100;
                return (
                  <div key={cat.value} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>
                        {cat.icon} {cat.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{fmt(catTotal)}</span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3, background: `${th.accent}15`,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        background: th.accent, width: `${pct}%`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ─── MOCKUP LABEL ─── */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        padding: "8px 20px", borderRadius: 20, background: "rgba(0,0,0,0.75)",
        color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: font,
        zIndex: 100, letterSpacing: "0.03em",
      }}>
        MOCKUP — Expenses Page (New)
      </div>
    </div>
  );
}
