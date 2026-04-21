# Role-Based Onboarding Map

## Preamble
This doc maps the existing 8-step onboarding flow (`/app/onboarding/steps/`) against the four RSVP Energy roles. The goal is to ensure **Just Here and Vibes Only users never feel forced to slog through irrelevant setup**, while All In and Helping Out users still get the full, opinionated experience they want.

Core principle: **every skipped step can be returned to later.** Nothing is permanently gated — we just don't force it up front.

---

## The Four Roles

| Icon | Role | One-liner | UX Density |
|---|---|---|---|
| 🔥 | All In | I'm doing this, get out of my way | Full |
| 🙌 | Helping Out | I've got you on whatever you need | Near-full |
| 🎟️ | Just Here | I showed up, that's the contribution | Minimal |
| ✌️ | Vibes Only | Don't @ me, I'll see you there | Bare bones |

Energy levels, not a hierarchy — "All In" doesn't out-rank "Vibes Only." They're just different stances on the same trip.

---

## The 8 Existing Onboarding Steps

| # | Step | File | Purpose |
|---|---|---|---|
| 1 | Welcome | `step-welcome.tsx` | Brand intro splash with value props |
| 2 | Profile | `step-profile.tsx` | Name, avatar, phone |
| 3 | Details | `step-details.tsx` | Gender, age range |
| 4 | Style | `step-style.tsx` | Clothing style multi-select (drives outfit suggestions) |
| 5 | People | `step-people.tsx` | Add friends, build family units |
| 6 | Friend Suggestions | `step-friend-suggestions.tsx` | (Conditional) Friends-of-inviter suggestions |
| 7 | Packing | `step-packing.tsx` | Packing style + 3 sub-steps (org, fold, compartment) |
| 8 | Done | `step-done.tsx` | Completion splash |

---

## Skip / Keep / Defer Matrix

Legend: ✅ Keep · ⏭️ Skip entirely · 💤 Defer (offer later from profile)

| # | Step | 🔥 All In | 🙌 Helping Out | 🎟️ Just Here | ✌️ Vibes Only |
|---|---|:---:|:---:|:---:|:---:|
| 1 | Welcome | ✅ | ✅ | ⏭️ | ⏭️ |
| 2 | Profile | ✅ | ✅ | ⚡ Name only | ⚡ Name only |
| 3 | Details (gender/age) | ✅ | ✅ | 💤 | 💤 |
| 4 | Style (clothing) | ✅ | ✅ | 💤 | ⏭️ |
| 5 | People (friends/family) | ✅ | ✅ | 💤 | ⏭️ |
| 6 | Friend Suggestions | ✅ (if invited) | ✅ (if invited) | 💤 | ⏭️ |
| 7 | Packing Prefs (+ 3 sub) | ✅ | ✅ | 💤 | ⏭️ |
| 8 | Done | ✅ | ✅ | ⚡ Abbreviated | ⚡ Abbreviated |

**⚡ = modified version, not a skip.** Captures the minimum needed and drops them in the trip.

---

## All In & Helping Out — Full Path

These users self-identified as planners or helpers. They **want** to set things up properly because it pays off later (smart outfit suggestions, packing cube assignments, easy re-invites). Running the full 8-step flow is the correct choice.

**Small nuance:** if a Helping Out user picked their role via an invite from an All In user, the Friend Suggestions step (6) is *especially* valuable because it seeds their friend graph with the host's circle. Keep this prominent.

---

## Just Here — The Critical Short Path

This is the user you're trying to activate. They downloaded the app because Dan told them to. They do NOT care about their packing style today. They care about:

1. Knowing the trip is real
2. Knowing when/where to be
3. Paying Dan back

**The short path (≈ 45 seconds total):**

1. Invite accepted → account created (name, email, password)
2. Role Picker → taps **Just Here**
3. **→ SKIP to /trip/[id]**, default tab = Expenses
4. Show a lightweight "You're in" banner: "Welcome, {name}. Dan added you to Nashville Bach Weekend. Here's what you owe and where to be."

**What we capture at minimum:**
- Name (required for group roster)
- Email (already have it from signup)
- Nothing else

**What we quietly enable as "upgrade paths" in Profile:**
- "Add your packing style" → unlocks personalized packing lists
- "Add clothing style" → unlocks outfit suggestions
- "Add family members" → if they want to bring a +1 or kids
- "Connect with friends" → standard friend flow

These should live on the Profile screen as dismissible cards, not popups. **Never interrupt a Just Here user mid-trip to ask for data.**

**Key detail:** Just Here means the `trip_members.role_preference` = `just_here` for *this trip*. It doesn't permanently mark them as Just Here — their next trip might be as All In. But it does set `user_profiles.default_role_preference` = `just_here` so smart defaults on future trips lean toward low-friction.

---

## Vibes Only — The Bare Bones Path

