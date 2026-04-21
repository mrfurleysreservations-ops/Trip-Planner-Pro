# Build: Friends Tab (Dashboard-level)

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md` and `docs/tab-layout-standard.md` before writing any code. Follow the server/client split (`page.tsx` server, `*-page.tsx` client) exactly.

---

## What this phase builds
A fully functional `/friends` tab — replacing the current placeholder at `app/friends/page.tsx`. Two-pill toggle between **Friends** (individual users) and **Families** (family units you've connected with). Same layout on both pills.

Visual reference: `mockups/friends-mockup.html`. Open it locally and match the layout, colors, and proportions exactly.

---

## Finalized design decisions — do NOT re-ask

### Layout (identical on both pills)
Top-to-bottom inside the scrolling body:

1. **Pending invites** — collapsed dropdown card at top. Shows a count chip (e.g. `3`) + title ("Pending invites" / "Pending family invites") + subtitle ("2 waiting on you · 1 sent"). Tap to expand. Expanded rows show Accept + ✕ (incoming) or Cancel (outgoing). Accent-tinted border (`rgba(232,148,58,0.35)`).
2. **Suggested slider** — horizontal scroll. Cards show avatar, name, city, mutual-count chip, "via Sarah, Priya" attribution, + Add Friend / + Connect button. Friendship view: 155px cards. Family view: 180px cards with member-avatar stack above the mutual chip.
3. **Search** — input (with 🔍 glyph) that filters BOTH the "Your friends" list and the "Other people" list below it by name (case-insensitive, client-side).
4. **Your friends / Connected families** — full list of accepted connections. Each row: avatar, name, city + mutual count, "X trips" accent badge if you've traveled together, chevron. Family rows include a tiny stacked member-avatar strip.
5. **Other people on the app / Other families on the app** — browse-everyone section. Same row layout as #4 but with an inline "+ Add" / "+ Connect" button instead of the trip badge + chevron. Capped at ~20 rows with "Show more" at the bottom for pagination later.

### Sticky top region (applies `docs/tab-layout-standard.md` adapted for top-level page)
- Row 1: `Friends` title (h1) + `Share link` button on the right (no-op for now — placeholder).
- Row 2: Pill toggle `Friends | Families`. Uses the canonical pill from tab-layout-standard.
- NO search input in the sticky top — search lives in the body between Suggested and Your Friends (per mockup).
- Sticky region uses `position: sticky; top: 56` so it pins below the global `TabBar`.

### FAB
Bottom-right `+` FAB (56×56, accent). Tapping opens an "Add friend by email" / "Connect a family" modal (for v1 just stub with an alert — modal is a future phase).

### Theme
Use `THEMES.home` (`accent: #e8943a`). Do NOT introduce a new theme for this page.

### Families pill scope
A "family" on the Families pill means a `families` row the current user has *connected to* (new table `family_links` — see SQL below). The user's own families (owner_id = self) do NOT appear here — manage those on `/profile`.

### "Mutual friends" / "Mutual families"
Compute server-side:
- Mutual friends between user A and user B = count of `friend_links` rows where both (A, x) and (B, x) exist with `status='accepted'`.
- Mutual families between family A and family B = count of `family_links` rows where both families have a connection to the same third family.
- For MVP, cap each calculation at 20 friends/families to avoid expensive joins. If the user has >20 accepted connections, approximate is fine.

### Empty states
- No friends yet → show the suggested slider + "Other people" list only; hide the "Your friends · 0" section header entirely.
- No pending invites → hide the dropdown entirely.
- No suggestions (new user, no friends yet) → show "Other people on the app" merged into where suggested would go, with a subtitle "Discover travelers on the app".

---

## Step 1 — Migration (copy-paste this into Supabase SQL Editor)

