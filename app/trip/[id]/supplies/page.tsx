import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Trip,
  TripMember,
  ItineraryEvent,
  EventParticipant,
  MealItem,
  SupplyItem,
  GroceryCheckoff,
} from "@/types/database.types";
import SuppliesPage from "./supplies-page";

export interface SuppliesPageProps {
  trip: Trip;
  userId: string;
  isHost: boolean;
  members: TripMember[];
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) redirect("/dashboard");

  const isHost = trip.owner_id === user.id;

  // Fetch all in parallel. Most queries are scoped by trip_id; checkoffs
  // are per-user and filtered post-hoc once we know the user's meal_item ids.
  const [mealsRes, membersRes, suppliesRes] = await Promise.all([
    supabase
      .from("itinerary_events")
      .select("*")
      .eq("trip_id", id)
      .eq("event_type", "meal")
      .order("date")
      .order("start_time")
      .order("sort_order"),
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", id)
      .order("created_at"),
    supabase
      .from("supply_items")
      .select("*")
      .eq("trip_id", id)
      .order("sort_order")
      .order("created_at"),
  ]);

  const meals = (mealsRes.data ?? []) as ItineraryEvent[];
  const members = (membersRes.data ?? []) as TripMember[];
  const supplies = (suppliesRes.data ?? []) as SupplyItem[];

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
      .eq("user_id", user.id)
      .in("meal_item_id", mealItemIds);
    checkoffs = (data ?? []) as GroceryCheckoff[];
  }

  // URL view param: default to 'meals'. Never trust raw input.
  const rawView = (searchParams?.view ?? "meals").toLowerCase();
  const initialView: "meals" | "grocery" | "supplies" =
    rawView === "grocery" || rawView === "supplies" ? rawView : "meals";

  return (
    <SuppliesPage
      trip={trip as Trip}
      userId={user.id}
      isHost={isHost}
      members={members}
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
