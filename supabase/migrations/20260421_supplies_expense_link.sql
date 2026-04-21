-- =============================================================
-- Trip Planner Pro — Supplies Phase 1.1 — Expense link
-- Adds trip_expenses.supply_id so a purchased supply can be logged
-- as a reimbursable expense (mirrors the existing event_id link).
-- Safe to re-run.
-- =============================================================

alter table public.trip_expenses
  add column if not exists supply_id uuid
    references public.supply_items(id) on delete set null;

create index if not exists idx_trip_expenses_supply
  on public.trip_expenses(supply_id)
  where supply_id is not null;
