import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Trip,
  TripMember,
  ItineraryEvent,
} from "@/types/database.types";

export interface TripData {
  trip: Trip;
  members: TripMember[];
  events: ItineraryEvent[];
  userId: string;
  isHost: boolean;
}

/**
 * Request-scoped loader for the shared trip context: the trip row, its
 * accepted/pending members, and its itinerary events. Parallelized via
 * Promise.all and deduped across the layout + nested pages via React's
 * `cache()` helper — within a single server request, only one Supabase
 * round-trip per table happens regardless of how many callers invoke this.
 *
 * Callers that only need events or only need members should still go
 * through this — the dedupe makes it free, and it keeps the "one source
 * of truth for trip context" invariant.
 */
export const getTripData = cache(async (tripId: string): Promise<TripData> => {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [tripRes, membersRes, eventsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at"),
    supabase
      .from("itinerary_events")
      .select("*")
      .eq("trip_id", tripId)
      .order("date")
      .order("sort_order"),
  ]);

  const trip = tripRes.data;
  if (!trip) redirect("/dashboard");

  return {
    trip: trip as Trip,
    members: (membersRes.data ?? []) as TripMember[],
    events: (eventsRes.data ?? []) as ItineraryEvent[],
    userId: user.id,
    isHost: trip.owner_id === user.id,
  };
});
