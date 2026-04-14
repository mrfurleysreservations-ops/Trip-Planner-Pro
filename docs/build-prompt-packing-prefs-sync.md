# Build Prompt: Sync Packing Preferences Across Onboarding, Profile & Packing Page

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Context

We just rebuilt the packing page to gate features by packing style. The 5 styles (planner, minimalist, overpacker, spontaneous, hyper_organizer) each get a tailored flow — Spontaneous gets a 3-step Quick Pick, everyone else gets the full Group → Outfits → Consolidate → Pack & Go flow with style-specific extras.

The problem: the onboarding wizard still asks 4 sub-questions after packing style (organization method, folding method, compartment system), and the profile page shows 8+ granular settings. Most of these are derivable from the packing style itself. A spontaneous packer going through 4 screens about how they fold is wasted friction.

## What to Build

### 1. Add a Style Defaults Map to `lib/constants.ts`

Add a new export `PACKING_STYLE_DEFAULTS` that maps each packing style to its smart defaults for all sub-preferences. Add this right after the existing `getDailyEssentials` function (around line 357):

```typescript
export const PACKING_STYLE_DEFAULTS: Record<string, {
  organization_method: string;
  folding_method: string;
  compartment_system: string;
  checklist_level: string;
  planning_timeline: string;
  just_in_case_level: string;
  visual_planning: string;
}> = {
  planner: {
    organization_method: "by_outfit",
    folding_method: "no_preference",
    compartment_system: "no_preference",
    checklist_level: "standard",
    planning_timeline: "days_ahead",
    just_in_case_level: "few_extras",
    visual_planning: "digital_preview",
  },
  minimalist: {
    organization_method: "by_category",
    folding_method: "rolling",
    compartment_system: "compression_bags",
    checklist_level: "standard",
    planning_timeline: "days_ahead",
    just_in_case_level: "only_planned",
    visual_planning: "digital_preview",
  },
  overpacker: {
    organization_method: "by_category",
    folding_method: "no_preference",
    compartment_system: "packing_cubes",
    checklist_level: "detailed",
    planning_timeline: "weeks_ahead",
    just_in_case_level: "every_scenario",
    visual_planning: "lay_out_physical",
  },
  spontaneous: {
    organization_method: "no_preference",
    folding_method: "no_preference",
    compartment_system: "none",
    checklist_level: "minimal",
    planning_timeline: "morning_of",
    just_in_case_level: "only_planned",
    visual_planning: "skip",
  },
  hyper_organizer: {
    organization_method: "by_day",
    folding_method: "konmari",
    compartment_system: "packing_cubes",
    checklist_level: "obsessive",
    planning_timeline: "weeks_ahead",
    just_in_case_level: "every_scenario",
    visual_planning: "lay_out_physical",
  },
};
```

### 2. Simplify the Onboarding Packing Step

**File: `app/onboarding/steps/step-packing.tsx`**

Replace the entire 4-sub-step wizard with a **single screen** that only asks packing style. Remove the sub-step dots, the `subStep` state, and the `nextSub`/`prevSub` logic. The component should:

- Show `StepHeader` with step 6 of 7, title "How do you pack?", subtitle "Pick the one that sounds most like you — we'll set everything else up automatically."
- Show the 5 packing style options from `PACKING_SUB_STEPS[0].options` (the existing data)
- Keep the horizontal pill selector, the `PackingVisual` preview, and the expanded detail card — these are great UX for picking a style
- Keep the green confirmation banner
- When a style is selected, call `onChange` with **all preferences at once**: the selected `packingStyle` plus all sub-prefs from `PACKING_STYLE_DEFAULTS`
- The `NavButtons` should show "Save & Continue" (no more sub-steps)

Import `PACKING_STYLE_DEFAULTS` from `@/lib/constants` (not from the onboarding constants).

Here's the updated onChange call when selecting a style:

```typescript
import { PACKING_STYLE_DEFAULTS } from "@/lib/constants";

const selectOption = (idx: number) => {
  setSelectedIndex(idx);
  const style = current.options[idx].value;
  const defaults = PACKING_STYLE_DEFAULTS[style] || {};
  onChange({
    packingStyle: style,
    orgMethod: defaults.organization_method || null,
    foldingMethod: defaults.folding_method || null,
    compartmentSystem: defaults.compartment_system || null,
  } as Partial<OnboardingData>);
};
```

And the component no longer needs `subStep`, `nextSub`, `prevSub`. `onNext` is called directly from NavButtons. `onBack` is called directly.

**File: `app/onboarding/onboarding-page.tsx`**

Update the `saveAndFinish` function (around line 154) to also save the auto-filled sub-preferences that come from the defaults map. Currently it saves:

```typescript
packing_preferences: {
  packing_style: data.packingStyle,
  organization_method: data.orgMethod,
  folding_method: data.foldingMethod,
  compartment_system: data.compartmentSystem,
},
```

Add the extra preferences from the defaults map so they're persisted too:

```typescript
import { PACKING_STYLE_DEFAULTS } from "@/lib/constants";

// Inside saveAndFinish:
const styleDefaults = PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {};
packing_preferences: {
  packing_style: data.packingStyle,
  organization_method: data.orgMethod || styleDefaults.organization_method,
  folding_method: data.foldingMethod || styleDefaults.folding_method,
  compartment_system: data.compartmentSystem || styleDefaults.compartment_system,
  checklist_level: styleDefaults.checklist_level,
  planning_timeline: styleDefaults.planning_timeline,
  just_in_case_level: styleDefaults.just_in_case_level,
  visual_planning: styleDefaults.visual_planning,
},
```

