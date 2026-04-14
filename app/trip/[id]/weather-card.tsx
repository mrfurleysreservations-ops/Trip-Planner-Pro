"use client";
import { useState, useEffect, useRef } from "react";
import type { ThemeConfig } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface WeatherDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  weatherCode: number;
  weatherLabel: string;
  weatherIcon: string;
  precipitation: number;
  precipProbability: number | null;
  windSpeed: number;
}

interface WeatherData {
  days: WeatherDay[];
  location: { name: string; country: string; admin1?: string; lat: number; lng: number };
  status: "complete" | "partial" | "too_early" | "past";
  totalTripDays?: number;
  missingDays?: number;
  daysUntilAvailable?: number;
  availableFrom?: string;
}

interface WeatherCardProps {
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  theme: ThemeConfig;
}

export default function WeatherCard({ location, startDate, endDate, theme: th }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastFetchKey = useRef("");

  useEffect(() => {
    if (!location || !startDate || !endDate) return;

    const fetchKey = `${location}|${startDate}|${endDate}`;
    if (fetchKey === lastFetchKey.current && (weather || loading)) return;
    lastFetchKey.current = fetchKey;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ location, start_date: startDate, end_date: endDate });

    fetch(`/api/weather?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setWeather(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Weather fetch failed:", err.message);
          setError(err.message || "Weather unavailable");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [location, startDate, endDate, retryCount]);

  // Don't render anything if trip has no location or dates
  if (!location || !startDate || !endDate) return null;

  // Format day label
  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.toLocaleDateString("en-US", { weekday: "short" });
    return { weekday: day, monthDay: `${d.getMonth() + 1}/${d.getDate()}` };
  };

  // Loading skeleton — match trip day count
  if (loading) {
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T00:00:00");
    const dayCount = Math.min(Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1, 10);
    return (
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <span style={{ fontSize: "16px" }}>🌤️</span>
          <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>Loading weather...</span>
        </div>
        <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
          {Array.from({ length: dayCount }, (_, i) => (
            <div key={i} style={{
              minWidth: "76px", height: "110px", borderRadius: "14px",
              background: th.card, border: `1px solid ${th.cardBorder}`,
              opacity: 0.5,
            }} />
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="fade-in" style={{ marginBottom: "20px" }}>
        <div style={{
          padding: "14px 16px", borderRadius: "14px",
          background: th.card, border: `1px solid ${th.cardBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>🌤️</span>
            <span style={{ fontSize: "13px", color: th.muted }}>Weather unavailable for this location</span>
          </div>
          <button
            onClick={() => { lastFetchKey.current = ""; setRetryCount((c) => c + 1); }}
            style={{
              background: "none", border: `1px solid ${th.cardBorder}`, borderRadius: "8px",
              padding: "4px 12px", cursor: "pointer", fontSize: "12px", color: th.muted,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  // ─── "Too early" state: trip dates are beyond the 16-day forecast window ───
  if (weather.status === "too_early") {
    const availDate = weather.availableFrom
      ? formatDate(weather.availableFrom)
      : `in ${weather.daysUntilAvailable} days`;

    return (
      <div className="fade-in" style={{ marginBottom: "20px" }}>
        <div style={{
          padding: "16px", borderRadius: "14px",
          background: th.card, border: `1px solid ${th.cardBorder}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px" }}>🌤️</span>
            <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              Weather Forecast
            </span>
          </div>
          <div style={{ fontSize: "13px", color: th.muted, lineHeight: 1.5 }}>
            Your trip is <strong style={{ color: th.text }}>{weather.daysUntilAvailable} days away</strong> — forecasts
            are only available within 16 days of travel. Check back around <strong style={{ color: th.text }}>{availDate}</strong> for
            your {formatDate(startDate)} – {formatDate(endDate)} forecast.
          </div>
        </div>
      </div>
    );
  }

  // ─── "Past" state: trip already happened ───
  if (weather.status === "past") return null;

  // ─── Forecast available (complete or partial) ───
  const days = weather.days;
  if (days.length === 0) return null;

  const avgHigh = Math.round(days.reduce((s, d) => s + d.tempHigh, 0) / days.length);
  const avgLow = Math.round(days.reduce((s, d) => s + d.tempLow, 0) / days.length);
  const rainyDays = days.filter((d) => (d.precipProbability ?? 0) > 30).length;

  const getPackingHint = () => {
    const hints: string[] = [];
    const maxTemp = Math.max(...days.map((d) => d.tempHigh));
    const minTemp = Math.min(...days.map((d) => d.tempLow));

    if (minTemp < 45) hints.push("Pack warm layers");
    if (maxTemp > 85) hints.push("Bring lightweight, breathable clothing");
    if (rainyDays > 0) hints.push(`Rain gear recommended (${rainyDays} rainy day${rainyDays > 1 ? "s" : ""})`);
    if (days.some((d) => d.windSpeed > 20)) hints.push("Expect windy conditions");
    if (maxTemp - minTemp > 25) hints.push("Big temp swings — dress in layers");

    return hints.length > 0 ? hints.join(" · ") : "Great weather — pack for comfort!";
  };

  return (
    <div className="fade-in" style={{ marginBottom: "20px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🌤️</span>
          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
            Weather Forecast
          </span>
          <span style={{ fontSize: "11px", color: th.muted, opacity: 0.7 }}>
            {weather.location.name}{weather.location.admin1 ? `, ${weather.location.admin1}` : ""}
          </span>
        </div>
        <div style={{ fontSize: "11px", color: th.muted, opacity: 0.5 }}>
          Avg {avgHigh}°/{avgLow}°F
        </div>
      </div>

      {/* Partial coverage note */}
      {weather.status === "partial" && weather.missingDays && weather.missingDays > 0 && (
        <div style={{
          fontSize: "11px", color: th.accent, background: `${th.accent}11`,
          padding: "6px 10px", borderRadius: "8px", marginBottom: "10px",
        }}>
          Showing {days.length} of {weather.totalTripDays} trip days — remaining {weather.missingDays} day{weather.missingDays > 1 ? "s" : ""} will appear as your trip gets closer
        </div>
      )}

      {/* Daily forecast cards — horizontal scroll */}
      <div style={{
        display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "6px",
        scrollbarWidth: "none",
      }}>
        {days.map((day) => {
          const { weekday, monthDay } = formatDay(day.date);
          const isRainy = (day.precipProbability ?? 0) > 30;
          return (
            <div key={day.date} style={{
              minWidth: "76px", maxWidth: "76px",
              padding: "10px 6px",
              borderRadius: "14px",
              background: th.card,
              border: `1px solid ${th.cardBorder}`,
              textAlign: "center",
              flexShrink: 0,
            }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: th.text, marginBottom: "2px" }}>
                {weekday}
              </div>
              <div style={{ fontSize: "9px", color: th.muted, marginBottom: "6px" }}>
                {monthDay}
              </div>
              <div style={{ fontSize: "24px", lineHeight: 1, marginBottom: "6px" }}>
                {day.weatherIcon}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: th.text }}>
                {day.tempHigh}°
              </div>
              <div style={{ fontSize: "11px", color: th.muted }}>
                {day.tempLow}°
              </div>
              {day.precipProbability !== null && day.precipProbability > 0 && (
                <div style={{
                  fontSize: "9px", marginTop: "4px",
                  color: isRainy ? "#2196f3" : th.muted,
                  fontWeight: isRainy ? 600 : 400,
                }}>
                  💧 {day.precipProbability}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Packing hint */}
      <div style={{
        marginTop: "10px", fontSize: "12px", color: th.muted,
        padding: "8px 12px", borderRadius: "10px",
        background: `${th.accent}08`, border: `1px solid ${th.accent}15`,
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        <span>🧳</span>
        <span>{getPackingHint()}</span>
      </div>
    </div>
  );
}
