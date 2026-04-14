import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Fetches distinct, non-null locations from itinerary_events for a given trip.
 * Returns a deduplicated, sorted array of location strings that can be used
 * as suggestions in booking location fields.
 */
export function useItineraryLocations(tripId: string): string[] {
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    supabase
      .from("itinerary_events")
      .select("location")
      .eq("trip_id", tripId)
      .not("location", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const unique = Array.from(
          new Set(
            data
              .map((row: { location: string | null }) => row.location?.trim())
              .filter(Boolean) as string[],
          ),
        ).sort();
        setLocations(unique);
      });
  }, [tripId]);

  return locations;
}
