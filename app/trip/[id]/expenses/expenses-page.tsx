"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, EXPENSE_CATEGORIES, SPLIT_TYPES } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripMember, ItineraryEvent, ExpensePayer, ExpenseSplit } from "@/types/database.types";
import type { ExpensesPageProps, ExpenseWithRelations, FamilyGroup } from "./page";
import TripSubNav from "../trip-sub-nav";

// ─── Helpers ───

function getCategoryConfig(val: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === val) || { value: val, label: val, icon: "💳" };
}

function getSplitTypeLabel(val: string) {
  return SPLIT_TYPES.find((s) => s.value === val)?.label || val;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

/** Avatar circle with first letter */
function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
    }}>
      {(name[0] || "?").toUpperCase()}
    </div>
  );
}

// ─── Debt simplification algorithm ───

interface Transfer {
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  amount: number;
}

function computeSettleUpTransfers(
  familyGroups: FamilyGroup[],
  expenses: ExpenseWithRelations[],
  members: TripMember[],
): Transfer[] {
  // Net balance per family: total paid - total owed
  const balances = new Map<string, number>();
  const labelMap = new Map<string, string>();

  familyGroups.forEach((fg) => {
    balances.set(fg.familyId, 0);
    labelMap.set(fg.familyId, fg.label);
  });

  // Build member→familyGroup lookup
  const memberToFamily = new Map<string, string>();
  familyGroups.forEach((fg) => {
    fg.members.forEach((m) => memberToFamily.set(m.id, fg.familyId));
  });

  for (const exp of expenses) {
    // Add paid amounts
    for (const p of exp.payers) {
      const famId = memberToFamily.get(p.trip_member_id);
      if (famId) balances.set(famId, (balances.get(famId) || 0) + Number(p.amount_paid));
    }
    // Subtract owed amounts
    for (const s of exp.splits) {
      if (balances.has(s.family_id)) {
        balances.set(s.family_id, (balances.get(s.family_id) || 0) - Number(s.amount_owed));
      }
    }
  }

  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, bal] of balances) {
    const rounded = Math.round(bal * 100) / 100;
    if (rounded < -0.01) debtors.push({ id, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ id, amount: rounded });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let di = 0, ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].amount, creditors[ci].amount);
    if (amount > 0.01) {
      transfers.push({
        from: debtors[di].id,
        fromLabel: labelMap.get(debtors[di].id) || "Unknown",
        to: creditors[ci].id,
        toLabel: labelMap.get(creditors[ci].id) || "Unknown",
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[di].amount -= amount;
    creditors[ci].amount -= amount;
    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }

  return transfers;
}

// ─── Color palette for family avatars ───
const FAMILY_COLORS = ["#5a9a2f", "#0097a7", "#e65100", "#9c27b0", "#e91e63", "#3f51b5", "#00897b", "#ff6f00"];

function getFamilyColor(idx: number): string {
  return FAMILY_COLORS[idx % FAMILY_COLORS.length];
}

// ═══════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════

export default function ExpensesPageComponent({
  trip, members, expenses: initialExpenses, events, familyGroups,
  userId, isHost, fromEvent, fromEventTitle, fromEventDate,
}: ExpensesPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [activeView, setActiveView] = useState<"expenses" | "summary">("expenses");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── Delete confirmation ───
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Add modal state ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2 | 3>(1);
  const [addTitle, setAddTitle] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState("other");
  const [addDate, setAddDate] = useState("");
  const [addEventId, setAddEventId] = useState<string | null>(null);
  const [addNotes, setAddNotes] = useState("");
  const [addSplitType, setAddSplitType] = useState("family");
  const [addPayers, setAddPayers] = useState<Map<string, number>>(new Map());
  const [addSelectedFamilies, setAddSelectedFamilies] = useState<Set<string>>(new Set());
  const [addCustomAmounts, setAddCustomAmounts] = useState<Map<string, number>>(new Map());

  const currentUserName = members.find((m) => m.user_id === userId)?.name || "Someone";
  const currentUserMember = members.find((m) => m.user_id === userId);

  // Member name lookup
  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => { map[m.id] = m.name; });
    return map;
  }, [members]);

  // Family color index map
  const familyColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    familyGroups.forEach((fg, i) => { map[fg.familyId] = getFamilyColor(i); });
    return map;
  }, [familyGroups]);

  // Member→family lookup
  const memberToFamilyId = useMemo(() => {
    const map = new Map<string, string>();
    familyGroups.forEach((fg) => {
      fg.members.forEach((m) => map.set(m.id, fg.familyId));
    });
    return map;
  }, [familyGroups]);

  // ─── Auto-open modal from deep link ───
  useEffect(() => {
    if (fromEvent) {
      setAddEventId(fromEvent);
      if (fromEventTitle) setAddTitle(fromEventTitle);
      if (fromEventDate) setAddDate(fromEventDate);
      // Pre-select participant families from event
      // (We don't have participant data here, so select all families as default)
      setAddSelectedFamilies(new Set(familyGroups.map((fg) => fg.familyId)));
      setShowAddModal(true);
    }
  }, [fromEvent]);

  // ─── Filtered expenses ───
  const filteredExpenses = filterCategory
    ? expenses.filter((e) => e.category === filterCategory)
    : expenses;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [expenses]);

  // ─── Totals ───
  const totalAmount = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.total_amount), 0), [expenses]);

  // ─── Reset add form ───
  const resetAddForm = useCallback(() => {
    setAddStep(1);
    setAddTitle("");
    setAddAmount("");
    setAddCategory("other");
    setAddDate("");
    setAddEventId(null);
    setAddNotes("");
    setAddSplitType("family");
    setAddPayers(new Map());
    setAddSelectedFamilies(new Set(familyGroups.map((fg) => fg.familyId)));
    setAddCustomAmounts(new Map());
  }, [familyGroups]);

  // ─── Open add modal ───
  const openAddModal = useCallback(() => {
    resetAddForm();
    setShowAddModal(true);
  }, [resetAddForm]);

  // ─── Event selection handler ───
  const handleEventSelect = useCallback((eventId: string | null) => {
    setAddEventId(eventId);
    if (eventId) {
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        if (!addTitle) setAddTitle(ev.title);
        if (ev.date && !addDate) setAddDate(ev.date);
      }
    }
  }, [events, addTitle, addDate]);

  // ─── Payer toggle ───
  const togglePayer = useCallback((memberId: string) => {
    setAddPayers((prev) => {
      const next = new Map(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        const amt = parseFloat(addAmount) || 0;
        // If first payer, give them full amount
        if (next.size === 0) {
          next.set(memberId, amt);
        } else {
          next.set(memberId, 0);
        }
      }
      return next;
    });
  }, [addAmount]);

  // ─── Family toggle ───
  const toggleFamily = useCallback((familyId: string) => {
    setAddSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  }, []);

  // ─── Compute split preview ───
  const splitPreview = useMemo(() => {
    const total = parseFloat(addAmount) || 0;
    const selected = familyGroups.filter((fg) => addSelectedFamilies.has(fg.familyId));
    if (selected.length === 0 || total === 0) return [];

    if (addSplitType === "family") {
      const share = total / selected.length;
      return selected.map((fg) => ({ familyId: fg.familyId, label: fg.label, memberCount: fg.members.length, amount: Math.round(share * 100) / 100 }));
    } else if (addSplitType === "per_person") {
      const totalHeads = selected.reduce((sum, fg) => sum + fg.members.length, 0);
      return selected.map((fg) => ({
        familyId: fg.familyId, label: fg.label, memberCount: fg.members.length,
        amount: Math.round((total * fg.members.length / totalHeads) * 100) / 100,
      }));
    } else {
      // custom
      return selected.map((fg) => ({
        familyId: fg.familyId, label: fg.label, memberCount: fg.members.length,
        amount: addCustomAmounts.get(fg.familyId) || 0,
      }));
    }
  }, [addAmount, addSplitType, addSelectedFamilies, familyGroups, addCustomAmounts]);

  // ─── Save expense ───
  const saveExpense = useCallback(async () => {
    if (loading) return;
    const total = parseFloat(addAmount);
    if (!addTitle.trim() || isNaN(total) || total <= 0) return;
    setLoading(true);

    // 1. Insert expense
    const { data: expData, error: expErr } = await supabase
      .from("trip_expenses")
      .insert({
        trip_id: trip.id,
        created_by: userId,
        title: addTitle.trim(),
        total_amount: total,
        category: addCategory,
        event_id: addEventId || null,
        expense_date: addDate || null,
        notes: addNotes.trim() || null,
        split_type: addSplitType,
      })
      .select()
      .single();

    if (expErr || !expData) {
      console.error("Expense insert error:", JSON.stringify(expErr, null, 2));
      setLoading(false);
      return;
    }

    const expenseId = expData.id;

    // 2. Insert payers
    const payerRows: { expense_id: string; trip_member_id: string; amount_paid: number }[] = [];
    for (const [memberId, amount] of addPayers) {
      if (amount > 0) {
        payerRows.push({ expense_id: expenseId, trip_member_id: memberId, amount_paid: amount });
      }
    }
    if (payerRows.length > 0) {
      const { error: payerErr } = await supabase.from("expense_payers").insert(payerRows);
      if (payerErr) console.error("Payer insert error:", JSON.stringify(payerErr, null, 2));
    }

    // 3. Insert splits
    const splitRows: { expense_id: string; family_id: string; family_label: string; member_count: number; amount_owed: number }[] = [];
    for (const sp of splitPreview) {
      splitRows.push({
        expense_id: expenseId,
        family_id: sp.familyId,
        family_label: sp.label,
        member_count: sp.memberCount,
        amount_owed: sp.amount,
      });
    }
    if (splitRows.length > 0) {
      const { error: splitErr } = await supabase.from("expense_splits").insert(splitRows);
      if (splitErr) console.error("Split insert error:", JSON.stringify(splitErr, null, 2));
    }

    // 4. Log activity
    logActivity(supabase, {
      tripId: trip.id, userId, userName: currentUserName,
      action: "added", entityType: "expense", entityName: addTitle.trim(),
      linkPath: `/trip/${trip.id}/expenses`,
    });

    // 5. Build local object and update state
    const localExpense: ExpenseWithRelations = {
      ...expData,
      payers: payerRows.map((p) => ({
        id: crypto.randomUUID(),
        expense_id: expenseId,
        trip_member_id: p.trip_member_id,
        amount_paid: p.amount_paid,
        created_at: new Date().toISOString(),
      })),
      splits: splitRows.map((s) => ({
        id: crypto.randomUUID(),
        expense_id: expenseId,
        family_id: s.family_id,
        family_label: s.family_label,
        member_count: s.member_count,
        amount_owed: s.amount_owed,
        is_settled: false,
        settled_at: null,
        created_at: new Date().toISOString(),
      })),
    };

    setExpenses((prev) => [localExpense, ...prev]);
    setShowAddModal(false);
    resetAddForm();
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, addTitle, addAmount, addCategory, addEventId, addDate, addNotes, addSplitType, addPayers, splitPreview, loading, resetAddForm]);

  // ─── Delete expense ───
  const deleteExpense = useCallback(async (id: string) => {
    setLoading(true);
    const exp = expenses.find((e) => e.id === id);
    await supabase.from("trip_expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setExpandedId(null);
    setConfirmDeleteId(null);
    if (exp) {
      logActivity(supabase, {
        tripId: trip.id, userId, userName: currentUserName,
        action: "deleted", entityType: "expense", entityName: exp.title,
        linkPath: `/trip/${trip.id}/expenses`,
      });
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, expenses]);

  // ─── Mark split settled ───
  const markSettled = useCallback(async (splitId: string, expenseId: string) => {
    await supabase.from("expense_splits").update({ is_settled: true, settled_at: new Date().toISOString() }).eq("id", splitId);
    setExpenses((prev) => prev.map((e) => {
      if (e.id !== expenseId) return e;
      return {
        ...e,
        splits: e.splits.map((s) => s.id === splitId ? { ...s, is_settled: true, settled_at: new Date().toISOString() } : s),
      };
    }));
  }, [supabase]);

  // ─── Styles ───
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12,
    fontWeight: active ? 700 : 500,
    border: `1.5px solid ${active ? th.accent : th.cardBorder}`,
    background: active ? `${th.accent}1a` : "transparent",
    color: active ? th.accent : th.muted,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1px solid ${th.cardBorder}`, background: th.card,
    color: th.text, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: th.muted,
    textTransform: "uppercase", marginBottom: 4, display: "block",
  };

  // ─── Event name lookup ───
  const eventNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    events.forEach((e) => { map[e.id] = e.title; });
    return map;
  }, [events]);

  // ─── Summary computations ───
  const familySummaries = useMemo(() => {
    return familyGroups.map((fg, idx) => {
      let totalPaid = 0;
      let totalOwed = 0;
      for (const exp of expenses) {
        for (const p of exp.payers) {
          if (memberToFamilyId.get(p.trip_member_id) === fg.familyId) {
            totalPaid += Number(p.amount_paid);
          }
        }
        for (const s of exp.splits) {
          if (s.family_id === fg.familyId) {
            totalOwed += Number(s.amount_owed);
          }
        }
      }
      const net = Math.round((totalPaid - totalOwed) * 100) / 100;
      return {
        ...fg,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOwed: Math.round(totalOwed * 100) / 100,
        net,
        color: getFamilyColor(idx),
      };
    });
  }, [familyGroups, expenses, memberToFamilyId]);

  const settleUpTransfers = useMemo(() =>
    computeSettleUpTransfers(familyGroups, expenses, members),
  [familyGroups, expenses, members]);

  // Category breakdown for summary
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + Number(e.total_amount);
    });
    return Object.entries(totals)
      .map(([cat, amount]) => ({ ...getCategoryConfig(cat), amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: th.headerBg, padding: "14px 20px",
        borderBottom: `1px solid ${th.cardBorder}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "8px", position: "relative", zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 4, color: th.muted }}>←</button>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 20, color: th.text, margin: 0 }}>
            Expenses
          </h2>
        </div>
        <button onClick={openAddModal} className="btn" style={{ background: th.accent, padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>
          + Add Expense
        </button>
      </div>

      <TripSubNav tripId={trip.id} theme={th} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16, position: "relative", zIndex: 1 }}>

        {/* ═══ VIEW TOGGLE ═══ */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, background: `${th.accent}0a`, borderRadius: 12, border: `1.5px solid ${th.cardBorder}`, overflow: "hidden" }}>
          {(["expenses", "summary"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                flex: 1, padding: "10px 16px", background: activeView === view ? `${th.accent}1a` : "transparent",
                border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, fontWeight: activeView === view ? 700 : 500,
                color: activeView === view ? th.accent : th.muted,
                borderBottom: `3px solid ${activeView === view ? th.accent : "transparent"}`,
              }}
            >
              {view === "expenses" ? "💰 Expenses" : "📊 Summary"}
            </button>
          ))}
        </div>

        {/* ═══ EXPENSES LIST VIEW ═══ */}
        {activeView === "expenses" && (
          <>
            {/* Top banner */}
            {expenses.length > 0 && (
              <div style={{
                background: `linear-gradient(135deg, ${th.accent}, ${th.accent2 || th.accent})`,
                borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: "#fff",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Trip Total
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1 }}>
                  {fmtCurrency(totalAmount)}
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                  <span>{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</span>
                  <span>{familyGroups.length} {familyGroups.length === 1 ? "party" : "parties"}</span>
                  <span>{members.length} {members.length === 1 ? "person" : "people"}</span>
                </div>
              </div>
            )}

            {/* Category filter pills */}
            {expenses.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                <button onClick={() => setFilterCategory(null)} style={pillStyle(filterCategory === null)}>
                  All ({expenses.length})
                </button>
                {EXPENSE_CATEGORIES.filter((c) => categoryCounts[c.value]).map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFilterCategory(filterCategory === c.value ? null : c.value)}
                    style={pillStyle(filterCategory === c.value)}
                  >
                    {c.icon} {c.label} ({categoryCounts[c.value]})
                  </button>
                ))}
              </div>
            )}

            {/* Expense cards */}
            {filteredExpenses.length > 0 ? filteredExpenses.map((exp) => {
              const cat = getCategoryConfig(exp.category);
              const payerNames = exp.payers.map((p) => memberNameMap[p.trip_member_id] || "Unknown").join(", ");
              const isExpanded = expandedId === exp.id;
              const canModify = exp.created_by === userId || isHost;

              return (
                <div
                  key={exp.id}
                  onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                  style={{
                    background: th.card, border: `1px solid ${isExpanded ? th.accent : th.cardBorder}`,
                    borderRadius: 14, padding: "16px 18px", marginBottom: 10,
                    cursor: "pointer", transition: "border-color 0.2s",
                    borderLeft: `4px solid ${th.accent}`,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>{cat.icon}</span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>{exp.title}</span>
                      </div>
                      {exp.event_id && eventNameMap[exp.event_id] && (
                        <div style={{ fontSize: 12, color: th.accent, fontWeight: 600, marginBottom: 2 }}>
                          📅 {eventNameMap[exp.event_id]}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: th.muted }}>
                        {fmtDate(exp.expense_date)} · Paid by {payerNames}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: th.accent }}>
                        {fmtCurrency(Number(exp.total_amount))}
                      </div>
                      <div style={{ fontSize: 10, color: th.muted, fontWeight: 500 }}>
                        {getSplitTypeLabel(exp.split_type)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded split breakdown */}
                  {isExpanded && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${th.cardBorder}` }}>
                      {exp.notes && (
                        <div style={{ fontSize: 13, color: th.muted, fontStyle: "italic", marginBottom: 12 }}>
                          {exp.notes}
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Split Breakdown
                      </div>
                      {exp.splits.map((s) => {
                        const isPayer = exp.payers.some((p) => memberToFamilyId.get(p.trip_member_id) === s.family_id);
                        const statusLabel = isPayer ? "PAID" : s.is_settled ? "SETTLED" : "OWES";
                        const statusBg = isPayer ? th.accent : s.is_settled ? "#28a745" : "#f9a825";
                        const statusColor = "#fff";

                        return (
                          <div key={s.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 0", borderBottom: `1px solid ${th.cardBorder}20`,
                          }}>
                            <Avatar name={s.family_label} color={familyColorMap[s.family_id] || th.accent} size={28} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.family_label}</div>
                              <div style={{ fontSize: 11, color: th.muted }}>{s.member_count} {s.member_count === 1 ? "person" : "people"}</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtCurrency(Number(s.amount_owed))}</div>
                            <span style={{
                              padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: statusBg, color: statusColor, textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}>
                              {statusLabel}
                            </span>
                            {statusLabel === "OWES" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markSettled(s.id, exp.id); }}
                                style={{
                                  padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                                  background: "#e8f5e9", color: "#2e7d32", border: "none",
                                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                Mark Settled
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Actions */}
                      {canModify && (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                          {confirmDeleteId === exp.id ? (
                            <>
                              <span style={{ fontSize: 12, color: "#e74c3c", fontWeight: 600, alignSelf: "center" }}>Delete this expense?</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteExpense(exp.id); }}
                                style={{ padding: "6px 14px", borderRadius: 8, background: "#e74c3c", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                Yes, Delete
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                style={{ padding: "6px 14px", borderRadius: 8, background: th.card, border: `1px solid ${th.cardBorder}`, color: th.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(exp.id); }}
                              style={{ padding: "6px 14px", borderRadius: 8, background: "#fde8e8", color: "#e74c3c", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No Expenses Yet</h3>
                <p style={{ color: th.muted, fontSize: 14, marginBottom: 20 }}>
                  Track who paid for what and split costs easily across your group.
                </p>
                <button onClick={openAddModal} className="btn" style={{ background: th.accent, padding: "12px 28px", fontSize: 14, fontWeight: 700 }}>
                  + Add Your First Expense
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ SUMMARY VIEW ═══ */}
        {activeView === "summary" && (
          <>
            {expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: th.muted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: th.text, marginBottom: 8 }}>No expenses to summarize</div>
                <div style={{ fontSize: 14 }}>Add some expenses first to see the breakdown.</div>
              </div>
            ) : (
              <>
                {/* Per-family summary cards */}
                <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Family Balances
                </div>
                {familySummaries.map((fs) => (
                  <div key={fs.familyId} style={{
                    background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 14,
                    padding: "14px 18px", marginBottom: 8,
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <Avatar name={fs.label} color={fs.color} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>{fs.label}</div>
                      <div style={{ fontSize: 12, color: th.muted }}>
                        {fs.members.map((m) => m.name).join(", ")}
                      </div>
                      <div style={{ fontSize: 12, color: th.muted, fontWeight: 600, marginTop: 2 }}>
                        Paid {fmtCurrency(fs.totalPaid)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18,
                        color: fs.net > 0.01 ? "#28a745" : fs.net < -0.01 ? "#e74c3c" : th.muted,
                      }}>
                        {fs.net > 0 ? "+" : ""}{fmtCurrency(fs.net)}
                      </div>
                      <div style={{ fontSize: 11, color: th.muted, fontWeight: 500 }}>
                        {fs.net > 0.01 ? "is owed" : fs.net < -0.01 ? "owes" : "settled"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Settle Up */}
                {settleUpTransfers.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Settle Up — {settleUpTransfers.length} transfer{settleUpTransfers.length !== 1 ? "s" : ""} needed
                    </div>
                    {settleUpTransfers.map((t, i) => (
                      <div key={i} style={{
                        background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 14,
                        padding: "14px 18px", marginBottom: 8,
                        display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <Avatar name={t.fromLabel} color={familyColorMap[t.from] || th.accent} size={32} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.fromLabel}</div>
                        <span style={{ fontSize: 16, color: th.muted }}>→</span>
                        <Avatar name={t.toLabel} color={familyColorMap[t.to] || th.accent} size={32} />
                        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.toLabel}</div>
                        <div style={{
                          fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 16, color: th.accent,
                        }}>
                          {fmtCurrency(t.amount)}
                        </div>
                        <button disabled style={{
                          padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: `${th.accent}1a`, color: th.accent, border: `1px solid ${th.accent}40`,
                          cursor: "not-allowed", opacity: 0.5, fontFamily: "'DM Sans', sans-serif",
                        }}>
                          Venmo
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category breakdown */}
                {categoryBreakdown.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Spending by Category
                    </div>
                    {categoryBreakdown.map((cb) => {
                      const pct = totalAmount > 0 ? (cb.amount / totalAmount) * 100 : 0;
                      return (
                        <div key={cb.value} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 0", borderBottom: `1px solid ${th.cardBorder}20`,
                        }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{cb.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{cb.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtCurrency(cb.amount)}</span>
                            </div>
                            <div style={{ background: `${th.accent}15`, borderRadius: 4, height: 8, overflow: "hidden" }}>
                              <div style={{ background: th.accent, height: "100%", borderRadius: 4, width: `${pct}%`, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ═══ ADD EXPENSE MODAL ═══ */}
      {showAddModal && (
        <div
          onClick={() => { setShowAddModal(false); resetAddForm(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
              background: th.bg, borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
              padding: 0, animation: "slideUp 0.2s ease-out",
            }}
          >
            {/* Modal header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 2,
              background: th.bg, padding: "16px 20px 12px",
              borderBottom: `1px solid ${th.cardBorder}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18 }}>
                {addStep === 1 ? "💰 New Expense" : addStep === 2 ? "💳 Who Paid?" : "📊 Split Between"}
              </span>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: th.muted, padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            {/* Step indicator */}
            <div style={{ display: "flex", gap: 4, padding: "12px 20px 0" }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: s <= addStep ? th.accent : `${th.accent}20`,
                  transition: "background 0.2s",
                }} />
              ))}
            </div>

            <div style={{ padding: "16px 20px 24px" }}>

              {/* ─── STEP 1: What & How Much ─── */}
              {addStep === 1 && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Title *</label>
                    <input style={inputStyle} value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="e.g. Dinner at The Grill" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Amount *</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: th.muted }}>$</span>
                      <input
                        type="number" step="0.01" min="0" style={{ ...inputStyle, paddingLeft: 28 }}
                        value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Category</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setAddCategory(c.value)}
                          style={{
                            padding: "8px 14px", borderRadius: 20,
                            border: `1.5px solid ${addCategory === c.value ? th.accent : th.cardBorder}`,
                            background: addCategory === c.value ? `${th.accent}1a` : "transparent",
                            color: addCategory === c.value ? th.accent : th.muted,
                            fontWeight: addCategory === c.value ? 700 : 500, fontSize: 13,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Date</label>
                      <input type="date" style={inputStyle} value={addDate} onChange={(e) => setAddDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Link to Event</label>
                      <select
                        style={{ ...inputStyle, cursor: "pointer" }}
                        value={addEventId || ""}
                        onChange={(e) => handleEventSelect(e.target.value || null)}
                      >
                        <option value="">None</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.title}{ev.date ? ` (${fmtDate(ev.date)})` : ""}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Notes</label>
                    <input style={inputStyle} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Any extra details..." />
                  </div>

                  <button
                    onClick={() => setAddStep(2)}
                    disabled={!addTitle.trim() || !addAmount || parseFloat(addAmount) <= 0}
                    className="btn"
                    style={{
                      width: "100%", background: th.accent, padding: "12px 24px",
                      fontSize: 14, fontWeight: 700,
                      opacity: !addTitle.trim() || !addAmount || parseFloat(addAmount) <= 0 ? 0.5 : 1,
                    }}
                  >
                    Next: Who Paid? →
                  </button>
                </>
              )}

              {/* ─── STEP 2: Who Paid? ─── */}
              {addStep === 2 && (
                <>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 14 }}>
                    Tap who paid for this {fmtCurrency(parseFloat(addAmount) || 0)} expense.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {members.map((m) => {
                      const selected = addPayers.has(m.id);
                      const payerAmount = addPayers.get(m.id) || 0;
                      return (
                        <div key={m.id}>
                          <div
                            onClick={() => togglePayer(m.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 14px", borderRadius: 12,
                              border: `1.5px solid ${selected ? th.accent : th.cardBorder}`,
                              background: selected ? `${th.accent}0a` : th.card,
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            <Avatar name={m.name} color={selected ? th.accent : th.muted} size={32} />
                            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{m.name}</span>
                            {selected && (
                              <span style={{ fontWeight: 700, color: th.accent, fontSize: 14 }}>✓</span>
                            )}
                          </div>
                          {/* Amount input for multi-payer */}
                          {selected && addPayers.size > 1 && (
                            <div style={{ marginLeft: 52, marginTop: 6 }}>
                              <div style={{ position: "relative", maxWidth: 160 }}>
                                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: th.muted }}>$</span>
                                <input
                                  type="number" step="0.01" min="0"
                                  style={{ ...inputStyle, paddingLeft: 24, fontSize: 13, padding: "6px 10px 6px 24px" }}
                                  value={payerAmount || ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setAddPayers((prev) => {
                                      const next = new Map(prev);
                                      next.set(m.id, val);
                                      return next;
                                    });
                                  }}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Confirmation text */}
                  {addPayers.size === 1 && (
                    <div style={{ fontSize: 13, color: th.accent, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>
                      {memberNameMap[Array.from(addPayers.keys())[0]]} paid the full {fmtCurrency(parseFloat(addAmount) || 0)}
                    </div>
                  )}

                  {/* Validation warning for multi-payer */}
                  {addPayers.size > 1 && (() => {
                    const totalPaid = Array.from(addPayers.values()).reduce((s, v) => s + v, 0);
                    const expTotal = parseFloat(addAmount) || 0;
                    const diff = Math.abs(totalPaid - expTotal);
                    if (diff > 0.01) {
                      return (
                        <div style={{ fontSize: 12, color: "#e74c3c", fontWeight: 600, textAlign: "center", marginBottom: 12 }}>
                          Payer total ({fmtCurrency(totalPaid)}) {totalPaid < expTotal ? "is less than" : "exceeds"} expense total ({fmtCurrency(expTotal)})
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setAddStep(1)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                      ← Back
                    </button>
                    <button
                      onClick={() => {
                        // If single payer, set full amount
                        if (addPayers.size === 1) {
                          const key = Array.from(addPayers.keys())[0];
                          setAddPayers(new Map([[key, parseFloat(addAmount) || 0]]));
                        }
                        setAddStep(3);
                      }}
                      disabled={addPayers.size === 0}
                      className="btn"
                      style={{
                        flex: 2, background: th.accent, padding: "12px 24px",
                        fontSize: 14, fontWeight: 700,
                        opacity: addPayers.size === 0 ? 0.5 : 1,
                      }}
                    >
                      Next: Split Between →
                    </button>
                  </div>
                </>
              )}

              {/* ─── STEP 3: Split Between ─── */}
              {addStep === 3 && (
                <>
                  {/* Split type toggle */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Split Type</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SPLIT_TYPES.map((st) => (
                        <button
                          key={st.value}
                          onClick={() => setAddSplitType(st.value)}
                          style={{
                            padding: "8px 14px", borderRadius: 12, fontSize: 12,
                            border: `1.5px solid ${addSplitType === st.value ? th.accent : th.cardBorder}`,
                            background: addSplitType === st.value ? `${th.accent}1a` : "transparent",
                            color: addSplitType === st.value ? th.accent : th.muted,
                            fontWeight: addSplitType === st.value ? 700 : 500,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    {addSplitType && (
                      <div style={{ fontSize: 11, color: th.muted, marginTop: 4 }}>
                        {SPLIT_TYPES.find((s) => s.value === addSplitType)?.description}
                      </div>
                    )}
                  </div>

                  {/* Family / person chips */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Include in Split</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {familyGroups.map((fg, idx) => {
                        const selected = addSelectedFamilies.has(fg.familyId);
                        return (
                          <div key={fg.familyId}>
                            <div
                              onClick={() => toggleFamily(fg.familyId)}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 14px", borderRadius: 12,
                                border: `1.5px solid ${selected ? th.accent : th.cardBorder}`,
                                background: selected ? `${th.accent}0a` : th.card,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              <Avatar name={fg.label} color={getFamilyColor(idx)} size={32} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{fg.label}</div>
                                <div style={{ fontSize: 11, color: th.muted }}>
                                  {fg.members.map((m) => m.name).join(", ")} · {fg.members.length} {fg.members.length === 1 ? "person" : "people"}
                                </div>
                              </div>
                              {selected && <span style={{ fontWeight: 700, color: th.accent }}>✓</span>}
                            </div>
                            {/* Custom amount input */}
                            {selected && addSplitType === "custom" && (
                              <div style={{ marginLeft: 52, marginTop: 6 }}>
                                <div style={{ position: "relative", maxWidth: 160 }}>
                                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: th.muted }}>$</span>
                                  <input
                                    type="number" step="0.01" min="0"
                                    style={{ ...inputStyle, paddingLeft: 24, fontSize: 13, padding: "6px 10px 6px 24px" }}
                                    value={addCustomAmounts.get(fg.familyId) || ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setAddCustomAmounts((prev) => {
                                        const next = new Map(prev);
                                        next.set(fg.familyId, val);
                                        return next;
                                      });
                                    }}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Split preview */}
                  {splitPreview.length > 0 && (
                    <div style={{
                      background: `${th.accent}08`, border: `1px solid ${th.accent}20`,
                      borderRadius: 12, padding: 14, marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: th.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Split Preview
                      </div>
                      {splitPreview.map((sp) => (
                        <div key={sp.familyId} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>{sp.label}</span>
                          <span style={{ fontWeight: 700 }}>{fmtCurrency(sp.amount)}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px solid ${th.accent}20`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                        <span>Total</span>
                        <span>{fmtCurrency(splitPreview.reduce((s, sp) => s + sp.amount, 0))}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setAddStep(2)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                      ← Back
                    </button>
                    <button
                      onClick={saveExpense}
                      disabled={loading || addSelectedFamilies.size === 0}
                      className="btn"
                      style={{
                        flex: 2, background: th.accent, padding: "12px 24px",
                        fontSize: 14, fontWeight: 700,
                        opacity: loading || addSelectedFamilies.size === 0 ? 0.5 : 1,
                      }}
                    >
                      {loading ? "Saving..." : "Save Expense"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
