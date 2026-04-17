// ─── Weather lib ───
// Open-Meteo (https://open-meteo.com): free, no API key required.
// Used by the packing page to bucket weather per date/time-of-day so
// outfit groups can be split by sunny vs rainy vs cold etc.

export type WeatherBucket =
  | "hot_sunny"
  | "warm_sunny"
  | "mild"
  | "cold"
  | "rainy"
  | "snowy"
  | "unknown";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

// Time-of-day windows (local time, hours).
// morning: 05–10, afternoon: 11–15, evening: 16–20, night: 21–04
export const TOD_WINDOWS: Record<TimeOfDay, [number, number]> = {
  morning: [5, 10],
  afternoon: [11, 15],
  evening: [16, 20],
  night: [21, 4],
};

// Forecast cell stored per (date, time_of_day). all_day is the daily
// fallback when hourly isn't available (>16 days out).
export interface ForecastCell {
  bucket: WeatherBucket;
  temperatureHighF: number | null;
  temperatureLowF: number | null;
  weatherCode: number | null;
  precipitationProbability: number | null;
}

// Map: date (YYYY-MM-DD) -> time_of_day -> cell
// time_of_day key is one of: morning|afternoon|evening|night|all_day
export type ForecastMap = Record<string, Record<string, ForecastCell>>;

// ─── WMO weather code → category ───
// 0–3 clear/partly cloudy/cloudy
// 45–48 fog (treat as non-precipitation, mild)
// 51–67 drizzle/rain → rainy
// 71–77 snow → snowy
// 80–82 rain showers → rainy
// 85–86 snow showers → snowy
// 95–99 thunderstorm → rainy
function isClearOrPartlyCloudy(code: number): boolean {
  return code >= 0 && code <= 3;
}
function isPrecipitation(code: number): "rain" | "snow" | null {
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return null;
}

export function bucketWeather(
  highF: number | null,
  lowF: number | null,
  weatherCode: number | null,
  precipProb: number | null,
): WeatherBucket {
  // Need at least a temp + code to bucket meaningfully
  if (highF == null || weatherCode == null) return "unknown";

  const precip = isPrecipitation(weatherCode);
  if (precip === "rain") return "rainy";
  if (precip === "snow") return "snowy";

  // Non-precip path (includes clear, partly cloudy, cloudy, fog)
  const sunny = isClearOrPartlyCloudy(weatherCode);

  if (highF >= 85 && sunny) return "hot_sunny";
  if (highF >= 70 && highF < 85 && sunny) return "warm_sunny";
  if (highF >= 55 && highF < 70) return "mild";
  if (highF < 55) return "cold";

  // Fallbacks for hot/warm but cloudy
  if (highF >= 85) return "hot_sunny";
  if (highF >= 70) return "warm_sunny";
  return "mild";
}

// ─── Geocoding (Open-Meteo geocoding API, no key) ───
export interface GeoResult {
  lat: number;
  lon: number;
  timezone: string;
}

export async function geocodeLocation(locationString: string): Promise<GeoResult | null> {
  if (!locationString || !locationString.trim()) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationString.trim())}&count=1&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return null;
    return {
      lat: first.latitude,
      lon: first.longitude,
      timezone: first.timezone || "auto",
    };
  } catch {
    return null;
  }
}

// ─── Forecast fetch ───
export interface DailyForecast {
  date: string; // YYYY-MM-DD
  highF: number | null;
  lowF: number | null;
  weatherCode: number | null;
  precipProb: number | null;
  hourly?: HourlyForecast[];
}

export interface HourlyForecast {
  hour: number; // 0..23 local time
  tempF: number | null;
  weatherCode: number | null;
  precipProb: number | null;
}

function daysBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate + "T12:00:00Z").getTime();
  const e = new Date(endDate + "T12:00:00Z").getTime();
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24));
}

export async function fetchForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  timezone: string = "auto",
): Promise<DailyForecast[]> {
  const span = daysBetween(startDate, endDate);
  const includeHourly = span <= 16;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone,
    start_date: startDate,
    end_date: endDate,
  });
  if (includeHourly) {
    params.set("hourly", "temperature_2m,weather_code,precipitation_probability");
  }

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  let data: any;
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const dates: string[] = data?.daily?.time || [];
  const highs: number[] = data?.daily?.temperature_2m_max || [];
  const lows: number[] = data?.daily?.temperature_2m_min || [];
  const codes: number[] = data?.daily?.weather_code || [];
  const precips: number[] = data?.daily?.precipitation_probability_max || [];

  const hourlyTime: string[] = data?.hourly?.time || [];
  const hourlyTemp: number[] = data?.hourly?.temperature_2m || [];
  const hourlyCode: number[] = data?.hourly?.weather_code || [];
  const hourlyPrecip: number[] = data?.hourly?.precipitation_probability || [];

  // Index hourly entries by date.
  const hourlyByDate = new Map<string, HourlyForecast[]>();
  if (includeHourly && hourlyTime.length > 0) {
    for (let i = 0; i < hourlyTime.length; i++) {
      const ts = hourlyTime[i]; // "YYYY-MM-DDTHH:MM"
      const date = ts.slice(0, 10);
      const hour = parseInt(ts.slice(11, 13), 10);
      const arr = hourlyByDate.get(date) || [];
      arr.push({
        hour,
        tempF: typeof hourlyTemp[i] === "number" ? hourlyTemp[i] : null,
        weatherCode: typeof hourlyCode[i] === "number" ? hourlyCode[i] : null,
        precipProb: typeof hourlyPrecip[i] === "number" ? hourlyPrecip[i] : null,
      });
      hourlyByDate.set(date, arr);
    }
  }

  return dates.map((date, idx) => ({
    date,
    highF: typeof highs[idx] === "number" ? highs[idx] : null,
    lowF: typeof lows[idx] === "number" ? lows[idx] : null,
    weatherCode: typeof codes[idx] === "number" ? codes[idx] : null,
    precipProb: typeof precips[idx] === "number" ? precips[idx] : null,
    hourly: hourlyByDate.get(date),
  }));
}

