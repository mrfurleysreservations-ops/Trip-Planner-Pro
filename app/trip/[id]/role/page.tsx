import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember } from "@/types/database.types";
import RolePage from "./role-page";

export interface RolePageProps {
  trip: Trip;
  currentMember: TripMember;
  defaultRole: string | null;
  inviterName: string | null;
  userId: string;
  userName: string;
  redirectTo: string;
}

export default async function RoleServerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { redirectTo?: string };
}) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Trip must exist
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) redirect("/dashboard");

  // Current user must be a member of this trip — otherwise bounce to dashboard
  const { data: currentMember } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMember) redirect("/dashboard");

  // Pull the account-level default role (used to decide whether to seed it
  // on first pick — we never overwrite an existing default)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("default_role_preference, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Inviter name — only if somebody else invited this user onto the trip
  let inviterName: string | null = null;
  if (currentMember.invited_by && currentMember.invited_by !== user.id) {
    const { data: inviterProfile } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", currentMember.invited_by)
      .maybeSingle();
    inviterName = inviterProfile?.full_name ?? null;
  }

  // Sanitize redirectTo: only allow same-origin paths starting with "/"
  const rawRedirect = searchParams?.redirectTo ?? "";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
    ? rawRedirect
    : `/trip/${id}`;

  return (
    <RolePage
      trip={trip as Trip}
      currentMember={currentMember as TripMember}
      defaultRole={profile?.default_role_preference ?? null}
      inviterName={inviterName}
      userId={user.id}
      userName={profile?.full_name ?? currentMember.name ?? "You"}
      redirectTo={safeRedirect}
    />
  );
}
