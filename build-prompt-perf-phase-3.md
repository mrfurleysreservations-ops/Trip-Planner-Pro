# Build: Performance Phase 3 — Client-Side Cache with TanStack Query

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Context — why this phase exists

Phase 1 gave instant loading feedback. Phase 2 cut shared-data duplication server-side. Phase 3 makes **returning to a tab** feel instant.

**The problem today (post-Phase 2):** A user navigates Itinerary → Packing → back to Itinerary. Each tab's client component has `useEffect + supabase` calls that re-run on mount. The server-side shared context (Phase 2) is fine — it's the tab-specific client fetches that still round-trip. So "back to Itinerary" re-fetches the events-for-this-day, the expense totals, the reservation statuses, all over again, even though none of it has changed in the last 5 seconds.

**The fix:** TanStack Query (`@tanstack/react-query`). Every tab-specific client fetch becomes a `useQuery` with a scoped key. Mutations become `useMutation` with `invalidateQueries` instead of manual `setState` patching and `router.refresh()` calls. Cached data stays warm for 30 seconds across tab navigations, with background refetch when stale.

Architecturally decided up front so you don't have to:
- **QueryClientProvider lives at the app root** (`app/providers.tsx` mounted in `app/layout.tsx`). Scoping to the trip layout would work today but costs us nothing to do once, and the dashboard/friends/profile can adopt the same pattern later without another phase.
- **Server pages keep fetching tab-specific data and passing as props.** Client components consume that via `useQuery({ initialData: propsData, staleTime: 30_000 })`. No `HydrationBoundary` / `dehydrate` plumbing — the `initialData` path is simpler, gives us instant first paint, and is the right call for this stack.
- **The Phase 2 shared context stays as-is.** Do NOT migrate `useTripData()` to React Query. It's already optimal (single server fetch, hydrated via context) and moving it here adds complexity without speed gain.
- **Stale time default: 30 seconds. GC time default: 5 minutes. Refetch-on-window-focus: on (the React Query default).** Override per-query only when there's a reason.

**Non-goals for this phase** (leave for later):
- Parallelizing per-tab server queries (Phase 4).
- Middleware trim (Phase 5).
- Migrating modals that aren't directly reading/mutating the same query keys as their parent tab.

---

## Step 1 — Install TanStack Query

```bash
npm install @tanstack/react-query@^5
```

Pin to the major only — v5 has a stable API and Next.js 14 compatibility. Do not install `@tanstack/react-query-devtools` for this phase; we can add it in a later polish pass if needed.

Run `npm install` and commit the `package.json` + `package-lock.json` changes along with the code changes.

---

## Step 2 — Create the providers wrapper

Create `app/providers.tsx`:

```tsx
"use client";
import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

export default function Providers({ children }: { children: ReactNode }) {
  // useState lazy-init so the client is created exactly once per client
  // boot — avoids re-creating it on every React render and avoids the
  // "new client per request" footgun on the server side of hydration.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,         // 30s — data considered fresh
            gcTime: 5 * 60 * 1_000,    // 5 min — kept in memory even if unused
            refetchOnWindowFocus: true, // TanStack default, stated explicitly
            retry: 1,                   // one retry on transient failure
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
```

Mount it in `app/layout.tsx`:

```tsx
import Providers from "./providers";
// ...existing imports...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <html lang="en">
      <body>
        {googleMapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`}
            strategy="lazyOnload"
          />
        )}
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

Providers goes **outside** `AppShell` so the QueryClient is alive before any child component uses it.

---

## Step 3 — Create the query-key factory

Create `lib/query-keys.ts`:

```ts
/**
 * Centralized TanStack Query keys, scoped by trip. All keys follow the
 * pattern ["trip", tripId, <resource>, ...optional sub-keys] so
 * invalidating ["trip", tripId] nukes every query for that trip.
 *
 * Using a factory instead of inline literals gives us:
 *  - Typo-free invalidation (you can't misspell a function name)
 *  - Auto-complete across the codebase
 *  - One place to see every cached resource this app tracks
 *
 * Add new entries here when introducing a new query — do NOT inline
 * string tuples at call sites.
 */
export const tripKeys = {
  all: (tripId: string) => ["trip", tripId] as const,

  // Itinerary tab
  eventParticipants: (tripId: string) =>
    ["trip", tripId, "event-participants"] as const,
  eventExpenseTotals: (tripId: string) =>
    ["trip", tripId, "event-expense-totals"] as const,

  // Expenses tab
  expenses: (tripId: string) => ["trip", tripId, "expenses"] as const,
  expensePayers: (tripId: string) =>
    ["trip", tripId, "expense-payers"] as const,
  expenseSplits: (tripId: string) =>
    ["trip", tripId, "expense-splits"] as const,

  // Chat tab
  chatMessages: (tripId: string) =>
    ["trip", tripId, "chat-messages"] as const,
  chatReadState: (tripId: string) =>
    ["trip", tripId, "chat-read-state"] as const,

  // Packing tab
  packingItems: (tripId: string) =>
    ["trip", tripId, "packing-items"] as const,
  packingOutfits: (tripId: string) =>
    ["trip", tripId, "packing-outfits"] as const,
  packingOutfitGroups: (tripId: string) =>
    ["trip", tripId, "packing-outfit-groups"] as const,
  packingBagSections: (tripId: string) =>
    ["trip", tripId, "packing-bag-sections"] as const,
  packingContainers: (tripId: string) =>
    ["trip", tripId, "packing-containers"] as const,
  packingAssignments: (tripId: string) =>
    ["trip", tripId, "packing-assignments"] as const,
  gearLibrary: (tripId: string) =>
    ["trip", tripId, "gear-library"] as const,

  // Notes tab
  notes: (tripId: string) => ["trip", tripId, "notes"] as const,

  // Supplies tab
  supplies: (tripId: string) => ["trip", tripId, "supplies"] as const,

  // Group tab (beyond shared members context)
  bookings: (tripId: string) => ["trip", tripId, "bookings"] as const,
  invitations: (tripId: string) => ["trip", tripId, "invitations"] as const,
};
```

