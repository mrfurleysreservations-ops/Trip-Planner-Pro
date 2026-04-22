# Build: Performance Phase 2 — Shared Trip Layout

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Context — why this phase exists

Phase 1 shipped instant loading feedback. The app *feels* responsive now. Phase 2 is the first phase that actually **makes it faster**, and it's the biggest single win in the plan.

**The problem:** Every sub-tab under `/trip/[id]/*` currently fetches the same trip, trip_members, and itinerary_events rows from Supabase. A user clicking between Itinerary → Expenses → Packing → Notes re-queries the same ~30 rows of stable trip data up to 4× in a minute. Compounded across the 7 sub-tabs plus the hub, that's the dominant source of per-tab latency.

**The fix:** One shared server-side data loader, one shared layout that hydrates a client context, and every sub-tab stops fetching trip/members/events on its own. Fetched once per navigation cycle, not once per tab.

**Non-goals for this phase** (leave for later):
- Client-side caching across navigations (Phase 3 — TanStack Query).
- Parallelizing the per-tab specific queries (Phase 4).
- Middleware auth-check trim (Phase 5).

If a change is tempting and isn't in this prompt, stop and leave it for the phase it belongs to.

---

## Architecture — the pattern in one paragraph

A new `lib/trip-data.ts` exports `getTripData(tripId)` wrapped in React's `cache()` so it dedupes within a single server request. A new `app/trip/[id]/layout.tsx` (server) calls `getTripData`, then wraps `{children}` in a `<TripDataProvider>` (client component). Every sub-tab's `page.tsx` stops fetching trip/members/events and stops passing them as props. Every sub-tab's `*-page.tsx` reads them from `useTripData()` instead of from props. When a sub-tab server page genuinely needs events/members server-side for a dependent query (e.g. `participants where event_id in [...]`), it calls `getTripData(tripId)` too — React's `cache()` deduplicates with the layout's call within the same request, so Supabase is still hit only once.

That's the whole idea. The rest is mechanical application across 8 routes.

---

## Step 1 — Create the shared loader

Create `lib/trip-data.ts`:

```ts
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Trip,
  TripMember,
  ItineraryEvent,
} from "@/types/database.types";

export interface TripData {
  trip: Trip;
  members: TripMember[];
  events: ItineraryEvent[];
  userId: string;
  isHost: boolean;
}

/**
 * Request-scoped loader for the shared trip context: the trip row, its
 * accepted/pending members, and its itinerary events. Parallelized via
 * Promise.all and deduped across the layout + nested pages via React's
 * `cache()` helper — within a single server request, only one Supabase
 * round-trip per table happens regardless of how many callers invoke this.
 *
 * Callers that only need events or only need members should still go
 * through this — the dedupe makes it free, and it keeps the "one source
 * of truth for trip context" invariant.
 */
export const getTripData = cache(async (tripId: string): Promise<TripData> => {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [tripRes, membersRes, eventsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at"),
    supabase
      .from("itinerary_events")
      .select("*")
      .eq("trip_id", tripId)
      .order("date")
      .order("sort_order"),
  ]);

  const trip = tripRes.data;
  if (!trip) redirect("/dashboard");

  return {
    trip: trip as Trip,
    members: (membersRes.data ?? []) as TripMember[],
    events: (eventsRes.data ?? []) as ItineraryEvent[],
    userId: user.id,
    isHost: trip.owner_id === user.id,
  };
});
```

Notes on this file:
- `cache()` from React is **not** the same as `unstable_cache` from Next.js. It's request-scoped (free, no revalidation config) and is the correct tool here. Do not substitute `unstable_cache`.
- The three queries run via `Promise.all` — fixes the waterfall for shared data in one move.
- Auth and trip-existence redirects happen here so call sites don't have to repeat them. If a sub-tab page doesn't want the auto-redirect on missing trip, it shouldn't call `getTripData` — but every current sub-tab DOES redirect on missing trip, so this is fine.
- Do NOT expand this to fetch bookings, expenses, packing, or anything tab-specific. That pollutes the shared loader and defeats the point.

---

## Step 2 — Create the client context provider

Create `app/trip/[id]/trip-data-context.tsx`:

```tsx
"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { TripData } from "@/lib/trip-data";

const TripDataContext = createContext<TripData | null>(null);

export function TripDataProvider({
  value,
  children,
}: {
  value: TripData;
  children: ReactNode;
}) {
  return (
    <TripDataContext.Provider value={value}>
      {children}
    </TripDataContext.Provider>
  );
}

/**
 * Hook for client components under `/app/trip/[id]/*` to read the shared
 * trip data (trip row, members, events, userId, isHost) that the layout
 * fetched server-side. Throws if used outside the provider — that means a
 * component is being rendered outside the trip segment and should be
 * getting its data some other way.
 */
