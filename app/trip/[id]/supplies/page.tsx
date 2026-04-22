import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ItineraryEvent,
  EventParticipant,
  MealItem,
  SupplyItem,
  GroceryCheckoff,
} from "@/types/database.types";
import { getTripData } from "@/lib/trip-data";
import SuppliesPage from "./supplies-page";

export interface SuppliesPageProps {
  meals: ItineraryEvent[];
  mealItems: MealItem[];
  participants: EventParticipant[];
  supplies: SupplyItem[];
  checkoffs: GroceryCheckoff[];
  initialView: "meals" | "grocery" | "supplies";
  focusSupplyId: string | null;
  focusMealId: string | null;
}

export default async function SuppliesServerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string; supply?: string; meal?: string };
}) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  const { events, userId } = await getTripData(id);

  // Meals are just meal-typed itinerary events — derive from the shared
  // events list instead of re-querying. The shared fetch orders by
  // (date, sort_order); re-sort here to preserve the old
  // (date, start_time, sort_order) ordering so meal cards keep clock-order
  // within a day.
  const meals: ItineraryEvent[] = events
    .filter((e) => e.event_type === "meal")
    .slice()
    .sort((a, b) => {
      const dateCmp = (a.date ?? "").localeCompare(b.date ?? "");
      if (dateCmp !== 0) return dateCmp;
      if (a.start_time !== b.start_time) {
        if (a.start_time === null) return 1;
        if (b.start_time === null) return -1;
        return a.start_time.localeCompare(b.start_time);
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  // ─── Tier 1 ────────────────────────────────────────────────────────
  // mealIds comes from the shared `events` list (already resolved via
  // getTripData), so supplies / meal_items / participants all have their
  // inputs at this point and can run in one parallel batch.
  const mealIds = meals.map((m) => m.id);

  const [suppliesRes, mealItemsRes, participantsRes] = await Promise.all([
    supabase
      .from("supply_items")
      .select("*")
      .eq("trip_id", id)
      .order("sort_order")
      .order("created_at"),
    mealIds.length > 0
      ? supabase
          .from("meal_items")
          .select("*")
          .in("event_id", mealIds)
          .order("sort_order")
          .order("created_at")
      : Promise.resolve({ data: [] as MealItem[] }),
    mealIds.length > 0
      ? supabase
          .from("event_participants")
          .select("*")
          .in("event_id", mealIds)
      : Promise.resolve({ data: [] as EventParticipant[] }),
  ]);

  const supplies = (suppliesRes.data ?? []) as SupplyItem[];
  const mealItems = (mealItemsRes.data ?? []) as MealItem[];
  const participants = (participantsRes.data ?? []) as EventParticipant[];

  // ─── Tier 2 ────────────────────────────────────────────────────────
  // Grocery checkoffs need meal_item ids resolved by Tier 1.
  const mealItemIds = mealItems.map((mi) => mi.id);
  const { data: checkoffsData } = mealItemIds.length > 0
    ? await supabase
        .from("grocery_checkoffs")
        .select("*")
        .eq("user_id", userId)
        .in("meal_item_id", mealItemIds)
    : { data: [] as GroceryCheckoff[] };
  const checkoffs = (checkoffsData ?? []) as GroceryCheckoff[];

  // URL view param: default to 'meals'. Never trust raw input.
  const rawView = (searchParams?.view ?? "meals").toLowerCase();
  const initialView: "meals" | "grocery" | "supplies" =
    rawView === "grocery" || rawView === "supplies" ? rawView : "meals";

  return (
    <SuppliesPage
      meals={meals}
      mealItems={mealItems}
      participants={participants}
      supplies={supplies}
      checkoffs={checkoffs}
      initialView={initialView}
      focusSupplyId={searchParams?.supply ?? null}
      focusMealId={searchParams?.meal ?? null}
    />
  );
}
