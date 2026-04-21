import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, OutfitGroup, OutfitGroupEvent, UserProfile, FamilyMember, PackingBag, PackingBagSection, PackingBagContainer, PackingItemAssignment, TripWeatherForecast, GearBin, GearItem, TripGearBin } from "@/types/database.types";
import { geocodeLocation, fetchForecast, bucketDailyByTOD, type ForecastMap, type ForecastCell } from "@/lib/weather";
import PackingPage from "./packing-page";

export interface PackingPageProps {
  trip: Trip;
  members: TripMember[];
  events: ItineraryEvent[];
  participants: EventParticipant[];
  packingItems: PackingItem[];
  packingOutfits: PackingOutfit[];
  outfitPackingItems: OutfitPackingItem[];
  outfitGroups: OutfitGroup[];
  outfitGroupEvents: OutfitGroupEvent[];
  userProfile: UserProfile;
  familyMembers: FamilyMember[];
  userId: string;
  isHost: boolean;
  packingBags: PackingBag[];
  packingBagSections: PackingBagSection[];
  packingBagContainers: PackingBagContainer[];
  packingItemAssignments: PackingItemAssignment[];
  weatherForecast: ForecastMap;
  // Gear Phase 2: host-only visualizer data. `libraryBins` / `libraryItems` are
  // the owner's gear library so the Add-gear picker can browse without an
  // extra round-trip; `tripGearBins` is the join rows for this trip.
  libraryBins: GearBin[];
  libraryItems: GearItem[];
  tripGearBins: TripGearBin[];
  primaryVehicleName: string | null;
}

// Build the in-memory ForecastMap from cached rows
function rowsToForecastMap(rows: TripWeatherForecast[]): ForecastMap {
  const map: ForecastMap = {};
  for (const row of rows) {
    const dateMap = map[row.forecast_date] || (map[row.forecast_date] = {});
    dateMap[row.time_of_day] = {
      bucket: row.weather_bucket as ForecastCell["bucket"],
      temperatureHighF: row.temperature_high_f != null ? Number(row.temperature_high_f) : null,
      temperatureLowF: row.temperature_low_f != null ? Number(row.temperature_low_f) : null,
      weatherCode: row.weather_code,
      precipitationProbability: row.precipitation_probability,
    };
  }
  return map;
}

