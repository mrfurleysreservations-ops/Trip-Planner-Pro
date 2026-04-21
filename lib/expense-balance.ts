// Shared balance math for expenses.
//
// Two consumers:
//   1. /expenses summary view — wants the full per-family balance map so it
//      can render every family's net, then run settle-up on top.
//   2. /trip/[id] hero — wants the viewer's own family balance + a best-effort
//      "who do they owe the most" counterparty to headline the Just Here card.
//
// Keeping both code paths on the same algorithm guarantees the hub and the
// detail page never show different numbers for the same trip.

import type { TripMember } from "@/types/database.types";
import type { ExpenseWithRelations } from "@/app/trip/[id]/expenses/page";
import type { FamilyGroup } from "@/lib/family-groups";

/**
 * Net balance per family group across all expenses.
 *
 * Positive = the family is owed money (paid more than their share).
 * Negative = the family owes money (paid less than their share).
 * Values are rounded to cents at call sites — the raw map is not rounded so
 * downstream math (e.g. settle-up) can accumulate without compounding error.
 */
export function computeFamilyBalances(
  expenses: ExpenseWithRelations[],
  familyGroups: FamilyGroup[],
  _members: TripMember[],
): Map<string, number> {
  const balances = new Map<string, number>();
  familyGroups.forEach((fg) => balances.set(fg.familyId, 0));

  // Member → family lookup so we can attribute payer amounts correctly. An
  // expense's "payer" is a trip_member, but balances roll up to the family.
  const memberToFamily = new Map<string, string>();
  familyGroups.forEach((fg) => {
    fg.members.forEach((m) => memberToFamily.set(m.id, fg.familyId));
  });

  for (const exp of expenses) {
    for (const p of exp.payers) {
      const famId = memberToFamily.get(p.trip_member_id);
      if (famId !== undefined) {
        balances.set(famId, (balances.get(famId) || 0) + Number(p.amount_paid));
      }
    }
    for (const s of exp.splits) {
      if (balances.has(s.family_id)) {
        balances.set(s.family_id, (balances.get(s.family_id) || 0) - Number(s.amount_owed));
      }
    }
  }

  return balances;
}

export interface ViewerBalance {
  /** Net dollars: negative = owes, positive = owed, 0 = settled. Rounded to cents. */
  net: number;
  /**
   * Best-effort "top counterparty" label — the family on the other side of
   * the biggest outstanding imbalance relative to the viewer. Null if the
   * viewer is settled, or if the trip has no other non-zero families.
   */
  counterpartyName: string | null;
  /**
   * Titles of the top 3 expenses contributing to what the viewer owes. Used
   * as the Just Here amount-card subtitle ("Dinner · Uber · Concert tix").
   * Empty when the viewer is settled or owed.
   */
  topOwedExpenseTitles: string[];
  /**
   * Grand total unsettled across the whole trip, calculated as the sum of
   * positive balances (which equals the sum of |negative balances|).
   * Headlines the All In hero.
   */
  tripUnsettledTotal: number;
}

/**
 * For a specific viewer, return their family group's net balance + the single
 * top counterparty and the trip's grand unsettled total. Designed for the
 * role hero, which wants a one-glance snapshot rather than the full grid.
 */
export function computeViewerBalance(
  expenses: ExpenseWithRelations[],
  familyGroups: FamilyGroup[],
  members: TripMember[],
  viewerMemberId: string,
): ViewerBalance {
  const balances = computeFamilyBalances(expenses, familyGroups, members);

  // Find the viewer's family group. Multi-person families share a key;
  // singles use their trip_member id, which is also their viewerMemberId.
  const viewerFamily = familyGroups.find((fg) =>
    fg.members.some((m) => m.id === viewerMemberId),
  );
  const viewerFamilyId = viewerFamily?.familyId ?? viewerMemberId;
  const rawNet = balances.get(viewerFamilyId) ?? 0;
  const net = Math.round(rawNet * 100) / 100;

  // Grand unsettled — sum of positive balances across all families. The
  // system is zero-sum, so sum(positives) = sum(|negatives|). Either works.
  let tripUnsettledTotal = 0;
  for (const [, bal] of balances) {
    const rounded = Math.round(bal * 100) / 100;
    if (rounded > 0.01) tripUnsettledTotal += rounded;
  }
  tripUnsettledTotal = Math.round(tripUnsettledTotal * 100) / 100;

  // Counterparty: the family on the opposite side of the sign. If the viewer
  // owes money, pick the family with the largest positive balance (the
  // biggest creditor). If the viewer is owed, pick the largest debtor.
  let counterpartyName: string | null = null;
  if (net < -0.01) {
    let topCreditor: FamilyGroup | null = null;
    let topCreditorAmount = 0;
    for (const fg of familyGroups) {
      if (fg.familyId === viewerFamilyId) continue;
      const bal = Math.round((balances.get(fg.familyId) ?? 0) * 100) / 100;
      if (bal > topCreditorAmount) {
        topCreditorAmount = bal;
        topCreditor = fg;
      }
    }
    counterpartyName = topCreditor?.label ?? null;
  } else if (net > 0.01) {
    let topDebtor: FamilyGroup | null = null;
    let topDebtorAmount = 0;
    for (const fg of familyGroups) {
      if (fg.familyId === viewerFamilyId) continue;
      const bal = Math.round((balances.get(fg.familyId) ?? 0) * 100) / 100;
      if (bal < -topDebtorAmount) {
        topDebtorAmount = -bal;
        topDebtor = fg;
      }
    }
    counterpartyName = topDebtor?.label ?? null;
  }

  // Top 3 owed expenses — expenses the viewer's family is on the hook for
  // (split row exists) but has not settled. We rank by the viewer's owed
  // amount on each expense, largest first. Only populated when the viewer
  // is in the red; if they're owed or settled, the subtitle is empty.
  let topOwedExpenseTitles: string[] = [];
  if (net < -0.01) {
    const owed: { title: string; amount: number }[] = [];
    for (const exp of expenses) {
      for (const s of exp.splits) {
        if (s.family_id !== viewerFamilyId) continue;
        if (s.is_settled) continue;
        const amount = Number(s.amount_owed);
        if (amount > 0.01) owed.push({ title: exp.title, amount });
      }
    }
    owed.sort((a, b) => b.amount - a.amount);
    topOwedExpenseTitles = owed.slice(0, 3).map((o) => o.title);
  }

  return { net, counterpartyName, topOwedExpenseTitles, tripUnsettledTotal };
}
