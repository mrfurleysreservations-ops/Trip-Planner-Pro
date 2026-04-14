import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripNote, TripMember } from "@/types/database.types";
import NotesPage from "./notes-page";

export interface NotesPageProps {
  trip: Trip;
  notes: TripNote[];
  members: TripMember[];
  userId: string;
  isHost: boolean;
  openNoteId: string | null;
}

export default async function NotesServerPage({ params, searchParams }: { params: { id: string }; searchParams: { note?: string } }) {
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

  // Fetch trip notes ordered by sort_order then newest first
  const { data: notes } = await supabase
    .from("trip_notes")
    .select("*")
    .eq("trip_id", id)
    .order("sort_order")
    .order("created_at", { ascending: false });

  // Fetch trip members (for displaying who created each note)
  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .order("created_at");

  return (
    <NotesPage
      trip={trip as Trip}
      notes={(notes ?? []) as TripNote[]}
      members={(members ?? []) as TripMember[]}
      userId={user.id}
      isHost={isHost}
      openNoteId={searchParams?.note || null}
    />
  );
}