Even shorter than Just Here. These users are one foot out the door. They're not going to read anything longer than a tweet.

**The ultra-short path (≈ 25 seconds total):**

1. Invite accepted → account created (name + email, no password option: magic link only)
2. Role Picker → taps **Vibes Only**
3. **→ SKIP to /trip/[id]**, default tab = Itinerary in Today-mode
4. Show a single card: "📍 Friday 8pm — Dinner at Husk, 37 Rutledge Ave. Don't be late. You owe $42."

That's it. If they need more, everything's one tap away via a "View full trip" link.

**What we capture at minimum:**
- Name only (email comes from the invite link itself)
- If we can get away without a password, we should (magic link + device persistence)

**Key difference vs. Just Here:** Just Here lands on Expenses (their question is money). Vibes Only lands on Itinerary-in-Today-mode (their question is "where/when"). Both have all 6 sub-nav tabs reachable.

---

## Upgrade Paths — How Skipped Steps Come Back

Users can always become more engaged. When they do, the skipped steps need to be retrievable without forcing the user back through the whole onboarding flow.

Add these cards to `/profile` for Just Here / Vibes Only users:

| Card | Triggers | What it does |
|---|---|---|
| "Get personalized packing lists" | Always visible for Just Here/Vibes Only | Links to step-packing.tsx flow, standalone |
| "Suggest outfits for events" | Always visible | Links to step-style.tsx flow, standalone |
| "Add family members" | Always visible | Links to step-people.tsx flow, standalone |
| "Finish your profile" | If profile < 50% complete | Links to step-details.tsx flow |

Each card should be **dismissible** (via a row in `user_dismissed_upsells`). If a Just Here user dismisses "Get personalized packing lists," don't show it again on that trip. Their next trip — especially if they pick All In or Helping Out — can re-surface it.

---

## Changing Role Mid-Trip

Anyone can change their role at any time via `/trip/[id]/group` → tap their own row → "Change my role."

**When they upgrade** (e.g., Just Here → Helping Out): offer the skipped onboarding steps as "Want to set these up now? It only takes a minute" rather than forcing them through.

**When they downgrade** (e.g., All In → Just Here): no data loss, just UI density changes. Their packing prefs, family, etc. are preserved — they just don't see those tabs prominently anymore.

---

## Default Landing Tabs by Role

Add to `TripPage` a `useDefaultTabForRole(role)` helper:

| Role | Default Tab | Sub-nav Order |
|---|---|---|
| 🔥 All In | Itinerary | Itinerary · Expenses · Packing · Notes · Meals · Group |
| 🙌 Helping Out | Itinerary | Itinerary · Packing · Expenses · Notes · Meals · Group |
| 🎟️ Just Here | Expenses | Expenses · Itinerary · Group · Packing · Notes · Meals |
| ✌️ Vibes Only | Itinerary (Today-mode) | Itinerary · Expenses · Group · Packing · Notes · Meals |

**All 6 tabs are always visible for every role.** What changes is (a) which tab opens first on landing, (b) the order they appear in the fixed bottom nav. Nothing is hidden behind a "More" menu.

---

## Open Questions to Resolve Before Building

1. **Magic-link auth for Vibes Only** — is this worth the complexity? Reduces friction but adds an auth path to maintain. Alternative: password still required but pre-filled from invite token if possible.
2. **"Skip →" on the Role Picker itself** — what does it default to? Recommendation: Helping Out (safe middle ground, no density gated off, can be changed from Group later).
3. **Family members** — if an All In user adds family to a trip who haven't onboarded, what's their default role? Recommendation: auto-set `role_preference = just_here` for auto-attended family members since they're not actively using the app.
4. **Party-of-one trips** — solo trips don't have a social role axis. Either skip the Role Picker entirely (always All In) or show it anyway for consistency. Recommendation: skip. No one's making themselves Just Here on their own trip.

---

## Build Order (Suggested)

Wedge this between the current itinerary/packing phase and polish. Specifically:

1. **Phase A:** Schema — add `trip_members.role_preference` + `user_profiles.default_role_preference`, update RLS. Seed existing members as `all_in` if host, `helping_out` otherwise. Values: `all_in | helping_out | just_here | vibes_only`. [copy-paste SQL required]
2. **Phase B:** Role Picker route `/trip/[id]/role` — server + client split per existing pattern, pulls from the mockup at `mockups/role-picker-mockup.html`.
3. **Phase C:** Wire entry points — invite-accept flow, trip-create flow, group-screen "Change role" button.
4. **Phase D:** Onboarding short-circuit logic in `onboarding-page.tsx` — if role is Just Here / Vibes Only, jump straight to abbreviated Done.
5. **Phase E:** Trip hub density — sub-nav reorder + default tab + notification defaults per role.
6. **Phase F:** Profile upgrade cards — surface skipped steps as opt-in.

Each phase in a new chat, per `docs/build-guide.md` conventions.
