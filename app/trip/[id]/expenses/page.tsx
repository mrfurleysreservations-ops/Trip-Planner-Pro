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

  // ─── Tier 1 ────────────────────────────────────────────────────────
  // Expenses + payers/splits collapse into a single nested-select round-trip
  // (Supabase evaluates RLS per base table, so the same row-visibility rules
  // still apply). family_members runs in parallel — it only needs the ids
  // already present in `members` from getTripData.
  const [expensesRes, familyMembersRes] = await Promise.all([
    supabase
      .from("trip_expenses")
      .select("*, expense_payers(*), expense_splits(*)")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    familyMemberIds.length > 0
      ? supabase.from("family_members").select("*").in("id", familyMemberIds)
      : Promise.resolve({ data: [] as FamilyMember[] }),
  ]);

  // Fan the nested results back out into three flat arrays server-side so
  // the client's ExpensesPageProps shape (expenses: ExpenseWithRelations[])
  // remains unchanged — no client-side migration needed.
  const expensesRaw = (expensesRes.data ?? []) as (TripExpense & {
    expense_payers: ExpensePayer[] | null;
    expense_splits: ExpenseSplit[] | null;
  })[];

  const expensesWithRelations: ExpenseWithRelations[] = expensesRaw.map((e) => {
    const { expense_payers, expense_splits, ...rest } = e;
    return {
      ...(rest as TripExpense),
      payers: (expense_payers ?? []) as ExpensePayer[],
      splits: (expense_splits ?? []) as ExpenseSplit[],
    };
  });

  const familyMembersData = (familyMembersRes.data ?? []) as FamilyMember[];
  const familyGroups = buildFamilyGroups(members, familyMembersData);

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
