# Prompt: Expenses Tab — Replace Logistics Page

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Goal

Replace the Logistics page (`/trip/[id]/logistics`) with a new **Expenses** page (`/trip/[id]/expenses`). This is a Splitwise-style expense tracking system where trip members can log who paid for what and split costs across families or individuals. Expenses can optionally link to itinerary events.

**Important context:** The sub-nav tab was already renamed from "Logistics" to "Expenses" (💰) in the Trip Hub Redesign prompt. The bookings data (hotels, flights, etc.) was moved to the Trip Hub. This prompt builds the entirely new expenses system.

---

## Step 1 — Database Setup

Run this SQL in the Supabase SQL Editor to create the expenses tables:

```sql
-- ══════════════════════════════════════════════
-- Trip Expenses System
-- ══════════════════════════════════════════════

-- Expense categories
-- activity | dining | transport | groceries | hotel | other

-- Split types
-- family: each family/single counts as one equal share
-- per_person: divided by total headcount (families pay more)
-- custom: manual amounts per party

-- ─── Main expenses table ───
CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  event_id UUID,
  expense_date DATE,
  notes TEXT,
  split_type TEXT NOT NULL DEFAULT 'family',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Who paid (supports multiple payers per expense) ───
CREATE TABLE IF NOT EXISTS expense_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
  trip_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── How the expense is split across families/individuals ───
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  family_label TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 1,
  amount_owed NUMERIC(10,2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_event_id ON trip_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_expense_payers_expense_id ON expense_payers(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_family_id ON expense_splits(family_id);

-- ─── RLS Policies ───
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Trip expenses: anyone in the trip can view, creators/hosts can modify
CREATE POLICY "Trip members can view expenses"
  ON trip_expenses FOR SELECT
  USING (
    trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Trip members can insert expenses"
  ON trip_expenses FOR INSERT
  WITH CHECK (
    trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Expense creator or host can update"
  ON trip_expenses FOR UPDATE
  USING (
    created_by = auth.uid()
    OR trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid() AND role = 'host')
  );

CREATE POLICY "Expense creator or host can delete"
  ON trip_expenses FOR DELETE
  USING (
    created_by = auth.uid()
    OR trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid() AND role = 'host')
  );

-- Payers: same as parent expense
CREATE POLICY "View payers" ON expense_payers FOR SELECT
  USING (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
CREATE POLICY "Insert payers" ON expense_payers FOR INSERT
  WITH CHECK (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
CREATE POLICY "Delete payers" ON expense_payers FOR DELETE
  USING (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));

-- Splits: same as parent expense
CREATE POLICY "View splits" ON expense_splits FOR SELECT
  USING (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
CREATE POLICY "Insert splits" ON expense_splits FOR INSERT
  WITH CHECK (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
CREATE POLICY "Update splits" ON expense_splits FOR UPDATE
  USING (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
CREATE POLICY "Delete splits" ON expense_splits FOR DELETE
  USING (expense_id IN (SELECT id FROM trip_expenses WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())));
```

---

## Step 2 — Update TypeScript Types

In `types/database.types.ts`, add the three new tables (`trip_expenses`, `expense_payers`, `expense_splits`) in the Tables section following the existing pattern (Row + Insert types). Add type aliases at the bottom:

```typescript
export type TripExpense = Database["public"]["Tables"]["trip_expenses"]["Row"];
export type TripExpenseInsert = Database["public"]["Tables"]["trip_expenses"]["Insert"];
export type ExpensePayer = Database["public"]["Tables"]["expense_payers"]["Row"];
export type ExpensePayerInsert = Database["public"]["Tables"]["expense_payers"]["Insert"];
export type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
export type ExpenseSplitInsert = Database["public"]["Tables"]["expense_splits"]["Insert"];
```

---

## Step 3 — Add Constants

In `lib/constants.ts`, add:

```typescript
export const EXPENSE_CATEGORIES = [
  { value: "activity", label: "Activity", icon: "🎯" },
  { value: "dining", label: "Dining", icon: "🍽️" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "groceries", label: "Groceries", icon: "🛒" },
  { value: "hotel", label: "Lodging", icon: "🏨" },
  { value: "other", label: "Other", icon: "💳" },
] as const;

export const SPLIT_TYPES = [
  { value: "family", label: "Split by Family/Person", description: "Each family or single counts as one equal share" },
  { value: "per_person", label: "Split Per Head", description: "Divided by total headcount — families pay more" },
  { value: "custom", label: "Custom Amounts", description: "Set each party's share manually" },
] as const;
```

