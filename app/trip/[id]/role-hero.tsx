"use client";
// Role-specific hub hero — now the trip hub's real dashboard rather than a
// decorative banner. Each role gets a variant that answers "what do I care
// about first?" with real data fetched server-side and passed down via
// `heroData`:
//
//   🔥 All In       — running-the-show dashboard (events, unsettled $,
//                     packing %, quick-scan of next 3 events, latest chat)
//   🙌 Helping Out  — soft nudges into assist surfaces (notes, packing),
//                     latest chat, "you owe" strip only when viewer is in red
//   🎟️ Just Here    — amount-card first ("You owe $X · Pay with Venmo"),
//                     then latest chat, next event, packing opt-in hint
//   ✌️ Vibes Only   — next-event gradient card + amount-card only when owed
//
// Style rules:
//   - Inline styles only. No Tailwind, no CSS modules.
//   - Glass-card surface for the hero; #fafafa card bodies for MiniSection.
//   - Accent-tinted amount cards; settled variant flips to green.
//   - Stay terse — the hub hero is not the place to add every future feature.
//
// Deliberately out of scope (Phase 2):
//   - Nudge buttons / RSVP aggregation
//   - Meal claim surfaces in Helping Out
//   - Real Venmo deep-links in Just Here (placeholder button for now)
//   - @mention filtering in the Just Here latest-message row

import { useRouter } from "next/navigation";
import type { Trip, ItineraryEvent } from "@/types/database.types";
import type { ThemeConfig } from "@/lib/constants";
import { getRoleConfig } from "@/lib/role-density";

// ─── Shared data payload (built server-side in app/trip/[id]/page.tsx) ───

export interface RoleHeroData {
  // Expenses
  viewerNet: number;                       // negative = owes, positive = owed, 0 = settled
  counterpartyName: string | null;
  topOwedExpenseTitles: string[];          // up to 3, for Just Here amount-card subtitle
  tripUnsettledTotal: number;              // sum of |net| across all non-zero families
  // Chat
  unreadChatCount: number;
  chatLevel: "all" | "mentions" | "muted";
  latestMessage: { authorName: string; body: string; createdAt: string } | null;
  // Packing
  packingTotal: number;
  packingPacked: number;
}

// ─── Formatters ──────────────────────────────────────────────────

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

/** Human-friendly "2m ago / 3h ago / Apr 3" for chat timestamps. */
function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Clamp a chat body to ~120 chars with a trailing ellipsis. */
function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

// ─── Shared card chrome ──────────────────────────────────────────

// Matches .hero in the mockup (gradient, white text). Kept as-is from the
// previous version — it's the outer shell for every variant.
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

// ─── New helpers: AmountCard + MiniSection ───────────────────────

interface AmountCardProps {
  label: string;
  /** Pre-formatted string, e.g. "$165.00" — callers own the rounding rule. */
  amount: string;
  note?: string;
  /** e.g. "Pay with Venmo" — tapping is a no-op placeholder for now. */
  ctaLabel?: string;
  /** Green-variant treatment: flips border + amount color to settled green. */
  settled?: boolean;
  accent: string;
}

/**
 * Big-number card used for "You owe $X" and "You're all settled ✓". Lives
 * inside the hero surface as a white panel so the accent gradient shows
 * through its margins.
 */
