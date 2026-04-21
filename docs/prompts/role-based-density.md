# Role-Based Density (RSVP Energy) — Build Prompts

This adds a per-trip **Role Picker** — 🔥 All In / 🙌 Helping Out / 🎟️ Just Here / ✌️ Vibes Only — that reorders sub-nav, re-defaults the landing tab, re-themes the hub hero, and sets chat notification defaults. **Nothing is hidden.** Every role can still reach every sub-nav tab. All 7 tabs (Itinerary · Expenses · Chat · Packing · Notes · Meals · Group) stay visible at all times.

Reference docs:
- Mockup: `mockups/role-picker-mockup.html`
- Mockup: `mockups/role-trip-hub-mockup.html`
- Spec: `docs/role-based-onboarding.md`

Run each phase in a **new chat session**. Paste the prompt block, wait for it to complete, verify it works, commit, then move to the next phase. Do not combine phases.

---

## Phase A — Schema: role_preference + chat_notification_level

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
Add per-trip role preferences to `trip_members`, a default-role preference on `user_profiles`, and a chat notification level on `trip_members`. Backfill existing rows so the feature lights up for already-created trips without any UX disruption.

### Why
We're introducing "RSVP Energy" — a per-trip role the user picks (All In / Helping Out / Just Here / Vibes Only) that drives UI density (default tab, sub-nav order, hub hero, chat noise level). It must **never** hide features — only reorder/re-default them. See `docs/role-based-onboarding.md` for the full spec and `mockups/role-picker-mockup.html` + `mockups/role-trip-hub-mockup.html` for the UX.

### 1. Create migration file

Create `supabase/migrations/20260418_role_preferences.sql` with the contents below. This migration is additive — no existing column changes.

**Provide me the exact SQL to paste into Supabase SQL Editor:**

```sql
-- Migration: Role-based density (RSVP Energy)
-- Adds per-trip role_preference + chat_notification_level on trip_members,
-- and default_role_preference on user_profiles. Backfills existing rows.

-- ─── trip_members.role_preference ────────────────────────────────────────
ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS role_preference text
    NOT NULL
    DEFAULT 'helping_out'
    CHECK (role_preference IN ('all_in', 'helping_out', 'just_here', 'vibes_only'));

-- ─── trip_members.chat_notification_level ────────────────────────────────
ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS chat_notification_level text
    NOT NULL
    DEFAULT 'all'
    CHECK (chat_notification_level IN ('all', 'mentions', 'muted'));

-- ─── user_profiles.default_role_preference ───────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS default_role_preference text
    CHECK (default_role_preference IN ('all_in', 'helping_out', 'just_here', 'vibes_only'));

-- ─── Backfill existing trip_members ──────────────────────────────────────
-- Hosts default to 'all_in', everyone else stays at the column default 'helping_out'.
UPDATE trip_members
   SET role_preference = 'all_in'
 WHERE role = 'host'
   AND role_preference = 'helping_out';  -- only touch rows still at default

-- Indexes for common lookups (role-based filtering + default tab routing)
CREATE INDEX IF NOT EXISTS idx_trip_members_role_pref
  ON trip_members(trip_id, role_preference);
```

No RLS changes are needed — these are columns on existing tables, so the existing `trip_members` and `user_profiles` policies cover them.

### 2. Update `types/database.types.ts`

- Add to `trip_members` Row: `role_preference: string;` and `chat_notification_level: string;`
- Add to `trip_members` Insert: `role_preference?: string;` and `chat_notification_level?: string;`
- Add to `user_profiles` Row: `default_role_preference: string | null;`
- Add to `user_profiles` Insert: `default_role_preference?: string | null;`

### 3. Add constants to `lib/constants.ts`

Add a new constant block after the existing trip-type / event-type constants:

