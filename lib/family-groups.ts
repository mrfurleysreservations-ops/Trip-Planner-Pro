// Family-group builder — shared between the expenses page (which computes
// splits and settle-up) and the trip hub hero (which surfaces the viewer's
// balance inline). Centralizing here so both call sites bucket members the
// same way; if the hub grouped singles differently than /expenses, the
// hero's "what you owe" would disagree with the detail view.
//
// Algorithm:
//   - Members with a `family_member_id` that resolves to a family in
//     `family_members` get bucketed by `family_members.family_id`.
//   - Members whose `family_member_id` is null, or whose linked row is
//     missing, become their own single-person group keyed by the
//     trip_member id (matches expenses-page.tsx line ~122 convention).

import type { TripMember, FamilyMember } from "@/types/database.types";

export interface FamilyGroup {
  familyId: string;
  label: string;
  members: TripMember[];
  isSingle: boolean;
}

export function buildFamilyGroups(
  members: TripMember[],
  familyMembers: FamilyMember[],
): FamilyGroup[] {
  const familyMemberMap = new Map<string, FamilyMember>();
  familyMembers.forEach((fm) => familyMemberMap.set(fm.id, fm));

  const familyGroupMap = new Map<string, TripMember[]>();
  const singles: TripMember[] = [];

  for (const m of members) {
    if (m.family_member_id) {
      const fm = familyMemberMap.get(m.family_member_id);
      if (fm) {
        const key = fm.family_id;
        if (!familyGroupMap.has(key)) familyGroupMap.set(key, []);
        familyGroupMap.get(key)!.push(m);
      } else {
        // family_member_id points at a row we couldn't fetch (stale link or
        // RLS blocked) — treat as a single rather than dropping the member.
        singles.push(m);
      }
    } else {
      singles.push(m);
    }
  }

  const groups: FamilyGroup[] = [];

  // Multi-member family groups. Label prefers host's last name, falling back
  // to alphabetical first member — mirrors expenses-page.tsx labeling so the
  // hub and the detail page never show two different names for the same family.
  for (const [familyId, fMembers] of familyGroupMap) {
    const hostMember = fMembers.find((m) => m.role === "host");
    const labelMember = hostMember || fMembers.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
    const lastName = labelMember.name.split(" ").pop() || labelMember.name;
    groups.push({
      familyId,
      label: `${lastName} Family`,
      members: fMembers,
      isSingle: false,
    });
  }

  // Singles — keyed by trip_member id so they can still appear in
  // expense_splits (which uses the familyId as the split key).
  for (const m of singles) {
    groups.push({
      familyId: m.id,
      label: m.name,
      members: [m],
      isSingle: true,
    });
  }

  return groups;
}
