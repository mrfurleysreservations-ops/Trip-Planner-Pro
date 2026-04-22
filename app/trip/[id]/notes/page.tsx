import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TripNote } from "@/types/database.types";
import { getTripData } from "@/lib/trip-data";
import NotesPage from "./notes-page";

export interface NotesPageProps {
  notes: TripNote[];
  openNoteId: string | null;
}

export default async function NotesServerPage({ params, searchParams }: { params: { id: string }; searchParams: { note?: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  await getTripData(id);

  // Fetch trip notes ordered by sort_order then newest first
  const { data: notes } = await supabase
    .from("trip_notes")
    .select("*")
    .eq("trip_id", id)
    .order("sort_order")
    .order("created_at", { ascending: false });

  return (
    <NotesPage
      notes={(notes ?? []) as TripNote[]}
      openNoteId={searchParams?.note || null}
    />
  );
}
