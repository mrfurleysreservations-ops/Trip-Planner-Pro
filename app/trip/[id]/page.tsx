import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripBooking, TripMember } from "@/types/database.types";
import TripPage from "./trip-page";

export default async function TripServerPage({ params, searchParams }: { params: { id: string }; searchParams: { edit?: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;
  const wantsEdit = searchParams.edit === "true";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [tripRes, membersRes, bookingsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).single(),
    supabase.from("trip_members").select("*").eq("trip_id", id),
    supabase.from("trip_bookings").select("*").eq("trip_id", id).order("start_date", { ascending: true }),
  ]);

  const trip = tripRes.data as Trip | null;
  if (!trip) redirect("/dashboard");

  const members = membersRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const isHost = trip.owner_id === user.id;
  const memberCount = members.length;
  const currentMember = members.find((m: any) => m.user_id === user.id);
  const userName = currentMember?.name || "Someone";

  // Determine if the trip setup is complete
  // A trip is "set up" when it has a real name, location, at least one date,
  // and at least one member beyond the host
  const isSetupComplete =
    trip.name !== "New Trip" &&
    !!trip.location &&
    (!!trip.start_date || !!trip.end_date) &&
    memberCount > 1;

  // Guests always go to the hub; hosts go to setup if incomplete
  // Also allow hosts to force-edit via ?edit=true query param
  const needsSetup = isHost && (!isSetupComplete || wantsEdit);

  return (
    <TripPage
      trip={trip}
      userId={user.id}
      userName={userName}
      isHost={isHost}
      needsSetup={needsSetup}
      memberCount={memberCount}
      bookings={bookings as TripBooking[]}
      members={members as TripMember[]}
    />
  );
}