export default async function PackingServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) redirect("/dashboard");

  const isHost = trip.owner_id === user.id;

  // Fetch user profile (for packing preferences, clothing styles, gender)
  const { data: userProfile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();

  // Fetch user's family members (for the family-only person tabs)
  const { data: families } = await supabase.from("families").select("*").eq("owner_id", user.id);
  const familyIds = (families ?? []).map(f => f.id);
  let familyMembers: FamilyMember[] = [];
  if (familyIds.length > 0) {
    const { data } = await supabase.from("family_members").select("*").in("family_id", familyIds);
    familyMembers = (data ?? []) as FamilyMember[];
  }

  // Fetch trip members
  const { data: members } = await supabase.from("trip_members").select("*").eq("trip_id", id).order("created_at");

  // Fetch itinerary events
  const { data: events } = await supabase.from("itinerary_events").select("*").eq("trip_id", id).order("date").order("sort_order");

  // Fetch event participants
  const eventIds = (events ?? []).map(e => e.id);
  let participants: EventParticipant[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase.from("event_participants").select("*").in("event_id", eventIds);
    participants = (data ?? []) as EventParticipant[];
  }

  // Fetch packing items (RLS ensures only family-scoped items returned)
  const { data: packingItems } = await supabase.from("packing_items").select("*").eq("trip_id", id).order("sort_order");

  // Fetch packing outfits (RLS ensures only family-scoped)
  const { data: packingOutfits } = await supabase.from("packing_outfits").select("*").eq("trip_id", id);

  // Fetch outfit-packing-item junctions
  const outfitIds = (packingOutfits ?? []).map(o => o.id);
  let outfitPackingItems: OutfitPackingItem[] = [];
  if (outfitIds.length > 0) {
    const { data } = await supabase.from("outfit_packing_items").select("*").in("outfit_id", outfitIds);
    outfitPackingItems = (data ?? []) as OutfitPackingItem[];
  }

  // Fetch outfit groups and their event mappings
  const { data: outfitGroups } = await supabase.from("outfit_groups").select("*").eq("trip_id", id).order("date").order("sort_order");
  const groupIds = (outfitGroups ?? []).map(g => g.id);
  let outfitGroupEvents: OutfitGroupEvent[] = [];
  if (groupIds.length > 0) {
    const { data } = await supabase.from("outfit_group_events").select("*").in("outfit_group_id", groupIds);
    outfitGroupEvents = (data ?? []) as OutfitGroupEvent[];
  }

  // Fetch user's packing bags (persist across trips — belong to user, not trip)
  const { data: packingBags } = await supabase.from("packing_bags").select("*").eq("user_id", user.id).order("sort_order");

  // Fetch sections for the user's bags
  const bagIds = (packingBags ?? []).map(b => b.id);
  let packingBagSections: PackingBagSection[] = [];
  if (bagIds.length > 0) {
    const { data } = await supabase.from("packing_bag_sections").select("*").in("bag_id", bagIds).order("sort_order");
    packingBagSections = (data ?? []) as PackingBagSection[];
  }

  // Fetch containers for those sections
  const sectionIds = packingBagSections.map(s => s.id);
  let packingBagContainers: PackingBagContainer[] = [];
  if (sectionIds.length > 0) {
    const { data } = await supabase.from("packing_bag_containers").select("*").in("section_id", sectionIds).order("sort_order");
    packingBagContainers = (data ?? []) as PackingBagContainer[];
  }

  // Fetch item assignments for this trip
  const { data: packingItemAssignments } = await supabase.from("packing_item_assignments").select("*").eq("trip_id", id);

  // ─── Gear Phase 2: trip gear bins + host's library + vehicle name ────────
  // Gear is host-only in Phase 2, so we only fetch when the caller is the trip
  // owner. Non-hosts get empty arrays and the client hides the Gear pill.
  let libraryBins: GearBin[] = [];
  let libraryItems: GearItem[] = [];
  let tripGearBins: TripGearBin[] = [];
  let primaryVehicleName: string | null = null;

  if (isHost) {
    const [libBinsRes, joinRes] = await Promise.all([
      supabase
        .from("gear_bins")
        .select("*")
        .eq("owner_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_gear_bins")
        .select("*")
        .eq("trip_id", id),
    ]);

    libraryBins = (libBinsRes.data ?? []) as GearBin[];
    tripGearBins = (joinRes.data ?? []) as TripGearBin[];

    const libBinIds = libraryBins.map((b) => b.id);
    if (libBinIds.length > 0) {
      const { data: gearItemsData } = await supabase
        .from("gear_items")
        .select("*")
        .in("bin_id", libBinIds)
        .order("sort_order", { ascending: true });
      libraryItems = (gearItemsData ?? []) as GearItem[];
    }

    primaryVehicleName =
      (userProfile as UserProfile | null)?.primary_vehicle_name ?? null;
  }

  // ─── Weather: read cached rows; if missing or stale, refetch + upsert ───
  let weatherForecast: ForecastMap = {};
  if (trip.location && trip.start_date && trip.end_date) {
    const { data: cachedRows } = await supabase
      .from("trip_weather_forecast")
      .select("*")
      .eq("trip_id", id);
    const rows = (cachedRows ?? []) as TripWeatherForecast[];

    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const isStale = rows.length === 0 || rows.some(r => new Date(r.fetched_at).getTime() < sixHoursAgo);

    if (isStale && isHost) {
      // Only the host can write to the cache (per RLS), but any member's read uses cached rows.
      const geo = await geocodeLocation(trip.location);
      if (geo) {
        const dailies = await fetchForecast(geo.lat, geo.lon, trip.start_date, trip.end_date, geo.timezone);
        if (dailies.length > 0) {
          // Clear existing rows for this trip, then upsert new ones
          await supabase.from("trip_weather_forecast").delete().eq("trip_id", id);
          const upserts: any[] = [];
          for (const daily of dailies) {
            const byTOD = bucketDailyByTOD(daily);
            for (const tod of ["morning", "afternoon", "evening", "night"] as const) {
              const cell = byTOD[tod];
              upserts.push({
                trip_id: id,
                forecast_date: daily.date,
                time_of_day: tod,
                temperature_high_f: cell.temperatureHighF,
                temperature_low_f: cell.temperatureLowF,
                weather_code: cell.weatherCode,
                precipitation_probability: cell.precipitationProbability,
                weather_bucket: cell.bucket,
              });
            }
          }
          if (upserts.length > 0) {
            await supabase.from("trip_weather_forecast").insert(upserts);
          }
          // Re-read after upsert so the in-memory map matches DB
          const { data: freshRows } = await supabase
            .from("trip_weather_forecast")
            .select("*")
            .eq("trip_id", id);
          weatherForecast = rowsToForecastMap((freshRows ?? []) as TripWeatherForecast[]);
        } else {
          weatherForecast = rowsToForecastMap(rows);
        }
      } else {
        weatherForecast = rowsToForecastMap(rows);
      }
    } else {
      weatherForecast = rowsToForecastMap(rows);
    }
  }

  return (
    <PackingPage
      trip={trip as Trip}
      members={(members ?? []) as TripMember[]}
      events={(events ?? []) as ItineraryEvent[]}
      participants={participants}
      packingItems={(packingItems ?? []) as PackingItem[]}
      packingOutfits={(packingOutfits ?? []) as PackingOutfit[]}
      outfitPackingItems={outfitPackingItems}
      outfitGroups={(outfitGroups ?? []) as OutfitGroup[]}
      outfitGroupEvents={outfitGroupEvents}
      userProfile={userProfile as UserProfile}
      familyMembers={familyMembers}
      userId={user.id}
      isHost={isHost}
      packingBags={(packingBags ?? []) as PackingBag[]}
      packingBagSections={packingBagSections}
      packingBagContainers={packingBagContainers}
      packingItemAssignments={(packingItemAssignments ?? []) as PackingItemAssignment[]}
      weatherForecast={weatherForecast}
      libraryBins={libraryBins}
      libraryItems={libraryItems}
      tripGearBins={tripGearBins}
      primaryVehicleName={primaryVehicleName}
    />
  );
}
