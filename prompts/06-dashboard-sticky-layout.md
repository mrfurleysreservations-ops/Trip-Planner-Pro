# Build Prompt — Dashboard sticky layout + top-level nav

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task

Refactor the Dashboard page to apply the sticky layout pattern used on all trip tabs. Introduce a new shared top-level nav component (Trips · Chats · Friends · Gear · Profile · Alerts) that mirrors the visual language of `TripSubNav` but sits at the TOP of the page. Move the "+ New Trip" inline button to a bottom-right FAB. Wire notification bubbles on the Chats and Friends nav icons.

This is primarily a **UI-shell refactor plus one new shared component**. All existing dashboard behavior — trip card rendering, upcoming/past grouping and sorting, onboarding reminder, first-time family prompt, empty state, `createTrip` handler, `deleteTrip` handler — stays exactly as it is today.

## Files in scope

1. **Create NEW:** `app/top-nav.tsx` — shared top-level nav component. Mirrors `app/trip/[id]/trip-sub-nav.tsx` structurally.
2. **Modify:** `app/dashboard/page.tsx` (server component) — add notification-count queries, pass as props.
3. **Modify:** `app/dashboard/dashboard.tsx` (client component) — apply sticky layout, add `<TopNav />`, move "+ New Trip" to FAB.

Do NOT touch any other tabs, constants, types, or the existing `trip-sub-nav.tsx`. Do NOT apply `<TopNav />` to `/chats`, `/friends`, `/gear`, `/profile`, or `/alerts` yet — that comes in follow-up prompts.

## 1. Create `app/top-nav.tsx`

Build the shared component. Mirror the structural shape of `app/trip/[id]/trip-sub-nav.tsx` (read that file first so the pattern matches):

```tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";

const TOP_NAV_TABS = [
  { key: "trips",   label: "Trips",   icon: "🧳", path: "/dashboard" },
  { key: "chats",   label: "Chats",   icon: "💬", path: "/chats"    },
  { key: "friends", label: "Friends", icon: "👥", path: "/friends"  },
  { key: "gear",    label: "Gear",    icon: "🎒", path: "/gear"     },
  { key: "profile", label: "Profile", icon: "👤", path: "/profile"  },
  { key: "alerts",  label: "Alerts",  icon: "🔔", path: "/alerts"   },
];

function getActiveKey(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "trips";
  if (pathname.startsWith("/chats"))   return "chats";
  if (pathname.startsWith("/friends")) return "friends";
  if (pathname.startsWith("/gear"))    return "gear";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/alerts"))  return "alerts";
  return "";
}

interface TopNavProps {
  /** Count of unread chat messages across all trips the user belongs to. 0 = no bubble. */
  unreadChatCount?: number;
  /** Count of pending friend requests targeting the current user. 0 = no bubble. */
  pendingFriendCount?: number;
  /** Optional future: unread alerts. 0 = no bubble. */
  unreadAlertCount?: number;
}

export default function TopNav({
  unreadChatCount = 0,
  pendingFriendCount = 0,
  unreadAlertCount = 0,
}: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = getActiveKey(pathname);
  const th = THEMES.home; // dashboard-level pages use home theme

  const badgeFor = (key: string): number => {
    if (key === "chats")   return unreadChatCount;
    if (key === "friends") return pendingFriendCount;
    if (key === "alerts")  return unreadAlertCount;
    return 0;
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        height: 56,
        padding: "0 2px",
        background: "transparent",
      }}
    >
      {TOP_NAV_TABS.map((tab) => {
        const active = activeKey === tab.key;
        const badge = badgeFor(tab.key);
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.path)}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              height: "100%",
              background: "none",
              border: "none",
              borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
              cursor: "pointer",
              padding: 0,
              minWidth: 0,
              transition: "all 0.2s ease",
              fontFamily: "'DM Sans', sans-serif",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, position: "relative" }}>
              {tab.icon}
              {badge > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -9,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#e74c3c",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    border: "1.5px solid #fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                color: active ? th.accent : "#999",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

Rules:
- Mirror the visual spec of `TripSubNav` but pinned to top (3px indicator on BOTTOM border instead of top).
- Notification bubbles only render when count > 0; cap display at `9+` when count exceeds 9.
- Badge counts come in as props — the component does NOT fetch. The dashboard page fetches once (server-side) and passes down.

## 2. Update `app/dashboard/page.tsx` (server component)

Before writing queries, inspect the schema:

```bash
# In Supabase SQL editor, inspect tables for chat / friend data:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%chat%' OR table_name LIKE '%friend%' OR table_name LIKE '%message%');
```

Look for:
- A messages table (likely `trip_chat_messages`, `chat_messages`, or similar) and any last-read tracking column (e.g. `chat_last_read_at` on `trip_members` or a separate `chat_reads` table).
- The friend links table (likely `friend_links` with `status` column values including `pending`).

**Then** add two lightweight count queries to the server component and pass them as props to `<DashboardPage />`.

Illustrative shape (adjust to the real schema you find):

```tsx
// in page.tsx, after fetching user + profile + trips