---

## Step 4 — Build the Family Grouping Logic

This is the core concept: trip members are grouped into **families** (households) or treated as **singles** for expense splitting.

A "family" in this context = all `trip_members` that share the same `family_id` through their `family_member_id` link to the `family_members` table. Members without a `family_member_id` (external invites) are treated as singles.

In the expenses server component, you need to:
1. Fetch all `trip_members` for the trip
2. For members that have a `family_member_id`, look up which `family_id` they belong to via the `family_members` table
3. Group them: members with the same `family_id` = one family unit; members without = individual units
4. Pass this grouped structure to the client as `familyGroups`:

```typescript
type FamilyGroup = {
  familyId: string;          // family_members.family_id or trip_members.id for singles
  label: string;             // "Furley Family" or "Mike" for singles
  members: TripMember[];     // the trip members in this group
  isSingle: boolean;         // true if just one non-family member
};
```

To get the label for families, use the name of the trip member who is the `host` or the first member alphabetically + " Family". For singles, use their name directly.

---

## Step 5 — Create the Expenses Page

### 5a — Server Component: `app/trip/[id]/expenses/page.tsx`

Fetch:
- `trip` (for theme, dates)
- `trip_members` with joined `family_members` data for grouping
- `trip_expenses` with nested `expense_payers` and `expense_splits`
- `itinerary_events` (for the "Link to event" dropdown and for event badges)

Build the `familyGroups` array described above. Pass everything to the client.

### 5b — Client Component: `app/trip/[id]/expenses/expenses-page.tsx`

This is the main page. It has **two views** toggled by a pill switcher:

#### VIEW 1: Expenses List

**Top banner:** Trip total with gradient accent background. Shows total amount, expense count, number of parties, number of people.

**Category filter pills:** All, Activity, Dining, Transport, Groceries, Lodging, Other. Only show categories that have expenses. Each shows count.

**Expense cards:** Each card shows:
- Left: category icon + title + date + "Paid by [name]"
- Right: amount + split type label
- If linked to an event: show "📅 [event name]" below the title in accent color
- **Tappable to expand** — expanded view shows the split breakdown:
  - Each family/single row with: colored avatar circle (first letter), label, member count, amount owed
  - Status badge per row: **PAID** (accent bg, white text) if this is the payer's family, **SETTLED** (green) if `is_settled`, **OWES** (yellow) otherwise
  - A "Mark Settled" button on each OWES row that sets `is_settled = true` on that split

**Edit/Delete:** Expense creator or trip host can edit or delete. Delete requires confirmation. Same pattern as notes.

#### VIEW 2: Summary

**Per-family summary cards:** For each family group, show:
- Colored avatar + family label + member names
- "Paid [total]" as subtitle
- Net balance on the right: green with "+" prefix if owed money, red if they owe
- Small label: "is owed" / "owes" / "settled"

**Settle Up section:** Calculate minimum transfers needed to zero out all balances. Use the standard debt simplification algorithm:
1. Compute net balance per family (total paid − total owed)
2. Sort debtors and creditors
3. Greedily match debtor→creditor transfers until all balanced

Display each transfer as: `[Debtor avatar] [Debtor name] → [Creditor avatar] [Creditor name] = $amount` with a "Venmo" button (disabled/placeholder for now — will be wired up later).

**Category breakdown:** Bar chart showing spending by category. Each row: icon + label + amount, with a horizontal progress bar showing percentage of total (bar uses `th.accent` color).

---

## Step 6 — Add Expense Flow (3-step form)

When the user clicks "+ Add Expense", show a bottom-sheet modal (same animation pattern as notes detail modal: `fadeIn` + `slideUp`).

### Step 1: What & How Much
- **Title** input (required)
- **Amount** input with $ prefix (required, number)
- **Category** pill selector
- **Date** input
- **Link to event** dropdown (optional) — populated from itinerary events. When an event is selected: auto-fill the title if blank, auto-select the families/people who are participants of that event
- **Notes** input (optional)
- "Next: Who Paid?" button

