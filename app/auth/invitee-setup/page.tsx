import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import InviteeSetupPage from "./invitee-setup-page";

// Only accept same-origin paths for `next` so this can't be used as an open redirect.
function sanitizeNext(raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Fast-path setup screen for invited users.
 *
 * An invite email drops the user into /auth/confirm, which now forwards
 * invited+no-password users here instead of the full onboarding wizard.
 * This page asks for ONLY name + password, saves them, then routes the
 * user straight to the trip invite page. The full onboarding is deferred
 * — users see a "Finish setting up your profile" card on the dashboard
 * whenever `onboarding_completed` is false.
 *
 * Rationale: invitees clicked a link to RSVP to a trip. They shouldn't
 * have to answer an 8-step packing-personality quiz before they can say
 * "yes I'll go."
 */
export default async function InviteeSetupRoute({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const nextUrl = sanitizeNext(searchParams?.next);

  // If the user already set a password, this page has nothing to do.
  // Send them onward (to next, or /dashboard).
  const metadata = (user.user_metadata ?? {}) as { password_set?: boolean };
  if (metadata.password_set) {
    redirect(nextUrl ?? "/dashboard");
  }

  // Pre-fill name from whatever already exists — invite metadata sets
  // full_name if we know it, otherwise show an empty field.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <InviteeSetupPage
      userId={user.id}
      userEmail={user.email ?? ""}
      initialName={profile?.full_name ?? ""}
      nextUrl={nextUrl}
    />
  );
}
