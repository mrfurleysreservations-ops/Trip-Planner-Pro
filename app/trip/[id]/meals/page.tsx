import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip } from "@/types/database.types";
import MealsPage from "./meals-page";

export default async function MealsServerPage({ params }: { params: { id: string } }) {
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

  // Viewer's role_preference drives sub-nav ordering. Cheap lookup —
  // single-row fetch on a unique (trip_id, user_id) combo.
  const { data: memberRow } = await supabase
    .from("trip_members")
    .select("role_preference")
    .eq("trip_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const currentUserRole = memberRow?.role_preference ?? null;

  return <MealsPage trip={trip as Trip} currentUserRole={currentUserRole} />;
}