If you find a tab-specific query in the codebase whose resource isn't listed here, **add it to this file first**, then use the factory at the call site. Do not inline string tuples in tab components.

---

## Step 4 — The pattern: migrating a read query

For every tab-specific `useEffect + supabase` fetch in a `*-page.tsx` file, apply this transformation.

**Before** (representative pattern seen across tabs):

```tsx
const [items, setItems] = useState<PackingItem[]>(initialItems);
const supabase = createBrowserSupabaseClient();

useEffect(() => {
  async function load() {
    const { data } = await supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", tripId);
    setItems(data ?? []);
  }
  load();
}, [tripId]);
```

**After:**

```tsx
import { useQuery } from "@tanstack/react-query";
import { tripKeys } from "@/lib/query-keys";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// ...inside component...
const supabase = createBrowserSupabaseClient();

const { data: items = [] } = useQuery({
  queryKey: tripKeys.packingItems(tripId),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", tripId);
    if (error) throw error;
    return (data ?? []) as PackingItem[];
  },
  initialData: initialItems,
  staleTime: 30_000,
});
```

**Rules for the migration:**
- `initialData` MUST be whatever prop the server already passed in. That gives us instant first paint.
- Drop the `useState` + `setState` pair for this data. The returned `data` from `useQuery` IS the source of truth now.
- Drop the `useEffect` entirely — `useQuery` handles the mount fetch and the refetch.
- `queryFn` must `throw` on error (don't silently return empty) so React Query knows to surface the error. If the current code swallowed errors, preserve that behavior by catching in the queryFn and returning `[]` — but prefer throwing.
- If the old code had custom sort/filter logic AFTER the fetch, keep it — either in a `useMemo` derived from `data`, or by applying the sort inside `queryFn`. Inside the queryFn is cleaner when the sort is cheap.

**For `useState` that was being updated by BOTH the effect and by mutations:** remove the `useState` entirely. Mutations go through `useMutation` + `invalidateQueries` (Step 5) which will trigger a refetch and update `data`.

---

## Step 5 — The pattern: migrating a mutation

Replace every `await supabase.insert/update/delete` in an onClick/onSubmit with `useMutation`.

**Before:**

```tsx
async function toggleChecked(id: string) {
  await supabase
    .from("packing_items")
    .update({ checked: true })
    .eq("id", id);
  setItems((prev) =>
    prev.map((i) => (i.id === id ? { ...i, checked: true } : i)),
  );
}
```

**After:**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ...inside component...
const queryClient = useQueryClient();

const toggleMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from("packing_items")
      .update({ checked: true })
      .eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: tripKeys.packingItems(tripId),
    });
  },
});

