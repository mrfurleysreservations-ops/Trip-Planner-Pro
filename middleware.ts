import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareSupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicPage = pathname === "/";
  const isOnboardingPage = pathname === "/onboarding";

  // Redirect unauthenticated users to login (except auth pages and root)
  if (!user && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage && pathname !== "/auth/reset-password") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect users who haven't completed onboarding
  // UNLESS they chose "Explore the App" (skip cookie set)
  if (user && !isAuthPage && !isOnboardingPage && !isPublicPage) {
    const skippedOnboarding = request.cookies.get("skipped_onboarding")?.value === "true";

    if (!skippedOnboarding) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  return response();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
