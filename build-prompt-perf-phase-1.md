# Build: Performance Phase 1 — Instant Tab Feedback

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Context — why this phase exists

Users report that every tab switch inside a trip "takes a long time" and feels like the click didn't register. A full performance audit identified five structural problems; this is the first of five phases that address them. The order matters — later phases (shared trip layout, TanStack Query, waterfall cleanup, middleware trim) depend on this one being in place.

**This phase does NOT make the app faster.** It makes it *feel* fast by giving users instant visual feedback while the server still does its slow work. Two changes only:

1. Add a trip-level `loading.tsx` Suspense skeleton so clicking a sub-tab paints immediately.
2. Convert `router.push()` in `trip-sub-nav.tsx` to `<Link prefetch>` so Next.js starts fetching the next tab before the user taps it.

Do NOT attempt query parallelization, shared layouts, caching, or any other perf work in this phase. Those are Phases 2–5 and each needs its own chat session per the build-guide convention.

---

## Step 1 — Add the shared trip skeleton

Create a single file at `app/trip/[id]/loading.tsx`. Next.js will automatically wrap `page.tsx` and **every nested sub-tab** (`/itinerary`, `/expenses`, `/chat`, `/packing`, `/notes`, `/supplies`, `/group`) in a React Suspense boundary backed by this component. One file covers all seven tabs plus the hub.

Requirements:
- Server component (no `"use client"`).
- Matches the visual shape of a trip sub-page so the swap feels like content loading, not a totally different screen.
- Trip-type-agnostic — it cannot read the trip row, so use neutral grays. Do NOT try to pull theme accent here.
- Uses inline styles and `.card-glass` for consistency with existing components.
- Includes a gentle pulse animation via a scoped `<style>` tag (no new global CSS).
- Reserves space at the bottom for the sub-nav (56px) so the skeleton doesn't jump when the real page mounts.

Create `app/trip/[id]/loading.tsx` with:

```tsx
export default function TripLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        paddingBottom: 56,
      }}
    >
      {/* Sticky top row placeholder — matches tab-layout-standard Row 1 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #e5e5e5",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Shimmer w={40} h={40} r={20} />
        <Shimmer w={140} h={20} r={6} />
        <div style={{ flex: 1 }} />
        <Shimmer w={80} h={28} r={14} />
      </div>

      {/* Body — 3 generic card placeholders */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card-glass"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <Shimmer w="60%" h={16} r={6} />
            <Shimmer w="40%" h={12} r={6} />
            <Shimmer w="90%" h={12} r={6} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tp-shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
      `}</style>
    </div>
  );
}

