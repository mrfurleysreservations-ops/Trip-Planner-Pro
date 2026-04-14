# Onboarding Flow — Build Prompt

> Paste this entire prompt into a **new chat session**. Do NOT combine with other build phases.

---

## Preamble (ALWAYS follow this)

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## What You're Building

A 7-step onboarding wizard that new users go through immediately after signup, instead of landing on the dashboard. This captures profile data, clothing style, travel companions, friend connections, and packing preferences — all saved to Supabase.

The approved mockup is at `onboarding-flow-mockup.jsx` in the project root. **Match it exactly** — every step, every layout, every interaction, every animated visual. The mockup is the source of truth for UI.

---

## Phase 1: Database Schema Changes

Run the following SQL in Supabase SQL Editor to add the new columns to `user_profiles`:

```sql
-- Add onboarding profile columns
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS clothing_styles text[] DEFAULT '{}';
```

Then update `types/database.types.ts` — add these fields to the `user_profiles` Row and Insert types:

```
gender: string | null;
age_range: string | null;
phone: string | null;
clothing_styles: string[] | null;
```

The `packing_preferences` (JSONB) and `onboarding_completed` (boolean) columns already exist.

---

## Phase 2: Add Constants

In `lib/constants.ts`, add these new constants (if they don't already exist — check first):

```ts
export const GENDERS = [
  { value: "female", label: "Female", icon: "👩" },
  { value: "male", label: "Male", icon: "👨" },
  { value: "nonbinary", label: "Non-binary", icon: "🧑" },
  { value: "prefer_not", label: "Prefer not to say", icon: "🤍" },
] as const;

export const AGE_RANGES = [
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_64", label: "55–64" },
  { value: "65_plus", label: "65+" },
] as const;

export const CLOTHING_STYLES = [
  { value: "casual", label: "Casual", icon: "👕", image: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", description: "Jeans, tees, sneakers — comfortable and effortless", palette: ["#5c8db5", "#8fb5d4", "#b8d4e8", "#dceaf4"] },
  { value: "boho", label: "Boho", icon: "🌻", image: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)", description: "Flowy fabrics, earth tones, layered accessories", palette: ["#c97b3a", "#d4a373", "#e6c9a0", "#f5e6d0"] },
  { value: "classic", label: "Classic", icon: "👔", image: "linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%)", description: "Tailored fits, neutral colors, timeless pieces", palette: ["#5d4037", "#8d6e63", "#bcaaa4", "#d7ccc8"] },
  { value: "streetwear", label: "Streetwear", icon: "🧢", image: "linear-gradient(135deg, #1a1a1a 0%, #424242 100%)", description: "Bold logos, oversized fits, sneaker culture", palette: ["#212121", "#616161", "#e53935", "#fdd835"] },
  { value: "preppy", label: "Preppy", icon: "⛵", image: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", description: "Polos, chinos, clean lines, country-club energy", palette: ["#2e7d32", "#1565c0", "#fff", "#f5f5f5"] },
  { value: "athleisure", label: "Athleisure", icon: "🏃", image: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", description: "Performance meets style — leggings, joggers, fresh kicks", palette: ["#7b1fa2", "#ce93d8", "#e0e0e0", "#fff"] },
  { value: "minimalist", label: "Minimalist", icon: "◻️", image: "linear-gradient(135deg, #fafafa 0%, #e0e0e0 100%)", description: "Clean silhouettes, monochrome, quality over quantity", palette: ["#212121", "#757575", "#bdbdbd", "#f5f5f5"] },
  { value: "eclectic", label: "Eclectic", icon: "🎨", image: "linear-gradient(135deg, #fce4ec 0%, #e1f5fe 100%)", description: "A mix of everything — patterns, colors, unique finds", palette: ["#e91e63", "#ff9800", "#4caf50", "#2196f3"] },
] as const;
```

The packing preference constants (`PACKING_STYLES`, `ORGANIZATION_METHODS`, `FOLDING_METHODS`, `COMPARTMENT_SYSTEMS`, etc.) already exist in `lib/constants.ts`. Do NOT duplicate them.

---

## Phase 3: Create the Onboarding Route

### File: `app/onboarding/page.tsx` (Server Component)

```
- Get the authenticated user via createServerSupabaseClient()
- If no user, redirect to /auth/login
- Fetch the user's profile from user_profiles
- If profile.onboarding_completed === true, redirect to /dashboard
- Render <OnboardingPage userId={user.id} userEmail={user.email} userName={profile?.full_name} avatarUrl={profile?.avatar_url} />
```

### File: `app/onboarding/onboarding-page.tsx` (Client Component — "use client")

This is the main implementation. **Match the mockup exactly.** The mockup file `onboarding-flow-mockup.jsx` is the complete UI reference.

#### Architecture:

- 7 steps: Welcome/Profile → About You → Clothing Style → Your People → Friend Suggestions → Packing Preferences → Done
- Single state object tracking all collected data
- `TOTAL_STEPS = 7`
- Step navigation with `next()` / `back()` functions that scroll to top
- Sticky progress dots at the top (visible on steps 1–5, hidden on step 0 and step 6)
- Each step is its own component, receiving `data`, `onChange`, `onNext`, `onBack`
- CSS animation class `fade-in` for step transitions

#### Step-by-step spec:

**Step 1 — Welcome & Profile (StepProfile)**
- Avatar upload circle (use the existing `AvatarPicker` component from `app/components/avatar-picker`)
- Name input field
- Gender pill selector (from GENDERS constant)
- "Let's go" button, disabled until name is entered
- No back button, no progress dots

**Step 2 — About You (StepDetails)**
- Age range pill selector (from AGE_RANGES constant)
- Optional phone number input
- Next disabled until age range is selected

**Step 3 — Clothing Style (StepStyle)**
- 2-column grid of style cards (from CLOTHING_STYLES constant)
- Each card shows: gradient background, icon, palette dots, label, description
- Multi-select — tap to toggle, orange border + checkmark when selected
- Count badge: "N style(s) selected"
- Next disabled until at least 1 style is selected

**Step 4 — Your People (StepPeople)**
- 3-tab interface: "Find People" | "Your Family" | "Invite"
- **Find People tab**: Search input + full browsable list of app users. Search filters matches to the top with "Matches" / "Everyone on the app" dividers. Does NOT hide non-matches. Query `user_profiles` for real users (not mock data). Each user row shows avatar, name, email, mutual friend count, and a toggle circle.
- **Family tab**: Shows existing family members. "Link someone on the app" section with user search. "Add someone without an account" section with name input + age type pills (adult/kid/toddler/baby). These go into the `family_members` table.
- **Invite tab**: Email input to send invites. Shows "Invites sent" list with checkmarks.
- Selected people shown as chips above the tab bar (orange for connections, green for family, blue for invites)
- "Skip for now" if no one selected, "Next" otherwise

**Step 5 — Friend Suggestions (StepFriendSuggestions)**
- Only shown if the user was invited by someone (check `friend_links` table or invite metadata)
- Shows inviter badge card with avatar, name, "Invited you to Trip Planner Pro"
- Lists inviter's friends with trip counts, "+ Add" button on each
- Already-connected friends shown as green chips at top
- If user was NOT invited, skip this step entirely (go from step 4 → step 6, adjust numbering display accordingly)

**Step 6 — Packing Preferences (StepPacking)**
- 4 sub-steps: Packing Style → Organization Method → Folding Method → Compartment System
- Sub-step dots (smaller, uses ACCENT2 color)
- Each sub-step shows:
  1. **Animated visual preview** — the `PackingVisual` component with ALL 18+ visual types. Copy every visual exactly from the mockup. These are the animated illustrations: planner, minimalist, overpacker, spontaneous, hyper_organizer, by_day, by_category, by_activity, by_outfit, rolling, konmari, bundle, flat_fold, cubes, compression, ziplock, toss, plus fallback no_preference variants. Each visual uses CSS transitions triggered by `isActive` prop.
  2. **Horizontal scrolling pill selector** — pills with icon + label, orange when selected, scrollable overflow
  3. **Expanded detail card** — shows icon, label, tagline, description, and "How this works in your trip" section with arrow-pointed bullet points
  4. **Green confirmation banner** — appears below the detail card once a selection is made: "✅ {icon} {label} will be saved as your default. You can change it anytime in your profile, or override it per trip."
- Nav buttons say "Save & Continue" between sub-steps, "Save & Finish ✓" on the last sub-step
- `useEffect` syncs `selectedIndex` when entering a sub-step that already has a saved value

The packing sub-step data structure (copy from mockup's `PACKING_SUB_STEPS`):
- Each sub-step has: `key`, `title`, `subtitle`, `options[]`
- Each option has: `value`, `label`, `icon`, `visual` (key for PackingVisual), `tagline`, `description`, `howItWorks[]` (array of strings)

**Step 7 — Done (StepDone)**
- Confetti emoji with scale-in animation
- "You're all set, {firstName}!" heading
- "These preferences are saved to your profile and will be used every time you pack for a trip."
- **Saved preferences card** with green "✅ Your saved preferences" header, showing 6 rows:
  - Clothing Style (joined labels from selected styles)
  - Packing Style (icon + label)
  - Organization (icon + label)
  - Folding Method (icon + label)
  - Compartments (icon + label)
  - Travelers ("You + N people" or "Just you (for now)")
- "You can update these anytime in Profile → Packing Preferences" link
- Tip card: "💡 These are your defaults — not locked in stone" — explains per-trip overrides
- Pinterest teaser card (pink gradient, 📌 icon, "Coming Soon: Style Inspiration")
- "Start Planning a Trip →" button that navigates to `/dashboard`

#### Data Persistence:

On the Done step (or when "Start Planning a Trip" is clicked), save everything to Supabase in a single transaction:

```ts
// Update user_profiles
await supabase.from("user_profiles").update({
  full_name: data.name,
  avatar_url: data.avatarUrl,  // if uploaded
  gender: data.gender,
  age_range: data.ageRange,
  phone: data.phone,
  clothing_styles: data.clothingStyles,
  packing_preferences: {
    packing_style: data.packingStyle,
    organization_method: data.orgMethod,
    folding_method: data.foldingMethod,
    compartment_system: data.compartmentSystem,
  },
  onboarding_completed: true,
}).eq("id", userId);
```

For connections (friend links):
```ts
// Insert friend_links for each selected connection
for (const connection of data.connections) {
  await supabase.from("friend_links").insert({
    user_id: userId,
    friend_id: connection.id,
    status: "pending",
  });
}
```

For family members:
```ts
// Get or create a family for the user, then insert family_members
// If member has linkedUserId, set the linked_user_id column
```

For email invites:
```ts
// Store pending invites however the existing invite system works
// Or create friend_links with status: "invited" and the email
```

---

## Phase 4: Middleware — Redirect New Users to Onboarding

Update `middleware.ts` to check onboarding status. After the existing auth check, if the user is authenticated and heading to any page OTHER than `/onboarding` or `/auth/*`:

```ts
// After existing auth logic...
if (user && !isAuthPage && pathname !== "/onboarding") {
  // Check if onboarding is completed
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_completed) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
}
```

**Important:** Also allow authenticated users to access `/onboarding` without being redirected to `/dashboard`. The current middleware redirects auth'd users away from auth pages — make sure `/onboarding` is not caught by that rule.

---

## Phase 5: Auth Callback — Send to Onboarding

Update `app/auth/callback/route.ts`: After exchanging the auth code for a session, check if the user has completed onboarding. If not, redirect to `/onboarding` instead of `/dashboard`.

---

## Styling Rules

- **Inline CSS only** — no Tailwind, no CSS modules, no styled-components
- Match the existing app's glass-morphism card style
- Accent color: `#e8943a` (ACCENT), secondary: `#c75a2a` (ACCENT2)
- Background: `#f8f8f8`
- Font: `'Outfit', system-ui, -apple-system, sans-serif`
- Border radius: 14px for cards, 24px for pills, 50% for circles
- Consistent with the mockup — every padding, every gradient, every transition

---

## What NOT to Do

- Do NOT use mock data for the "Find People" user search — query real `user_profiles` from Supabase
- Do NOT skip the animated PackingVisual component — it has 18+ visual types, all with CSS transitions. Copy them from the mockup exactly.
- Do NOT simplify the packing step into plain cards — it must have the horizontal pill selector, animated visual, expanded detail card with howItWorks, and green confirmation banner
- Do NOT merge the "Find People", "Family", and "Invite" tabs into one — they are 3 distinct tabs
- Do NOT use any CSS framework
- Do NOT add external state management
- Do NOT skip the friend suggestions step — implement it with a flag check
- Do NOT forget the green confirmation banner on packing selections: "✅ {option} will be saved as your default"
- Do NOT forget to set `onboarding_completed = true` when the user finishes

---

## Files You'll Create/Modify

| File | Action |
|------|--------|
| `types/database.types.ts` | Add gender, age_range, phone, clothing_styles to user_profiles |
| `lib/constants.ts` | Add GENDERS, AGE_RANGES, CLOTHING_STYLES (check they don't already exist) |
| `app/onboarding/page.tsx` | CREATE — server component, auth check, fetch profile, redirect if completed |
| `app/onboarding/onboarding-page.tsx` | CREATE — client component, full 7-step wizard |
| `middleware.ts` | MODIFY — add onboarding redirect for users who haven't completed it |
| `app/auth/callback/route.ts` | MODIFY — redirect new users to /onboarding instead of /dashboard |

---

## Reference: The Mockup

The complete approved mockup is at `onboarding-flow-mockup.jsx` in the project root. It contains:
- All data constants (GENDERS, AGE_RANGES, CLOTHING_STYLES, PACKING_SUB_STEPS with full visual/howItWorks data)
- The complete `PackingVisual` component (all 18+ animated visual types)
- All reusable components (ProgressDots, StepHeader, PillSelector, NavButtons, UserRow)
- All 7 step components (StepProfile, StepDetails, StepStyle, StepPeople, StepFriendSuggestions, StepPacking, StepDone)
- The main OnboardingFlowMockup component with state management and navigation

**The mockup is your spec.** Read it line-by-line. Match the UI exactly. The only difference is that the production version uses real Supabase data instead of mock data, real `AvatarPicker` instead of the placeholder circle, and saves everything to the database.

---

## SQL to Run (copy-paste into Supabase SQL Editor)

```sql
-- Run this BEFORE building the code

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS clothing_styles text[] DEFAULT '{}';
```

---

## After Building — Verify

1. Sign up a brand new user → should be redirected to `/onboarding` (not dashboard)
2. Complete all 7 steps → data should save to `user_profiles` in Supabase
3. Click "Start Planning a Trip" → should go to `/dashboard`
4. Refresh the page → should go to `/dashboard` (not onboarding again, because `onboarding_completed = true`)
5. Existing users who already have `onboarding_completed = true` → should never see onboarding
6. Check the profile page → packing preferences section should show the saved values from onboarding
