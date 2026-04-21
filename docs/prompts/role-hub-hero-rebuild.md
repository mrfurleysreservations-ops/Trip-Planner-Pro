# Role Hub Hero Rebuild (Phase 1) — Build Prompt

The role picker, sub-nav reorder, and role-specific default tabs all shipped, but the trip hub hero is still a generic gradient banner. **No expenses, packing, or chat summaries** land on the hub for any role, and Just Here users get redirected away before they ever see the hub. This prompt fixes that using only data and features that already exist today.

Anything speculative (meal claims, pending-RSVP aggregation, nudge-pending, @mentions parsing) is punted to Phase 2 so this ships in one clean pass.

Reference:
- Current vs target mockup: `mockups/role-hub-current-vs-target.html`
- Existing role hero: `app/trip/[id]/role-hero.tsx`
- Existing hub page: `app/trip/[id]/page.tsx` + `app/trip/[id]/trip-page.tsx`
- Expense balance math (source of truth): `app/trip/[id]/expenses/expenses-page.tsx` lines 50–120

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Goal

Make the trip hub hero render real summary data per role. Specifically:

1. **Stop redirecting Just Here users away from the hub.** They should stay on `/trip/[id]` and see a big "You owe $X · Pay with Venmo" card as the hero.
2. **Fetch real summary data server-side** in `app/trip/[id]/page.tsx` (expenses balance, packing progress, chat unread count, latest chat message, next 3 upcoming events) and pass it down as a single `heroData` prop.
3. **Rewrite each role's hero** in `role-hero.tsx` to render that data per the mockup.

Scope is deliberately narrow. Do NOT introduce nudge buttons, meal claims, RSVP aggregation, or @mention parsing — those require new features/columns and are Phase 2.

## Why

Joe expected expense data to show on the hub for Just Here users — that was the whole point of the mockup. Today the server redirects them to `/expenses` before they see the hub, and no role's hero fetches expense/packing/chat data. The hero is informational filler; it should be the dashboard.

## What to build

### 1. Remove the Just Here redirect

In `app/trip/[id]/page.tsx`, the block at lines ~68–73 redirects any role whose `defaultTab !== "itinerary"` to that tab. Today the only such role is `just_here`, so this is effectively "always redirect Just Here to /expenses."

Replace it with:

```ts
if (!needsSetup && currentMember) {
  const defaultTab = defaultTabForRole(currentUserRole);
  // Just Here now stays on the hub — the hero shows the expense summary
  // they came for. Other non-itinerary roles still redirect (future-proofing).
  if (defaultTab && defaultTab !== "itinerary" && currentUserRole !== "just_here") {
    redirect(`/trip/${id}/${defaultTab}`);
  }
}
```

### 2. Extract a shared balance helper

Create `lib/expense-balance.ts`. Move the family-balance math from `expenses-page.tsx` lines 50–120 into it, with two exports:

```ts
import type { TripMember, FamilyMember } from "@/types/database.types";
import type { ExpenseWithRelations } from "@/app/trip/[id]/expenses/page";
import type { FamilyGroup } from "@/app/trip/[id]/expenses/page";

/**
 * Net balance per family group across all expenses.
 * Positive = they're owed money, negative = they owe.
 */
export function computeFamilyBalances(
  expenses: ExpenseWithRelations[],
  familyGroups: FamilyGroup[],
  members: TripMember[],
): Map<string, number> { /* existing algorithm, unchanged */ }

/**
 * For a specific viewer, return their family group's net balance + the single
 * top counterparty (the family they owe the most to, or who owes them the most).
 * Counterparty name is best-effort — falls back to null if no clear winner.
 */
export function computeViewerBalance(
  expenses: ExpenseWithRelations[],
  familyGroups: FamilyGroup[],
  members: TripMember[],
  viewerMemberId: string,
): {
  net: number;
  counterpartyName: string | null;
  /** Top 3 expense titles contributing to what they owe (for the Just Here card subtitle). */
  topOwedExpenseTitles: string[];
  /** Grand total unsettled across the whole trip — for the All In hero. */
  tripUnsettledTotal: number;
}
```

Refactor `expenses-page.tsx` to call `computeFamilyBalances` — its behavior must not change.

### 3. Fetch summary data in `app/trip/[id]/page.tsx`

Extend the existing `Promise.all` block. Add (in parallel):