```sql
-- family_links: a family (A) has connected with another family (B).
-- Semantics: a row (family_id=A, linked_family_id=B, status=accepted) means A has
-- connected to B. Mutual is represented by two rows (A→B accepted AND B→A accepted).
-- For simplicity v1 we create both rows on accept.

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  linked_family_id uuid not null references public.families(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (family_id, linked_family_id),
  check (family_id <> linked_family_id)
);

create index if not exists idx_family_links_family on public.family_links(family_id);
create index if not exists idx_family_links_linked on public.family_links(linked_family_id);
create index if not exists idx_family_links_status on public.family_links(status);

alter table public.family_links enable row level security;

-- Read: you can see a link where you own either family involved.
create policy family_links_select on public.family_links for select using (
  exists (select 1 from public.families f where f.id = family_links.family_id and f.owner_id = auth.uid())
  or
  exists (select 1 from public.families f where f.id = family_links.linked_family_id and f.owner_id = auth.uid())
);

-- Insert: you can request a link ONLY from a family you own, and you must be the requester.
create policy family_links_insert on public.family_links for insert with check (
  requested_by = auth.uid()
  and exists (select 1 from public.families f where f.id = family_links.family_id and f.owner_id = auth.uid())
);

-- Update: either side can update status (accept/decline/cancel).
create policy family_links_update on public.family_links for update using (
  exists (select 1 from public.families f where f.id = family_links.family_id and f.owner_id = auth.uid())
  or
  exists (select 1 from public.families f where f.id = family_links.linked_family_id and f.owner_id = auth.uid())
);

-- Delete: either side can delete (remove connection).
create policy family_links_delete on public.family_links for delete using (
  exists (select 1 from public.families f where f.id = family_links.family_id and f.owner_id = auth.uid())
  or
  exists (select 1 from public.families f where f.id = family_links.linked_family_id and f.owner_id = auth.uid())
);

-- Add a public profile surface we can safely query for the "Other people on the app" list.
-- (If you already expose user_profiles publicly, skip this. Otherwise add a minimal
-- read policy so any authenticated user can see name + avatar + city of others.)
create policy if not exists user_profiles_public_read
  on public.user_profiles for select
  using (auth.role() = 'authenticated');
```

After running: verify in the Supabase Table Editor that `family_links` exists with RLS enabled and four policies.

---

## Step 2 — Types
Update `types/database.types.ts`:
- Add `family_links` table typing matching the schema above.
- Do NOT invent fields that aren't in the SQL.

---

## Step 3 — Server component (`app/friends/page.tsx`)
Rewrite the existing placeholder. Fetch everything the client needs in parallel:

```ts
const [profileRes, friendsRes, pendingFriendsRes, ownFamiliesRes, familyLinksRes, pendingFamilyLinksRes, allUsersRes, allFamiliesRes] = await Promise.all([
  // profile (avatar + name)
  supabase.from("user_profiles").select("full_name, avatar_url, city").eq("id", user.id).single(),

  // accepted friend links involving the user (expand friend profile)
  supabase
    .from("friend_links")
    .select("id, user_id, friend_id, status, created_at, friend:user_profiles!friend_id(id, full_name, avatar_url, city)")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq("status", "accepted"),

  // pending friend links (inbound + outbound)
  supabase
    .from("friend_links")
    .select("id, user_id, friend_id, status, created_at, inviter:user_profiles!user_id(id, full_name, avatar_url), invitee:user_profiles!friend_id(id, full_name, avatar_url)")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq("status", "pending"),

  // families the user owns (used to scope family_links queries)
  supabase.from("families").select("id, name").eq("owner_id", user.id),

  // accepted family_links for any of user's families
  // (resolved in a follow-up .in() query using the ownFamilies ids)
  Promise.resolve({ data: [] }),

  // pending family_links
  Promise.resolve({ data: [] }),

  // "Other people on the app" — any profile that isn't the user and isn't already a friend
  supabase.from("user_profiles").select("id, full_name, avatar_url, city").neq("id", user.id).limit(40),

  // "Other families" — any family the user doesn't own and isn't already connected to
  supabase.from("families").select("id, name, owner_id").neq("owner_id", user.id).limit(40),
]);
```

After the first `await`, run the two family_links queries using `ownFamiliesRes.data.map(f => f.id)` as the `.in()` filter on `family_id`.

**Suggested friends**: compute in the server component. For each of the user's accepted friends, pull THEIR accepted friends (people the user isn't already linked to). Aggregate, sort by mutual count desc, take top 10. Include `mutualNames` (2 first mutuals) and `mutualCount`.

**Suggested families**: same pattern via `family_links`.

Pass everything down to `app/friends/friends-page.tsx` as typed props.

---

## Step 4 — Client component (`app/friends/friends-page.tsx`)

Match `mockups/friends-mockup.html` exactly. Structure:

```tsx
"use client";
// Imports ...

export default function FriendsPage({ /* typed props */ }: FriendsPageProps) {
  const th = THEMES.home;
  const [view, setView] = useState<"friends" | "families">("friends");
  const [pendingOpen, setPendingOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Derive filtered lists with useMemo on `search` + `view`.
  // Filtering applies to BOTH "your friends" and "other people" (same pill).

  return (
    <div style={{ minHeight: "100vh", background: th.bg, paddingBottom: 80 }}>
      {/* Sticky top: title + pill toggle (no search here) */}
      <div style={{ position: "sticky", top: 56, zIndex: 20, /* ... */ }}>
        {/* Row 1: h1 "Friends" + Share link button */}
        {/* Row 2: canonical pill — Friends | Families */}
      </div>

      {/* Scrolling body */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "10px 16px 24px" }}>
        {/* 1. Pending invites dropdown — collapse/expand via pendingOpen */}
        {/* 2. Suggested slider */}
        {/* 3. Search input (in body, NOT sticky) */}
        {/* 4. Your friends / Connected families list (filtered by search) */}
        {/* 5. Other people / Other families (filtered by search, capped at 20 with Show more) */}
      </div>

      {/* FAB (+) — opens "Add friend" / "Connect family" modal */}
    </div>
  );
}
```

**Extract reusable pieces ONLY if they are used twice within this file** (e.g. a `SuggestedCard` component with a variant prop for friend vs family). Do not create standalone component files under `app/components/` — these components aren't reused outside this page.

**Action handlers (real, not stubs):**
- Accept friend invite: `update friend_links set status='accepted' where id=?`
- Decline/cancel: `delete from friend_links where id=?`
- Add friend (from suggested or other): `insert into friend_links (user_id=auth.uid(), friend_id=target.id, status='pending')`
- Connect family (from suggested or other): `insert into family_links (family_id=<user's primary family>, linked_family_id=target.id, requested_by=auth.uid(), status='pending')`. If the user owns multiple families, prompt them to pick which one connects (small inline dropdown inside the FAB modal is fine; for Add-on-row default to their first family and show a toast "Connected from <FamilyName>").
- Remove friend / disconnect family: long-press / context menu on the row (leave for a future phase — NOT in scope here).

After any mutation, refresh state optimistically and call `router.refresh()` so the server component re-runs.

---

## Step 5 — Visual fidelity
- Match colors from `mockups/friends-mockup.html`. All accent tints use `#e8943a` with alpha variants (`15`, `12`, `10`).
- Pending dropdown border: `1.5px solid rgba(232,148,58,0.35)`.
- Row cards: `1.5px solid #e8e8e8`, `border-radius: 14px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.03)`.
- Avatar: 44px circle for individual rows, 44px rounded-square (`border-radius: 12px`) with tinted background for family rows.
- Use emoji fallbacks when `avatar_url` is null — `👤` for users, `👨‍👩‍👧‍👦` for families.
- Family member stack: 22px circles, `-7px` negative margin overlap, white 2px border. Cap at 4 shown + "+N" chip.

---

## Step 6 — Verification checklist (do this before declaring done)
- [ ] Run `npx tsc --noEmit` — zero errors.
- [ ] `/friends` loads without errors for a user with: (a) no friends + no families, (b) some friends + some families, (c) pending invites in both directions.
- [ ] Pending invites dropdown collapses/expands smoothly.
- [ ] Search filters both Your Friends and Other People lists simultaneously.
- [ ] Pill toggle switches views without re-fetching from the server (all data loaded upfront).
- [ ] Sticky region pins below the global TabBar (not behind it, not floating over it).
- [ ] FAB sits above the content at bottom-right; does not overlap the last row when scrolled to the bottom.
- [ ] Accept → the invite disappears, the friend appears in Your Friends.
- [ ] Add friend → the person disappears from Other People, appears in the pending dropdown (outgoing).

---

## What NOT to build in this phase
- Friend profile detail pages (tapping a row is a no-op for now).
- Family profile detail pages.
- Removing/blocking friends or families.
- Cross-app sharing / invite-by-email / invite link.
- Real-time subscriptions — polling on page mount is fine.
- Per-family picker modal for multi-family users (default to first family with a toast).
- Changing the global `TabBar` order or icons.

---

## Deliverable
Push straight to main per project convention. Give me the commit + push commands to run locally (sandbox git is locked).