function Shimmer({
  w,
  h,
  r = 4,
}: {
  w: number | string;
  h: number;
  r?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background:
          "linear-gradient(90deg, #e8e8e8 0px, #f2f2f2 40px, #e8e8e8 80px)",
        backgroundSize: "200px 100%",
        animation: "tp-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
```

Do NOT create per-tab loading.tsx files. One file at `app/trip/[id]/loading.tsx` is sufficient — Next.js resolves the nearest ancestor Suspense boundary automatically and adding seven duplicates violates the "no duplication" rule in CLAUDE.md.

---

## Step 2 — Convert `trip-sub-nav.tsx` to `<Link prefetch>`

File: `app/trip/[id]/trip-sub-nav.tsx`

Currently the primary tab buttons (line ~189) and the More-sheet tiles (line ~323) both use `router.push()`. That gives Next.js zero opportunity to prefetch the target route. Replace them with `<Link>` so Next.js can start fetching as soon as the nav is visible on screen.

**Primary tab buttons (around lines 186–200):** Replace the `<button onClick={() => router.push(...)}>...</button>` wrapper with `<Link href={...} prefetch>` carrying the same styling. Keep everything inside the tag identical — the icon span, badge, label, and style helpers. Preserve the `active` prop wiring driven by `activeSegment`. `<Link>` accepts `style`, so no visual regression should result.

**More-sheet tiles (around lines 319–354):** Same conversion, but the existing `onClick` also calls `setMoreOpen(false)`. `<Link>` accepts an `onClick` prop that fires on click — move the `setMoreOpen(false)` call into it. Navigation still happens via the `href`.

**The `⋯ More` button itself stays a `<button>`** — it opens a sheet, it doesn't navigate.

**Other cleanup:**
- Add `import Link from "next/link";` at the top.
- `useRouter` is only used for `router.push` in these two spots. After conversion, check whether any other `router.*` usage remains in the file. If not, remove the `useRouter` import and the `const router = useRouter()` line. If you're unsure, grep the file first — don't just delete.
- Prefetch behavior: `<Link prefetch>` (or omitted — it defaults to `true` in production) is what we want. Do not set `prefetch={false}`.

**Do NOT refactor anything else in this file.** The role-density logic, badge helpers, and More sheet structure stay exactly as they are. This is a mechanical conversion, not a rewrite.

---

## Step 3 — Verify no other `router.push` tab jumps

The sub-nav is the hot path, but if other components navigate between trip sub-tabs using `router.push`, they have the same prefetch problem. Grep the project for `router.push(\`/trip/` and for each hit:

- If the navigation is a **tab-like jump** (user clicks, goes to a route they can see from here), convert it to `<Link prefetch>` the same way.
- If the navigation is a **post-action redirect** (e.g. after saving a form, after deleting something, inside a `useEffect`), leave it as `router.push`. Those are imperative flows, not user-initiated navigation, and `<Link>` doesn't fit.

Keep this pass **conservative**. If there's any doubt about whether a call site is tab-like or post-action, leave it alone. We'll revisit in Phase 3 when TanStack Query lands.

---

## Step 4 — Manual smoke test

Run locally (`npm run dev`) and walk through:

- [ ] Open any trip. Click each sub-tab (Itinerary, Expenses, Chat, Packing, Notes, Supplies, Group). The skeleton should appear immediately on every click — no more blank-screen-then-content pop-in.
- [ ] The skeleton's sticky top row stays in place and doesn't "jump" visually when the real page takes over.
- [ ] The sub-nav bar stays docked at the bottom throughout the transition (it's rendered by the target page, so there may be a brief moment where the skeleton shows without it — acceptable in v1).
- [ ] Hovering a tab on desktop should prefetch — open the Network tab in DevTools, hover a tab, and you should see a background fetch for the target route before you click. (On mobile this still kicks in on viewport visibility — no way to test without a device.)
- [ ] The More sheet still closes when you tap a tile inside it.
- [ ] No console errors or React warnings about `<Link>` children.

---

## Acceptance checklist

- [ ] `app/trip/[id]/loading.tsx` exists and renders a shimmering skeleton with 3 card placeholders.
- [ ] Skeleton appears within ~50ms of tapping any sub-tab — no blank screen.
- [ ] `app/trip/[id]/trip-sub-nav.tsx` uses `<Link prefetch>` for all 7 primary tabs.
- [ ] More-sheet tiles use `<Link>` with an onClick that closes the sheet.
- [ ] `router.push` is gone from tab-nav code paths; `useRouter` import removed if unused.
- [ ] Active-tab styling (border-top accent, bold label, color) still works exactly as before.
- [ ] Chat unread badges (count + muted dot) still render on both primary and More paths.
- [ ] Visual regression check at 360px viewport — bottom nav labels don't wrap; More sheet grid still 3 columns.
- [ ] No new files outside the two above. No new components, hooks, or lib helpers.

---

## What this phase does NOT do (reminder)

- Does NOT consolidate per-tab Supabase fetches into a shared layout. (Phase 2)
- Does NOT add TanStack Query or any client-side cache. (Phase 3)
- Does NOT parallelize waterfall queries in Packing/Expenses/Itinerary. (Phase 4)
- Does NOT touch `middleware.ts`. (Phase 5)

If you find yourself tempted, stop. Ship Phase 1 and move to a new chat for the next one.

---

## Reference
- Tab layout standard: `docs/tab-layout-standard.md` (referenced to keep the skeleton's sticky-top shape correct).
- Relevant memory rules in MEMORY.md: push-to-main (solo hobby project, skip PR), commit-locally (sandbox can't push), always provide copy-paste content.

Push straight to main when the acceptance checklist is green. This is Joe's solo hobby project — no PR required.