### Step 2: Who Paid?
- Show all trip members as tappable pills
- Tap one = they paid the full amount (show confirmation text: "[Name] paid the full $X")
- Tap multiple = show amount input per payer so they can split (e.g., Bob paid $200 deposit, Jamie paid $160 balance)
- Validation: total of payer amounts must equal the expense total
- "Next: Split Between" button

### Step 3: Split Between
- **Split type toggle:** "Split by Family/Person" vs "Split Per Head" vs "Custom"
- **Family/person chips:** Tappable cards for each family group. Show avatar, label, member names, member count. Pre-selected if an event was linked (use event participants).
  - `family` split: total ÷ number of selected groups
  - `per_person` split: total ÷ total headcount across selected groups (families pay proportionally more)
  - `custom`: show amount input per group
- **Live split preview** showing what each party owes
- "Save Expense" button

### Save Logic
1. Insert into `trip_expenses` → get back the `id`
2. Insert into `expense_payers` (one row per payer with their amount)
3. Insert into `expense_splits` (one row per family group with their `amount_owed`)
4. Log activity: `entityType: "expense"`, `entityName: title`, `action: "added"`
5. Close modal, refresh expenses list

---

## Step 7 — Itinerary Integration (Expense Entry Point on Events)

In the itinerary page (`app/trip/[id]/itinerary/itinerary-page.tsx`), add an expense indicator to each event card:

- **If the event has expenses:** Show a green badge `💰 $[total]` with the total of all expenses linked to that event. Tapping it navigates to the expenses page filtered to that event.
- **If the event has no expenses:** Show a subtle `💰 Add` button. Tapping it navigates to: `/trip/[id]/expenses?fromEvent=[eventId]&title=[eventTitle]&date=[eventDate]`

In the expenses page, handle the `fromEvent` query parameter:
1. Server component: read `searchParams.fromEvent`, pass to client
2. Client component: if `fromEvent` is set, auto-open the Add Expense modal with the event pre-linked, title pre-filled, and participants pre-selected

This follows the exact same deep-link pattern used for notes→itinerary conversion (`fromNote` param).

---

## Step 8 — Verification

1. Run the SQL in Supabase SQL Editor — verify all tables created without errors
2. Add an expense from the expenses page — verify it saves to DB and displays correctly
3. Add an expense with multiple payers — verify amounts are tracked per payer
4. Test "Split by Family" vs "Split Per Head" — verify the math is correct
5. Mark a split as settled — verify the badge updates
6. Check the Summary view — verify net balances add up to zero across all families
7. Check Settle Up — verify minimum transfers are calculated correctly
8. Navigate from itinerary event "💰 Add" button — verify the expense form opens pre-filled
9. Delete an expense — verify cascade deletes payers and splits
10. Run `npx tsc --noEmit` — verify no TypeScript errors
11. Verify the sub-nav "Expenses" tab navigates to the new page

---

## Files You Will Create

- `app/trip/[id]/expenses/page.tsx` — server component
- `app/trip/[id]/expenses/expenses-page.tsx` — client component

## Files You Will Modify

- `types/database.types.ts` — add TripExpense, ExpensePayer, ExpenseSplit types
- `lib/constants.ts` — add EXPENSE_CATEGORIES, SPLIT_TYPES
- `app/trip/[id]/itinerary/itinerary-page.tsx` — add expense badges/buttons to event cards

## Files to Reference (read but don't modify)

- `app/trip/[id]/notes/notes-page.tsx` — modal pattern, edit/delete UX, activity logging
- `app/trip/[id]/itinerary/itinerary-page.tsx` — fromNote deep-link pattern (reuse for fromEvent)
- `app/trip/[id]/group/group-page.tsx` — how family_member_id links to family_members for grouping logic
- `app/trip/[id]/logistics/logistics-page.tsx` — reference only, this file gets replaced

## What to Do with the Old Logistics Page

**Delete** `app/trip/[id]/logistics/` entirely (both `page.tsx` and `logistics-page.tsx`). The bookings CRUD was moved to the Trip Hub. The expenses page at `app/trip/[id]/expenses/` replaces it in the nav.
