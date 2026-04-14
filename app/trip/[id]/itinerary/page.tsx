import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, TripExpense } from "@/types/database.types";
import ItineraryPage from "./itinerary-page";

export interface ItineraryPageProps {
  trip: Trip;
  events: ItineraryEvent[];
  participants: EventParticipant[];
  members: TripMember[];
  userId: string;
  isHost: boolean;
  openEventId: string | null;
  fromNote: string | null;
  fromNoteTitle: string | null;
  fromNoteDescription: string | null;
  fromNoteLink: string | null;
  fromNoteDate: string | null;
  fromNoteStartTime: string | null;
  fromNoteEndTime: string | null;
  eventExpenseTotals: Record<string, number>;
}

export default async function ItineraryServerPage({ params, searchParams }: { params: { id: string }; searchParams: { event?: string; fromNote?: string; title?: string; description?: string; link?: string; date?: string; startTime?: string; endTime?: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) redirect("/dashboard");

  const isHost = trip.owner_id === user.id;

  // Fetch itinerary events ordered by date, time slot, then sort_order
  const { data: events } = await supabase
    .from("itinerary_events")
    .select("*")
    .eq("trip_id", id)
    .order("date")
    .order("sort_order");

  // Fetch all event participants for this trip's events
  const eventIds = (events ?? []).map((e) => e.id);
  let participants: EventParticipant[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("event_participants")
      .select("*")
      .in("event_id", eventIds);
    participants = (data ?? []) as EventParticipant[];
  }

  // Fetch trip members (accepted only for participant counts)
  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .order("created_at");

  // Fetch expense totals per event
  const { data: expensesRaw } = await supabase
    .from("trip_expenses")
    .select("event_id, total_amount")
    .eq("trip_id", id)
    .not("event_id", "is", null);

  const eventExpenseTotals: Record<string, number> = {};
  (expensesRaw ?? []).forEach((e: { event_id: string | null; total_amount: number }) => {
    if (e.event_id) {
      eventExpenseTotals[e.event_id] = (eventExpenseTotals[e.event_id] || 0) + Number(e.total_amount);
    }
  });

  return (
    <ItineraryPage
      trip={trip as Trip}
      events={(events ?? []) as ItineraryEvent[]}
      participants={participants}
      members={(members ?? []) as TripMember[]}
      userId={user.id}
      isHost={isHost}
      openEventId={searchParams?.event || null}
      fromNote={searchParams?.fromNote || null}
      fromNoteTitle={searchParams?.title || null}
      fromNoteDescription={searchParams?.description || null}
      fromNoteLink={searchParams?.link || null}
      fromNoteDate={searchParams?.date || null}
      fromNoteStartTime={searchParams?.startTime || null}
      fromNoteEndTime={searchParams?.endTime || null}
      eventExpenseTotals={eventExpenseTotals}
    />
  );
}
