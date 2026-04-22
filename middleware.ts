import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicPage = pathname === "/";
  const isOnboardingPage = pathname === "/onboarding";

  // Public landing page — no auth check needed. Skip the Supabase round-trip
  // entirely. The page itself is server-rendered and reads nothing that
  // depends on the user.
  if (isPublicPage) {
    return NextResponse.next({ request });
  }

  const { supabase, response } = createMiddlewareSupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except auth pages; the landing
  // page was already handled above).
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage && pathname !== "/auth/reset-password") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Onboarding gate. Cookie-first: the DB query only runs when neither the
  // "skipped_onboarding" cookie NOR the cached "onboarding_completed" cookie
  // is set. For a returning user this means zero DB queries for the gate.
  if (user && !isAuthPage && !isOnboardingPage) {
    const skippedOnboarding = request.cookies.get("skipped_onboarding")?.value === "true";
    const onboardingCompletedCookie =
      request.cookies.get("onboarding_completed")?.value === "true";

    // Fast path — cached or explicitly skipped.
    if (skippedOnboarding || onboardingCompletedCookie) {
      return response();
    }

    // Slow path — first-time user, or user whose cookie hasn't been set yet.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Onboarding is done according to the DB. Cache that in a cookie so we
    // don't hit user_profiles on every navigation for this user again.
    // httpOnly:false is fine — this flag is a UX optimization, not a security
    // token (RLS is the real boundary, JWT is the auth proof).
    // maxAge 1 year is safe because onboarding is monotonic — it can't
    // un-complete.
    const res = response();
    res.cookies.set("onboarding_completed", "true", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  return response();
}

export const config = {
  matcher: [
    // Skip Next internals, static assets, the API layer, and common asset
    // extensions. Middleware should NEVER run for these — they never need an
    // auth check and running middleware on them was burning cycles for no
    // reason.
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|webmanifest|woff|woff2|ttf|map)).*)",
  ],
};
