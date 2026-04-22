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

  // Supplies is trip-scoped; run it in parallel with nothing here since the
  // meal_items / participants queries below depend on the derived mealIds.
  const { data: suppliesData } = await supabase
    .from("supply_items")
    .select("*")
    .eq("trip_id", id)
    .order("sort_order")
    .order("created_at");
  const supplies = (suppliesData ?? []) as SupplyItem[];

  const mealIds = meals.map((m) => m.id);

  let mealItems: MealItem[] = [];
  let participants: EventParticipant[] = [];
  if (mealIds.length > 0) {
    const [miRes, partsRes] = await Promise.all([
      supabase
        .from("meal_items")
        .select("*")
        .in("event_id", mealIds)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("event_participants")
        .select("*")
        .in("event_id", mealIds),
    ]);
    mealItems = (miRes.data ?? []) as MealItem[];
    participants = (partsRes.data ?? []) as EventParticipant[];
  }

  // Grocery checkoffs — only for meal_items that exist in the fetched set.
  let checkoffs: GroceryCheckoff[] = [];
  if (mealItems.length > 0) {
    const mealItemIds = mealItems.map((mi) => mi.id);
    const { data } = await supabase
      .from("grocery_checkoffs")
      .select("*")
      .eq("user_id", userId)
      .in("meal_item_id", mealItemIds);
    checkoffs = (data ?? []) as GroceryCheckoff[];
  }

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