// Unread chat messages count — across all trips the user is an accepted member of.
// Adjust the query to match actual table + last-read mechanism.
const { count: unreadChatCount } = await supabase
  .from("<chat_messages_table>")
  .select("id", { count: "exact", head: true })
  // .gt("created_at", lastReadAt)  // if last-read tracking exists
  // .neq("created_by", user.id)    // exclude the user's own messages
  ;

// Pending friend requests targeting this user
const { count: pendingFriendCount } = await supabase
  .from("friend_links")
  .select("id", { count: "exact", head: true })
  .eq("target_user_id", user.id)
  .eq("status", "pending");

return (
  <DashboardPage
    user={...}
    profile={...}
    initialTrips={...}
    initialFamilies={...}
    unreadChatCount={unreadChatCount ?? 0}
    pendingFriendCount={pendingFriendCount ?? 0}
  />
);
```

If the chat schema doesn't have a clear last-read tracking mechanism, pass `0` for `unreadChatCount` for now and add a `// TODO: wire unread chat count once last-read tracking lands` comment. Do NOT invent a new tracking mechanism in this prompt — that's a separate scope.

## 3. Refactor `app/dashboard/dashboard.tsx` (client component)

Four changes:

### 3a. Add props + import TopNav

```tsx
import TopNav from "@/app/top-nav";

interface DashboardProps {
  // ...existing props...
  unreadChatCount: number;
  pendingFriendCount: number;
}

export default function DashboardPage({
  // ...existing args...
  unreadChatCount,
  pendingFriendCount,
}: DashboardProps) {
  // existing body...
}
```

### 3b. Wrap header + nav in a sticky container

Replace the current header row (line ~212 — the `<div style={{ display: "flex", justifyContent: "space-between", ... }}>` containing avatar + "Your Trips" + "+ New Trip" button) with:

```tsx
{/* ─── STICKY TOP ─── */}
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: `1px solid ${th.cardBorder}`,
    // negative margin to cancel the outer padding so sticky spans full width
    marginLeft: -16,
    marginRight: -16,
    paddingLeft: 16,
    paddingRight: 16,
  }}
>
  {/* Row 1 — Page header */}
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
    {profile?.avatar_url ? (
      <img
        src={profile.avatar_url}
        alt={profile.full_name || "You"}
        onClick={() => router.push("/profile")}
        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
      />
    ) : (
      <div
        onClick={() => router.push("/profile")}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {(profile?.full_name || user.email || "?").charAt(0).toUpperCase()}
      </div>
    )}
    <h2 className="display" style={{ fontSize: 22, flex: 1, marginLeft: 4 }}>
      Your Trips
    </h2>
  </div>

  {/* Row 2 — Top-level nav */}
  <TopNav
    unreadChatCount={unreadChatCount}
    pendingFriendCount={pendingFriendCount}
  />
</div>
```

Important:
- The outer container today is `<div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 16px" }}>`. The sticky container sits at the TOP of that container. Because the parent has horizontal `padding: 16px`, the sticky div uses negative margin + padding to span full-width visually. If that's fragile, restructure so the sticky container is a sibling of the padded inner div and lives outside the padding.
- Remove the inline "+ New Trip" button that was in the old header row — it moves to the FAB in §3d.

### 3c. Adjust the outer container

