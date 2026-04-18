"use client";
// Role-specific hub hero addendum.
//
// Renders one of four variants below the existing trip header:
//   🔥 All In       — host action items ("X events upcoming · N pending RSVPs")
//   🙌 Helping Out  — "How you can help" → link into Notes to claim tasks
//   🎟️ Just Here    — "You owe" CTA + next event (defensive; these users
//                      normally redirect to /expenses before hitting the hub)
//   ✌️ Vibes Only   — single "next event" card only
//
// Style rules (from mockups/role-trip-hub-mockup.html):
//   - Inline styles only. No Tailwind, no CSS modules.
//   - Use the trip theme accent/accent2 so the hero feels native to the
//     camping/flying/roadtrip/meetup visual identity.
//   - Glass-card surface with a gradient background tinted by accent.

import { useRouter } from "next/navigation";
import type { Trip, ItineraryEvent } from "@/types/database.types";
import type { ThemeConfig } from "@/lib/constants";
import { getRoleConfig } from "@/lib/role-density";

// ─── Helpers ───

function formatEventWhen(event: ItineraryEvent): string {
  if (!event.date) return "";
  const d = new Date(event.date + "T12:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const base = `${weekday} · ${md}`;
  if (!event.start_time) return base;
  const [h, m] = event.start_time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${base} · ${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Shared card chrome — matches .hero in the mockup (gradient, white text).
function heroSurface(accent: string, accent2: string): React.CSSProperties {
  return {
    color: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)`,
    boxShadow: `0 4px 16px ${accent}40`,
  };
}

const heroLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  opacity: 0.85,
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  marginTop: 5,
  lineHeight: 1.25,
  fontFamily: "'Outfit', sans-serif",
};

const heroMetaStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.9,
  marginTop: 4,
};

const heroBtnStyle: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,0.2)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 14px",
  borderRadius: 10,
  marginTop: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
};

// ─── Variant components ───

interface HeroCommon {
  trip: Trip;
  theme: ThemeConfig;
  nextEvent: ItineraryEvent | null;
  upcomingEventCount: number;
  isHost: boolean;
}

function RoleHeroAllIn({ trip, theme, upcomingEventCount, isHost }: HeroCommon) {
  const router = useRouter();
  const label = isHost ? "You're running the show" : "You're fully in";
  const title =
    upcomingEventCount > 0
      ? `${upcomingEventCount} event${upcomingEventCount === 1 ? "" : "s"} coming up`
      : "No events scheduled yet";
  const meta = upcomingEventCount > 0
    ? "Review the schedule, nudge the group if you need RSVPs."
    : "Kick things off — drop your first event on the itinerary.";

  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={heroTitleStyle}>{title}</div>
      <div style={heroMetaStyle}>{meta}</div>
      <button onClick={() => router.push(`/trip/${trip.id}/itinerary`)} style={heroBtnStyle}>
        Open Itinerary →
      </button>
    </div>
  );
}

function RoleHeroHelpingOut({ trip, theme, upcomingEventCount }: HeroCommon) {
  const router = useRouter();
  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>Want to help?</div>
      <div style={heroTitleStyle}>Pick up a task the host hasn't claimed</div>
      <div style={heroMetaStyle}>
        {upcomingEventCount > 0
          ? "Check meals, packing assignments, and open notes."
          : "Chime in on the itinerary once the host drops events."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => router.push(`/trip/${trip.id}/notes`)} style={heroBtnStyle}>
          Browse Notes →
        </button>
        <button onClick={() => router.push(`/trip/${trip.id}/meals`)} style={heroBtnStyle}>
          Claim a Meal →
        </button>
      </div>
    </div>
  );
}

function RoleHeroJustHere({ trip, theme, nextEvent }: HeroCommon) {
  const router = useRouter();
  // Just Here users normally redirect to /expenses before hitting the hub.
  // If they DO land here (e.g. host redirected them here, or the redirect
  // was short-circuited), give them the two things they actually care
  // about: what they owe, and where to be next.
  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>Quick check-in</div>
      <div style={heroTitleStyle}>See what you owe · where to be</div>
      {nextEvent && (
        <div style={heroMetaStyle}>
          Next up: {nextEvent.title} · {formatEventWhen(nextEvent)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => router.push(`/trip/${trip.id}/expenses`)} style={heroBtnStyle}>
          View Expenses →
        </button>
        <button onClick={() => router.push(`/trip/${trip.id}/itinerary`)} style={heroBtnStyle}>
          Next Event →
        </button>
      </div>
    </div>
  );
}

function RoleHeroVibesOnly({ trip, theme, nextEvent }: HeroCommon) {
  const router = useRouter();
  if (!nextEvent) {
    // No scheduled events — show a minimal placeholder so the hero slot
    // isn't empty (keeps visual parity with the other roles).
    return (
      <div style={heroSurface(theme.accent, theme.accent2)}>
        <div style={heroLabelStyle}>Nothing scheduled yet</div>
        <div style={heroTitleStyle}>We'll surface the next thing when it lands</div>
        <div style={heroMetaStyle}>Kick back — {trip.name} hasn't been filled in yet.</div>
      </div>
    );
  }

  const when = formatEventWhen(nextEvent);
  const mapsHref = nextEvent.location
    ? `https://www.google.com/maps/search/${encodeURIComponent(nextEvent.location)}`
    : null;

  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>{when || "Next up"}</div>
      <div style={heroTitleStyle}>{nextEvent.title}</div>
      {nextEvent.location && (
        <div style={heroMetaStyle}>📍 {nextEvent.location}</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...heroBtnStyle, textDecoration: "none" }}
          >
            Open in Maps →
          </a>
        )}
        <button onClick={() => router.push(`/trip/${trip.id}/itinerary`)} style={heroBtnStyle}>
          Full itinerary →
        </button>
      </div>
    </div>
  );
}

// ─── Entry point ───

interface RoleHeroProps extends HeroCommon {
  role: string | null;
}

export default function RoleHero(props: RoleHeroProps) {
  // getRoleConfig falls back to "helping_out" for unknown/null roles,
  // which renders a neutral assist-style hero — sensible default for
  // users who haven't picked a role yet.
  const config = getRoleConfig(props.role);
  switch (config.value) {
    case "all_in":
      return <RoleHeroAllIn {...props} />;
    case "helping_out":
      return <RoleHeroHelpingOut {...props} />;
    case "just_here":
      return <RoleHeroJustHere {...props} />;
    case "vibes_only":
      return <RoleHeroVibesOnly {...props} />;
    default:
      return <RoleHeroHelpingOut {...props} />;
  }
}
