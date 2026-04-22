import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, OutfitGroup, OutfitGroupEvent, UserProfile, FamilyMember, PackingBag, PackingBagSection, PackingBagContainer, PackingItemAssignment, TripWeatherForecast, GearBin, GearItem, TripGearBin } from "@/types/database.types";
import type { ForecastMap, ForecastCell } from "@/lib/weather";
import { getTripData } from "@/lib/trip-data";
import PackingPage from "./packing-page";

export interface PackingPageProps {
  participants: EventParticipant[];
  packingItems: PackingItem[];
  packingOutfits: PackingOutfit[];
  outfitPackingItems: OutfitPackingItem[];
  outfitGroups: OutfitGroup[];
  outfitGroupEvents: OutfitGroupEvent[];
  userProfile: UserProfile;
  familyMembers: FamilyMember[];
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

  // Shared trip context — deduped with the layout's call via React cache().
  const { trip, events, userId, isHost } = await getTripData(id);

  const eventIds = events.map((e) => e.id);

  // ─── Tier 1 ────────────────────────────────────────────────────────
  // Every query below has its inputs ready from `getTripData` (or is static
  // on userId / trip id). They don't depend on each other, so they all land
  // in one parallel batch — nine round-trips collapsed to one. Host-only
  // gear queries are folded into the same batch via conditional Promise
  // resolves so the tiering stays clean regardless of role.
  const [
    userProfileRes,
    familiesRes,
    participantsRes,
    packingItemsRes,
    packingOutfitsRes,
    outfitGroupsRes,
    packingBagsRes,
    packingItemAssignmentsRes,
    weatherRowsRes,
    libBinsRes,
    tripGearBinsRes,
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
    supabase.from("families").select("*").eq("owner_id", userId),
    eventIds.length > 0
      ? supabase.from("event_participants").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] as EventParticipant[] }),
    supabase.from("packing_items").select("*").eq("trip_id", id).order("sort_order"),
    supabase.from("packing_outfits").select("*").eq("trip_id", id),
    supabase.from("outfit_groups").select("*").eq("trip_id", id).order("date").order("sort_order"),
    supabase.from("packing_bags").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("packing_item_assignments").select("*").eq("trip_id", id),
    supabase.from("trip_weather_forecast").select("*").eq("trip_id", id),
    isHost
      ? supabase
          .from("gear_bins")
          .select("*")
          .eq("owner_id", userId)
          .is("archived_at", null)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as GearBin[] }),
    isHost
      ? supabase.from("trip_gear_bins").select("*").eq("trip_id", id)
      : Promise.resolve({ data: [] as TripGearBin[] }),
  ]);

  const userProfile = userProfileRes.data as UserProfile | null;
  const families = (familiesRes.data ?? []) as { id: string }[];
  const participants = (participantsRes.data ?? []) as EventParticipant[];
  const packingItems = (packingItemsRes.data ?? []) as PackingItem[];
  const packingOutfits = (packingOutfitsRes.data ?? []) as PackingOutfit[];
  const outfitGroups = (outfitGroupsRes.data ?? []) as OutfitGroup[];
  const packingBags = (packingBagsRes.data ?? []) as PackingBag[];
  const packingItemAssignments = (packingItemAssignmentsRes.data ?? []) as PackingItemAssignment[];
  const cachedWeatherRows = (weatherRowsRes.data ?? []) as TripWeatherForecast[];
  const libraryBins = (libBinsRes.data ?? []) as GearBin[];
  const tripGearBins = (tripGearBinsRes.data ?? []) as TripGearBin[];

  // ─── Tier 2 ────────────────────────────────────────────────────────
  // Each of these needs ids materialized by Tier 1. Short-circuit with
  // Promise.resolve when the parent collection is empty — `.in("col", [])`
  // can throw on some Supabase versions and is a wasted round-trip either
  // way — so the result shape stays consistent.
  const familyIds = families.map((f) => f.id);
  const outfitIds = packingOutfits.map((o) => o.id);
  const groupIds = outfitGroups.map((g) => g.id);
  const bagIds = packingBags.map((b) => b.id);
  const libBinIds = libraryBins.map((b) => b.id);

  const [
    familyMembersRes,
    outfitPackingItemsRes,
    outfitGroupEventsRes,
    packingBagSectionsRes,
    gearItemsRes,
  ] = await Promise.all([
    familyIds.length > 0
      ? supabase.from("family_members").select("*").in("family_id", familyIds)
      : Promise.resolve({ data: [] as FamilyMember[] }),
    outfitIds.length > 0
      ? supabase.from("outfit_packing_items").select("*").in("outfit_id", outfitIds)
      : Promise.resolve({ data: [] as OutfitPackingItem[] }),
    groupIds.length > 0
      ? supabase.from("outfit_group_events").select("*").in("outfit_group_id", groupIds)
      : Promise.resolve({ data: [] as OutfitGroupEvent[] }),
    bagIds.length > 0
      ? supabase.from("packing_bag_sections").select("*").in("bag_id", bagIds).order("sort_order")
      : Promise.resolve({ data: [] as PackingBagSection[] }),
    isHost && libBinIds.length > 0
      ? supabase
          .from("gear_items")
          .select("*")
          .in("bin_id", libBinIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as GearItem[] }),
  ]);

  const familyMembers = (familyMembersRes.data ?? []) as FamilyMember[];
  const outfitPackingItems = (outfitPackingItemsRes.data ?? []) as OutfitPackingItem[];
  const outfitGroupEvents = (outfitGroupEventsRes.data ?? []) as OutfitGroupEvent[];
  const packingBagSections = (packingBagSectionsRes.data ?? []) as PackingBagSection[];
  const libraryItems = (gearItemsRes.data ?? []) as GearItem[];

  // ─── Tier 3 ────────────────────────────────────────────────────────
  // Containers hang off section ids resolved by Tier 2 — single query, no
  // Promise.all needed.
  const sectionIds = packingBagSections.map((s) => s.id);
  const { data: packingBagContainersData } = sectionIds.length > 0
    ? await supabase
        .from("packing_bag_containers")
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order")
    : { data: [] as PackingBagContainer[] };
  const packingBagContainers = (packingBagContainersData ?? []) as PackingBagContainer[];

  // Weather forecast: render with cached rows on first paint. The client
  // refreshes (and the host upserts) via `/api/trip/[id]/weather/refresh`
  // behind a long-staleTime useQuery, so geocoding + the external forecast
  // API no longer block SSR.
  const weatherForecast: ForecastMap = rowsToForecastMap(cachedWeatherRows);

  const primaryVehicleName = isHost
    ? (userProfile?.primary_vehicle_name ?? null)
    : null;

  return (
    <PackingPage
      participants={participants}
      packingItems={packingItems}
      packingOutfits={packingOutfits}
      outfitPackingItems={outfitPackingItems}
      outfitGroups={outfitGroups}
      outfitGroupEvents={outfitGroupEvents}
      userProfile={userProfile as UserProfile}
      familyMembers={familyMembers}
      packingBags={packingBags}
      packingBagSections={packingBagSections}
      packingBagContainers={packingBagContainers}
      packingItemAssignments={packingItemAssignments}
      weatherForecast={weatherForecast}
      libraryBins={libraryBins}
      libraryItems={libraryItems}
      tripGearBins={tripGearBins}
      primaryVehicleName={primaryVehicleName}
    />
  );
}
