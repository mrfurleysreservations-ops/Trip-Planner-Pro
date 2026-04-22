import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TripExpense, ExpensePayer, ExpenseSplit, FamilyMember } from "@/types/database.types";
import { buildFamilyGroups, type FamilyGroup } from "@/lib/family-groups";
import { getTripData } from "@/lib/trip-data";
import ExpensesPage from "./expenses-page";

// Re-export so existing imports (`./page`) keep working — the type moved
// to lib/family-groups.ts because the trip-hub hero needs it too.
export type { FamilyGroup };

export interface ExpenseWithRelations extends TripExpense {
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
}

export interface ExpensesPageProps {
  expenses: ExpenseWithRelations[];
  familyGroups: FamilyGroup[];
  fromEvent: string | null;
  fromEventTitle: string | null;
  fromEventDate: string | null;
  fromSupply: string | null;
  fromSupplyTitle: string | null;
}

export default async function ExpensesServerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fromEvent?: string; fromSupply?: string; title?: string; date?: string };
}) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  // Shared trip context — deduped with the layout's call via React cache().
  const { members } = await getTripData(id);

  const familyMemberIds = members
    .map((m) => m.family_member_id)
    .filter(Boolean) as string[];

  // Expenses and family_members can run in parallel — both are trip-specific
  // and independent of each other. payers/splits still need the expense ids
  // so they land in a second parallel batch below.
  const [expensesRes, familyMembersRes] = await Promise.all([
    supabase
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    familyMemberIds.length > 0
      ? supabase.from("family_members").select("*").in("id", familyMemberIds)
      : Promise.resolve({ data: [] as FamilyMember[] }),
  ]);

  const allExpenses = (expensesRes.data ?? []) as TripExpense[];
  const familyMembersData = (familyMembersRes.data ?? []) as FamilyMember[];

  const familyGroups = buildFamilyGroups(members, familyMembersData);

  const expenseIds = allExpenses.map((e) => e.id);
  let allPayers: ExpensePayer[] = [];
  let allSplits: ExpenseSplit[] = [];

  if (expenseIds.length > 0) {
    const [payersRes, splitsRes] = await Promise.all([
      supabase.from("expense_payers").select("*").in("expense_id", expenseIds),
      supabase.from("expense_splits").select("*").in("expense_id", expenseIds),
    ]);
    allPayers = (payersRes.data ?? []) as ExpensePayer[];
    allSplits = (splitsRes.data ?? []) as ExpenseSplit[];
  }

  const expensesWithRelations: ExpenseWithRelations[] = allExpenses.map((e) => ({
    ...e,
    payers: allPayers.filter((p) => p.expense_id === e.id),
    splits: allSplits.filter((s) => s.expense_id === e.id),
  }));

  return (
    <ExpensesPage
      expenses={expensesWithRelations}
      familyGroups={familyGroups}
      fromEvent={searchParams?.fromEvent || null}
      fromEventTitle={searchParams?.fromEvent ? (searchParams?.title || null) : null}
      fromEventDate={searchParams?.date || null}
      fromSupply={searchParams?.fromSupply || null}
      fromSupplyTitle={searchParams?.fromSupply ? (searchParams?.title || null) : null}
    />
  );
}