```ts
export const ROLE_PREFERENCES = [
  {
    value: "all_in",
    label: "All In",
    icon: "🔥",
    tagline: "I'm doing this, get out of my way",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "expenses", "chat", "packing", "notes", "meals", "group"],
    chatDefault: "all",
  },
  {
    value: "helping_out",
    label: "Helping Out",
    icon: "🙌",
    tagline: "I've got you on whatever you need",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "packing", "chat", "expenses", "notes", "meals", "group"],
    chatDefault: "all",
  },
  {
    value: "just_here",
    label: "Just Here",
    icon: "🎟️",
    tagline: "I showed up, that's the contribution",
    defaultTab: "expenses",
    subNavOrder: ["expenses", "chat", "itinerary", "group", "packing", "notes", "meals"],
    chatDefault: "mentions",
  },
  {
    value: "vibes_only",
    label: "Vibes Only",
    icon: "✌️",
    tagline: "Don't @ me, I'll see you there",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "expenses", "chat", "group", "packing", "notes", "meals"],
    chatDefault: "muted",
  },
] as const;

export type RolePreference = (typeof ROLE_PREFERENCES)[number]["value"];
```

### 4. Do NOT touch yet
- The Role Picker UI — that's Phase B
- `trip-sub-nav.tsx` ordering — that's Phase E
- The chat page's notification behavior — that's Phase G

### 5. When finished
Tell me the exact shell commands to run locally to stage + commit + push to main. The sandbox cannot push, and this is a solo hobby project — always push straight to main.

---

## Phase B — Role Picker route

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
Build the Role Picker at `/trip/[id]/role` — the single screen where a user picks one of the four RSVP Energy roles for a specific trip. This is per-trip, not per-account.

### Why
Reluctant travelers (Just Here / Vibes Only) need a 30-second path into a trip instead of an 8-step onboarding. All In / Helping Out users still get the full experience. The Role Picker is the decision point that branches these paths. See the mockup at `mockups/role-picker-mockup.html` and the spec at `docs/role-based-onboarding.md`.

### What to build

Follow the existing server/client split pattern used by every other trip page (see `app/trip/[id]/group/page.tsx` + `group-page.tsx` for reference).

#### 1. Server component: `app/trip/[id]/role/page.tsx`
- Fetch the trip by id (exists check — 404 otherwise)
- Fetch the current `trip_members` row for `auth.uid()` on this trip (must exist; if not, redirect to `/dashboard`)
- Fetch `user_profiles.default_role_preference` for the current user
- Pass `{ trip, currentMember, defaultRole }` to the client component

#### 2. Client component: `app/trip/[id]/role/role-page.tsx`
- Import `ROLE_PREFERENCES` from `lib/constants.ts`
- Render 4 cards matching `mockups/role-picker-mockup.html`:
  - Icon, label, tagline
  - Highlighted ring in `th.accent` when selected
- A `redirectTo` query param controls where to go after save (default `/trip/[id]`)
- On selection, call `handleSelect(role)`:
  ```ts
  await supabase
    .from("trip_members")
    .update({
      role_preference: role,
      chat_notification_level: ROLE_PREFERENCES.find(r => r.value === role)!.chatDefault,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentMember.id);

  // Also set default for future trips (don't overwrite an existing value unless user has none yet)
  if (!defaultRole) {
    await supabase
      .from("user_profiles")
      .update({ default_role_preference: role, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  logActivity(...);
  router.push(redirectTo);
  ```
- Include a "Skip →" link in the top-right that defaults to `helping_out` (the safe middle ground — no density gated off).

#### 3. Styling
- Inline styles, glass-morphism cards, trip's accent color for the selected ring
- DM Sans body, Outfit headings
- Follow the sticky-header + scrolling-body pattern from `docs/tab-layout-standard.md`
- Mobile-first — the mockup shows ~390px wide phones

### Files to create
- `app/trip/[id]/role/page.tsx`
- `app/trip/[id]/role/role-page.tsx`

### Files NOT to modify
- Don't wire this into the invite-accept or trip-create flows yet — that's Phase C
- Don't change the sub-nav — Phase E

