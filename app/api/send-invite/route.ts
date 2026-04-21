import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ─── Trip-type visual config (kept in sync with lib/constants.ts) ───
// Duplicated here so the email metadata is self-contained and independent of
// any client-bundled code paths. If you add a new trip type in lib/constants.ts,
// add it here too.
const TRIP_TYPE_META: Record<
  string,
  { emoji: string; label: string; accent: string; accentSoft: string; tagline: string }
> = {
  camping: { emoji: "🏕️", label: "Camping",   accent: "#5a9a2f", accentSoft: "#eef4e8", tagline: "Into the wild" },
  flying:  { emoji: "✈️",  label: "Flying",    accent: "#0097a7", accentSoft: "#e8f4f6", tagline: "Beach & beyond" },
  roadtrip:{ emoji: "🚗", label: "Road Trip", accent: "#e65100", accentSoft: "#f5ede0", tagline: "Route 66 vibes" },
  meetup:  { emoji: "🤝", label: "Meetup",    accent: "#9c27b0", accentSoft: "#f0e4f4", tagline: "Get together" },
};
const DEFAULT_TRIP_TYPE_META = { emoji: "🧳", label: "Trip", accent: "#e8943a", accentSoft: "#faf6f0", tagline: "Let's go" };

// Format a Postgres DATE (YYYY-MM-DD) or ISO string into a friendly range. Returns
// "" when we can't parse either end so the template can fall back cleanly.
function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const s = start ? new Date(`${start}T00:00:00Z`) : null;
  const e = end ? new Date(`${end}T00:00:00Z`) : null;
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(d);

  if (s && e) {
    const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
    const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
    if (sameMonth) {
      // "Jun 12 – 19, 2026"
      return `${fmt(s, { month: "short", day: "numeric" })} – ${fmt(e, { day: "numeric", year: "numeric" })}`;
    }
    if (sameYear) {
      // "Jun 28 – Jul 4, 2026"
      return `${fmt(s, { month: "short", day: "numeric" })} – ${fmt(e, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    // "Dec 28, 2026 – Jan 3, 2027"
    return `${fmt(s, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(e, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (s) return fmt(s, { month: "short", day: "numeric", year: "numeric" });
  if (e) return fmt(e, { month: "short", day: "numeric", year: "numeric" });
  return "";
}

// Build a compact attendee preview like "Sarah, Mike, and 3 others" from a
// list of display names. Skips falsy names and caps at 2 leading names to keep
// the email skimmable.
function formatAttendeePreview(names: string[]): string {
  const clean = names.filter((n) => typeof n === "string" && n.trim().length > 0).map((n) => n.trim());
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  if (clean.length === 3) return `${clean[0]}, ${clean[1]}, and ${clean[2]}`;
  const othersCount = clean.length - 2;
  return `${clean[0]}, ${clean[1]}, and ${othersCount} other${othersCount === 1 ? "" : "s"}`;
}

// POST /api/send-invite
// Body: { tripId: string, email: string, inviteeName?: string }
// - Looks up the trip + host + attendee preview to build rich metadata that
//   the Supabase "Invite user" email template (and magic-link template) can
//   use to render a themed, personalized invite card.
// - If the email belongs to an existing Supabase auth user, sends a magic-link
//   sign-in email; otherwise sends an invite email (creates the user record).
// - Email link lands at /auth/confirm → /auth/invitee-setup (name+password)
//   → /trip/[tripId]/invite.
// - Returns { ok: true, mode: "invited" | "magiclink" } on success.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const inviteeName = typeof body?.inviteeName === "string" ? body.inviteeName.trim() : "";

    // Enforce email requirement + basic format check.
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    if (!tripId || !emailOk) {
      return NextResponse.json(
        { error: "tripId and a valid email are required" },
        { status: 400 }
      );
    }

    // The requester must be a member of the trip (RLS-enforced read).
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, name, owner_id, trip_type, location, start_date, end_date")
      .eq("id", tripId)
      .single();
    if (tripErr || !trip) {
      return NextResponse.json({ error: "Trip not found or access denied" }, { status: 404 });
    }

    // Look up host display name + avatar for the email metadata.
    const { data: hostProfile } = await supabase
      .from("user_profiles")
      .select("full_name, avatar_url")
      .eq("id", trip.owner_id)
      .single();
    const hostName = hostProfile?.full_name || "A friend";
    const hostAvatarUrl = hostProfile?.avatar_url || "";

    // Attendee preview — pull accepted trip_members (auth users) + their names.
    // RLS scopes this to members the requester can see, which already includes
    // themselves + fellow members. Counts up to 10 names; the preview uses 2
    // and rolls the rest into "and N others".
    const { data: memberRows } = await supabase
      .from("trip_members")
      .select("user_id, status, email")
      .eq("trip_id", tripId)
      .eq("status", "accepted")
      .limit(10);

    const acceptedUserIds = (memberRows ?? [])
      .map((m) => m.user_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    let attendeeNames: string[] = [];
    if (acceptedUserIds.length > 0) {
      const { data: attendeeProfiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", acceptedUserIds);
      attendeeNames = (attendeeProfiles ?? [])
        .map((p) => (p.full_name ?? "").trim())
        .filter((n) => n.length > 0);
    }
    const attendeePreview = formatAttendeePreview(attendeeNames);
    const attendeeCount = (memberRows ?? []).length; // accepted members total

    // Resolve trip-type visual config.
    const typeKey = (trip.trip_type || "").toLowerCase();
    const typeMeta = TRIP_TYPE_META[typeKey] || DEFAULT_TRIP_TYPE_META;

    const dateRange = formatDateRange(trip.start_date ?? null, trip.end_date ?? null);

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfiguration — service role key not set" },
        { status: 500 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Where the email link should land. Prefer NEXT_PUBLIC_SITE_URL so prod
    // URLs stay stable; fall back to the request origin for local dev. Strip
    // any trailing slash so `${origin}/path` never produces a `//` artifact.
    const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const origin = rawOrigin.replace(/\/+$/, "");
    // The email link's `{{ .RedirectTo }}` becomes the `?next=` param on our
    // /auth/confirm route. Since /auth/confirm already creates the session via
    // verifyOtp, it should hand off directly to the invite landing — NOT back
    // through /auth/callback (that route is for PKCE OAuth only).
    const redirectTo = `${origin}/trip/${tripId}/invite`;

    // ─── Rich email metadata ───
    // Every field here is surfaced as {{ .Data.<field> }} in Supabase's email
    // templates (Invite user + Magic Link). Keep all values as primitive strings
    // so Go's text/template renders them cleanly — no nested objects or arrays.
    // Missing values become empty strings (not null) so `{{ if .Data.xxx }}`
    // works as expected in the template.
    const inviteMetadata = {
      // Core
      trip_id: tripId,
      trip_name: trip.name || "your trip",
      invitee_name: inviteeName || "",
      // Host
      host_name: hostName,
      host_avatar_url: hostAvatarUrl,
      // Trip details
      trip_type: typeMeta.label,
      trip_emoji: typeMeta.emoji,
      trip_tagline: typeMeta.tagline,
      trip_accent: typeMeta.accent,          // hex, e.g. #5a9a2f
      trip_accent_soft: typeMeta.accentSoft, // pale tint for hero bg
      trip_location: trip.location || "",
      trip_dates: dateRange,                  // "Jun 12 – 19, 2026" or ""
      // Attendees
      attendee_preview: attendeePreview,      // "Sarah, Mike, and 3 others" or ""
      attendee_count: String(attendeeCount),  // stringified for template parity
    };

    // Try invite first — works cleanly for brand-new emails.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(emailRaw, {
      redirectTo,
      data: inviteMetadata,
    });

    if (!inviteErr) {
      return NextResponse.json({ ok: true, mode: "invited" });
    }

    // If the user already exists, inviteUserByEmail errors. Fall back to
    // a magic-link email via OTP, which Supabase routes through the same SMTP.
    const alreadyRegistered =
      /already|registered|exists/i.test(inviteErr.message || "");
    if (!alreadyRegistered) {
      return NextResponse.json(
        { error: `Invite failed: ${inviteErr.message}` },
        { status: 500 }
      );
    }

    const { error: otpErr } = await admin.auth.signInWithOtp({
      email: emailRaw,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
        data: inviteMetadata,
      },
    });
    if (otpErr) {
      return NextResponse.json(
        { error: `Magic link failed: ${otpErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mode: "magiclink" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
