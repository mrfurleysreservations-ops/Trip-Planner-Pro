# Build Prompt — Group: add "Also on the app" discovery + move search below invite form

Paste everything below the line into a new Claude chat with the Trip Planner Pro repo open.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Task
Two related changes to the Group tab:

1. Below "Your friends" and "Your families", show everyone else who's on the app, greyed out, so the host can discover people they're not already friends with. Tapping a greyed friend adds them to the trip as a pending invite (no friending step). Tapping "+ Add All" on a greyed family adds its members the same way.
2. Move the single search input OUT of the sticky top container and place it in the body of each tab, directly below "Invite someone new" on the Friends tab and at the top of the Families tab body. Rationale: first-time users land on the invite form; search only matters once there's a list to filter.

## Files in scope
- `app/trip/[id]/group/page.tsx` — server component (data fetch)
- `app/trip/[id]/group/group-page.tsx` — client component (UI)

Do NOT touch other tabs, `types/database.types.ts`, the sub-nav, or any handler logic that isn't explicitly called out here.

## Server-side data (page.tsx)

Today the server fetches:
- `friends` — `user_profiles` rows for accepted `friend_links`
- `familiesWithMembers` — families owned by you + families owned by your friends

Add two new props and include them on `<GroupPage … />`:

- `otherAppUsers: FriendWithProfile[]`
  - Query `user_profiles` where `id` is NOT the current user AND NOT in `friendUserIds`.
  - Select the same fields as today: `id, full_name, email, avatar_url`.
  - `order("full_name")`, `.limit(100)`.
  - Map each row into `FriendWithProfile` shape (reuse the existing type).

- `otherFamilies: FamilyWithMembers[]`
  - Query `families` joined to `family_members(*)` where `owner_id` is NOT the current user AND NOT in `friendUserIds`.
  - Resolve `owner_name` with the same `user_profiles` lookup pattern used today.
  - `is_own: false`. `order("created_at", { ascending: false })`, `.limit(100)`.

Add both to `GroupPageProps` alongside the existing `friends` / `familiesWithMembers`.

Note: this exposes all public `user_profiles` rows to every logged-in user. That's fine for the current hobby-project scope but flag it if RLS is ever tightened.

## UI changes (group-page.tsx)

### Sticky container — shrink to 3 rows
Remove the search row (Row 4) from the sticky top container. The sticky container now holds exactly:
1. Header (back · "Group" · Save ✓)
2. Crew roster strip
3. Friends/Families pill

All other sticky styling and the tab-layout-standard wrapper rules stay the same.

### Search input — lives in the tab body
Same single `search` state, same placeholder logic, same markup — just rendered inside each tab's body, not in the sticky div.

- Friends tab: render the search input DIRECTLY below the "Invite someone new" form (before "Your Friends").
- Families tab: render the search input at the TOP of the Families body (before "Your Families").

### Friends tab — new order
1. Invite someone new (form, unchanged)
2. Search input
3. Your friends (unchanged)
4. Not on the app yet (external invites, unchanged)
5. **NEW: Also on the app** — greyed-out discovery list
   - Section header styled like "Not on the app yet" (uppercase, muted, `#bbb` color is fine).
   - Each row uses the same `.greyed` styling from the existing "Not on the app yet" rows (opacity 0.45, `#f0f0f0` bg, `#e0e0e0` border, `#bbb` avatar bg) — copy that exact block. Swap the subtitle line to just the email (not "Invited — hasn't joined yet").
   - Right side: `+ Invite` button. Handler: reuse `addFriend(f)` (it already inserts a `trip_members` row with `user_id` and `status: "pending"` — that is the invite). Do NOT create a `friend_links` row.
   - Source: `otherAppUsers`, filtered by `search`, excluding anyone whose `user_id` is already in `memberUserIds` (so once invited, the row disappears from here and appears in "Your friends" as `✓ Added`).

### Families tab — new order
1. Search input
2. Your families (unchanged)
3. Friends' families (unchanged)
4. **NEW: Other families on the app** — greyed-out discovery list
   - Section header styled like "Friends' Families" but muted grey (`#bbb`).
   - Render each family with the existing `FamilyCard` component. Add a new optional prop `dimmed?: boolean` to `FamilyCardProps` that, when true, wraps the card at `opacity: 0.55`. No other `FamilyCard` changes.
   - `ownerLabel = \`${fam.owner_name || "Someone"}'s family\``.
   - `+ Add All` handler: reuse `addWholeFamily(fam)` (already inserts with `status: "pending"`).
   - Source: `otherFamilies`, filtered by the existing `familyQ` logic, and hide any family whose members are fully added (reuse `isFamilyAdded`).

## Hard do-not-touch list
- `addFriend`, `addFamilyMember`, `addWholeFamily`, `sendExternalInvite`, `removeMember` — signatures, Supabase writes, activity logs stay identical.
- Sticky container's Row 1 (header + back + Save ✓) and Row 2 (crew chips) — no visual changes.
- Friends/Families pill styling.
- Back button, Save ✓ button, sub-nav.
- `types/database.types.ts`, RLS policies, any other tab.

## Verification checklist
- [ ] `page.tsx` fetches `otherAppUsers` and `otherFamilies` with `.limit(100)` caps, excluding current user + existing friends/own records.
- [ ] `GroupPageProps` includes both new props; `GroupPage` consumes them.
- [ ] Sticky top container has exactly 3 rows (header, crew, pill) — no search row.
- [ ] Friends tab section order: Invite form → Search → Your friends → Not on the app yet → Also on the app.
- [ ] Families tab section order: Search → Your families → Friends' families → Other families on the app.
- [ ] "Also on the app" rows are greyed; tapping `+ Invite` moves the user to "Your friends" with `✓ Added` state.
- [ ] "Other families on the app" cards are dimmed (opacity 0.55); tapping `+ Add All` works and the card disappears from the discovery list once fully added.
- [ ] The single `search` state filters across the active tab's body (including the new greyed sections).
- [ ] No new `friend_links` rows are written anywhere.

## Ship it
Run `npm run build` locally. If build passes, push straight to `main` — solo project, no branch or PR needed.