### When finished
Provide shell commands to commit + push to main locally.

---

## Phase C — Wire entry points

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
Route users through `/trip/[id]/role` at three entry points:
1. **Invite accept** — after an invitee joins a trip, before they see the trip hub
2. **Trip create** — after a host creates a trip, before they see the hub (can skip; defaults to `all_in`)
3. **Group screen** — add a "Change my role" action on the current user's row in `/trip/[id]/group`

### Why
The Role Picker only matters if it's actually in the flow. Without these entry points, role defaults stay at the seeded value and users never see the RSVP Energy branching. See `docs/role-based-onboarding.md` for the full flow map.

### What to build

#### 1. Invite accept entry point
Find the existing invite-accept flow (grep for `invite_token`, `status = 'accepted'`, or start from `app/trip/[id]/group/group-page.tsx` and any invite landing route).

After the user is set to `status='accepted'` on their `trip_members` row, redirect them to:
```
/trip/[id]/role?redirectTo=/trip/[id]
```

If their `user_profiles.default_role_preference` is already set, pre-select that role card so they can confirm with one tap.

#### 2. Trip create entry point
Find the trip creation flow (likely `app/dashboard/` or a `new-trip` route). After a trip is created AND the host is auto-added as a `trip_members` row (existing behavior):

- If it's a **solo trip** (party-of-one or no other members invited yet), skip the picker entirely. Host stays at `all_in`. No redirect.
- Otherwise, redirect to `/trip/[id]/role?redirectTo=/trip/[id]/group` so they go to the group screen next to invite people.

Detection: check the number of `trip_members` rows for the trip. If 1, it's solo.

#### 3. Group screen entry point
In `app/trip/[id]/group/group-page.tsx`, on the current user's own row in the roster, add a small "Change role" button that links to `/trip/[id]/role?redirectTo=/trip/[id]/group`. Show the user's current role icon + label next to their name (pull from `trip_members.role_preference`, look up via `ROLE_PREFERENCES`).

For other members' rows (not the current user), show their role icon + label as read-only — this lets the host see at a glance who's All In vs Just Here.

