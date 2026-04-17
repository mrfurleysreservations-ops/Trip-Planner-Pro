You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Task: Replace Trip Sub-Nav with Sticky Bottom Tab Bar & Hide Dashboard TabBar Inside Trips

We're changing how navigation works inside trip detail pages. Currently the trip sub-nav (`trip-sub-nav.tsx`) is an inline horizontal scrollable bar rendered below the trip header. The problem: users don't realize they can scroll sideways to find more tabs. We're replacing it with a fixed bottom tab bar — the same compact style as the dashboard's `tab-bar.tsx` — pinned to the bottom of the screen like the wizard nav in `onboarding-page.tsx`.

Additionally, the dashboard-level `TabBar` (Trips, Packing, Gear, Friends, Profile, Alerts) should be **hidden** when the user is inside a trip. You're in a trip — stay in the trip.

---

### What to change

#### 1. Modify `app/trip/[id]/trip-sub-nav.tsx`

Replace the entire component with a **fixed bottom tab bar**. Here's exactly what it should look like:

**Container `<nav>` styles:**
```
position: fixed
bottom: 0
left: 0
right: 0
maxWidth: "480px"
margin: "0 auto"
zIndex: 100
display: flex
justifyContent: "space-around"
alignItems: center
height: "56px"
background: "rgba(255,255,255,0.97)"
backdropFilter: "blur(20px)"
WebkitBackdropFilter: "blur(20px)"
borderTop: "1px solid #e5e5e5"
padding: "0 4px"
```

**Each tab button styles:**
```
flex: 1
display: flex
flexDirection: "column"
alignItems: center
justifyContent: center
gap: "2px"
height: "100%"
background: "none"
border: "none"
borderTop: `3px solid ${active ? theme.accent : "transparent"}`
cursor: "pointer"
padding: 0
minWidth: 0
transition: "all 0.2s ease"
```

**Icon:** `fontSize: "18px"`, `lineHeight: 1`

**Label:** `fontSize: "10px"`, `fontWeight: active ? 700 : 500`, `color: active ? theme.accent : "#999"`, `fontFamily: "'DM Sans', sans-serif"`, `whiteSpace: "nowrap"`

Keep the same 6 tabs (Itinerary, Expenses, Packing, Notes, Meals, Group) with the same icons, segments, and router.push navigation logic. Keep the `getActiveSegment()` function and `ThemeConfig` prop — those don't change.

#### 2. Modify `app/trip/[id]/trip-page.tsx`

- **Remove the first `<TripSubNav>` call** (around line ~736) — the one inside the conditional setup/detail area.
- **Keep only ONE `<TripSubNav>`** rendered at the very **end** of the component's return, outside of any content wrappers, as the last element before the closing fragment/div. Since it's `position: fixed`, placement in the JSX tree doesn't affect visual position, but putting it last is cleanest.
- **Add `paddingBottom: "80px"`** to the main content container(s) so content doesn't get hidden behind the fixed bottom nav. The content areas that wrap the tab content (the `<div style={{ padding: "16px", maxWidth: "600px", ... }}>` wrappers) need this bottom padding.

#### 3. Modify `app/components/app-shell.tsx`

Hide both the **TabBar** and the **title bar** ("🧭 Trip Planner Pro" + sign out button) when the user is inside a trip page.

- Import `usePathname` (already imported).
- Add a check: `const insideTrip = pathname.startsWith("/trip/");`
- Wrap the title bar `<div>` and `<TabBar>` in a condition: only render them when `!insideTrip`.
- The trip pages have their own back button and header — the dashboard chrome should disappear entirely.

#### 4. No changes needed to:
- `globals.css` — no new CSS classes needed, everything is inline styles
- `tab-bar.tsx` — the component itself stays the same, it's just conditionally hidden
- Any modal components — modals use `position: fixed` with higher z-index, they'll layer above the bottom nav automatically
- The onboarding/wizard flow — completely separate

---

### Key patterns to follow

- **Inline styles only** — this project uses inline React styles, not CSS modules or styled-components. Match the existing pattern exactly.
- **Theme-driven colors** — the trip sub-nav uses `theme.accent` for active states, not the hard-coded `#e8943a`. Keep it that way.
- **`"DM Sans"` for labels, `"Outfit"` for display headings** — match existing font usage.
- **Active indicator is a 3px border** — `borderTop` (not borderBottom, since it's at the bottom of the screen now).
- **`maxWidth: "480px"` with `margin: "0 auto"`** — matches the wizard bottom nav and keeps it centered on wider screens.

---

### Testing checklist

After implementing, verify:
1. Bottom tab bar is visible and fixed to the bottom on all trip sub-pages (`/trip/[id]/itinerary`, `/trip/[id]/expenses`, etc.)
2. All 6 tabs are visible without any horizontal scrolling
3. Active tab highlights correctly based on the URL segment
4. Tapping a tab navigates to the correct route
5. The dashboard TabBar and title bar are **not visible** when inside `/trip/[id]/*`
6. The dashboard TabBar and title bar **reappear** when navigating back to `/dashboard`, `/packing`, `/gear`, etc.
7. Content doesn't get hidden behind the bottom nav (padding-bottom is sufficient)
8. Modals (add note, add event, etc.) still appear above the bottom nav
9. The back button in the trip header still works to return to the dashboard
