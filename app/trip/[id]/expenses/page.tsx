import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, TripExpense, ExpensePayer, ExpenseSplit, ItineraryEvent, FamilyMember } from "@/types/database.types";
import ExpensesPage from "./expenses-page";

// ─── Family group type used by the expenses system ───
export interface FamilyGroup {
  familyId: string;
  label: string;
  members: TripMember[];
  isSingle: boolean;
}

export interface ExpenseWithRelations extends TripExpense {
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
}

export interface ExpensesPageProps {
  trip: Trip;
  members: TripMember[];
  expenses: ExpenseWithRelations[];
  events: ItineraryEvent[];
  familyGroups: FamilyGroup[];
  userId: string;
  isHost: boolean;
  fromEvent: string | null;
  fromEventTitle: string | null;
  fromEventDate: string | null;
}

export default async function ExpensesServerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fromEvent?: string; title?: string; date?: string };
}) {
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

  // Fetch trip members
  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", id)
    .order("created_at");

  const allMembers = (members ?? []) as TripMember[];

  // Fetch family_members for members that have a family_member_id
  const familyMemberIds = allMembers
    .map((m) => m.family_member_id)
    .filter(Boolean) as string[];

  let familyMembersData: FamilyMember[] = [];
  if (familyMemberIds.length > 0) {
    const { data } = await supabase
      .from("family_members")
      .select("*")
      .in("id", familyMemberIds);
    familyMembersData = (data ?? []) as FamilyMember[];
  }

  // Build family groups
  // Members with family_member_id → look up family_id from family_members table
  // Members sharing same family_id → one family group
  // Members without family_member_id → individual singles
  const familyMemberMap = new Map<string, FamilyMember>();
  familyMembersData.forEach((fm) => familyMemberMap.set(fm.id, fm));

  const familyGroupMap = new Map<string, TripMember[]>();
  const singles: TripMember[] = [];

  for (const m of allMembers) {
    if (m.family_member_id) {
      const fm = familyMemberMap.get(m.family_member_id);
      if (fm) {
        const key = fm.family_id;
        if (!familyGroupMap.has(key)) familyGroupMap.set(key, []);
        familyGroupMap.get(key)!.push(m);
      } else {
        singles.push(m);
      }
    } else {
      singles.push(m);
    }
  }

  const familyGroups: FamilyGroup[] = [];

  // Family groups
  for (const [familyId, fMembers] of familyGroupMap) {
    // Label: host member's name + " Family", or first alphabetically
    const hostMember = fMembers.find((m) => m.role === "host");
    const labelMember = hostMember || fMembers.sort((a, b) => a.name.localeCompare(b.name))[0];
    const lastName = labelMember.name.split(" ").pop() || labelMember.name;
    familyGroups.push({
      familyId,
      label: `${lastName} Family`,
      members: fMembers,
      isSingle: false,
    });
  }

  // Singles
  for (const m of singles) {
    familyGroups.push({
      familyId: m.id, // use trip_member id as familyId for singles
      label: m.name,
      members: [m],
      isSingle: true,
    });
  }

  // Fetch expenses with payers and splits
  const { data: expenses } = await supabase
    .from("trip_expenses")
    .select("*")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  const allExpenses = (expenses ?? []) as TripExpense[];

  const expenseIds = allExpenses.map((e) => e.id);
  let allPayers: ExpensePayer[] = [];
  let allSplits: ExpenseSplit[] = [];

  if (expenseIds.length > 0) {
    const { data: payers } = await supabase
      .from("expense_payers")
      .select("*")
      .in("expense_id", expenseIds);
    allPayers = (payers ?? []) as ExpensePayer[];

    const { data: splits } = await supabase
      .from("expense_splits")
      .select("*")
      .in("expense_id", expenseIds);
    allSplits = (splits ?? []) as ExpenseSplit[];
  }

  const expensesWithRelations: ExpenseWithRelations[] = allExpenses.map((e) => ({
    ...e,
    payers: allPayers.filter((p) => p.expense_id === e.id),
    splits: allSplits.filter((s) => s.expense_id === e.id),
  }));

  // Fetch itinerary events (for linking)
  const { data: events } = await supabase
    .from("itinerary_events")
    .select("*")
    .eq("trip_id", id)
    .order("date")
    .order("sort_order");

  return (
    <ExpensesPage
      trip={trip as Trip}
      members={allMembers}
      expenses={expensesWithRelations}
      events={(events ?? []) as ItineraryEvent[]}
      familyGroups={familyGroups}
      userId={user.id}
      isHost={isHost}
      fromEvent={searchParams?.fromEvent || null}
      fromEventTitle={searchParams?.title || null}
      fromEventDate={searchParams?.date || null}
    />
  );
}