// ─── Bucket per time-of-day from a daily forecast ───
// If hourly data is present, derive the dominant condition for the TOD window.
// Otherwise fall back to the daily numbers (same bucket for all four windows).
export function bucketDailyByTOD(daily: DailyForecast): Record<TimeOfDay, ForecastCell> {
  const result = {} as Record<TimeOfDay, ForecastCell>;
  const tods: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

  if (!daily.hourly || daily.hourly.length === 0) {
    const cell: ForecastCell = {
      bucket: bucketWeather(daily.highF, daily.lowF, daily.weatherCode, daily.precipProb),
      temperatureHighF: daily.highF,
      temperatureLowF: daily.lowF,
      weatherCode: daily.weatherCode,
      precipitationProbability: daily.precipProb,
    };
    for (const t of tods) result[t] = cell;
    return result;
  }

  for (const tod of tods) {
    const [start, end] = TOD_WINDOWS[tod];
    const inWindow = daily.hourly.filter(h =>
      tod === "night" ? (h.hour >= start || h.hour <= end) : h.hour >= start && h.hour <= end
    );
    if (inWindow.length === 0) {
      result[tod] = {
        bucket: bucketWeather(daily.highF, daily.lowF, daily.weatherCode, daily.precipProb),
        temperatureHighF: daily.highF,
        temperatureLowF: daily.lowF,
        weatherCode: daily.weatherCode,
        precipitationProbability: daily.precipProb,
      };
      continue;
    }
    // Use max temp in the window as "high", min as "low"
    const temps = inWindow.map(h => h.tempF).filter((n): n is number => typeof n === "number");
    const high = temps.length ? Math.max(...temps) : daily.highF;
    const low = temps.length ? Math.min(...temps) : daily.lowF;
    // Pick the most "severe" code in the window (rain/snow > clouds > clear)
    const code = pickWorstCode(inWindow.map(h => h.weatherCode).filter((n): n is number => typeof n === "number"));
    const precipProbs = inWindow.map(h => h.precipProb).filter((n): n is number => typeof n === "number");
    const maxPrecip = precipProbs.length ? Math.max(...precipProbs) : daily.precipProb;
    result[tod] = {
      bucket: bucketWeather(high, low, code, maxPrecip),
      temperatureHighF: high,
      temperatureLowF: low,
      weatherCode: code,
      precipitationProbability: maxPrecip,
    };
  }
  return result;
}

// Pick the most condition-defining code (precipitation > clouds > clear).
function pickWorstCode(codes: number[]): number | null {
  if (codes.length === 0) return null;
  // Severity: snow (71-77, 85-86) > thunderstorm (95-99) > rain (51-67, 80-82) > fog (45-48) > cloudy (3) > partly cloudy (2) > mainly clear (1) > clear (0)
  const severity = (c: number): number => {
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 8;
    if (c >= 95 && c <= 99) return 7;
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 6;
    if (c >= 45 && c <= 48) return 4;
    if (c === 3) return 3;
    if (c === 2) return 2;
    if (c === 1) return 1;
    return 0;
  };
  return codes.reduce((worst, c) => (severity(c) > severity(worst) ? c : worst), codes[0]);
}

// ─── Display helpers ───
export function weatherChipText(cell: ForecastCell | undefined): string {
  if (!cell || cell.bucket === "unknown") return "— weather pending";
  const temp = cell.temperatureHighF != null ? `${Math.round(cell.temperatureHighF)}°F` : "";
  const icon = (() => {
    switch (cell.bucket) {
      case "hot_sunny": return "☀️";
      case "warm_sunny": return "☀️";
      case "mild": return "⛅";
      case "cold": return "🥶";
      case "rainy": return "🌧️";
      case "snowy": return "❄️";
      default: return "";
    }
  })();
  const condition = (() => {
    switch (cell.bucket) {
      case "hot_sunny": return "hot";
      case "warm_sunny": return "clear";
      case "mild": return "mild";
      case "cold": return "cold";
      case "rainy": return "rain";
      case "snowy": return "snow";
      default: return "";
    }
  })();
  return `${icon} ${temp}${condition ? ` · ${condition}` : ""}`.trim();
}
