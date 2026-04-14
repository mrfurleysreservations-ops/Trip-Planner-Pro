# Build Prompt — Packing Preferences Profile + Invited User Onboarding

## Context
This phase adds packing preferences to user profiles and introduces a lightweight onboarding flow for invited users who sign up via a trip invite link. The goal: by the time someone lands in their first trip's packing section, the system already knows how they like to organize — no configuration needed in the moment.

This should be built **before** Phase 4 (Event-Driven Packing) so packing preferences are available when the packing UI is built.

---

## What Gets Built

1. **Database:** `packing_preferences` columns on `user_profiles` (JSONB) + migration SQL
2. **Constants:** New packing preference options in `lib/constants.ts`
3. **Profile UI:** New "Packing Preferences" section on the existing `/profile` page
4. **Onboarding flow:** `/welcome` page — a short step-by-step wizard for new users (especially invitees)
5. **Redirect logic:** After first login (no preferences set), redirect to `/welcome` instead of `/dashboard`

---

## Prompts

### Prompt 1 — Database: Add packing preferences to user_profiles

```
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read docs/page-hierarchy-v2.md for architecture context. Read types/database.types.ts for the current user_profiles shape.

We're adding packing preferences to user_profiles as a JSONB column. This stores how a person likes to pack so the packing UI can be personalized from their first trip.

Give me the exact SQL to paste into the Supabase SQL Editor that does the following:

1. Add a `packing_preferences` column (jsonb, nullable, default null) to user_profiles
2. Add an `onboarding_completed` column (boolean, default false) to user_profiles — tracks whether the user has gone through the welcome wizard
3. Comment the column so future devs know the expected shape

The JSONB shape should be:
{
  "packing_style": "planner" | "minimalist" | "overpacker" | "spontaneous" | "hyper_organizer",
  "organization_method": "by_day" | "by_category" | "by_activity" | "by_outfit" | "no_preference",
  "folding_method": "rolling" | "konmari" | "bundle" | "flat_fold" | "no_preference",
  "compartment_system": "packing_cubes" | "compression_bags" | "ziplock" | "none" | "no_preference",
  "checklist_level": "minimal" | "standard" | "detailed" | "obsessive",
  "planning_timeline": "weeks_ahead" | "days_ahead" | "night_before" | "morning_of",
  "just_in_case": "only_planned" | "few_extras" | "every_scenario",
  "visual_planning": "lay_out_physical" | "digital_preview" | "skip",
  "reusable_templates": true | false
}

Do NOT create a separate table for this — it's a single JSONB column on user_profiles. Preferences change rarely and are always read as a unit.

Also update types/database.types.ts to add packing_preferences (Json | null) and onboarding_completed (boolean) to the user_profiles Row and Insert types. Follow the existing pattern exactly.
```

### Prompt 2 — Constants: Packing preference options