### Files to modify
- The invite-accept handler (locate via search)
- The trip-create handler (locate via search)
- `app/trip/[id]/group/group-page.tsx` (and its server component if the role_preference isn't already fetched)

### Files NOT to modify
- Don't change `/trip/[id]/role/*` — that was built in Phase B
- Don't change onboarding yet — Phase D

### When finished
Provide shell commands to commit + push to main locally.

---

## Phase D — Onboarding short-circuit

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
When a user's `default_role_preference` is `just_here` or `vibes_only`, the 8-step onboarding flow in `app/onboarding/onboarding-page.tsx` should short-circuit: capture name only (step-profile in minimal mode), skip steps 3-7, jump straight to an abbreviated Done screen. All In / Helping Out users see the full flow unchanged.

### Why
Just Here / Vibes Only users are here because someone told them to be. They'll bail on any setup longer than 30 seconds. The skipped steps are never gone — they return as opt-in cards on the profile screen (Phase F). See `docs/role-based-onboarding.md` Skip/Keep/Defer matrix.

### What to build

#### 1. Read the current onboarding orchestrator
Read `app/onboarding/onboarding-page.tsx` and `app/onboarding/constants.ts` to understand the step sequencing. The existing 8 steps are: welcome, profile, details, style, people, friend-suggestions, packing, done.

#### 2. Add role-aware step filtering
At the top of `onboarding-page.tsx`, after the user's `default_role_preference` is loaded, compute the active step list:

```ts
import { ROLE_PREFERENCES } from "@/lib/constants";

function stepsForRole(role: string | null): string[] {
  // Full flow for planners/helpers (and if role is unset, assume helping_out)
  if (!role || role === "all_in" || role === "helping_out") {
    return ["welcome", "profile", "details", "style", "people", "friend-suggestions", "packing", "done"];
  }
  // Just Here — minimal profile + abbreviated done
  if (role === "just_here") {
    return ["profile-minimal", "done-abbreviated"];
  }
  // Vibes Only — even shorter
  if (role === "vibes_only") {
    return ["profile-minimal", "done-abbreviated"];
  }
  return ["welcome", "profile", "details", "style", "people", "friend-suggestions", "packing", "done"];
}
```

#### 3. Profile minimal mode
Update `step-profile.tsx` to accept a `minimal?: boolean` prop. When true:
- Show only the Name field (required)
- Hide avatar upload, phone, city
- Swap the CTA copy to "Let's go →"

Don't break the existing full-profile behavior — guard all extra fields behind `!minimal`.

#### 4. Abbreviated Done
Update `step-done.tsx` to accept an `abbreviated?: boolean` prop. When true:
- Skip the celebratory "You're all set! Here's what you unlocked..." list
- Show a one-liner: "You're in. Here's your trip." with a single CTA that routes to `/trip/[id]` (or `/dashboard` if there's no active trip context)
- No confetti, no animation heavy stuff

#### 5. Upgrade path messaging
At the bottom of the abbreviated Done screen, show a soft line:
> Want packing lists, outfit suggestions, or to add family? You can turn those on any time from your profile.

Link to `/profile`. Phase F builds the opt-in cards there.

### Files to modify
- `app/onboarding/onboarding-page.tsx` — step filter logic
- `app/onboarding/steps/step-profile.tsx` — `minimal` mode
- `app/onboarding/steps/step-done.tsx` — `abbreviated` mode

### Files NOT to modify
- Don't delete any steps — they must still be reachable for All In / Helping Out users and (Phase F) via profile cards
- Don't change the `user_profiles` schema — just the rendering logic
- Don't touch the Role Picker — it was built in Phase B

### When finished
Provide shell commands to commit + push to main locally.

---

## Phase E — Trip hub density (default tab + sub-nav reorder + hero)

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
Make the trip hub responsive to `trip_members.role_preference` along three axes:
1. **Default landing tab** — the first tab the user sees when opening the trip
2. **Sub-nav ordering** — all 7 tabs still present, but in a role-specific order
3. **Hub hero card** — the top-of-page content varies per role (but still inside the standard sticky-top + scrolling-body layout)

**Critical constraint:** Every tab must remain visible and tappable for every role. No "More" menus. No hidden features. Joe spent a lot of time building each tab — the role only changes order and defaults. See memory `feedback_role_density_no_feature_loss.md` and the mockups at `mockups/role-trip-hub-mockup.html`.

### What to build

#### 1. `useDefaultTabForRole` helper
Create `lib/role-density.ts`:

```ts
import { ROLE_PREFERENCES, type RolePreference } from "./constants";

export function getRoleConfig(role: RolePreference | string | null) {
  const found = ROLE_PREFERENCES.find((r) => r.value === role);
  return found ?? ROLE_PREFERENCES.find((r) => r.value === "helping_out")!;
}

export function subNavOrderForRole(role: RolePreference | string | null): string[] {
  return getRoleConfig(role).subNavOrder;
}

export function defaultTabForRole(role: RolePreference | string | null): string {
  return getRoleConfig(role).defaultTab;
}
```

#### 2. Sub-nav reorder
In `app/trip/[id]/trip-sub-nav.tsx`, accept a `role: string` prop. Internally, sort the existing 7 tab defs using `subNavOrderForRole(role)`. **Do not remove any tabs** — all 7 must render. Only order changes. Active-tab highlighting, badges, and routing behavior stay the same.

Update wherever `<TripSubNav />` is rendered to pass the role down (pull from `trip_members` on the server side and thread it through).

#### 3. Default tab routing
The current trip hub at `/trip/[id]` likely renders the Itinerary view by default. Update the server component `app/trip/[id]/page.tsx`:

- After loading `trip_members` for the current user, compute `defaultTab = defaultTabForRole(member.role_preference)`
- If `defaultTab !== "itinerary"` (the current hub behavior), server-redirect to `/trip/[id]/${defaultTab}` — but only on bare `/trip/[id]` visits, not when the user clicked a specific tab

Important: Do NOT redirect if the user is navigating to a specific sub-path. Only the bare `/trip/[id]` entry point gets the role-driven redirect.

#### 4. Hub hero variants
In `app/trip/[id]/trip-page.tsx`, the existing hero section (trip name, countdown, etc.) stays. Add a role-specific hero addendum below it:

- **🔥 All In:** Full dashboard — upcoming events, packing progress, expenses summary, unread chats
- **🙌 Helping Out:** "How you can help" — list of open assignments (meals without owner, packing items unassigned, etc.)
- **🎟️ Just Here:** Big "What you owe Dan: $42 · Pay ›" card + "Your next event: Friday 8pm dinner" below it
- **✌️ Vibes Only:** One card — the next event's when/where only. "📍 Fri 8pm · Husk · 37 Rutledge Ave"

Each variant should be a small component (`RoleHeroAllIn`, `RoleHeroHelpingOut`, `RoleHeroJustHere`, `RoleHeroVibesOnly`) within `trip-page.tsx` or a sibling file. Render by `switch (role)` on the existing `trip_members.role_preference`.

Match the styles in `mockups/role-trip-hub-mockup.html`. Inline styles, glass cards, accent color from the trip theme.

#### 5. Itinerary "Today mode" for Vibes Only
When a Vibes Only user lands on `/trip/[id]` → redirected to `/trip/[id]/itinerary`, default the itinerary view to "Today" filter if one exists (or filter to events on the current calendar day). They can tap into "Full trip" anytime. Don't change the itinerary page for other roles.

### Files to modify
- `lib/role-density.ts` — NEW
- `app/trip/[id]/trip-sub-nav.tsx` — accept `role` prop, reorder tabs
- `app/trip/[id]/page.tsx` — compute default tab, conditional redirect
- `app/trip/[id]/trip-page.tsx` — role-variant hero
- `app/trip/[id]/itinerary/*-page.tsx` — today-mode default for vibes_only

### Files NOT to modify
- No tab's contents/features should change. This is reorder + default + hero only.
- Don't touch the Role Picker, onboarding, or entry-point wiring — those are earlier phases.
- Don't change chat behavior — Phase G.

### When finished
Provide shell commands to commit + push to main locally.

---

## Phase F — Profile upgrade cards

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
On `/profile`, show dismissible opt-in cards that re-surface the onboarding steps skipped by Just Here / Vibes Only users. This is the "upgrade path" — nothing is lost, users can turn on packing lists / outfit suggestions / family etc. at any time without going back through onboarding.

### Why
Skipping onboarding is only acceptable if users can recover those features when they want them. Without this phase, a Just Here user who later becomes more engaged has no way to unlock packing prefs short of re-doing onboarding. See `docs/role-based-onboarding.md` → "Upgrade Paths".

### What to build

#### 1. Migration: `user_dismissed_upsells`

**Provide me the exact SQL to paste into Supabase SQL Editor:**

```sql
-- Migration: Dismissed upgrade-path cards on /profile
CREATE TABLE IF NOT EXISTS user_dismissed_upsells (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upsell_key  text        NOT NULL,
  dismissed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, upsell_key)
);

CREATE INDEX IF NOT EXISTS idx_user_dismissed_upsells_user
  ON user_dismissed_upsells(user_id);

ALTER TABLE user_dismissed_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own dismissals"
  ON user_dismissed_upsells FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Update `types/database.types.ts` with the new Row/Insert types.

#### 2. Add `UPSELL_CARDS` to `lib/constants.ts`

```ts
export const UPSELL_CARDS = [
  {
    key: "packing_prefs",
    icon: "🧳",
    title: "Get personalized packing lists",
    body: "Tell us your packing style once and we'll auto-build lists for every trip.",
    cta: "Set my style",
    href: "/onboarding?step=packing&standalone=1",
    showWhen: "always",
  },
  {
    key: "clothing_style",
    icon: "👕",
    title: "Suggest outfits for events",
    body: "Pick your clothing styles so we can suggest outfits per event.",
    cta: "Pick styles",
    href: "/onboarding?step=style&standalone=1",
    showWhen: "always",
  },
  {
    key: "family",
    icon: "👨‍👩‍👧",
    title: "Add family members",
    body: "Bring a +1 or kids? Add them once, re-use on every trip.",
    cta: "Add family",
    href: "/onboarding?step=people&standalone=1",
    showWhen: "always",
  },
  {
    key: "finish_profile",
    icon: "📝",
    title: "Finish your profile",
    body: "Gender + age range help us tailor suggestions.",
    cta: "Finish up",
    href: "/onboarding?step=details&standalone=1",
    showWhen: "profile_incomplete",
  },
] as const;
```

#### 3. Standalone onboarding step mode
In `app/onboarding/onboarding-page.tsx`, respect `?standalone=1` on the URL:
- When present, show ONLY the step named in `?step=`
- After completion, redirect to `/profile` (not the next onboarding step)
- Don't flip `onboarding_completed` if it's already true

This reuses the existing step components without creating new forms.

#### 4. Upgrade cards section on `/profile`
Read `app/profile/*` (locate the profile page). Add an "Upgrade your trip experience" section that:

- Shows only for users whose `default_role_preference` is `just_here` or `vibes_only` (or is null — pre-RSVP-Energy users)
- For each card in `UPSELL_CARDS`:
  - Skip if the user dismissed it (`user_dismissed_upsells.upsell_key = card.key`)
  - Skip `finish_profile` if the profile is already complete (gender + age_range populated)
  - Render: icon + title + body + CTA button + small "✕ dismiss" in the corner
- Dismiss inserts into `user_dismissed_upsells`
- Style to match the existing profile page — glass cards, accent colors, consistent with `tab-layout-standard.md`

Don't show this section for All In / Helping Out users — they already opted into the full flow.

### Files to modify
- `app/profile/*-page.tsx` — add upsell section
- `app/onboarding/onboarding-page.tsx` — standalone mode
- `lib/constants.ts` — UPSELL_CARDS
- `types/database.types.ts` — new table types

### Files NOT to modify
- The step components themselves (step-packing, step-style, step-people, step-details) already exist and should be reused as-is through standalone mode

### When finished
Provide shell commands to commit + push to main locally.

---

## Phase G — Chat notification defaults per role

Copy everything below the line into a new chat.

---

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

### Goal
Honor `trip_members.chat_notification_level` everywhere unread counts + in-app notifications are computed. Also surface a visible per-user mute toggle inside the Chat tab so users can override the default set by their role.

### Why
- **All In / Helping Out:** Want every message (`level = 'all'`)
- **Just Here:** Only wants mentions (`level = 'mentions'`) — the firehose is noise
- **Vibes Only:** Fully muted (`level = 'muted'`), shows a gray dot on the tab instead of a red badge

Set in Phase A migration as defaults. This phase wires it into the UI.

### What to build

#### 1. Chat unread counting logic
Locate wherever unread counts are computed for the chat tab badge (likely somewhere that reads `trip_messages` vs `trip_message_reads`). Update the count function to honor `chat_notification_level`:

```ts
// Pseudocode — adapt to actual existing query
function getUnreadCount(tripId: string, userId: string, level: string) {
  if (level === "muted") return 0;
  const unreadMessages = fetchUnreadMessages(tripId, userId);
  if (level === "mentions") {
    return unreadMessages.filter(m => m.mentions?.includes(userId)).length;
  }
  return unreadMessages.length; // level === "all"
}
```

Mention detection: check if the existing `trip_messages` schema already stores mentions. If not, parse `@name` from body text against `trip_members.name` at render time (fine for v1; can add a `mentions` column later).

#### 2. Sub-nav badge style
In `trip-sub-nav.tsx`, the Chat tab badge should:
- `level = 'muted'` → gray dot (no number), even if there are unread messages
- `level = 'mentions'` → red badge with count, but count is only of mentions
- `level = 'all'` → red badge with full unread count (existing behavior)

See `mockups/role-trip-hub-mockup.html` for exact visual — the Vibes Only card shows the gray-dot variant.

#### 3. In-chat notification toggle
Inside the Chat tab (`app/trip/[id]/chat/chat-page.tsx`), add a small settings control (bell icon in the top-right of the chat header). Tapping opens a sheet with three options:
- All messages (default for All In / Helping Out)
- Only @mentions (default for Just Here)
- Muted (default for Vibes Only)

Selecting updates `trip_members.chat_notification_level` for the current user on this trip:

```ts
await supabase
  .from("trip_members")
  .update({ chat_notification_level: level, updated_at: new Date().toISOString() })
  .eq("id", currentMember.id);
```

Show the current role's icon next to the default so users understand why their starting state was what it was ("Default for 🎟️ Just Here").

#### 4. Role-change cascade (optional but recommended)
When a user changes their role via `/trip/[id]/role`, keep the existing behavior from Phase B (updating `chat_notification_level` to the new role's default). BUT — if they've already explicitly customized it (i.e., their current level differs from the PREVIOUS role's default), preserve their choice.

To detect this cleanly, in Phase B's update handler, compare:
```ts
const prevRole = currentMember.role_preference;
const prevDefault = getRoleConfig(prevRole).chatDefault;
const currentLevel = currentMember.chat_notification_level;
const userCustomized = currentLevel !== prevDefault;

await supabase.from("trip_members").update({
  role_preference: newRole,
  ...(userCustomized ? {} : { chat_notification_level: getRoleConfig(newRole).chatDefault }),
  updated_at: new Date().toISOString(),
}).eq("id", currentMember.id);
```

Add this comparison if it wasn't already implemented in Phase B. If it was, skip this step.

### Files to modify
- The unread-count query/helper (locate it — possibly in `chat-page.tsx` or a shared hook)
- `app/trip/[id]/trip-sub-nav.tsx` — badge style variants
- `app/trip/[id]/chat/chat-page.tsx` — settings control + sheet
- `app/trip/[id]/role/role-page.tsx` — preserve-customization logic (if needed)

### Files NOT to modify
- No schema changes — Phase A already added `chat_notification_level`
- Don't change message sending/receiving behavior — only unread counting + badge display

### When finished
Provide shell commands to commit + push to main locally.

---

## Post-Build Checklist

After all 7 phases ship, smoke-test each role end-to-end:

- [ ] **All In** — Create a trip, confirm default tab is Itinerary, sub-nav is Itin · Exp · Chat · Pack · Notes · Meals · Grp, chat badge is red with count
- [ ] **Helping Out** — Pick via Role Picker, confirm sub-nav is Itin · Pack · Chat · Exp · Notes · Meals · Grp, hero shows "How you can help"
- [ ] **Just Here** — Accept an invite, skip to minimal onboarding, confirm default tab is Expenses, chat badge shows mentions only
- [ ] **Vibes Only** — Accept an invite, skip to even shorter onboarding, confirm default tab is Itinerary-Today, chat tab shows gray dot
- [ ] **Role change** — As Just Here, change to All In via group screen, confirm no features were ever hidden and density shifts correctly
- [ ] **Profile upgrade cards** — As Just Here, confirm "Get personalized packing lists" etc. appear on /profile and open standalone onboarding steps
- [ ] **Dismissal** — Dismiss an upsell card, reload, confirm it's gone
