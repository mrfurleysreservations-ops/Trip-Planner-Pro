import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Handles email confirmation links from Supabase.
 *
 * When a user clicks "Confirm your email" in the Supabase email,
 * the link redirects here with `token_hash` and `type` query params.
 * We verify the OTP server-side, then redirect to onboarding or dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // ─── Invitee fast-path ───
        // Users who arrived via a Supabase invite email have no password yet.
        // Route them to the minimal /auth/invitee-setup screen (name + password)
        // which then drops them on the trip invite page. The full onboarding
        // wizard would be a terrible first experience for someone who just
        // wanted to RSVP to a trip — we defer it via the dashboard's existing
        // "Finish setting up your profile" card.
        const metadata = (user.user_metadata ?? {}) as { password_set?: boolean };
        const needsInviteeSetup = !!user.invited_at && !metadata.password_set;
        if (needsInviteeSetup) {
          const qs = `?next=${encodeURIComponent(next)}`;
          return NextResponse.redirect(`${origin}/auth/invitee-setup${qs}`);
        }

        // Everyone else who hasn't finished onboarding: send to the full wizard,
        // threading `next` so finishing drops them where they were heading.
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (profile && !profile.onboarding_completed) {
          const qs = next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : "";
          return NextResponse.redirect(`${origin}/onboarding${qs}`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If verification fails, send to login with an error
  return NextResponse.redirect(
    `${origin}/auth/login?error=confirmation_failed`
  );
}