- **Expenses with relations** — `trip_expenses`, `expense_payers`, `expense_splits` (match the pattern in `app/trip/[id]/expenses/page.tsx` lines 129–160). Also fetch `family_members` for members that have a `family_member_id`, then build `familyGroups` using the same algorithm as the expenses page. Duplicate the family-group build helper or (preferable) extract it into `lib/family-groups.ts` and import it in both places.
- **Latest chat message** — top 1 from `trip_messages` for this trip, ordered by `created_at desc`. Resolve `author_user_id` to a name via `trip_members` (already loaded).
- **Chat unread count** — reuse `useTripChatUnread` logic server-side. If that helper is client-only, create `lib/chat-unread.ts` with a pure server function that takes `tripId`, `userId`, `chat_notification_level` and returns `{ count, level }`. The existing client hook should then import and call it too.
- **Packing progress for the viewer** — `packing_items` where `trip_member_id = currentMember.id` and `trip_id = id`. Count `total` and `packed` (where `is_packed = true`).

Build a `RoleHeroData` object:

```ts
export interface RoleHeroData {
  // Expenses
  viewerNet: number;                       // negative = owes, positive = owed, 0 = settled
  counterpartyName: string | null;
  topOwedExpenseTitles: string[];          // up to 3, for Just Here amount-card subtitle
  tripUnsettledTotal: number;              // sum of |net| across all non-zero families
  // Chat
  unreadChatCount: number;
  chatLevel: "all" | "mentions" | "muted";
  latestMessage: { authorName: string; body: string; createdAt: string } | null;
  // Packing
  packingTotal: number;
  packingPacked: number;
}
```

Pass it into `TripPage` as a new prop. Also extend the existing `eventsRes` query to return the full upcoming list (already ordered) — `TripPage` currently only gets `nextEvent` + `upcomingEventCount`; also pass `upcomingEvents: ItineraryEvent[]` (first 3 upcoming) for the All In "Quick scan."

### 4. Rewrite `role-hero.tsx`

Keep the `heroSurface`, `heroLabelStyle`, `heroTitleStyle`, `heroMetaStyle`, `heroBtnStyle` helpers — they're correct.

Add two new helpers below them:

```tsx
function AmountCard({
  label, amount, note, ctaLabel, settled, accent,
}: {
  label: string;
  amount: string;              // pre-formatted "$165.00"
  note?: string;
  ctaLabel?: string;           // e.g. "Pay with Venmo" — tapping is a no-op placeholder for now
  settled?: boolean;           // green variant when true
  accent: string;
}): JSX.Element { /* 2px border, big number, optional button. Styling per mockup. */ }

function MiniSection({
  icon, title, rightMeta, body, dim,
}: {
  icon: string; title: string; rightMeta?: string; body: React.ReactNode; dim?: boolean;
}): JSX.Element { /* #fafafa card matching the .mini-section in mockup */ }
```

Then replace each variant component:

**`RoleHeroAllIn`** — informational dashboard, no speculative buttons:

```
🔥 You're running the show
{upcomingEventCount} events · ${tripUnsettledTotal.toFixed(0)} unsettled · {unreadChatCount} new messages
Packing {packingPct}% complete
[Settle up →]   [Open Itinerary →]

📅 Quick scan                    next {upcomingEvents.length}
  {event1.title}  ·  {weekday short-date time}
  {event2.title}  ·  ...
  {event3.title}  ·  ...

💬 Latest                        {relative time}
  {authorName}: "{body truncated to 120 chars}"
```

The "Quick scan" MiniSection is hidden if `upcomingEvents.length === 0`. The "Latest" MiniSection is hidden if `latestMessage === null`. Both buttons route to real pages (`/expenses`, `/itinerary`). Do NOT add a "Nudge pending" button — that's Phase 2.

**`RoleHeroHelpingOut`** — soft, informational, no fabricated task lists:

```
🙌 Ready to lend a hand
Dip in wherever — notes, packing, meals.
Your packing: {packed}/{total} items     (if total > 0)
[Browse Notes →]   [Open Packing →]

💬 Latest                        {relative time}
  {authorName}: "{body}"

💰 You owe                       ${abs(viewerNet)}     (only if viewerNet < 0)
  Tap Expenses to settle
```

Hide the "You owe" strip if `viewerNet >= -0.01` (settled or being owed). Do NOT list specific unclaimed meals or tasks — we don't have those today.

**`RoleHeroJustHere`** — amount-card first, then context:

```
[AmountCard]
  Label: "You owe {counterpartyName || 'the group'}"
  Amount: "${abs(viewerNet).toFixed(2)}"
  Note: {topOwedExpenseTitles.slice(0,3).join(" · ")}   (only if array non-empty)
  CTA: "Pay with Venmo"

If viewerNet >= 0:
  [AmountCard settled]
    Label: "You're all settled"
    Amount: "✓"                  (small checkmark, green border)
    No CTA button.

💬 Latest message                {relative time}  (plain — no @mention filtering yet)
  {authorName}: "{body}"

📅 Where to be                   today
  {nextEvent.title} · {formatEventWhen(nextEvent)}
  {nextEvent.location && "📍 " + nextEvent.location}

🧳 Packing list                  opt-in      (dim)
  Want a personalized list? Set it up →        → links to /profile
```

