import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  bucketDailyByTOD,
  fetchForecast,
  geocodeLocation,
  type ForecastCell,
  type ForecastMap,
} from "@/lib/weather";
import type { TripWeatherForecast } from "@/types/database.types";

/**
 * POST /api/trip/[id]/weather/refresh
 *
 * Host-only endpoint that geocodes the trip's location, pulls a fresh
 * forecast from Open-Meteo, and upserts the `trip_weather_forecast` rows
 * for this trip. Returns the resulting ForecastMap the packing client can
 * drop straight into TanStack Query.
 *
 * This used to run synchronously during SSR in `packing/page.tsx`, adding
 * ~hundreds of ms to first paint on Packing even when the cached rows were
 * perfectly fine. Phase 4 moves it behind a 6h-staleTime useQuery on the
 * client so SSR only ever does one lightweight read of the cached table.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Host gate: only the trip owner may write to trip_weather_forecast (per
  // RLS). Non-hosts keep the cached rows they got during SSR; surfacing 403
  // lets the client drop them into a permanent staleTime state.
  const { data: trip } = await supabase
    .from("trips")
    .select("owner_id, location, start_date, end_date")
    .eq("id", id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (trip.owner_id !== user.id) {
    return NextResponse.json({ error: "Host only" }, { status: 403 });
  }
  if (!trip.location || !trip.start_date || !trip.end_date) {
    return NextResponse.json({} satisfies ForecastMap);
  }

  const geo = await geocodeLocation(trip.location);
  if (!geo) {
    // Degrade gracefully: return whatever's cached rather than 500ing —
    // mirrors the old server-page behaviour.
    const { data: cachedRows } = await supabase
      .from("trip_weather_forecast")
      .select("*")
      .eq("trip_id", id);
    return NextResponse.json(
      rowsToForecastMap((cachedRows ?? []) as TripWeatherForecast[]),
    );
  }

  const dailies = await fetchForecast(
    geo.lat,
    geo.lon,
    trip.start_date,
    trip.end_date,
    geo.timezone,
  );

  if (dailies.length === 0) {
    const { data: cachedRows } = await supabase
      .from("trip_weather_forecast")
      .select("*")
      .eq("trip_id", id);
    return NextResponse.json(
      rowsToForecastMap((cachedRows ?? []) as TripWeatherForecast[]),
    );
  }

  // Wipe + insert — same write pattern the old server page used. Keeps the
  // (trip_id, forecast_date, time_of_day) rows consistent with the new fetch.
  await supabase.from("trip_weather_forecast").delete().eq("trip_id", id);

  const upserts: Array<{
    trip_id: string;
    forecast_date: string;
    time_of_day: "morning" | "afternoon" | "evening" | "night";
    temperature_high_f: number | null;
    temperature_low_f: number | null;
    weather_code: number | null;
    precipitation_probability: number | null;
    weather_bucket: ForecastCell["bucket"];
  }> = [];

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

  const { data: freshRows } = await supabase
    .from("trip_weather_forecast")
    .select("*")
    .eq("trip_id", id);

  return NextResponse.json(
    rowsToForecastMap((freshRows ?? []) as TripWeatherForecast[]),
  );
}

// Mirror of the helper in packing/page.tsx. Kept local so the route stays
// self-contained (and the server page can retire its version if it ever
// stops needing the cached read).
function rowsToForecastMap(rows: TripWeatherForecast[]): ForecastMap {
  const map: ForecastMap = {};
  for (const row of rows) {
    const dateMap = map[row.forecast_date] || (map[row.forecast_date] = {});
    dateMap[row.time_of_day] = {
      bucket: row.weather_bucket as ForecastCell["bucket"],
      temperatureHighF:
        row.temperature_high_f != null ? Number(row.temperature_high_f) : null,
      temperatureLowF:
        row.temperature_low_f != null ? Number(row.temperature_low_f) : null,
      weatherCode: row.weather_code,
      precipitationProbability: row.precipitation_probability,
    };
  }
  return map;
}
