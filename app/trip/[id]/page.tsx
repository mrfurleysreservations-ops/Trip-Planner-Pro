import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripBooking, TripMember, ItineraryEvent } from "@/types/database.types";
import { defaultTabForRole } from "@/lib/role-density";
import TripPage from "./trip-page";

export default async function TripServerPage({ params, searchParams }: { params: { id: string }; searchParams: { edit?: string; from?: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;
  const wantsEdit = searchParams.edit === "true";
  const fromGroup = searchParams.from === "group";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [tripRes, membersRes, bookingsRes, eventsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).single(),
    supabase.from("trip_members").select("*").eq("trip_id", id),
    supabase.from("trip_bookings").select("*").eq("trip_id", id).order("start_date", { ascending: true }),
    // Itinerary events feed the role hero (next-event card, upcoming count).
    // Ordered so the first event with a future-or-today date lands at index 0
    // after we filter below.
    supabase
      .from("itinerary_events")
      .select("*")
      .eq("trip_id", id)
      .not("date", "is", null)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
  ]);

  const trip = tripRes.data as Trip | null;
  if (!trip) redirect("/dashboard");

  const members = membersRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const events = (eventsRes.data ?? []) as ItineraryEvent[];
  const isHost = trip.owner_id === user.id;
  const memberCount = members.length;
  const currentMember = members.find((m: any) => m.user_id === user.id);
  const userName = currentMember?.name || "Someone";
  const currentUserRole: string | null = currentMember?.role_preference ?? null;

  // Determine if the trip setup is complete
  // A trip is "set up" when it has a real name, location, and at least one date
  const isSetupComplete =
    trip.name !== "New Trip" &&
    !!trip.location &&
    (!!trip.start_date || !!trip.end_date);

  // Guests always go to the hub; hosts go to setup if incomplete
  // Also allow hosts to force-edit via ?edit=true query param
  // If user just came from the group page, skip setup and show the hub
  const needsSetup = isHost && !fromGroup && (!isSetupComplete || wantsEdit);

  // Role-driven default tab redirect. Only fires on the bare /trip/[id] hub
  // entry (this file). Specific sub-paths /trip/[id]/itinerary, /expenses,
  // etc. resolve through their own server components and are unaffected.
  //
  // Rules:
  //   - Skip when `needsSetup` (host still needs to fill in trip details).
  //   - Skip when the user came from the group page (post-invite handoff).
  //   - Skip when the role's default tab is `itinerary` (hub already shows
  //     that view inline — no redirect needed; also keeps unknown/null roles
  //     from bouncing, since getRoleConfig falls back to `helping_out`).
  //   - Otherwise redirect to /trip/[id]/<defaultTab>.
  if (!needsSetup && currentMember) {
    const defaultTab = defaultTabForRole(currentUserRole);
    if (defaultTab && defaultTab !== "itinerary") {
      redirect(`/trip/${id}/${defaultTab}`);
    }
  }

  // Compute "next event" + upcoming counts server-side so the hero doesn't
  // need to re-filter on the client. "Today" uses the trip viewer's local
  // date via the server's ISO slice — good enough for a single-day window
  // (events are stored as plain DATE, no timezone). If your trip spans
  // different timezones, the hero might be off by a day at the edges.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => !!e.date && e.date >= todayIso);
  const nextEvent: ItineraryEvent | null = upcomingEvents[0] ?? null;
  const upcomingEventCount = upcomingEvents.length;

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
      currentUserRole={currentUserRole}
      nextEvent={nextEvent}
      upcomingEventCount={upcomingEventCount}
    />
  );
}
