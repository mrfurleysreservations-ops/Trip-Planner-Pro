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
      // Check if user needs onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (profile && !profile.onboarding_completed) {
          // Preserve the intended destination through onboarding so invitees
          // land on /trip/[id]/invite after finishing instead of /dashboard.
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
