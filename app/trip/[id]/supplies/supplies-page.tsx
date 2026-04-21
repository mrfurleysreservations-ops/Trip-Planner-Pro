"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  THEMES,
  GROCERY_SECTIONS,
  SUPPLY_CATEGORIES,
  SUPPLY_STATUSES,
  MEAL_UNITS,
  type GrocerySection,
  type SupplyCategory,
  type SupplyStatus,
} from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import TripSubNav from "../trip-sub-nav";
import type {
  ItineraryEvent,
  EventParticipant,
  MealItem,
  SupplyItem,
  GroceryCheckoff,
  TripMember,
} from "@/types/database.types";
import type { SuppliesPageProps } from "./page";

// ─── Helpers ───

const SECTION_LABEL = new Map<string, string>(
  GROCERY_SECTIONS.map((s) => [s.value, s.label]),
);
const SECTION_ORDER = new Map<string, number>(
  GROCERY_SECTIONS.map((s, idx) => [s.value, idx]),
);
const CATEGORY_LABEL = new Map<string, string>(
  SUPPLY_CATEGORIES.map((c) => [c.value, c.label]),
);
const CATEGORY_ORDER = new Map<string, number>(
  SUPPLY_CATEGORIES.map((c, idx) => [c.value, idx]),
);
const STATUS_CONFIG = new Map<string, (typeof SUPPLY_STATUSES)[number]>(
  SUPPLY_STATUSES.map((s) => [s.value, s]),
);