Lift the maxWidth+padding container so it doesn't wrap the sticky nav (or use the negative-margin trick above). Whichever you choose, the body padding must NOT affect the sticky row, AND the sticky row must not inherit the 600px max-width cap that would leave gaps on the sides on wider screens.

Simplest refactor:

```tsx
return (
  <div style={{ minHeight: "100vh", background: th.bg, color: th.text, paddingBottom: 96 }}>
    {/* Sticky top spans full width */}
    <div style={{ position: "sticky", top: 0, zIndex: 20, ... }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
        {/* header row */}
        {/* TopNav */}
      </div>
    </div>

    {/* Scrollable body has the same max-width cap */}
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
      {/* onboarding reminder */}
      {/* first-time family prompt */}
      {/* empty state */}
      {/* upcoming trips section */}
      {/* past trips section */}
    </div>

    {/* FAB */}
    {/* ... */}
  </div>
);
```

Use this sibling structure — cleaner than the negative-margin trick.

### 3d. Replace "+ New Trip" inline button with a FAB

Add a FAB at the root level, after the scrollable body:

```tsx
<button
  onClick={createTrip}
  disabled={creating}
  aria-label="New trip"
  style={{
    position: "fixed",
    bottom: 20,
    right: 18,
    zIndex: 50,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
    color: "#fff",
    border: "none",
    fontSize: 28,
    fontWeight: 300,
    cursor: creating ? "default" : "pointer",
    opacity: creating ? 0.5 : 1,
    boxShadow: `0 4px 20px ${th.accent}8c`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.1s",
  }}
>
  {creating ? "…" : "+"}
</button>
```

- Wires to the existing `createTrip` function — do NOT duplicate its logic.
- Disabled/dimmed state matches the old button's `creating ? 0.5 : 1` opacity.
- `bottom: 20` (not 72) because the dashboard has NO bottom sub-nav — the FAB sits above the phone's home indicator only.

## Hard do-not-touch list

- Trip card rendering (`TripCard` component) — all its fields, accent border, delete button, chevron, past-trip dimming.
- Section titles ("Upcoming" / "Past Trips") and their muted-color styling.
- Upcoming vs past filtering and sort logic.
- Empty state (🧭 card with "No trips yet!").
- Onboarding reminder card — its styling, icon, "Set Up →" button handler.
- First-time family prompt — the "👋 Welcome!" card when `families.length === 0`.
- `createTrip` and `deleteTrip` handler logic — only change where `createTrip` is wired from (FAB instead of inline button).
- `.card-glass` CSS class and the `.badge` class in `app/globals.css`.
- Any other route or page.
- Existing `TripSubNav` component.

## Verification checklist

After your change, confirm:

- [ ] `app/top-nav.tsx` exists and mirrors the structural shape of `app/trip/[id]/trip-sub-nav.tsx`.
- [ ] `TopNav` accepts `unreadChatCount`, `pendingFriendCount`, `unreadAlertCount` props — all default 0.
- [ ] Notification bubble only renders when count > 0; displays "9+" when count > 9.
- [ ] `TopNav` uses `usePathname` to determine active tab and `router.push` to navigate to each tab's path.
- [ ] Dashboard has a sticky container at the top wrapping the header row + `<TopNav />`.
- [ ] Dashboard has a circular FAB bottom-right (56x56, orange gradient, `position: fixed; bottom: 20; right: 18`).
- [ ] The old inline "+ New Trip" button in the header row is gone.
- [ ] Onboarding reminder, first-time family prompt, empty state, upcoming/past sections render byte-identical.
- [ ] Trip cards (`.card-glass` style) render unchanged — delete button, chevron, accent badges, border-left color.
- [ ] Clicking the avatar navigates to `/profile`.
- [ ] `page.tsx` passes `unreadChatCount` and `pendingFriendCount` to `<DashboardPage />`. If chat last-read tracking doesn't exist, passes `0` with a `// TODO:` comment.
- [ ] `npm run build` passes locally.

## Ship it

Run `npm run build` locally first. If build passes, push straight to `main` — solo project, no branch or PR needed.

If the chat schema inspection reveals the data model requires bigger changes to support unread tracking, stop and report — don't invent the mechanism.