Hide "Where to be" if `nextEvent === null`. Hide "Latest message" if `latestMessage === null`. The Venmo CTA is a placeholder `<button>` that does nothing; comment this clearly — real Venmo deep-link is future work.

**`RoleHeroVibesOnly`** — keep the next-event gradient hero (correct today), then ADD:

```
[next-event gradient hero — unchanged]

[AmountCard]                     (hidden if viewerNet >= 0)
  Label: "You owe"
  Amount: "${abs(viewerNet).toFixed(0)}"       (no cents for Vibes — minimalism)
  CTA: "Pay with Venmo"
```

### 5. Collapsible Travel & Lodging for Vibes Only

In `trip-page.tsx`, the Travel & Lodging section (line ~807) always renders expanded. For `currentUserRole === "vibes_only"`, render it collapsed by default — a single row "🧳 Travel & Lodging · tap to expand", clickable to expand the full list. All other roles keep the current behavior.

Do NOT hide it. Tap-to-expand is fine. Every tab stays reachable (memory `role_density_no_feature_loss.md`).

### 6. Update `TripPageProps`

```ts
export interface TripPageProps {
  // ...existing fields...
  heroData: RoleHeroData;
  upcomingEvents: ItineraryEvent[];  // first 3 upcoming, for All In Quick scan
}
```

Remove `upcomingEventCount` from both `TripPageProps` and `RoleHero` props — derive from `upcomingEvents.length` inside the components.

## Edge cases

- **Trip with zero expenses** — `viewerNet = 0`, `counterpartyName = null`, `topOwedExpenseTitles = []`. All In hero shows "$0 unsettled." Just Here shows the settled-green variant. Helping Out + Vibes Only hide the owe strip/amount card.
- **Trip with no packing items for the viewer** — show `{packed}/{total}` as `0/0` and the copy "not started yet" instead of a division-by-zero percentage.
- **Trip with no chat messages** — `latestMessage = null`. All hero sections that reference it hide entirely (don't render an empty box).
- **Singles (member not in a family group)** — `computeViewerBalance` uses `trip_member_id` as the family-group key for singles, matching `expenses-page.tsx` lines 88–101. Don't special-case; reuse that logic.
- **Pre-role trips** — any `trip_members` row with `role_preference = null` falls through to the `helping_out` default via `getRoleConfig`. Their hero is Helping Out.

## Files to modify

1. `app/trip/[id]/page.tsx` — remove Just Here redirect, add summary fetches, build `heroData` + `upcomingEvents`
2. `app/trip/[id]/trip-page.tsx` — accept new props, thread to RoleHero, collapsible lodging for Vibes
3. `app/trip/[id]/role-hero.tsx` — rewrite 4 variants with real data per above
4. `lib/expense-balance.ts` — NEW, shared balance math
5. `lib/family-groups.ts` — NEW, shared family-group builder (extract from expenses-page.tsx)
6. `lib/chat-unread.ts` — NEW if `useTripChatUnread` is client-only; otherwise skip
7. `app/trip/[id]/expenses/expenses-page.tsx` — refactor to call the new helpers (no behavior change)

## Files NOT to modify

- `lib/role-density.ts`, `lib/constants.ts` `ROLE_PREFERENCES` — correct
- `app/trip/[id]/trip-sub-nav.tsx` — correct
- Any migration file — no schema changes
- Meals / group / RSVP pages — Phase 2

## Styling

Inline styles only. Glass cards use `th.card` / `th.cardBorder`. Accents from `th.accent` / `th.accent2`. DM Sans body, Outfit titles. Amount-card border 2px solid `th.accent`. Settled variant border + number color `#2e7d32`. Follow `docs/tab-layout-standard.md`: sticky top + scrolling body.

## When finished

Sandbox can't push. Give me the exact shell commands:

```bash
git add app/trip/[id]/page.tsx \
        app/trip/[id]/trip-page.tsx \
        app/trip/[id]/role-hero.tsx \
        app/trip/[id]/expenses/expenses-page.tsx \
        lib/expense-balance.ts \
        lib/family-groups.ts \
        lib/chat-unread.ts
git commit -m "Role hub heros: real expense/packing/chat summaries per role"
git push origin main
```

Push straight to main.