export function useTripData(): TripData {
  const ctx = useContext(TripDataContext);
  if (!ctx) {
    throw new Error(
      "useTripData must be used inside <TripDataProvider> — are you " +
        "rendering a trip component outside of /app/trip/[id]/*?",
    );
  }
  return ctx;
}
```

This is one of the few legitimate abstractions in the project (per CLAUDE.md's "no unnecessary abstraction" rule) because it's used by 7+ consumers and gives them all one source of truth. Keep it tight — no extra helpers, no selectors, no memoization until there's a demonstrated need.

---

## Step 3 — Create the shared layout

Create `app/trip/[id]/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { getTripData } from "@/lib/trip-data";
import { TripDataProvider } from "./trip-data-context";

export default async function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  const tripData = await getTripData(params.id);

  return (
    <TripDataProvider value={tripData}>
      {children}
    </TripDataProvider>
  );
}
```

That's it. No HTML chrome, no wrapping divs — the existing `page.tsx` files already render the full page shell (sticky top, body, sub-nav). The layout is a pure data-hydration boundary. Phase 1's `loading.tsx` already lives in this same folder and keeps working unchanged — it wraps this layout's children in a Suspense boundary.

---

## Step 4 — Update the hub page (server + client)

Files: `app/trip/[id]/page.tsx` and its client companion (`trip-page.tsx`).

This page currently fetches 10+ things. Keep all the tab-specific ones (bookings, messages, expense totals, payers, splits, family members, packing summary, etc.) — they're not shared.

**Server half (`page.tsx`):**
1. Replace the three separate fetches for `trips`, `trip_members`, and `itinerary_events` with a single `const { trip, members, events, userId, isHost } = await getTripData(params.id);` call at the top. React's `cache()` ensures this dedupes with the layout's call — same request, one set of queries.
2. Remove the redundant `auth.getUser()` call at the top of this page — `getTripData` already does it and redirects on missing user.
3. Remove the `if (!trip) redirect("/dashboard")` — `getTripData` already does it.
4. Keep the second `Promise.all` batch (payers, splits, family members, packing) exactly as-is — it's correctly parallelized.
5. **Stop passing** `trip`, `members`, `events`, `userId`, `isHost` to the client half as props. The client half will read them from context, same as every other sub-tab — consistency matters more than inertia here.

**Client half (`trip-page.tsx` or equivalent):**
1. Remove `trip`, `members`, `events`, `userId`, `isHost` from the props interface and the function-signature destructure.
2. Add `const { trip, members, events, userId, isHost } = useTripData();` near the top of the component body.
3. Import: `import { useTripData } from "./trip-data-context";`
4. Leave the rest untouched — the hub's tab-specific state, effects, and mutation handlers stay exactly as-is.

---

## Step 5 — Update each sub-tab server page

Apply the same pattern to every file below. For each one:

- **Delete** the `auth.getUser()` call and the `if (!user) redirect("/auth/login")` line.
- **Delete** the `trips.select("*").eq("id", ...)` query and the `if (!trip) redirect("/dashboard")` line.
- **Delete** the `trip_members.select("*").eq("trip_id", ...)` query.
- **Delete** the `itinerary_events.select("*").eq("trip_id", ...)` query.
- **Add** at the top: `const { trip, members, events, userId, isHost } = await getTripData(params.id);`
- Keep any **dependent** queries that use `events` or `members` data (e.g. `event_participants where event_id in [...]`) — they now read from the `events`/`members` returned by `getTripData`. Wrap them in `Promise.all` where independent.
- **Stop passing** `trip`, `members`, `events`, `userId`, `isHost` as props to the client `*-page.tsx` half — they'll read from context instead (Step 6). Remove those fields from the client component's props interface.
- **Still pass** anything tab-specific (the tab's own fetched data, the searchParams-derived values).

Files to update in this pass:
- `app/trip/[id]/itinerary/page.tsx`
- `app/trip/[id]/expenses/page.tsx`
- `app/trip/[id]/chat/page.tsx`
- `app/trip/[id]/packing/page.tsx`
- `app/trip/[id]/notes/page.tsx`
- `app/trip/[id]/supplies/page.tsx`
- `app/trip/[id]/group/page.tsx`

Packing is the heaviest offender (18 sequential queries) — for this phase, do NOT attempt to parallelize its remaining tab-specific queries. That's Phase 4. Only remove the shared fetches here. Measuring the delta between phases matters; don't confound the signal.

---

## Step 6 — Update each sub-tab client page

For each `*-page.tsx` whose server parent was changed in Step 5:

- **Remove** `trip`, `members`, `events`, `userId`, `isHost` from the component's props interface.
- **Remove** them from the function-signature destructure.
- **Add** `const { trip, members, events, userId, isHost } = useTripData();` near the top of the component body, after the `"use client";` line and the `useState`/`useEffect` imports.
- Import: `import { useTripData } from "../trip-data-context";` (adjust the relative path for chat, packing, etc. — they're one level deeper).
- Leave every other piece of state and every other `useEffect + supabase` call alone — tab-specific client fetches stay as-is in this phase.
- Search the file for any inline `supabase.from("trips") | .from("trip_members") | .from("itinerary_events")` queries in `useEffect`s or event handlers. If you find any that were fetching the shared data again client-side, delete them and use the context data instead. If you find ones fetching them because of a *mutation* (e.g. inviting a new member re-fetches the list) — leave those. Phase 3 will replace them with TanStack Query mutations.

Files to update:
- `app/trip/[id]/itinerary/itinerary-page.tsx`
- `app/trip/[id]/expenses/expenses-page.tsx`
- `app/trip/[id]/chat/chat-page.tsx`
- `app/trip/[id]/packing/packing-page.tsx`
- `app/trip/[id]/notes/notes-page.tsx`
- `app/trip/[id]/supplies/supplies-page.tsx`
- `app/trip/[id]/group/group-page.tsx`

---

## Step 7 — What about mutations refreshing stale context?

The context is hydrated from a server render and does not auto-update when the user mutates data (e.g. editing a trip name, inviting a member, adding an event). For Phase 2, the correct escape hatch is `router.refresh()` — call it after the mutation succeeds and Next.js will re-run the layout, re-call `getTripData`, and re-hydrate the provider with fresh data. Client state in sibling components survives.

If any existing sub-tab already calls `router.refresh()` after mutating trip/members/events, leave it — it now works correctly with the context. If a sub-tab instead does manual state patching (`setMembers([...members, newMember])` inside a client handler), leave that as-is for this phase — don't rewire mutation flows. Phase 3's TanStack Query migration is the right time to unify that.

Do NOT add new `router.refresh()` calls speculatively. Only touch what Steps 4–6 require.

---

## Acceptance checklist

- [ ] `lib/trip-data.ts` exists and exports `getTripData` wrapped in `cache()` with `Promise.all` for the three queries.
- [ ] `app/trip/[id]/trip-data-context.tsx` exports `TripDataProvider` and `useTripData`; hook throws outside the provider.
- [ ] `app/trip/[id]/layout.tsx` is a server component that calls `getTripData` and wraps children in the provider — no HTML chrome.
- [ ] Hub page and all 7 sub-tab server pages have had their `trips`/`trip_members`/`itinerary_events` fetches removed and replaced with `getTripData(params.id)`.
- [ ] Hub and all 7 sub-tab client pages read `trip`, `members`, `events`, `userId`, `isHost` from `useTripData()`, not from props.
- [ ] The corresponding `*-page.tsx` props interfaces no longer list those five fields (hub's `trip-page.tsx` included).
- [ ] Opening any sub-tab and inspecting the Network tab in DevTools shows **one** fetch each for `trips`, `trip_members`, `itinerary_events` per navigation — not two or three.
- [ ] Clicking between sub-tabs on the same trip does NOT re-issue those three queries (layout stays cached; only the target page's tab-specific queries fire).
- [ ] Phase 1's `loading.tsx` skeleton still shows on tab navigation — no regression.
- [ ] No `useTripData must be used inside <TripDataProvider>` errors in the console.
- [ ] Existing behaviors all still work: inviting members, adding events, opting into events, deleting messages, etc. Spot-check two or three mutation flows per tab.
- [ ] Visual regression check at 360px viewport — no layout shifts from removing the explicit data-fetch-in-page pattern.
- [ ] TypeScript compiles clean (`npm run build` or `tsc --noEmit`).

---

## What NOT to do

- Do NOT add TanStack Query, SWR, or any client-cache library. That's Phase 3.
- Do NOT parallelize tab-specific queries (e.g. Packing's 15+ per-page queries). Phase 4.
- Do NOT touch `middleware.ts`. Phase 5.
- Do NOT collapse the three `getTripData` queries into a Postgres view or RPC. The dedupe + Promise.all is already the right level of abstraction.
- Do NOT expand `getTripData` to fetch bookings, expenses, packing, or other tab-specific data — that re-creates the exact problem this phase exists to solve.

---

## Reference
- Tab layout standard: `docs/tab-layout-standard.md` (unchanged by this phase; layout.tsx has no chrome).
- Phase 1 prompt for context: `build-prompt-perf-phase-1.md`.
- Relevant memory rules in MEMORY.md: push-to-main (solo hobby project, skip PR), commit-locally (sandbox can't push), always provide copy-paste content, role-density-no-feature-loss (the layout must not cause any tab to disappear or change role behavior).

Push straight to main when the acceptance checklist is green. This is Joe's solo hobby project — no PR required.