```
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read lib/constants.ts to see the existing pattern for AGE_TYPES, APPETITE_TYPES, etc.

Add the following packing preference constants to lib/constants.ts, following the same { value, label, icon } pattern. Put them in a new section after APPETITE_TYPES with a comment header "// Packing preferences".

PACKING_STYLES:
- planner — "The Planner" — 📋 — "I lay out outfits for each day and match them to my itinerary"
- minimalist — "The Minimalist" — 🎒 — "One bag, versatile pieces, nothing extra"
- overpacker — "The Overpacker" — 🧳 — "Better to have it and not need it than need it and not have it"
- spontaneous — "The Spontaneous" — ⚡ — "I throw things in last minute and figure it out"
- hyper_organizer — "The Hyper-Organizer" — 🗂️ — "Color-coded cubes, verified checklists, nothing left to chance"

Each constant should have: value, label, icon, and a new field called "description" (the quoted text above). The description is shown during onboarding to help people self-identify.

ORGANIZATION_METHODS:
- by_day — "By Day" — 📅 — "Day 1 cube, Day 2 cube..."
- by_category — "By Category" — 🏷️ — "All tops together, all bottoms together"
- by_activity — "By Activity" — 🎯 — "Beach stuff, dinner stuff, hiking stuff"
- by_outfit — "By Outfit" — 👔 — "Complete outfits grouped together"
- no_preference — "No Preference" — 🤷 — "I don't think about it"

FOLDING_METHODS:
- rolling — "Rolling" — 🌀 — "Roll everything tight to save space"
- konmari — "KonMari File Fold" — 📁 — "Items stand upright so I can see everything"
- bundle — "Bundle Wrapping" — 🎁 — "Wrap clothes around a core for zero wrinkles"
- flat_fold — "Flat Fold" — 📄 — "Traditional fold and stack"
- no_preference — "No Preference" — 🤷 — "Whatever works"

COMPARTMENT_SYSTEMS:
- packing_cubes — "Packing Cubes" — 🧊
- compression_bags — "Compression Bags" — 🫧
- ziplock — "Ziplock Bags" — 🛍️
- none — "Just Toss It In" — 🎲
- no_preference — "No Preference" — 🤷

CHECKLIST_LEVELS:
- minimal — "Minimal" — "Just remind me of the big stuff"
- standard — "Standard" — "A solid checklist I can check off"
- detailed — "Detailed" — "Sub-categories, quantities, the works"
- obsessive — "Obsessive" — "Verification step, repack confirmation, nothing forgotten"

PLANNING_TIMELINES:
- weeks_ahead — "Weeks Before" — 📆
- days_ahead — "A Few Days Before" — 🗓️
- night_before — "Night Before" — 🌙
- morning_of — "Morning Of" — ☀️

JUST_IN_CASE_LEVELS:
- only_planned — "Only What's Planned" — "If it's not on the itinerary, it's not in the bag"
- few_extras — "A Few Extras" — "One backup outfit, just in case"
- every_scenario — "Every Scenario" — "What if there's a pool? What if it snows?"

VISUAL_PLANNING_STYLES:
- lay_out_physical — "Lay It All Out" — 🛏️ — "I spread everything on the bed first"
- digital_preview — "Digital Preview" — 📱 — "Show me a visual checklist on screen"
- skip — "Skip This Step" — ⏭️ — "Just give me the list"

Do NOT add descriptions to existing constants — only the new packing ones. Keep the file clean.
```

### Prompt 3 — Profile UI: Packing Preferences section

```
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read app/profile/page.tsx and app/profile/profile-page.tsx to understand the existing server/client pattern and styling. Read lib/constants.ts for the new packing preference constants you just added.

Add a new "Packing Preferences" section to the existing profile page. This goes BELOW the user profile card (name, avatar, email) and ABOVE the family management section.

Requirements:
1. The server component (page.tsx) must fetch packing_preferences and onboarding_completed from user_profiles and pass them to the client component
2. The client component renders a collapsible "Packing Preferences" card using the existing glass-morphism card style
3. Each preference is shown as a row with the label on the left and the current selection on the right
4. Clicking any row opens an inline selector (pill buttons for each option, like how AGE_TYPES work on the member card)
5. Changes save immediately to Supabase on selection (optimistic update, same pattern as the name/avatar save)
6. If packing_preferences is null (user hasn't set them yet), show a friendly message: "Set your packing style to personalize your trip packing experience" with a "Set Up Now" button that expands all preferences for editing
7. Use the accent color from THEMES.home since this is the profile page (not trip-scoped)
8. Show the icon + label for each selected option. Show the description text only while editing/selecting.

The preferences to show (in this order):
- Packing Style (PACKING_STYLES)
- Organization Method (ORGANIZATION_METHODS)
- Checklist Level (CHECKLIST_LEVELS)
- Planning Timeline (PLANNING_TIMELINES)
- "Just in Case" Level (JUST_IN_CASE_LEVELS)
- Visual Planning (VISUAL_PLANNING_STYLES)
- Folding Method (FOLDING_METHODS)
- Compartment System (COMPARTMENT_SYSTEMS)
- Reusable Templates (simple on/off toggle)

Group them visually:
- "How You Pack" — packing style, organization method, folding method, compartment system
- "How Much You Plan" — checklist level, planning timeline, just in case level, visual planning
- "Shortcuts" — reusable templates toggle

Do NOT create a separate component file for this. Keep it inline in profile-page.tsx consistent with how MemberDetailCard and everything else is structured there. Only extract a component if there's a clear reuse case (there isn't one yet).
```

### Prompt 4 — Welcome Wizard: Onboarding for new/invited users