function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .replace(",", " ·");
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Consistent avatar color from a member id. */
function avatarColor(seed: string): string {
  const palette = [
    "#4a7c59", "#c75a2a", "#5a7cb5", "#b55a8c", "#7a5aa8",
    "#e68a00", "#0097a7", "#9c27b0", "#5a9a2f", "#b8651d",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Round a derived quantity to a readable value — trims trailing zeros. */
function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

// ─── Small sub-components ───

function Avatar({ id, name, size = 22 }: { id: string; name: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: "50%",
        background: avatarColor(id), color: "#fff",
        fontSize: Math.round(size * 0.42), fontWeight: 700, flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {initials(name)}
    </span>
  );
}

// ─── Main component ───

export default function SuppliesPage({
  trip,
  userId,
  isHost,
  members,
  meals: initialMeals,
  mealItems: initialMealItems,
  participants: initialParticipants,
  supplies: initialSupplies,
  checkoffs: initialCheckoffs,
  initialView,
  focusSupplyId,
  focusMealId,
}: SuppliesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === userId) ?? null,
    [members, userId],
  );
  const currentUserName = currentMember?.name || "Someone";
  const currentUserRole = currentMember?.role_preference ?? null;

  const memberById = useMemo(() => {
    const m = new Map<string, TripMember>();
    for (const mem of members) m.set(mem.id, mem);
    return m;
  }, [members]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "accepted"),
    [members],
  );

  // ─── State (mirrors server-fetched props, mutated via Supabase calls) ───

  const [view, setView] = useState<"meals" | "grocery" | "supplies">(initialView);
  const [meals, setMeals] = useState<ItineraryEvent[]>(initialMeals);
  const [mealItems, setMealItems] = useState<MealItem[]>(initialMealItems);
  const [participants, setParticipants] = useState<EventParticipant[]>(initialParticipants);
  const [supplies, setSupplies] = useState<SupplyItem[]>(initialSupplies);
  const [checkoffs, setCheckoffs] = useState<GroceryCheckoff[]>(initialCheckoffs);
  const [loading, setLoading] = useState(false);

  // Modals
  const [openMealId, setOpenMealId] = useState<string | null>(focusMealId);
  const [openSupplyId, setOpenSupplyId] = useState<string | null>(focusSupplyId);
  const [showNewMeal, setShowNewMeal] = useState(false);
  const [showNewSupply, setShowNewSupply] = useState(false);

  // ─── Handle `?view=...` changes without reloading ───
  useEffect(() => {
    const urlView = (searchParams?.get("view") ?? "meals").toLowerCase();
    const next = urlView === "grocery" || urlView === "supplies" ? urlView : "meals";
    setView(next);
  }, [searchParams]);

  const switchView = useCallback(
    (next: "meals" | "grocery" | "supplies") => {
      setView(next);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", next);
      // Clean stale focus params once we navigate intentionally.
      params.delete("supply");
      params.delete("meal");
      router.replace(`/trip/${trip.id}/supplies?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, trip.id],
  );

  // ─── Notes "finalize to supply" bridge ──
  // If the user landed here via /supplies?view=supplies&newSupply=1&fromNote=...&title=...&body=...
  // open the supply editor pre-filled. We do this in a ref-guarded effect so a
  // re-render doesn't re-open the sheet after the user closes it.
  const handledNoteBridgeRef = useRef(false);
  useEffect(() => {
    if (handledNoteBridgeRef.current) return;
    const newSupply = searchParams?.get("newSupply");
    if (newSupply === "1") {
      handledNoteBridgeRef.current = true;
      setShowNewSupply(true);
      // The empty-new-supply form reads the fromNote/title/body params itself.
    }
    const newMeal = searchParams?.get("newMeal");
    if (newMeal === "1") {
      handledNoteBridgeRef.current = true;
      setShowNewMeal(true);
    }
  }, [searchParams]);

  // ─── Derived: meal groupings ───

  const mealsByDay = useMemo(() => {
    const groups = new Map<string, ItineraryEvent[]>();
    for (const m of meals) {
      const key = m.date || "unplaced";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "unplaced") return 1;
      if (b === "unplaced") return -1;
      return a.localeCompare(b);
    });
  }, [meals]);

  const participantsByMeal = useMemo(() => {
    const byMeal = new Map<string, EventParticipant[]>();
    for (const p of participants) {
      if (!byMeal.has(p.event_id)) byMeal.set(p.event_id, []);
      byMeal.get(p.event_id)!.push(p);
    }
    return byMeal;
  }, [participants]);

  const itemsByMeal = useMemo(() => {
    const byMeal = new Map<string, MealItem[]>();
    for (const it of mealItems) {
      if (!byMeal.has(it.event_id)) byMeal.set(it.event_id, []);
      byMeal.get(it.event_id)!.push(it);
    }
    // Respect sort_order then created_at
    for (const arr of byMeal.values()) {
      arr.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return byMeal;
  }, [mealItems]);

  // ─── Derived: grocery aggregation for viewer ───

  const claimedMealIds = useMemo(() => {
    if (!currentMember) return new Set<string>();
    return new Set(
      meals.filter((m) => m.claimed_by === currentMember.id).map((m) => m.id),
    );
  }, [meals, currentMember]);

  const groceryBuckets = useMemo(() => {
    type Agg = {
      name: string;
      unit: string;
      section: string;
      totalQty: number;
      sources: Set<string>;     // meal titles
      mealItemIds: string[];    // for checkoff toggle
    };
    const buckets = new Map<string, Map<string, Agg>>();

    for (const meal of meals) {
      if (!claimedMealIds.has(meal.id)) continue;
      const parts = participantsByMeal.get(meal.id) ?? [];
      const headcount = Math.max(parts.length, 1);
      const items = itemsByMeal.get(meal.id) ?? [];
      for (const it of items) {
        const section = SECTION_LABEL.has(it.grocery_section) ? it.grocery_section : "other";
        const key = `${it.item_name.trim().toLowerCase()}||${it.unit.toLowerCase()}`;
        if (!buckets.has(section)) buckets.set(section, new Map());
        const bucket = buckets.get(section)!;
        const existing = bucket.get(key);
        const totalAdd = Number(it.quantity_per_person) * headcount;
        if (existing) {
          existing.totalQty += totalAdd;
          existing.sources.add(meal.title);
          existing.mealItemIds.push(it.id);
        } else {
          bucket.set(key, {
            name: it.item_name,
            unit: it.unit,
            section,
            totalQty: totalAdd,
            sources: new Set([meal.title]),
            mealItemIds: [it.id],
          });
        }
      }
    }

    // Render-ready ordered structure: [{section, rows}]
    const ordered = Array.from(buckets.entries())
      .sort(
        ([a], [b]) =>
          (SECTION_ORDER.get(a) ?? 99) - (SECTION_ORDER.get(b) ?? 99),
      )
      .map(([section, map]) => ({
        section,
        label: SECTION_LABEL.get(section) ?? section,
        rows: Array.from(map.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
    return ordered;
  }, [meals, claimedMealIds, itemsByMeal, participantsByMeal]);

  const checkedMealItemIds = useMemo(() => {
    return new Set(checkoffs.map((c) => c.meal_item_id));
  }, [checkoffs]);

  // ─── Derived: supplies grouping ───

  const suppliesByCategory = useMemo(() => {
    const groups = new Map<string, SupplyItem[]>();
    for (const s of supplies) {
      const cat = CATEGORY_LABEL.has(s.category) ? s.category : "other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    return Array.from(groups.entries())
      .sort(
        ([a], [b]) => (CATEGORY_ORDER.get(a) ?? 99) - (CATEGORY_ORDER.get(b) ?? 99),
      )
      .map(([cat, items]) => ({
        category: cat,
        label: CATEGORY_LABEL.get(cat) ?? cat,
        items: items.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return a.created_at.localeCompare(b.created_at);
        }),
      }));
  }, [supplies]);

  // ─── Derived: counter chip on Grocery view header ───
  const claimedMealsCount = claimedMealIds.size;

  // ─── Mutations: meals ───

  const createMeal = useCallback(
    async (draft: {
      date: string;
      startTime: string;
      endTime: string;
      title: string;
      claimedByMe: boolean;
      fromNoteId?: string | null;
    }) => {
      if (!draft.title.trim() || !draft.date) return null;
      setLoading(true);
      const timeSlot = (() => {
        const h = parseInt((draft.startTime || "09:00").split(":")[0], 10);
        if (Number.isNaN(h) || h < 12) return "morning";
        if (h < 17) return "afternoon";
        return "evening";
      })();
      const { data, error } = await supabase
        .from("itinerary_events")
        .insert({
          trip_id: trip.id,
          created_by: userId,
          date: draft.date,
          time_slot: timeSlot,
          start_time: draft.startTime || null,
          end_time: draft.endTime || null,
          title: draft.title.trim(),
          event_type: "meal",
          claimed_by: draft.claimedByMe && currentMember ? currentMember.id : null,
          note_id: draft.fromNoteId ?? null,
          sort_order: 0,
        })
        .select()
        .single();
      if (error) {
        console.error("createMeal error:", JSON.stringify(error, null, 2));
        setLoading(false);
        alert(`Couldn't save meal: ${error.message}`);
        return null;
      }
      const newMeal = data as ItineraryEvent;
      setMeals((prev) => [...prev, newMeal]);
      // The DB trigger auto-creates event_participants. Pull them.
      const { data: parts } = await supabase
        .from("event_participants")
        .select("*")
        .eq("event_id", newMeal.id);
      if (parts) {
        setParticipants((prev) => [...prev, ...(parts as EventParticipant[])]);
      }
      // Mark note as finalized if we came from one
      if (draft.fromNoteId) {
        await supabase
          .from("trip_notes")
          .update({
            status: "finalized",
            converted_to: "meal",
            event_id: newMeal.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.fromNoteId);
      }
      logActivity(supabase, {
        tripId: trip.id,
        userId,
        userName: currentUserName,
        action: "created",
        entityType: "meal",
        entityName: newMeal.title,
        entityId: newMeal.id,
        linkPath: `/trip/${trip.id}/supplies?view=meals&meal=${newMeal.id}`,
      });
      setLoading(false);
      return newMeal;
    },
    [supabase, trip.id, userId, currentUserName, currentMember],
  );

  const toggleMealClaimSelf = useCallback(
    async (mealId: string) => {
      if (!currentMember) return;
      const meal = meals.find((m) => m.id === mealId);
      if (!meal) return;
      const currentlyMine = meal.claimed_by === currentMember.id;
      const nextClaimedBy = currentlyMine ? null : currentMember.id;
      setLoading(true);
      const { error } = await supabase
        .from("itinerary_events")
        .update({ claimed_by: nextClaimedBy, updated_at: new Date().toISOString() })
        .eq("id", mealId);
      if (!error) {
        setMeals((prev) =>
          prev.map((m) =>
            m.id === mealId ? { ...m, claimed_by: nextClaimedBy } : m,
          ),
        );
      } else {
        console.error("toggleMealClaim error:", JSON.stringify(error, null, 2));
      }
      setLoading(false);
    },
    [supabase, meals, currentMember],
  );

  const setMealClaimTo = useCallback(
    async (mealId: string, memberId: string | null) => {
      setLoading(true);
      const { error } = await supabase
        .from("itinerary_events")
        .update({ claimed_by: memberId, updated_at: new Date().toISOString() })
        .eq("id", mealId);
      if (!error) {
        setMeals((prev) =>
          prev.map((m) => (m.id === mealId ? { ...m, claimed_by: memberId } : m)),
        );
      } else {
        console.error("setMealClaim error:", JSON.stringify(error, null, 2));
      }
      setLoading(false);
    },
    [supabase],
  );

  // ─── Mutations: meal_items ───

  const addMealItem = useCallback(
    async (eventId: string, draft: {
      itemName: string;
      quantityPerPerson: number;
      unit: string;
      grocerySection: string;
      notes: string;
    }) => {
      if (!draft.itemName.trim()) return null;
      const existingCount = (itemsByMeal.get(eventId) ?? []).length;
      const { data, error } = await supabase
        .from("meal_items")
        .insert({
          event_id: eventId,
          item_name: draft.itemName.trim(),
          quantity_per_person: draft.quantityPerPerson,
          unit: draft.unit || "each",
          grocery_section: draft.grocerySection || "other",
          notes: draft.notes.trim() || null,
          sort_order: existingCount,
        })
        .select()
        .single();
      if (error) {
        console.error("addMealItem error:", JSON.stringify(error, null, 2));
        return null;
      }
      const row = data as MealItem;
      setMealItems((prev) => [...prev, row]);
      return row;
    },
    [supabase, itemsByMeal],
  );

  const updateMealItem = useCallback(
    async (id: string, patch: Partial<MealItem>) => {
      const { error } = await supabase
        .from("meal_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) {
        setMealItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        );
      } else {
        console.error("updateMealItem error:", JSON.stringify(error, null, 2));
      }
    },
    [supabase],
  );

  const deleteMealItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("meal_items").delete().eq("id", id);
      if (!error) {
        setMealItems((prev) => prev.filter((it) => it.id !== id));
      } else {
        console.error("deleteMealItem error:", JSON.stringify(error, null, 2));
      }
    },
    [supabase],
  );

  // ─── Mutations: grocery_checkoffs (per-user) ───

  const toggleGroceryRow = useCallback(
    async (mealItemIds: string[]) => {
      if (mealItemIds.length === 0) return;
      // If ANY of the component meal_item ids are currently checked → uncheck all.
      // Otherwise check all.
      const anyChecked = mealItemIds.some((id) => checkedMealItemIds.has(id));
      if (anyChecked) {
        const { error } = await supabase
          .from("grocery_checkoffs")
          .delete()
          .eq("user_id", userId)
          .in("meal_item_id", mealItemIds);
        if (!error) {
          const ids = new Set(mealItemIds);
          setCheckoffs((prev) => prev.filter((c) => !ids.has(c.meal_item_id)));
        }
      } else {
        const rows = mealItemIds.map((mid) => ({
          meal_item_id: mid,
          user_id: userId,
        }));
        const { data, error } = await supabase
          .from("grocery_checkoffs")
          .upsert(rows, { onConflict: "meal_item_id,user_id" })
          .select();
        if (!error && data) {
          setCheckoffs((prev) => {
            const existing = new Set(
              prev
                .filter((c) => c.user_id === userId)
                .map((c) => c.meal_item_id),
            );
            const toAdd = (data as GroceryCheckoff[]).filter(
              (c) => !existing.has(c.meal_item_id),
            );
            return [...prev, ...toAdd];
          });
        } else if (error) {
          console.error("toggleGrocery error:", JSON.stringify(error, null, 2));
        }
      }
    },
    [supabase, userId, checkedMealItemIds],
  );

  // ─── Mutations: supplies ───

  const createSupply = useCallback(
    async (draft: {
      name: string;
      quantity: number;
      category: SupplyCategory;
      status: SupplyStatus;
      claimedBy: string | null;
      notes: string;
      sourceNoteId?: string | null;
    }) => {
      if (!draft.name.trim()) return null;
      const { data, error } = await supabase
        .from("supply_items")
        .insert({
          trip_id: trip.id,
          name: draft.name.trim(),
          quantity: Math.max(1, Math.floor(draft.quantity)),
          category: draft.category,
          status: draft.status,
          claimed_by: draft.claimedBy,
          notes: draft.notes.trim() || null,
          sort_order: supplies.length,
          source_note_id: draft.sourceNoteId ?? null,
        })
        .select()
        .single();
      if (error) {
        console.error("createSupply error:", JSON.stringify(error, null, 2));
        alert(`Couldn't save supply: ${error.message}`);
        return null;
      }
      const row = data as SupplyItem;
      setSupplies((prev) => [...prev, row]);
      // Finalize the source note if one was provided.
      if (draft.sourceNoteId) {
        await supabase
          .from("trip_notes")
          .update({
            status: "finalized",
            converted_to: "supply",
            supply_id: row.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.sourceNoteId);
      }
      logActivity(supabase, {
        tripId: trip.id,
        userId,
        userName: currentUserName,
        action: "created",
        entityType: "supply",
        entityName: row.name,
        entityId: row.id,
        linkPath: `/trip/${trip.id}/supplies?view=supplies&supply=${row.id}`,
      });
      return row;
    },
    [supabase, trip.id, userId, currentUserName, supplies.length],
  );

  const updateSupply = useCallback(
    async (id: string, patch: Partial<SupplyItem>) => {
      const { error } = await supabase
        .from("supply_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) {
        setSupplies((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        );
      } else {
        console.error("updateSupply error:", JSON.stringify(error, null, 2));
      }
    },
    [supabase],
  );

  const deleteSupply = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("supply_items").delete().eq("id", id);
      if (!error) {
        setSupplies((prev) => prev.filter((s) => s.id !== id));
        setOpenSupplyId(null);
      } else {
        console.error("deleteSupply error:", JSON.stringify(error, null, 2));
      }
    },
    [supabase],
  );

  // ─── Currently-open modal data ───
  const openMeal = openMealId ? meals.find((m) => m.id === openMealId) ?? null : null;
  const openSupply = openSupplyId ? supplies.find((s) => s.id === openSupplyId) ?? null : null;

  // ─── Render ───

  return (
    <div
      style={{
        minHeight: "100vh",
        background: th.bg,
        color: th.text,
        paddingBottom: 56,
      }}
    >
      {/* ─── STICKY TOP REGION ─── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: th.headerBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Row 1 — Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px 8px",
            gap: 8,
          }}
        >
          <button
            onClick={() => router.push(`/trip/${trip.id}`)}
            aria-label="Back to trip hub"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `${th.accent}1a`,
              border: `1.5px solid ${th.accent}40`,
              color: th.accent,
              fontSize: 22,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              transition: "all 0.15s",
            }}
          >
            ←
          </button>
          <h1
            style={{
              flex: 1,
              margin: "0 0 0 10px",
              fontSize: 20,
              fontWeight: 800,
              color: th.text,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            Supplies
          </h1>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {view === "grocery" && (
              <span style={headerCounterStyle(th.accent)}>
                {claimedMealsCount} meal{claimedMealsCount === 1 ? "" : "s"} claimed
              </span>
            )}
          </div>
        </div>

        {/* Row 2 — Segmented pill */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "4px 16px 10px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: th.card,
              border: `1.5px solid ${th.cardBorder}`,
              borderRadius: 20,
            }}
          >
            {(["meals", "grocery", "supplies"] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                style={{
                  background: view === v ? th.accent : "transparent",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: view === v ? 700 : 500,
                  color: view === v ? "#fff" : th.muted,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {v === "meals" ? "Meals" : v === "grocery" ? "Grocery" : "Supplies"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ─── */}
      <div style={{ padding: "14px 16px 96px" }}>
        {view === "meals" && (
          <MealsView
            th={th}
            tripId={trip.id}
            router={router}
            mealsByDay={mealsByDay}
            itemsByMeal={itemsByMeal}
            participantsByMeal={participantsByMeal}
            currentMember={currentMember}
            memberById={memberById}
            onTapMeal={(id) => setOpenMealId(id)}
            focusId={focusMealId}
          />
        )}
        {view === "grocery" && (
          <GroceryView
            th={th}
            buckets={groceryBuckets}
            checked={checkedMealItemIds}
            onToggleRow={toggleGroceryRow}
            hasClaimedMeals={claimedMealsCount > 0}
          />
        )}
        {view === "supplies" && (
          <SuppliesView
            th={th}
            tripId={trip.id}
            router={router}
            groups={suppliesByCategory}
            memberById={memberById}
            currentMember={currentMember}
            onTapSupply={(id) => setOpenSupplyId(id)}
            focusId={focusSupplyId}
          />
        )}
      </div>

      {/* ─── Meal editor sheet ─── */}
      {openMeal && (
        <MealEditorSheet
          th={th}
          meal={openMeal}
          items={itemsByMeal.get(openMeal.id) ?? []}
          attendees={(participantsByMeal.get(openMeal.id) ?? [])
            .map((p) => memberById.get(p.trip_member_id))
            .filter((m): m is TripMember => !!m)}
          members={activeMembers}
          currentMember={currentMember}
          isHost={isHost}
          onClose={() => setOpenMealId(null)}
          onClaimSelf={() => toggleMealClaimSelf(openMeal.id)}
          onClaimTo={(memberId) => setMealClaimTo(openMeal.id, memberId)}
          onAddItem={(draft) => addMealItem(openMeal.id, draft)}
          onUpdateItem={updateMealItem}
          onDeleteItem={deleteMealItem}
        />
      )}

      {/* ─── New meal sheet ─── */}
      {showNewMeal && (
        <NewMealSheet
          th={th}
          trip={trip}
          currentMember={currentMember}
          onClose={() => setShowNewMeal(false)}
          onCreate={async (draft) => {
            const created = await createMeal(draft);
            setShowNewMeal(false);
            if (created) {
              setOpenMealId(created.id);
            }
          }}
          searchParams={searchParams}
        />
      )}

      {/* ─── Supply editor sheet ─── */}
      {openSupply && (
        <SupplyEditorSheet
          th={th}
          supply={openSupply}
          members={activeMembers}
          currentMember={currentMember}
          isHost={isHost}
          onClose={() => setOpenSupplyId(null)}
          onSave={(patch) => updateSupply(openSupply.id, patch)}
          onDelete={() => deleteSupply(openSupply.id)}
          onAddExpense={() => {
            const params = new URLSearchParams({
              fromSupply: openSupply.id,
              title: openSupply.name,
            });
            router.push(`/trip/${trip.id}/expenses?${params.toString()}`);
          }}
        />
      )}

      {/* ─── New supply sheet ─── */}
      {showNewSupply && (
        <SupplyEditorSheet
          th={th}
          supply={null}
          members={activeMembers}
          currentMember={currentMember}
          isHost={isHost}
          prefillFromNote={{
            noteId: searchParams?.get("fromNote") ?? null,
            title: searchParams?.get("title") ?? "",
            body: searchParams?.get("body") ?? "",
          }}
          onClose={() => setShowNewSupply(false)}
          onCreate={async (draft) => {
            const created = await createSupply(draft);
            setShowNewSupply(false);
            if (created) setOpenSupplyId(created.id);
          }}
        />
      )}

      {/* ─── Add FAB (bottom-right, next to sub-nav) ───
          Purple/accent circle per tab-layout-standard. Hidden on Grocery
          since that view is a derived read-only list. */}
      {(view === "meals" || view === "supplies") && (
        <button
          onClick={() =>
            view === "meals" ? setShowNewMeal(true) : setShowNewSupply(true)
          }
          aria-label={view === "meals" ? "Add meal" : "Add supply"}
          style={{
            position: "fixed",
            bottom: 72,
            right: 16,
            zIndex: 50,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
            color: "#fff",
            border: "none",
            fontSize: 28,
            fontWeight: 300,
            cursor: "pointer",
            boxShadow: `0 4px 20px ${th.accent}60`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      )}

      {/* Shared sub-nav */}
      <TripSubNav tripId={trip.id} theme={th} role={currentUserRole} />

      {/* Animations shared by every sheet */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {loading && (
        <div
          aria-hidden
          style={{
            position: "fixed", left: 0, right: 0, top: 0, height: 2,
            background: th.accent, zIndex: 2000, opacity: 0.6,
          }}
        />
      )}
    </div>
  );
}

// ─── Shared style helpers ───

function headerCounterStyle(accent: string): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 20,
    background: `${accent}14`,
    color: accent,
    fontWeight: 700,
    fontSize: 12,
    border: `1px solid ${accent}33`,
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  };
}

function pillBase(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
  };
}

// ─── Sub-view: Meals ───

function MealsView({
  th,
  tripId,
  router,
  mealsByDay,
  itemsByMeal,
  participantsByMeal,
  currentMember,
  memberById,
  onTapMeal,
  focusId,
}: {
  th: (typeof THEMES)["home"];
  tripId: string;
  router: ReturnType<typeof useRouter>;
  mealsByDay: [string, ItineraryEvent[]][];
  itemsByMeal: Map<string, MealItem[]>;
  participantsByMeal: Map<string, EventParticipant[]>;
  currentMember: TripMember | null;
  memberById: Map<string, TripMember>;
  onTapMeal: (id: string) => void;
  focusId: string | null;
}) {
  if (mealsByDay.length === 0) {
    return (
      <div style={emptyStateStyle(th)}>
        No meals yet. Tap <strong>＋ Meal</strong> to add one.
      </div>
    );
  }

  return (
    <>
      {mealsByDay.map(([day, items]) => (
        <div key={day}>
          <div
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "#888",
              textTransform: "uppercase",
              margin: "10px 2px 8px",
            }}
          >
            {day === "unplaced" ? "Unscheduled" : formatDateHeader(day)}
          </div>
          {items.map((meal) => {
            const mealItems = itemsByMeal.get(meal.id) ?? [];
            const parts = participantsByMeal.get(meal.id) ?? [];
            const claimedByMe = currentMember ? meal.claimed_by === currentMember.id : false;
            const claimer = meal.claimed_by ? memberById.get(meal.claimed_by) ?? null : null;
            const focused = focusId === meal.id;
            return (
              <button
                key={meal.id}
                onClick={() => onTapMeal(meal.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "#fff",
                  borderRadius: 16,
                  border: focused ? `2px solid ${th.accent}` : "1px solid #e8e8e8",
                  padding: 14,
                  marginBottom: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      color: th.accent,
                      background: `${th.accent}14`,
                      padding: "4px 8px",
                      borderRadius: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {meal.start_time ? formatTime12h(meal.start_time) : "—"}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      lineHeight: 1.25,
                      paddingTop: 2,
                      color: th.text,
                    }}
                  >
                    {meal.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams({
                        fromEvent: meal.id,
                        title: meal.title,
                        ...(meal.date ? { date: meal.date } : {}),
                      });
                      router.push(`/trip/${tripId}/expenses?${params.toString()}`);
                    }}
                    aria-label="Add expense for this meal"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: `${th.accent}14`,
                      border: `1px solid ${th.accent}33`,
                      color: th.accent,
                      fontSize: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    💳
                  </button>
                  <span style={{ color: "#bbb", fontSize: 18, paddingTop: 2 }}>›</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ ...pillBase(), background: "#eaf2ec", color: "#4a7c59" }}>
                    👥 {parts.length} attending
                  </span>
                  {claimedByMe ? (
                    <span
                      style={{
                        ...pillBase(),
                        background: `${th.accent}26`,
                        color: th.accent,
                        fontWeight: 700,
                      }}
                    >
                      {currentMember && <Avatar id={currentMember.id} name={currentMember.name} size={20} />}
                      You're buying
                    </span>
                  ) : claimer ? (
                    <span style={{ ...pillBase(), background: "#f2edea", color: "#555" }}>
                      <Avatar id={claimer.id} name={claimer.name} size={20} />
                      {claimer.name.split(/\s+/)[0]}
                    </span>
                  ) : (
                    <span
                      style={{
                        ...pillBase(),
                        background: "#fde7e1",
                        color: "#c75a2a",
                        fontWeight: 700,
                      }}
                    >
                      Needs a buyer
                    </span>
                  )}
                  <span
                    style={{
                      ...pillBase(),
                      background: mealItems.length === 0 ? "#f2edea" : "#fff3e0",
                      color: mealItems.length === 0 ? "#555" : "#b8651d",
                    }}
                  >
                    {mealItems.length === 0
                      ? "Tap to add items"
                      : `${mealItems.length} item${mealItems.length === 1 ? "" : "s"}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ─── Sub-view: Grocery ───

function GroceryView({
  th,
  buckets,
  checked,
  onToggleRow,
  hasClaimedMeals,
}: {
  th: (typeof THEMES)["home"];
  buckets: Array<{
    section: string;
    label: string;
    rows: Array<{
      name: string;
      unit: string;
      section: string;
      totalQty: number;
      sources: Set<string>;
      mealItemIds: string[];
    }>;
  }>;
  checked: Set<string>;
  onToggleRow: (mealItemIds: string[]) => void;
  hasClaimedMeals: boolean;
}) {
  if (!hasClaimedMeals) {
    return (
      <div style={emptyStateStyle(th)}>
        Claim a meal on the <strong>Meals</strong> tab to build your grocery list.
      </div>
    );
  }
  if (buckets.length === 0) {
    return (
      <div style={emptyStateStyle(th)}>
        You've claimed meals, but they don't have any ingredients yet. Add items to each meal to build your list.
      </div>
    );
  }
  return (
    <>
      {buckets.map((bucket) => (
        <div key={bucket.section}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "16px 2px 8px",
            }}
          >
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.1em",
                color: th.accent,
                textTransform: "uppercase",
              }}
            >
              {bucket.label}
            </span>
            <span style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>
              {bucket.rows.length} item{bucket.rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {bucket.rows.map((row) => {
            const allChecked = row.mealItemIds.every((id) => checked.has(id));
            const sourceList = Array.from(row.sources);
            const sourceText =
              sourceList.length === 1
                ? `for ${sourceList[0]}`
                : sourceList.length === 2
                  ? `${sourceList.join(" · ")}`
                  : `${sourceList[0]} +${sourceList.length - 1} more`;
            return (
              <button
                key={row.mealItemIds.join(":")}
                onClick={() => onToggleRow(row.mealItemIds)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e8e8e8",
                  padding: "12px 14px",
                  marginBottom: 6,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: allChecked ? `2px solid ${th.accent}` : "2px solid #c5c0b7",
                    background: allChecked ? th.accent : "#fff",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {allChecked ? "✓" : ""}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 14,
                      lineHeight: 1.25,
                      color: allChecked ? "#aaa" : th.text,
                      textDecoration: allChecked ? "line-through" : "none",
                    }}
                  >
                    {row.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "#888",
                      marginTop: 2,
                      opacity: allChecked ? 0.5 : 1,
                    }}
                  >
                    {sourceText}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    color: th.accent,
                    flexShrink: 0,
                  }}
                >
                  {formatQty(row.totalQty)} {row.unit}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ─── Sub-view: Supplies ───

function SuppliesView({
  th,
  tripId,
  router,
  groups,
  memberById,
  currentMember,
  onTapSupply,
  focusId,
}: {
  th: (typeof THEMES)["home"];
  tripId: string;
  router: ReturnType<typeof useRouter>;
  groups: Array<{ category: string; label: string; items: SupplyItem[] }>;
  memberById: Map<string, TripMember>;
  currentMember: TripMember | null;
  onTapSupply: (id: string) => void;
  focusId: string | null;
}) {
  if (groups.length === 0) {
    return (
      <div style={emptyStateStyle(th)}>
        No shared supplies yet. Tap <strong>＋ Supply</strong> to add fuel, consumables, toiletries, or more.
      </div>
    );
  }
  return (
    <>
      {groups.map(({ category, label, items }) => (
        <div key={category}>
          <div
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "#888",
              textTransform: "uppercase",
              margin: "14px 2px 8px",
            }}
          >
            {label}
          </div>
          {items.map((s) => {
            const claimer = s.claimed_by ? memberById.get(s.claimed_by) ?? null : null;
            const claimedByMe = currentMember && s.claimed_by === currentMember.id;
            const statusCfg = STATUS_CONFIG.get(s.status) ?? SUPPLY_STATUSES[0];
            const focused = focusId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onTapSupply(s.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "#fff",
                  borderRadius: 16,
                  border: focused ? `2px solid ${th.accent}` : "1px solid #e8e8e8",
                  padding: 14,
                  marginBottom: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      flex: 1,
                      lineHeight: 1.3,
                      color: th.text,
                    }}
                  >
                    {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams({
                        fromSupply: s.id,
                        title: s.name,
                      });
                      router.push(`/trip/${tripId}/expenses?${params.toString()}`);
                    }}
                    aria-label="Add expense for this supply"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: `${th.accent}14`,
                      border: `1px solid ${th.accent}33`,
                      color: th.accent,
                      fontSize: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    💳
                  </button>
                  <span
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                      fontSize: 13,
                      background: "#f2edea",
                      color: "#555",
                      padding: "3px 8px",
                      borderRadius: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ×{s.quantity}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 12,
                      background: `${th.accent}14`,
                      color: th.accent,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: statusCfg.color,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: statusCfg.color,
                      }}
                    />
                    {statusCfg.label}
                  </span>
                  {claimedByMe ? (
                    <span
                      style={{
                        ...pillBase(),
                        background: `${th.accent}26`,
                        color: th.accent,
                        fontWeight: 700,
                      }}
                    >
                      {currentMember && <Avatar id={currentMember.id} name={currentMember.name} size={20} />}
                      You
                    </span>
                  ) : claimer ? (
                    <span style={{ ...pillBase(), background: "#f2edea", color: "#555" }}>
                      <Avatar id={claimer.id} name={claimer.name} size={20} />
                      {claimer.name.split(/\s+/)[0]}
                    </span>
                  ) : (
                    <span
                      style={{
                        ...pillBase(),
                        background: "#fde7e1",
                        color: "#c75a2a",
                        fontWeight: 700,
                      }}
                    >
                      Needs a buyer
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

function emptyStateStyle(th: (typeof THEMES)["home"]): React.CSSProperties {
  return {
    padding: "40px 20px",
    textAlign: "center",
    color: th.muted,
    fontSize: 14,
    lineHeight: 1.6,
    background: th.card,
    borderRadius: 16,
    border: `1px dashed ${th.cardBorder}`,
    marginTop: 20,
    fontFamily: "'DM Sans', sans-serif",
  };
}

// ─── Bottom-sheet shell (shared by all three sheets) ───
//
// Structure enforced by slot components:
//   <Sheet>
//     <SheetHandle />
//     <SheetHeader ... />
//     <SheetBody> ... scrolling content ... </SheetBody>
//     [optional] <SheetStickyBar> ... sticky add-bar ... </SheetStickyBar>
//     <SheetFooter> ... primary action + secondary ... </SheetFooter>
//   </Sheet>
//
// The body is the only scrolling region — handle/header/sticky-bar/footer
// never move. This prevents the Save button from scrolling off-screen when
// a long list (e.g. ingredients) grows inside the body.

function Sheet({
  onClose,
  children,
  height,
}: {
  onClose: () => void;
  children: React.ReactNode;
  height?: string | number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          height: height ?? undefined,
          minHeight: 0,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
          background: "#fff",
          animation: "slideUp 0.2s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SheetBody({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
        padding: "14px 20px 16px",
      }}
    >
      {children}
    </div>
  );
}

function SheetStickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 16px",
        borderTop: "1px solid #eee",
        background: "#fafaf7",
      }}
    >
      {children}
    </div>
  );
}

function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "12px 20px 18px",
        borderTop: "1px solid #eee",
        background: "#fff",
        borderRadius: "0 0 20px 20px",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function SheetHandle() {
  return (
    <div
      aria-hidden
      style={{
        width: 44,
        height: 4,
        borderRadius: 2,
        background: "#d4cec3",
        margin: "10px auto 6px",
        flexShrink: 0,
      }}
    />
  );
}

function SheetHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "6px 20px 14px",
        borderBottom: "1px solid #eee",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 19,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: "#777", marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          background: "#f2edea",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          color: "#777",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Sheet: Meal editor ───

function MealEditorSheet({
  th,
  meal,
  items,
  attendees,
  members,
  currentMember,
  isHost,
  onClose,
  onClaimSelf,
  onClaimTo,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: {
  th: (typeof THEMES)["home"];
  meal: ItineraryEvent;
  items: MealItem[];
  attendees: TripMember[];
  members: TripMember[];
  currentMember: TripMember | null;
  isHost: boolean;
  onClose: () => void;
  onClaimSelf: () => void;
  onClaimTo: (memberId: string | null) => void;
  onAddItem: (draft: {
    itemName: string;
    quantityPerPerson: number;
    unit: string;
    grocerySection: string;
    notes: string;
  }) => Promise<MealItem | null>;
  onUpdateItem: (id: string, patch: Partial<MealItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [changingClaimer, setChangingClaimer] = useState(false);

  const claimedByMe = currentMember ? meal.claimed_by === currentMember.id : false;
  const claimer = meal.claimed_by ? members.find((m) => m.id === meal.claimed_by) ?? null : null;
  const attendCount = attendees.length;
  const visibleAttendees = attendees.slice(0, 4);
  const extraAttendees = attendees.length - visibleAttendees.length;

  const subtitle = `${formatDateShort(meal.date)} · ${meal.start_time ? formatTime12h(meal.start_time) : "—"}`;

  return (
    <Sheet onClose={onClose}>
      <SheetHandle />
      <SheetHeader title={meal.title} subtitle={subtitle} onClose={onClose} />
      <SheetBody>
        {/* Attendees */}
        <SheetSecLabel>Attending ({attendCount})</SheetSecLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          {visibleAttendees.map((a) => (
            <span
              key={a.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px 5px 5px",
                background: "#f6f1ec",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#444",
              }}
            >
              <Avatar id={a.id} name={a.name} size={22} />
              {a.name.split(/\s+/)[0]}
            </span>
          ))}
          {extraAttendees > 0 && (
            <span
              style={{
                padding: "5px 10px",
                background: "#f6f1ec",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
                color: "#777",
              }}
            >
              +{extraAttendees} more
            </span>
          )}
          {attendCount === 0 && (
            <span style={{ fontSize: 12, color: "#999" }}>Nobody's attending yet.</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "#999", marginTop: 8 }}>
          ⓘ Manage attendees on the Itinerary tab.
        </div>

        {/* Who's buying — moved above ingredients so the claim control is always
            visible near the top of the scrolling body. */}
        <SheetSecLabel>Who's buying?</SheetSecLabel>
        <div
          style={{
            border: claimedByMe ? `1px solid ${th.accent}55` : "1px solid #e5dfd0",
            background: claimedByMe ? `${th.accent}10` : "#fbf8f3",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={onClaimSelf}
            aria-label={claimedByMe ? "Unclaim this meal" : "Claim this meal"}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: claimedByMe ? `2px solid ${th.accent}` : "2px solid #c5bdae",
              background: claimedByMe ? th.accent : "#fff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            {claimedByMe ? "✓" : ""}
          </button>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#333" }}>
            {claimedByMe
              ? "You're buying this meal"
              : claimer
                ? `${claimer.name} is buying this meal`
                : "No one's bought this yet — tap to claim"}
            <div style={{ fontSize: 11.5, color: "#888", fontWeight: 400, marginTop: 2 }}>
              {claimedByMe
                ? `Your grocery list will include these ${items.length} item${items.length === 1 ? "" : "s"}.`
                : claimer
                  ? `${claimer.name.split(/\s+/)[0]}'s grocery list covers it.`
                  : "Claim it to add its items to your grocery list."}
            </div>
          </div>
          {isHost && (
            <button
              onClick={() => setChangingClaimer((s) => !s)}
              style={{
                fontSize: 11.5,
                color: th.accent,
                fontWeight: 700,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {changingClaimer ? "Cancel" : "Change"}
            </button>
          )}
        </div>

        {changingClaimer && (
          <div style={{ marginTop: 10 }}>
            <select
              value={meal.claimed_by ?? ""}
              onChange={(e) => {
                onClaimTo(e.target.value || null);
                setChangingClaimer(false);
              }}
              style={fieldSelectStyle}
            >
              <option value="">— Unassigned —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {currentMember && m.id === currentMember.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Ingredients list (the "+ Add ingredient" bar lives in the sticky
            sub-bar below the body so it stays reachable while the list scrolls). */}
        <SheetSecLabel>
          Ingredients{" "}
          <span style={{ fontWeight: 500, color: "#aaa", textTransform: "none", letterSpacing: 0 }}>
            per-person qty × {attendCount} attending
          </span>
        </SheetSecLabel>

        {items.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#aaa", padding: "2px 2px 6px" }}>
            No ingredients yet — add one below.
          </div>
        )}

        {items.map((item) =>
          editingItemId === item.id ? (
            <IngredientEditor
              key={item.id}
              th={th}
              initial={item}
              onCancel={() => setEditingItemId(null)}
              onSave={async (draft) => {
                await onUpdateItem(item.id, {
                  item_name: draft.itemName.trim(),
                  quantity_per_person: draft.quantityPerPerson,
                  unit: draft.unit,
                  grocery_section: draft.grocerySection,
                  notes: draft.notes.trim() || null,
                });
                setEditingItemId(null);
              }}
              onDelete={async () => {
                await onDeleteItem(item.id);
                setEditingItemId(null);
              }}
            />
          ) : (
            <button
              key={item.id}
              onClick={() => setEditingItemId(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                marginBottom: 6,
                background: "#fff",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ color: "#ccc", fontSize: 14 }}>⋮⋮</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>
                  {item.item_name}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#888", marginTop: 2 }}>
                  {formatQty(Number(item.quantity_per_person))} {item.unit}/person ·{" "}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 7px",
                      background: `${th.accent}14`,
                      color: th.accent,
                      borderRadius: 10,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {SECTION_LABEL.get(item.grocery_section) ?? item.grocery_section}
                  </span>
                </span>
              </span>
              <span style={{ fontSize: 15, color: "#bbb" }}>›</span>
            </button>
          ),
        )}
      </SheetBody>

      {/* Sticky sub-bar: always-visible "+ Add ingredient" form.
          Sits between the scrolling body and the fixed footer so the user can
          keep adding items while the list grows in the body above. */}
      <SheetStickyBar>
        <AddIngredientBar th={th} onAdd={onAddItem} />
      </SheetStickyBar>

      <SheetFooter>
        <button
          onClick={onClose}
          style={{
            ...btnPrimaryStyle(th.accent),
            flex: 1,
            padding: 14,
            fontSize: 14,
          }}
        >
          Done
        </button>
      </SheetFooter>
    </Sheet>
  );
}

// ─── Compact add-ingredient bar (lives in the MealEditorSheet sticky sub-bar) ───
//
// Two compact rows: [item | qty | unit] / [section | Add]. After a successful
// add, the form resets so the user can keep adding rows without scrolling.

function AddIngredientBar({
  th,
  onAdd,
}: {
  th: (typeof THEMES)["home"];
  onAdd: (draft: {
    itemName: string;
    quantityPerPerson: number;
    unit: string;
    grocerySection: string;
    notes: string;
  }) => Promise<MealItem | null>;
}) {
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("each");
  const [section, setSection] = useState<GrocerySection>("other");
  const [saving, setSaving] = useState(false);

  const parsedQty = parseFloat(qty);
  const canAdd =
    !!itemName.trim() && Number.isFinite(parsedQty) && parsedQty > 0 && !saving;

  const reset = () => {
    setItemName("");
    setQty("1");
    setUnit("each");
    setSection("other");
  };

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    const row = await onAdd({
      itemName,
      quantityPerPerson: parsedQty,
      unit,
      grocerySection: section,
      notes: "",
    });
    setSaving(false);
    if (row) reset();
  };

  const compactInputStyle: React.CSSProperties = {
    ...fieldInputStyle,
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: 8,
  };
  const compactSelectStyle: React.CSSProperties = {
    ...fieldSelectStyle,
    padding: "8px 24px 8px 8px",
    fontSize: 12.5,
    borderRadius: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="+ Add ingredient"
          aria-label="Ingredient name"
          style={{ ...compactInputStyle, flex: 2, minWidth: 0 }}
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          aria-label="Quantity per person"
          style={{ ...compactInputStyle, width: 52, textAlign: "center" }}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Unit"
          style={{ ...compactSelectStyle, width: 72 }}
        >
          {MEAL_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as GrocerySection)}
          aria-label="Grocery section"
          style={{ ...compactSelectStyle, flex: 1, minWidth: 0 }}
        >
          {GROCERY_SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          aria-label="Add ingredient"
          style={{
            ...btnPrimaryStyle(th.accent),
            padding: "8px 18px",
            fontSize: 13,
            opacity: canAdd ? 1 : 0.5,
            flexShrink: 0,
          }}
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function SheetSecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.1em",
        color: "#888",
        textTransform: "uppercase",
        margin: "14px 2px 8px",
      }}
    >
      {children}
    </div>
  );
}

// ─── Inline ingredient editor (in-place expansion inside the meal sheet) ───

function IngredientEditor({
  th,
  initial,
  onCancel,
  onSave,
  onDelete,
}: {
  th: (typeof THEMES)["home"];
  initial: MealItem | null;
  onCancel: () => void;
  onSave: (draft: {
    itemName: string;
    quantityPerPerson: number;
    unit: string;
    grocerySection: string;
    notes: string;
  }) => Promise<void>;
  onDelete: (() => Promise<void>) | null;
}) {
  const [itemName, setItemName] = useState(initial?.item_name ?? "");
  const [qty, setQty] = useState(
    initial ? String(initial.quantity_per_person) : "1",
  );
  const [unit, setUnit] = useState(initial?.unit ?? "each");
  const [section, setSection] = useState<GrocerySection>(
    (initial?.grocery_section as GrocerySection) ?? "other",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!itemName.trim()) return;
    const parsed = parseFloat(qty);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSaving(true);
    await onSave({
      itemName,
      quantityPerPerson: parsed,
      unit: unit || "each",
      grocerySection: section,
      notes,
    });
    setSaving(false);
  };

  return (
    <div
      style={{
        background: "#f7f3ee",
        border: `1.5px solid ${th.accent}33`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <FieldLabel>Item</FieldLabel>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Eggs"
            style={fieldInputStyle}
            autoFocus
          />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Qty/person</FieldLabel>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            style={fieldInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Unit</FieldLabel>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={fieldSelectStyle}
          >
            {MEAL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <FieldLabel>Grocery section</FieldLabel>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as GrocerySection)}
          style={fieldSelectStyle}
        >
          {GROCERY_SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <FieldLabel>Note (optional)</FieldLabel>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. organic, large"
          style={fieldInputStyle}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        {onDelete ? (
          <button
            onClick={async () => {
              setSaving(true);
              await onDelete();
              setSaving(false);
            }}
            disabled={saving}
            style={{
              color: "#c75a2a",
              fontWeight: 600,
              fontSize: 12.5,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            🗑 Remove
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} disabled={saving} style={btnGhostStyle}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !itemName.trim()}
            style={{ ...btnPrimaryStyle(th.accent), opacity: saving || !itemName.trim() ? 0.6 : 1 }}
          >
            {initial ? "Save item" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sheet: New meal ───

function NewMealSheet({
  th,
  trip,
  currentMember,
  onClose,
  onCreate,
  searchParams,
}: {
  th: (typeof THEMES)["home"];
  trip: SuppliesPageProps["trip"];
  currentMember: TripMember | null;
  onClose: () => void;
  onCreate: (draft: {
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    claimedByMe: boolean;
    fromNoteId?: string | null;
  }) => Promise<void>;
  searchParams: URLSearchParams | null;
}) {
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return [];
    const days: string[] = [];
    const s = new Date(trip.start_date + "T12:00:00");
    const e = new Date(trip.end_date + "T12:00:00");
    const cur = new Date(s);
    while (cur <= e) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [trip.start_date, trip.end_date]);

  const noteParams = {
    noteId: searchParams?.get("fromNote") ?? null,
    title: searchParams?.get("title") ?? "",
  };

  const [date, setDate] = useState<string>(tripDays[0] ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState(noteParams.title);
  const [claimedByMe, setClaimedByMe] = useState(!!currentMember);
  const [saving, setSaving] = useState(false);

  const valid = !!title.trim() && !!date;

  return (
    <Sheet onClose={onClose}>
      <SheetHandle />
      <SheetHeader
        title="New meal"
        subtitle="Meals become itinerary events with event_type = 'meal'."
        onClose={onClose}
      />
      <SheetBody>
        <FieldLabel>Title</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Saturday breakfast"
          style={fieldInputStyle}
          autoFocus
        />

        <div style={{ marginTop: 14 }}>
          <FieldLabel>Day</FieldLabel>
          {tripDays.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tripDays.map((d) => (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${th.accent}`,
                    background: date === d ? th.accent : `${th.accent}10`,
                    color: date === d ? "#fff" : th.accent,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {formatDateShort(d)}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={fieldInputStyle}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Start time</FieldLabel>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={fieldInputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>End time</FieldLabel>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={fieldInputStyle}
            />
          </div>
        </div>

        {currentMember && (
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: `1px solid ${claimedByMe ? `${th.accent}55` : "#e5dfd0"}`,
                background: claimedByMe ? `${th.accent}10` : "#fbf8f3",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <input
                type="checkbox"
                checked={claimedByMe}
                onChange={(e) => setClaimedByMe(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
                I'll buy the groceries for this meal
              </span>
            </label>
          </div>
        )}
      </SheetBody>

      <SheetFooter>
        <button onClick={onClose} style={{ ...btnGhostStyle, flex: 1 }} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!valid) return;
            setSaving(true);
            await onCreate({
              date,
              startTime,
              endTime,
              title,
              claimedByMe,
              fromNoteId: noteParams.noteId,
            });
            setSaving(false);
          }}
          disabled={!valid || saving}
          style={{
            ...btnPrimaryStyle(th.accent),
            flex: 2,
            padding: 14,
            opacity: !valid || saving ? 0.6 : 1,
          }}
        >
          {saving ? "Creating…" : "Create meal"}
        </button>
      </SheetFooter>
    </Sheet>
  );
}

// ─── Sheet: Supply editor (also handles "new supply") ───

function SupplyEditorSheet({
  th,
  supply,
  members,
  currentMember,
  isHost,
  onClose,
  onSave,
  onCreate,
  onDelete,
  onAddExpense,
  prefillFromNote,
}: {
  th: (typeof THEMES)["home"];
  supply: SupplyItem | null;
  members: TripMember[];
  currentMember: TripMember | null;
  isHost: boolean;
  onClose: () => void;
  onSave?: (patch: Partial<SupplyItem>) => Promise<void>;
  onCreate?: (draft: {
    name: string;
    quantity: number;
    category: SupplyCategory;
    status: SupplyStatus;
    claimedBy: string | null;
    notes: string;
    sourceNoteId?: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onAddExpense?: () => void;
  prefillFromNote?: {
    noteId: string | null;
    title: string;
    body: string;
  };
}) {
  const [name, setName] = useState(supply?.name ?? prefillFromNote?.title ?? "");
  const [quantity, setQuantity] = useState(supply ? String(supply.quantity) : "1");
  const [category, setCategory] = useState<SupplyCategory>(
    (supply?.category as SupplyCategory) ?? "other",
  );
  const [status, setStatus] = useState<SupplyStatus>(
    (supply?.status as SupplyStatus) ?? "needed",
  );
  const [claimedBy, setClaimedBy] = useState<string | null>(supply?.claimed_by ?? null);
  const [notes, setNotes] = useState(supply?.notes ?? prefillFromNote?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!supply;
  const claimedByMe = currentMember ? claimedBy === currentMember.id : false;

  const toggleClaimMe = () => {
    if (!currentMember) return;
    setClaimedBy(claimedByMe ? null : currentMember.id);
    // Transition status automatically: none → claimed on first claim.
    if (!claimedByMe && status === "needed") setStatus("claimed");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const parsedQty = parseInt(quantity, 10);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return;
    setSaving(true);
    if (isEdit && onSave) {
      await onSave({
        name: name.trim(),
        quantity: parsedQty,
        category,
        status,
        claimed_by: claimedBy,
        notes: notes.trim() || null,
      });
      onClose();
    } else if (onCreate) {
      await onCreate({
        name,
        quantity: parsedQty,
        category,
        status,
        claimedBy,
        notes,
        sourceNoteId: prefillFromNote?.noteId ?? null,
      });
    }
    setSaving(false);
  };

  return (
    <Sheet onClose={onClose}>
      <SheetHandle />
      <SheetHeader
        title={isEdit ? "Edit supply" : "New supply"}
        subtitle={isEdit ? `${CATEGORY_LABEL.get(supply!.category) ?? "Other"}` : "Add something the group needs."}
        onClose={onClose}
      />
      <SheetBody>
        <FieldLabel>Item</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 2 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Firewood"
              style={fieldInputStyle}
              autoFocus
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Qty</FieldLabel>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              style={fieldInputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <FieldLabel>Category</FieldLabel>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupplyCategory)}
            style={fieldSelectStyle}
          >
            {SUPPLY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <SheetSecLabel>Status</SheetSecLabel>
        <div style={{ display: "flex", gap: 6 }}>
          {SUPPLY_STATUSES.map((s) => {
            const active = status === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: `1px solid ${active ? s.color + "55" : "#e0dacd"}`,
                  background: active ? s.color + "22" : "#fff",
                  color: active ? s.color : "#666",
                  fontWeight: active ? 700 : 600,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8, height: 8, borderRadius: "50%", background: s.color,
                  }}
                />
                {s.label}
              </button>
            );
          })}
        </div>

        <SheetSecLabel>Who's bringing it?</SheetSecLabel>
        <div
          onClick={toggleClaimMe}
          style={{
            border: claimedByMe ? `1px solid ${th.accent}55` : "1px solid #e5dfd0",
            background: claimedByMe ? `${th.accent}10` : "#fbf8f3",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: currentMember ? "pointer" : "default",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 24, height: 24, borderRadius: 6,
              border: claimedByMe ? `2px solid ${th.accent}` : "2px solid #c5bdae",
              background: claimedByMe ? th.accent : "#fff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {claimedByMe ? "✓" : ""}
          </span>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#333" }}>
            I'll bring it
            <div style={{ fontSize: 11.5, color: "#888", fontWeight: 400, marginTop: 2 }}>
              {isHost ? "Or pick someone else below" : "Uncheck to un-claim."}
            </div>
          </div>
        </div>

        {isHost && (
          <div style={{ marginTop: 10 }}>
            <select
              value={claimedBy ?? ""}
              onChange={(e) => setClaimedBy(e.target.value || null)}
              style={fieldSelectStyle}
            >
              <option value="">— Nobody yet —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {currentMember && m.id === currentMember.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {isEdit && onAddExpense && (
          <>
            <SheetSecLabel>Cost & reimbursement</SheetSecLabel>
            <button
              type="button"
              onClick={onAddExpense}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${th.accent}40`,
                background: `${th.accent}0d`,
                color: th.accent,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>💳</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                Add expense for reimbursement
              </span>
              <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>→</span>
            </button>
            <div style={{ fontSize: 11, color: "#888", marginTop: 6, lineHeight: 1.4 }}>
              Logs what you paid to the Expenses tab so the group can settle up.
            </div>
          </>
        )}

        <SheetSecLabel>Notes (optional)</SheetSecLabel>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. pickup at REI"
          style={fieldInputStyle}
        />
      </SheetBody>

      <SheetFooter>
        {isEdit && onDelete && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
            style={{
              color: "#c75a2a",
              fontWeight: 600,
              fontSize: 12.5,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              padding: "8px 6px",
              flexShrink: 0,
            }}
          >
            🗑 Delete
          </button>
        )}
        {isEdit && onDelete && confirmDelete && (
          <button
            onClick={async () => {
              setSaving(true);
              await onDelete();
              setSaving(false);
            }}
            disabled={saving}
            style={{
              color: "#fff",
              background: "#c75a2a",
              fontWeight: 700,
              fontSize: 12.5,
              border: "none",
              borderRadius: 10,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              flexShrink: 0,
            }}
          >
            Confirm delete
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          style={{
            ...btnPrimaryStyle(th.accent),
            flex: 1,
            padding: 14,
            opacity: saving || !name.trim() ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : isEdit ? "Save supply" : "Add supply"}
        </button>
      </SheetFooter>
    </Sheet>
  );
}

// ─── Field styles ───

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#888",
        marginBottom: 4,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </div>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e0dacd",
  borderRadius: 10,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  background: "#fff",
  color: "#1a1a1a",
  boxSizing: "border-box",
};

const fieldSelectStyle: React.CSSProperties = {
  ...fieldInputStyle,
  paddingRight: 32,
  appearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23999' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};

const btnGhostStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #d8d0c2",
  fontWeight: 600,
  fontSize: 13,
  color: "#555",
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
};

function btnPrimaryStyle(accent: string): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 10,
    background: accent,
    border: "none",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  };
}
