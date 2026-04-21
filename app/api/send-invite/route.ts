import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// POST /api/send-invite
// Body: { tripId: string, email: string, inviteeName?: string }
// - Looks up the trip + host name (used as metadata for email templates).
// - If the email belongs to an existing Supabase auth user, sends a magic-link
//   sign-in email; otherwise sends an invite email (creates the user record).
// - Either way, the recipient lands at /auth/callback?next=/trip/[tripId]/invite
//   after clicking the email link.
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
      .select("id, name, owner_id")
      .eq("id", tripId)
      .single();
    if (tripErr || !trip) {
      return NextResponse.json({ error: "Trip not found or access denied" }, { status: 404 });
    }

    // Look up host display name for the email metadata.
    const { data: hostProfile } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", trip.owner_id)
      .single();
    const hostName = hostProfile?.full_name || "A friend";

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

    const inviteMetadata = {
      trip_id: tripId,
      trip_name: trip.name,
      host_name: hostName,
      invitee_name: inviteeName || null,
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