```
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read the existing app architecture: app/profile/page.tsx for the server/client pattern, lib/constants.ts for the packing constants, and the existing trip page styling for glass-morphism cards.

Build a lightweight onboarding wizard at /welcome that new users (especially those joining via a trip invite) are redirected to on first login.

Architecture:
- app/welcome/page.tsx (server component — check auth, check if onboarding_completed, redirect to /dashboard if already done)
- app/welcome/welcome-page.tsx (client component — the wizard UI)

The wizard has 4 quick steps (NOT a long form — this should feel fast and friendly):

**Step 1: "Hey, welcome! Let's get you set up." (5 seconds)**
- Show their name (pre-filled from auth)
- Quick avatar pick (reuse or reference the existing AvatarPicker component)
- "This takes about 60 seconds. You can always change this later in your profile."
- Next button

**Step 2: "How do you pack?" (the fun one)**
- Show PACKING_STYLES as large selectable cards (icon, label, description)
- Single select — tap one to pick it
- Below that, show JUST_IN_CASE_LEVELS as smaller pill options ("While we're at it... how much 'just in case' do you pack?")
- These two questions are the most personality-defining, so they get their own step
- Next + Back buttons

**Step 3: "How do you like to organize?" (quick picks)**
- Three rows, each with pill selectors:
  - Organization method (ORGANIZATION_METHODS)
  - Checklist level (CHECKLIST_LEVELS)
  - Visual planning preference (VISUAL_PLANNING_STYLES)
- These are presented more compactly — label on top, pills below
- Each has a sensible default pre-selected: by_category, standard, digital_preview
- Next + Back buttons

**Step 4: "You're all set!"**
- Summary of what they picked (icon + label for each)
- "You can change any of these in your profile anytime"
- Two buttons:
  - "Take me to my trip" (if they have a pending trip invite → redirect to that trip)
  - "Go to dashboard" (default)
- Save all preferences to user_profiles.packing_preferences as JSONB
- Set onboarding_completed = true

Styling rules:
- Full-screen steps with centered content, not in the regular app shell/tab bar (the user isn't "in the app" yet)
- Use THEMES.home accent color
- Glass-morphism card for the content area
- Smooth transitions between steps (simple CSS fade, no animation library)
- Mobile-first — this will almost certainly be hit on a phone from a text invite link
- Progress indicator (4 dots at the top showing which step you're on)

Skip logic:
- Every step has a small "Skip for now" link at the bottom that jumps to dashboard with onboarding_completed = true and null preferences (they can set them later in profile)
- The wizard should NEVER block someone from getting to their trip

For folding method, compartment system, and planning timeline — do NOT include these in the wizard. They're lower-priority and available in the profile page for users who want to fine-tune. The wizard should be fast, not exhaustive.
```

### Prompt 5 — Redirect Logic: Route new users to welcome wizard

```
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read the existing middleware or auth flow to understand how users are routed after login. Read app/page.tsx (the root route) and any middleware.ts if it exists.

Add redirect logic so that authenticated users who have NOT completed onboarding (onboarding_completed = false or null on user_profiles) are redirected to /welcome instead of /dashboard.

Rules:
1. This check should happen in the dashboard server component (app/dashboard/page.tsx or wherever the main redirect lives), NOT in middleware. Middleware runs on every request and this only matters on the dashboard landing.
2. Query user_profiles for onboarding_completed. If false/null → redirect("/welcome").
3. The /welcome page itself checks onboarding_completed and redirects to /dashboard if already true (prevent re-showing the wizard).
4. The /trip/[id] pages should NOT redirect to welcome — if someone clicks a trip invite link, they should be able to go directly to the trip. The welcome wizard is a suggestion, not a gate.
5. If for some reason user_profiles doesn't have a row yet (edge case with new signups), create the row with default values before redirecting to /welcome.

This should be a minimal change — don't refactor the auth flow. Just add the onboarding check in the right place.
```

---

## Build Order
1. **Prompt 1** — Run the SQL in Supabase, update types
2. **Prompt 2** — Add constants (no dependencies)
3. **Prompt 3** — Profile UI (depends on 1 + 2)
4. **Prompt 4** — Welcome wizard (depends on 1 + 2, but can be built in parallel with 3)
5. **Prompt 5** — Redirect wiring (depends on 4)

## What This Unlocks for Phase 4 (Event-Driven Packing)
When building the packing UI, you can query `user_profiles.packing_preferences` to:
- Default the packing view to "by day" vs "by category" vs "by outfit" based on their organization_method
- Show the consolidation/"bed spread" view prominently for `lay_out_physical` users
- Auto-generate more detailed checklists for `detailed` and `obsessive` checklist_level users
- Suggest "just in case" items for `few_extras` and `every_scenario` users
- Show verification/repack confirmation for `obsessive` users
- Pre-select reusable template options for users who want them