### 3. Update the Profile Page

**File: `app/profile/profile-page.tsx`**

Restructure the packing preferences section to show:

**A. Packing Style — always visible and prominent** when expanded. Show the 5 styles as larger cards (not tiny pills) with their icon, name, and one-line tagline. The selected one should be visually highlighted. When the user changes their style, show a confirmation: "Reset other preferences to match?" with "Reset to Defaults" and "Keep My Settings" buttons. If they choose reset, apply `PACKING_STYLE_DEFAULTS` for the new style to all sub-preferences and save.

**B. "Fine-tune" section — collapsed by default** below the style picker. A toggle/disclosure that says "Fine-tune preferences" with a chevron. When expanded, shows the existing two groups ("How You Pack" and "How Much You Plan") with the same pill-selector UI. All values are pre-filled from the style defaults (or the user's customized values if they've changed them).

To implement this:

1. Import `PACKING_STYLE_DEFAULTS` from `@/lib/constants`.

2. Replace the current `PACKING_PREF_GROUPS` constant (lines 28-47) with two separate groups — one for the style (shown prominently) and one for the fine-tune section:

```typescript
const STYLE_PREF = {
  key: "packing_style" as const,
  label: "Packing Style",
  options: PACKING_STYLES,
};

const FINE_TUNE_GROUPS = [
  {
    label: "How You Pack",
    prefs: [
      { key: "organization_method" as const, label: "Organization Method", options: ORGANIZATION_METHODS },
      { key: "folding_method" as const, label: "Folding Method", options: FOLDING_METHODS },
      { key: "compartment_system" as const, label: "Compartment System", options: COMPARTMENT_SYSTEMS },
    ],
  },
  {
    label: "How Much You Plan",
    prefs: [
      { key: "checklist_level" as const, label: "Checklist Level", options: CHECKLIST_LEVELS },
      { key: "planning_timeline" as const, label: "Planning Timeline", options: PLANNING_TIMELINES },
      { key: "just_in_case_level" as const, label: '"Just in Case" Level', options: JUST_IN_CASE_LEVELS },
      { key: "visual_planning" as const, label: "Visual Planning", options: VISUAL_PLANNING_STYLES },
    ],
  },
];
```

3. Add a new state variable `fineTuneExpanded` (default `false`).

4. Add a handler for when packing style changes:

```typescript
const handleStyleChange = async (newStyle: string) => {
  const defaults = PACKING_STYLE_DEFAULTS[newStyle] || {};
  const updated = {
    ...packingPrefs,
    packing_style: newStyle,
    ...defaults,  // Apply all defaults
  };
  setPackingPrefs(updated);
  setEditingPrefKey(null);
  await supabase.from("user_profiles").update({ packing_preferences: updated }).eq("id", userId);
};
```

5. In the UI, replace the current `PACKING_PREF_GROUPS.map(...)` block with:

**Packing Style section** — Show the 5 styles as pill-style buttons (like current but slightly larger). Selecting one calls `handleStyleChange` which applies ALL defaults at once.

**Fine-tune disclosure** — A clickable row below with text "Fine-tune preferences ›" that toggles `fineTuneExpanded`. When expanded, show `FINE_TUNE_GROUPS` using the same existing pill-selector UI that's already there. Each preference shows its current value (which was auto-filled from the style defaults) and can be individually overridden.

Keep the existing "Shortcuts" section with the Reusable Templates toggle at the bottom.

### 4. Keep the Onboarding Constants Clean

**File: `app/onboarding/constants.ts`**

The `PACKING_SUB_STEPS` array can stay as-is — the first entry (packing style) is still used by the simplified step-packing component for its options, visuals, and descriptions. The other 3 entries (orgMethod, foldingMethod, compartmentSystem) won't be referenced anymore by the wizard but don't hurt anything sitting in the constants file. You can optionally remove them to keep things clean, but it's not required.

## What NOT to Do

- Do not change anything in the packing page (`app/trip/[id]/packing/`) — it already works correctly
- Do not change `lib/constants.ts` beyond adding `PACKING_STYLE_DEFAULTS`
- Do not remove any existing constants (PACKING_STYLES, ORGANIZATION_METHODS, etc.) — the profile page still uses them
- Do not add new database columns — `packing_preferences` JSON field already stores everything
- Do not change the `OnboardingData` interface — keep `orgMethod`, `foldingMethod`, `compartmentSystem` fields, they just get auto-filled now
- Do not change any other onboarding steps (profile, details, style, people, friends, done)
- Do not introduce Tailwind or CSS modules — use inline styles matching existing patterns

## Files to Modify

1. `lib/constants.ts` — Add `PACKING_STYLE_DEFAULTS` export
2. `app/onboarding/steps/step-packing.tsx` — Simplify to single-screen style picker
3. `app/onboarding/onboarding-page.tsx` — Update `saveAndFinish` to persist all defaults
4. `app/profile/profile-page.tsx` — Restructure packing prefs: style prominent, fine-tune collapsed

## Verification

After building, verify:

1. New user onboarding: picking "Spontaneous" on the packing step should auto-fill orgMethod, foldingMethod, compartmentSystem and save all 8 preferences to the database
2. Profile page: changing packing style should update all sub-preferences to match the new style's defaults
3. Profile page: fine-tune section should show all current values and allow individual overrides
4. Packing page: should still work exactly the same — it reads from `packing_preferences` which is now fully populated for every user
