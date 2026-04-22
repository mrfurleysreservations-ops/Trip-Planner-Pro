import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventParticipant } from "@/types/database.types";
import { getTripData } from "@/lib/trip-data";
import ItineraryPage from "./itinerary-page";

export interface ItineraryPageProps {
  openEventId: string | null;
  fromNote: string | null;
  fromNoteTitle: string | null;
  fromNoteDescription: string | null;
  fromNoteLink: string | null;
  fromNoteDate: string | null;
  fromNoteStartTime: string | null;
  fromNoteEndTime: string | null;
  participants: EventParticipant[];
  eventExpenseTotals: Record<string, number>;
}

export default async function ItineraryServerPage({ params, searchParams }: { params: { id: string }; searchParams: { event?: string; fromNote?: string; title?: string; description?: string; link?: string; date?: string; startTime?: string; endTime?: string } }) {
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  // We also need `events` here to derive event_ids for the participants
  // query, which is itinerary-specific.
  const { events } = await getTripData(id);

  const supabase = createServerSupabaseClient();

  // Itinerary-specific fetches. event_participants depends on event ids from
  // getTripData; expense totals only need trip_id, so the two run in parallel.
  const eventIds = events.map((e) => e.id);
  const [participantsRes, expensesRes] = await Promise.all([
    eventIds.length > 0
      ? supabase.from("event_participants").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] as EventParticipant[] }),
    supabase
      .from("trip_expenses")
      .select("event_id, total_amount")
      .eq("trip_id", id)
      .not("event_id", "is", null),
  ]);

  const participants = (participantsRes.data ?? []) as EventParticipant[];

  const eventExpenseTotals: Record<string, number> = {};
  (expensesRes.data ?? []).forEach((e: { event_id: string | null; total_amount: number }) => {
    if (e.event_id) {
      eventExpenseTotals[e.event_id] = (eventExpenseTotals[e.event_id] || 0) + Number(e.total_amount);
    }
  });

  return (
    <ItineraryPage
      participants={participants}
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
