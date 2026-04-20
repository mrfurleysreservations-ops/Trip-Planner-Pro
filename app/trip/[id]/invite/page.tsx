import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip } from "@/types/database.types";
import InviteLanding from "./invite-page";

// Landing page for the link in the invite email. The magic-link in the email
// drops the user at /auth/callback?next=/trip/[id]/invite, and callback then
// routes them here (after onboarding check).
export default async function TripInviteServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Magic-link handler should've authed them; if not, bounce to login with
    // a redirect back to this page so they come back here after signing in.
    const next = encodeURIComponent(`/trip/${id}/invite`);
    redirect(`/auth/login?next=${next}`);
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) {
    // They got a stale/invalid link. Dashboard is the safest fallback.
    redirect("/dashboard?invite_error=trip_not_found");
  }

  // See if they already have a trip_members row (either a pending external
  // invite that matches their email, or an already-added app user).
  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .or(`user_id.eq.${user.id},email.eq.${user.email ?? ""}`);

  const ownRow = (memberRows ?? []).find((m: any) => m.user_id === user.id) ?? null;
  const emailRow = (memberRows ?? []).find(
    (m: any) => !m.user_id && user.email && m.email?.toLowerCase() === user.email.toLowerCase()
  ) ?? null;

  // Host display name for the welcome copy.
  const { data: hostProfile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", trip.owner_id)
    .single();

  return (
    <InviteLanding
      trip={trip as Trip}
      hostName={hostProfile?.full_name || "The host"}
      userId={user.id}
      userEmail={user.email ?? ""}
      ownRowId={ownRow?.id ?? null}
      ownRowStatus={ownRow?.status ?? null}
      emailRowId={emailRow?.id ?? null}
    />
  );
}