function AmountCard({
  label,
  amount,
  note,
  ctaLabel,
  settled,
  accent,
}: AmountCardProps): JSX.Element {
  const SETTLED_GREEN = "#2e7d32";
  const borderColor = settled ? SETTLED_GREEN : accent;
  const amountColor = settled ? SETTLED_GREEN : accent;

  return (
    <div
      style={{
        background: "#fff",
        color: "#1a1a1a",
        borderRadius: 14,
        border: `2px solid ${borderColor}`,
        padding: "16px 18px",
        marginTop: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6a6a6a",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900,
          fontSize: 36,
          lineHeight: 1,
          color: amountColor,
        }}
      >
        {amount}
      </div>
      {note && (
        <div style={{ fontSize: 12, color: "#6a6a6a", marginTop: 8 }}>{note}</div>
      )}
      {ctaLabel && !settled && (
        <button
          // Placeholder — the real Venmo deep-link is Phase 2 work. Clicking
          // intentionally does nothing today; Joe asked us to show the CTA
          // so the hero communicates intent even without the integration.
          type="button"
          onClick={(e) => e.preventDefault()}
          style={{
            marginTop: 12,
            background: accent,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

interface MiniSectionProps {
  icon: string;
  title: string;
  rightMeta?: string;
  body: React.ReactNode;
  /** Muted styling — used for opt-in nudges like "personalized packing". */
  dim?: boolean;
}

/**
 * Subdued card body used to chunk the hero into scannable rows: latest chat,
 * quick-scan events, packing opt-in prompt. The #fafafa background matches
 * the `.mini-section` class in the mockup and sits atop the colored hero
 * surface without competing for attention.
 */
function MiniSection({ icon, title, rightMeta, body, dim }: MiniSectionProps): JSX.Element {
  return (
    <div
      style={{
        background: "#fafafa",
        color: "#1a1a1a",
        borderRadius: 12,
        padding: "12px 14px",
        marginTop: 10,
        opacity: dim ? 0.72 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <span style={{ marginRight: 6 }}>{icon}</span>
          {title}
        </div>
        {rightMeta && (
          <div style={{ fontSize: 10, color: "#6a6a6a", fontWeight: 600 }}>
            {rightMeta}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}

// ─── Variant components ─────────────────────────────────────────

interface HeroCommon {
  trip: Trip;
  theme: ThemeConfig;
  nextEvent: ItineraryEvent | null;
  upcomingEvents: ItineraryEvent[];
  isHost: boolean;
  heroData: RoleHeroData;
}

/** 🔥 All In — the operator view. Dense, informational, no speculative CTAs. */
function RoleHeroAllIn({ trip, theme, upcomingEvents, isHost, heroData }: HeroCommon) {
  const router = useRouter();
  const { tripUnsettledTotal, unreadChatCount, packingTotal, packingPacked, latestMessage } = heroData;
  const label = isHost ? "You're running the show" : "You're fully in";

  const upcomingEventCount = upcomingEvents.length;
  const title =
    upcomingEventCount > 0
      ? `${upcomingEventCount} event${upcomingEventCount === 1 ? "" : "s"} coming up`
      : "No events scheduled yet";

  // Packing copy — guard against division-by-zero on trips with no personalized
  // packing list yet. Showing "0% complete" would read as a regression.
  let packingLine = "Packing not set up yet";
  if (packingTotal > 0) {
    const pct = Math.round((packingPacked / packingTotal) * 100);
    packingLine = `Packing ${pct}% complete`;
  }

  const metaParts: string[] = [];
  metaParts.push(`${upcomingEventCount} event${upcomingEventCount === 1 ? "" : "s"}`);
  metaParts.push(`$${tripUnsettledTotal.toFixed(0)} unsettled`);
  metaParts.push(`${unreadChatCount} new message${unreadChatCount === 1 ? "" : "s"}`);

  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={heroTitleStyle}>{title}</div>
      <div style={heroMetaStyle}>{metaParts.join(" · ")}</div>
      <div style={{ ...heroMetaStyle, marginTop: 2 }}>{packingLine}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => router.push(`/trip/${trip.id}/expenses`)} style={heroBtnStyle}>
          Settle up →
        </button>
        <button onClick={() => router.push(`/trip/${trip.id}/itinerary`)} style={heroBtnStyle}>
          Open Itinerary →
        </button>
      </div>

      {upcomingEvents.length > 0 && (
        <MiniSection
          icon="📅"
          title="Quick scan"
          rightMeta={`next ${upcomingEvents.length}`}
          body={
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {upcomingEvents.map((ev) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{ev.title}</span>
                  <span style={{ color: "#6a6a6a", fontSize: 12 }}>{formatEventWhen(ev)}</span>
                </div>
              ))}
            </div>
          }
        />
      )}

      {latestMessage && (
        <MiniSection
          icon="💬"
          title="Latest"
          rightMeta={formatRelativeTime(latestMessage.createdAt)}
          body={
            <span>
              <span style={{ fontWeight: 700 }}>{latestMessage.authorName}:</span>{" "}
              <span style={{ fontStyle: "italic" }}>&ldquo;{truncate(latestMessage.body)}&rdquo;</span>
            </span>
          }
        />
      )}
    </div>
  );
}

/** 🙌 Helping Out — soft, informational. No fabricated task lists. */
function RoleHeroHelpingOut({ trip, theme, heroData }: HeroCommon) {
  const router = useRouter();
  const { packingTotal, packingPacked, latestMessage, viewerNet } = heroData;
  const showOweStrip = viewerNet < -0.01;

  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>Ready to lend a hand</div>
      <div style={heroTitleStyle}>Dip in wherever — notes, packing, meals.</div>

      {packingTotal > 0 && (
        <div style={heroMetaStyle}>
          Your packing: {packingPacked}/{packingTotal} items
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => router.push(`/trip/${trip.id}/notes`)} style={heroBtnStyle}>
          Browse Notes →
        </button>
        <button onClick={() => router.push(`/trip/${trip.id}/packing`)} style={heroBtnStyle}>
          Open Packing →
        </button>
      </div>

      {latestMessage && (
        <MiniSection
          icon="💬"
          title="Latest"
          rightMeta={formatRelativeTime(latestMessage.createdAt)}
          body={
            <span>
              <span style={{ fontWeight: 700 }}>{latestMessage.authorName}:</span>{" "}
              <span style={{ fontStyle: "italic" }}>&ldquo;{truncate(latestMessage.body)}&rdquo;</span>
            </span>
          }
        />
      )}

      {showOweStrip && (
        <MiniSection
          icon="💰"
          title="You owe"
          rightMeta={`$${Math.abs(viewerNet).toFixed(2)}`}
          body="Tap Expenses to settle"
        />
      )}
    </div>
  );
}

/** 🎟️ Just Here — amount-card first, then context. */
function RoleHeroJustHere({ trip, theme, nextEvent, heroData }: HeroCommon) {
  const router = useRouter();
  const { viewerNet, counterpartyName, topOwedExpenseTitles, latestMessage } = heroData;

  const isSettled = viewerNet >= -0.01;
  const owedAmount = Math.abs(viewerNet).toFixed(2);
  // If we can't pin down a specific counterparty (e.g. viewer owes multiple
  // families roughly equally), degrade gracefully to "the group".
  const oweLabel = `You owe ${counterpartyName || "the group"}`;
  const note = topOwedExpenseTitles.length > 0 ? topOwedExpenseTitles.slice(0, 3).join(" · ") : undefined;

  return (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>Quick check-in</div>
      <div style={heroTitleStyle}>Your trip at a glance</div>

      {isSettled ? (
        <AmountCard
          label="You're all settled"
          amount="✓"
          settled
          accent={theme.accent}
        />
      ) : (
        <AmountCard
          label={oweLabel}
          amount={`$${owedAmount}`}
          note={note}
          ctaLabel="Pay with Venmo"
          accent={theme.accent}
        />
      )}

      {latestMessage && (
        <MiniSection
          icon="💬"
          title="Latest message"
          rightMeta={formatRelativeTime(latestMessage.createdAt)}
          body={
            <span>
              <span style={{ fontWeight: 700 }}>{latestMessage.authorName}:</span>{" "}
              <span style={{ fontStyle: "italic" }}>&ldquo;{truncate(latestMessage.body)}&rdquo;</span>
            </span>
          }
        />
      )}

      {nextEvent && (
        <MiniSection
          icon="📅"
          title="Where to be"
          rightMeta="next up"
          body={
            <div>
              <div style={{ fontWeight: 600 }}>
                {nextEvent.title} · <span style={{ color: "#6a6a6a", fontWeight: 500 }}>{formatEventWhen(nextEvent)}</span>
              </div>
              {nextEvent.location && (
                <div style={{ fontSize: 12, color: "#6a6a6a", marginTop: 4 }}>📍 {nextEvent.location}</div>
              )}
            </div>
          }
        />
      )}

      <MiniSection
        icon="🧳"
        title="Packing list"
        rightMeta="opt-in"
        dim
        body={
          <span>
            Want a personalized list?{" "}
            <button
              type="button"
              onClick={() => router.push(`/profile`)}
              style={{
                background: "none",
                border: "none",
                color: theme.accent,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Set it up →
            </button>
          </span>
        }
      />
    </div>
  );
}

/** ✌️ Vibes Only — gradient next-event card (unchanged) + owe strip on top. */
function RoleHeroVibesOnly({ trip, theme, nextEvent, heroData }: HeroCommon) {
  const router = useRouter();
  const { viewerNet } = heroData;
  const showOwe = viewerNet < -0.01;

  // Existing next-event hero — do not touch the above-the-line content, the
  // mockup review called this correct. Owe amount card lives below it.
  const nextEventHero = !nextEvent ? (
    <div style={heroSurface(theme.accent, theme.accent2)}>
      <div style={heroLabelStyle}>Nothing scheduled yet</div>
      <div style={heroTitleStyle}>We&rsquo;ll surface the next thing when it lands</div>
      <div style={heroMetaStyle}>Kick back — {trip.name} hasn&rsquo;t been filled in yet.</div>
    </div>
  ) : (() => {
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
  })();

  if (!showOwe) return nextEventHero;

  // Vibes-Only variant of the owe card uses no cents (minimalism).
  const owedRoundDollars = Math.round(Math.abs(viewerNet));

  return (
    <>
      {nextEventHero}
      <div style={heroSurface(theme.accent, theme.accent2)}>
        <AmountCard
          label="You owe"
          amount={`$${owedRoundDollars}`}
          ctaLabel="Pay with Venmo"
          accent={theme.accent}
        />
      </div>
    </>
  );
}

// ─── Entry point ────────────────────────────────────────────────

interface RoleHeroProps extends HeroCommon {
  role: string | null;
}

export default function RoleHero(props: RoleHeroProps) {
  // getRoleConfig falls back to "helping_out" for unknown/null roles,
  // which renders a neutral assist-style hero — sensible default for
  // pre-role trips where members haven't picked a role yet.
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
