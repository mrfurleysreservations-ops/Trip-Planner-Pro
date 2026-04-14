import { NextRequest, NextResponse } from "next/server";

/**
 * Weather API route — uses Open-Meteo (free, no key required)
 *
 * Behavior:
 * - REQUIRES start_date and end_date (only fetches trip days, nothing else)
 * - If trip dates are within the 16-day forecast window → returns forecast for those days
 * - If trip dates are partially in window → returns what's available + which days are missing
 * - If trip dates are entirely outside window → returns no days + "availableFrom" date
 */

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

// WMO Weather interpretation codes → human-readable label + emoji
const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Heavy freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Heavy freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Light showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "⛈️" },
  85: { label: "Light snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + hail", icon: "⛈️" },
  99: { label: "Thunderstorm + heavy hail", icon: "⛈️" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!location) {
    return NextResponse.json({ error: "Missing location" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing trip dates" }, { status: 400 });
  }

  try {
    // Step 1: Geocode the location
    const cityName = location.split(",")[0].trim();
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) {
      console.error("Geocoding API error:", geoRes.status, await geoRes.text());
      return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
    }
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const geo: GeoResult = geoData.results[0];
    const locationInfo = { name: geo.name, country: geo.country, admin1: geo.admin1, lat: geo.latitude, lng: geo.longitude };

    // Step 2: Determine forecast availability
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripStart = new Date(startDate + "T00:00:00");
    const tripEnd = new Date(endDate + "T00:00:00");

    // Open-Meteo provides 16 days from today
    const forecastEnd = new Date(today);
    forecastEnd.setDate(forecastEnd.getDate() + 15); // today + 15 = 16 days total

    // Case 1: Trip is entirely beyond the forecast window
    if (tripStart > forecastEnd) {
      const daysUntilAvailable = Math.ceil((tripStart.getTime() - forecastEnd.getTime()) / (1000 * 60 * 60 * 24));
      const availableFrom = new Date(today);
      availableFrom.setDate(availableFrom.getDate() + daysUntilAvailable);

      return NextResponse.json({
        days: [],
        location: locationInfo,
        status: "too_early",
        tripStart: startDate,
        tripEnd: endDate,
        daysUntilAvailable,
        availableFrom: availableFrom.toISOString().split("T")[0],
      });
    }

    // Case 2: Trip is in the past
    if (tripEnd < today) {
      return NextResponse.json({
        days: [],
        location: locationInfo,
        status: "past",
      });
    }

    // Case 3: Trip overlaps with the forecast window (fully or partially)
    // Clamp our fetch range to what's actually available
    const fetchStart = tripStart < today ? today.toISOString().split("T")[0] : startDate;
    const fetchEnd = tripEnd > forecastEnd ? forecastEnd.toISOString().split("T")[0] : endDate;

    const params = new URLSearchParams({
      latitude: String(geo.latitude),
      longitude: String(geo.longitude),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,precipitation_probability_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: "auto",
      start_date: fetchStart,
      end_date: fetchEnd,
    });

    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    );
    const forecastData = await forecastRes.json();

    if (forecastData.error) {
      console.error("Forecast API error:", forecastData.error);
      return NextResponse.json({ error: "Weather data unavailable" }, { status: 502 });
    }

    const days = buildDays(forecastData.daily);

    // Count how many trip days we're missing (beyond the forecast window)
    const totalTripDays = Math.ceil((tripEnd.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const missingDays = totalTripDays - days.length;

    return NextResponse.json({
      days,
      location: locationInfo,
      status: missingDays > 0 ? "partial" : "complete",
      totalTripDays,
      missingDays: missingDays > 0 ? missingDays : 0,
    });
  } catch (err) {
    console.error("Weather API error:", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}

function buildDays(daily: any) {
  return daily.time.map((date: string, i: number) => {
    const code = daily.weather_code[i];
    const wmo = WMO_CODES[code] || { label: "Unknown", icon: "❓" };
    return {
      date,
      tempHigh: Math.round(daily.temperature_2m_max[i]),
      tempLow: Math.round(daily.temperature_2m_min[i]),
      weatherCode: code,
      weatherLabel: wmo.label,
      weatherIcon: wmo.icon,
      precipitation: daily.precipitation_sum[i],
      precipProbability: daily.precipitation_probability_max?.[i] ?? null,
      windSpeed: Math.round(daily.wind_speed_10m_max[i]),
    };
  });
}