// Call site:
<button onClick={() => toggleMutation.mutate(id)}>Check</button>
```

**Rules for the migration:**
- Use `mutate` (fire-and-forget) at call sites. Only use `mutateAsync` when the caller truly needs to await completion (e.g. an async save handler that closes a modal on success — then use `await toggleMutation.mutateAsync(...)` inside a try/catch).
- Invalidate every query key whose data might have changed. A `packing_items` update only affects `tripKeys.packingItems`. An `itinerary_events` update might also need to invalidate `eventParticipants` and `eventExpenseTotals` — think about the blast radius.
- If a mutation currently calls `router.refresh()` because it updates shared (trip/members/events) data, **keep the `router.refresh()`** — the shared context isn't in React Query and still needs the server layout to re-run. You can drop the refresh only if every affected piece of data is now in React Query.
- **Remove manual `setState` patching** after the mutation. `invalidateQueries` triggers a refetch which updates `data` via the React Query cache. Manual patching becomes stale-data bait.
- **Optimistic updates are out of scope for this phase.** They're a polish pass. Don't add `onMutate` logic unless the current code was already doing optimistic UI and we'd regress without it.

---

## Step 6 — Apply the pattern to every tab, in this order

Migrate one tab at a time. After each tab, smoke-test:
1. Open the tab, data renders from initialData (instant).
2. Navigate away and back within 30s — no network request, cached data shows.
3. Navigate away and back after 35s — cached data shows instantly, background refetch happens.
4. Mutate something — the UI updates after the mutation (via invalidation, not manual patching).
5. Open DevTools Network tab to verify: before, the same query fired on every tab-return; after, it fires at most every 30s.

Recommended order (lightest to heaviest — catches pattern mistakes early while the blast radius is small):

1. **Notes** (`app/trip/[id]/notes/notes-page.tsx`)
2. **Supplies** (`app/trip/[id]/supplies/supplies-page.tsx`)
3. **Itinerary** (`app/trip/[id]/itinerary/itinerary-page.tsx`)
4. **Group** (`app/trip/[id]/group/group-page.tsx`)
5. **Expenses** (`app/trip/[id]/expenses/expenses-page.tsx`)
6. **Chat** (`app/trip/[id]/chat/chat-page.tsx`) — see Chat-specific note below
7. **Packing** (`app/trip/[id]/packing/packing-page.tsx`) — biggest file, save for last

**Chat-specific note:** Chat has a Supabase realtime subscription on `trip_messages`. Keep the subscription. When a realtime event arrives (insert, update/soft-delete), call `queryClient.setQueryData(tripKeys.chatMessages(tripId), ...)` to patch the cache directly rather than invalidate — invalidation would round-trip and defeat the point of realtime. Set `staleTime: Infinity` on the chat messages query so background refetch doesn't fire (realtime is authoritative).

**Hub page client half:** `app/trip/[id]/trip-page.tsx` also has tab-specific fetches (recent messages, expense summary, packing summary for the overview cards). Migrate those the same way. The shared `useTripData()` call stays.

---

## Step 7 — Verify the Phase 2 context still works

After all tabs are migrated, mutations that change trip/members/events (e.g. renaming the trip, accepting an invite, adding an event) should still call `router.refresh()` so the Phase 2 context gets re-hydrated. Grep for any `router.refresh()` calls you may have accidentally removed — they're still load-bearing for shared context, even though they're no longer load-bearing for tab-specific data.

If a mutation modifies BOTH shared context data AND query-cached data, it should do both: `router.refresh()` for the shared context + `queryClient.invalidateQueries(...)` for the query cache. Don't rely on `router.refresh()` to refresh React Query data — the cache is client-only and Next.js refresh doesn't touch it.

---

## Acceptance checklist

- [ ] `@tanstack/react-query@^5` in `package.json`; `package-lock.json` updated.
- [ ] `app/providers.tsx` exports a client component that wraps children in `QueryClientProvider` with the stated defaults (staleTime 30s, gcTime 5min, retry 1).
- [ ] `app/layout.tsx` wraps `AppShell` in `<Providers>`.
- [ ] `lib/query-keys.ts` exports the `tripKeys` factory; every migrated query uses it — zero inline key literals in tab code.
- [ ] Every tab's `*-page.tsx` no longer has `useEffect + supabase` for data reads (except the Chat realtime subscription, which stays).
- [ ] Every tab's mutations use `useMutation` + `invalidateQueries`; manual `setState` patching after mutations is gone.
- [ ] `router.refresh()` is still called after mutations to trip/members/events so the Phase 2 context stays fresh.
- [ ] Chat's realtime handler uses `queryClient.setQueryData` to patch the cache, not invalidate.
- [ ] Opening a tab, leaving for 10s, returning — DevTools Network shows ZERO Supabase calls for that tab's data.
- [ ] Opening a tab, leaving for 60s, returning — DevTools Network shows ONE background refetch per query (stale-while-revalidate).
- [ ] Mutating an item reflects in the UI within one render cycle of the mutation resolving.
- [ ] TypeScript compiles clean (`npm run build` or `tsc --noEmit`). No `any` creeping into query generics.
- [ ] All existing behaviors still work. Spot-check one mutation flow per tab.
- [ ] Visual regression check at 360px viewport — no layout shifts from removing manual state.

---

## What NOT to do

- Do NOT add TanStack Query devtools in this phase.
- Do NOT add optimistic updates (`onMutate` + rollback). Polish pass.
- Do NOT migrate the shared `useTripData()` context to React Query. Leave Phase 2 alone.
- Do NOT use `HydrationBoundary` / `dehydrate` — `initialData` is the chosen pattern for this stack.
- Do NOT inline query-key string tuples at call sites. Everything goes through `tripKeys`.
- Do NOT parallelize per-tab server queries in this phase (that's Phase 4). Scope discipline.
- Do NOT migrate modals whose queries don't already share a key with a migrated tab query. Opportunistic cleanup only.
- Do NOT change `refetchOnWindowFocus` defaults. 30-second stale time already handles the over-fetching concern.

---

## Reference
- TanStack Query v5 docs: https://tanstack.com/query/v5/docs/framework/react/overview (useQuery, useMutation, initialData pattern).
- Phase 1 prompt: `build-prompt-perf-phase-1.md`.
- Phase 2 prompt: `build-prompt-perf-phase-2.md`.
- Relevant memory rules in MEMORY.md: push-to-main (solo hobby project, skip PR), commit-locally (sandbox can't push), always provide copy-paste content, role-density-no-feature-loss.

Push straight to main when the acceptance checklist is green. This is Joe's solo hobby project — no PR required.
