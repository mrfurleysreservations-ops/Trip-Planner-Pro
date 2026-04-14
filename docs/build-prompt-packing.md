# Phase 4: Event-Driven Packing — Build Prompt

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## What You're Building

The packing page at `/trip/[id]/packing`. This is the biggest feature of the app — it replaces the old standalone suitcase system with an itinerary-driven packing experience. The core idea: instead of "what's in my suitcase?" the app asks "what am I doing on Day 1 evening?" and helps you pick an outfit for THAT event.

There are **three views** inside packing:
1. **Event Walk-Through** — step through events one at a time, build outfits per event, browse Pinterest inspo
2. **Consolidation ("The Bed Spread")** — see ALL items across all events, find duplicates, pare down
3. **Final Checklist (Pack & Go)** — check off items as you physically pack them

**CRITICAL PRIVACY RULE:** A user can ONLY see packing for themselves and their own family members (from `family_members` table where `family_id` matches their family). They cannot see what friends or other trip members are packing. The person tabs at the top show ONLY the logged-in user + their family members who are trip members on this trip.

---

## Tech Stack & Patterns (follow exactly)

- **Framework:** Next.js 14 (App Router) with React 18, TypeScript
- **Database:** Supabase (PostgreSQL with Row-Level Security)
- **Styling:** Inline CSS only (no Tailwind, no CSS modules). Use existing glass-morphism card patterns.
- **State:** React hooks + Supabase client (no external state library)
- **Pattern:** Server component (`page.tsx`) fetches all data → passes to client component (`packing-page.tsx`)
- **Fonts:** `'DM Sans', sans-serif` for body, `'Outfit', sans-serif` for headings (fontWeight: 800)
- **Theme:** Use `THEMES[trip.trip_type]` from `@/lib/constants` — provides `bg`, `accent`, `text`, `muted`, `card`, `cardBorder`, `headerBg`, `vibeBg`
- **Activity logging:** Use `logActivity` from `@/lib/trip-activity` after every mutation (add, edit, delete, toggle)
- **Client Supabase:** `createBrowserSupabaseClient()` from `@/lib/supabase/client`
- **Server Supabase:** `createServerSupabaseClient()` from `@/lib/supabase/server`

### Styling Reference (exact values from existing pages)

**Badges:**
```
padding: "2px 8px", borderRadius: 10, fontSize: "10px", fontWeight: 700,
textTransform: "uppercase", letterSpacing: "0.04em"
```

**Cards:**
```
background: "white" or theme.card, borderRadius: "16px",
border: `1px solid ${th.cardBorder}`, overflow: "hidden",
boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
```

**Sub-nav tabs:**
```
padding: "10px 16px", fontSize: "13px", fontWeight: 700 (active) / 500 (inactive),
borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
color: active ? th.accent : th.muted
```

---

## Step 1: Database — Run This SQL in Supabase SQL Editor

```sql
-- ═══════════════════════════════════════════════════════════
--  PACKING TABLES — Phase 4
-- ═══════════════════════════════════════════════════════════

-- 1. Packing items (individual items per person per event)
CREATE TABLE packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  event_id UUID REFERENCES itinerary_events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  is_packed BOOLEAN NOT NULL DEFAULT false,
  is_multi_use BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Packing outfits (outfit grouping per event per person)
CREATE TABLE packing_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
  name TEXT,
  notes TEXT,
  inspo_image_url TEXT,
  inspo_source_url TEXT,
  inspo_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_member_id, event_id)
);

-- 3. Junction: which items belong to which outfit
CREATE TABLE outfit_packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES packing_outfits(id) ON DELETE CASCADE,
  packing_item_id UUID NOT NULL REFERENCES packing_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(outfit_id, packing_item_id)
);

-- Indexes for performance
CREATE INDEX idx_packing_items_trip ON packing_items(trip_id);
CREATE INDEX idx_packing_items_member ON packing_items(trip_member_id);
CREATE INDEX idx_packing_items_event ON packing_items(event_id);
CREATE INDEX idx_packing_outfits_trip ON packing_outfits(trip_id);
CREATE INDEX idx_packing_outfits_member ON packing_outfits(trip_member_id);
CREATE INDEX idx_packing_outfits_event ON packing_outfits(event_id);
CREATE INDEX idx_outfit_packing_items_outfit ON outfit_packing_items(outfit_id);

-- RLS policies
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_packing_items ENABLE ROW LEVEL SECURITY;

-- Packing items: users can manage items for trip members in their family
CREATE POLICY "Users can view packing items for their trip members"
  ON packing_items FOR SELECT
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_items.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert packing items for their trip members"
  ON packing_items FOR INSERT
  WITH CHECK (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_items.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update packing items for their trip members"
  ON packing_items FOR UPDATE
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_items.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete packing items for their trip members"
  ON packing_items FOR DELETE
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_items.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

-- Packing outfits: same family-scoped access
CREATE POLICY "Users can view packing outfits for their trip members"
  ON packing_outfits FOR SELECT
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_outfits.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert packing outfits for their trip members"
  ON packing_outfits FOR INSERT
  WITH CHECK (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_outfits.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update packing outfits for their trip members"
  ON packing_outfits FOR UPDATE
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_outfits.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete packing outfits for their trip members"
  ON packing_outfits FOR DELETE
  USING (
    trip_member_id IN (
      SELECT tm.id FROM trip_members tm
      WHERE tm.trip_id = packing_outfits.trip_id
      AND (
        tm.user_id = auth.uid()
        OR tm.family_member_id IN (
          SELECT fm.id FROM family_members fm
          JOIN families f ON fm.family_id = f.id
          WHERE f.owner_id = auth.uid()
        )
      )
    )
  );

-- Outfit packing items: cascade from outfit access
CREATE POLICY "Users can view outfit packing items"
  ON outfit_packing_items FOR SELECT
  USING (
    outfit_id IN (SELECT id FROM packing_outfits)
  );

CREATE POLICY "Users can insert outfit packing items"
  ON outfit_packing_items FOR INSERT
  WITH CHECK (
    outfit_id IN (SELECT id FROM packing_outfits)
  );

CREATE POLICY "Users can update outfit packing items"
  ON outfit_packing_items FOR UPDATE
  USING (
    outfit_id IN (SELECT id FROM packing_outfits)
  );

CREATE POLICY "Users can delete outfit packing items"
  ON outfit_packing_items FOR DELETE
  USING (
    outfit_id IN (SELECT id FROM packing_outfits)
  );
```

---

## Step 2: Update `types/database.types.ts`

Add these three tables to the `Database` interface inside `public.Tables`, and add convenience aliases at the bottom:

```typescript
// Add inside Database > public > Tables:

      packing_items: {
        Row: {
          id: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string | null;
          name: string;
          category: string;
          is_packed: boolean;
          is_multi_use: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_member_id: string;
          event_id?: string | null;
          name: string;
          category?: string;
          is_packed?: boolean;
          is_multi_use?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      packing_outfits: {
        Row: {
          id: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string;
          name: string | null;
          notes: string | null;
          inspo_image_url: string | null;
          inspo_source_url: string | null;
          inspo_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string;
          name?: string | null;
          notes?: string | null;
          inspo_image_url?: string | null;
          inspo_source_url?: string | null;
          inspo_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      outfit_packing_items: {
        Row: {
          id: string;
          outfit_id: string;
          packing_item_id: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          outfit_id: string;
          packing_item_id: string;
          sort_order?: number;
        };
      };

// Add convenience aliases at the bottom of the file:

export type PackingItem = Database["public"]["Tables"]["packing_items"]["Row"];
export type PackingItemInsert = Database["public"]["Tables"]["packing_items"]["Insert"];
export type PackingOutfit = Database["public"]["Tables"]["packing_outfits"]["Row"];
export type PackingOutfitInsert = Database["public"]["Tables"]["packing_outfits"]["Insert"];
export type OutfitPackingItem = Database["public"]["Tables"]["outfit_packing_items"]["Row"];
export type OutfitPackingItemInsert = Database["public"]["Tables"]["outfit_packing_items"]["Insert"];
```

---

## Step 3: Add Packing Constants to `lib/constants.ts`

Add these at the bottom of the existing constants file:

```typescript
// Packing item categories (for the packing page item categorization)
export const PACKING_CATEGORIES = [
  { value: "tops", label: "Tops", icon: "👕" },
  { value: "bottoms", label: "Bottoms", icon: "👖" },
  { value: "dresses", label: "Dresses", icon: "👗" },
  { value: "outerwear", label: "Outerwear", icon: "🧥" },
  { value: "shoes", label: "Shoes", icon: "👟" },
  { value: "accessories", label: "Accessories", icon: "💍" },
  { value: "swimwear", label: "Swimwear", icon: "👙" },
  { value: "activewear", label: "Activewear", icon: "🏃" },
  { value: "sleepwear", label: "Sleepwear", icon: "😴" },
  { value: "toiletries", label: "Toiletries", icon: "🧴" },
  { value: "gear", label: "Gear", icon: "🎒" },
  { value: "documents", label: "Documents", icon: "📄" },
  { value: "electronics", label: "Electronics", icon: "🔌" },
  { value: "other", label: "Other", icon: "📦" },
] as const;

// Dress code to suggested item categories mapping
export const DRESS_CODE_SUGGESTIONS: Record<string, { categories: string[]; essentials: string[] }> = {
  casual: { categories: ["tops", "bottoms", "shoes", "accessories"], essentials: ["Comfortable top", "Casual pants/shorts", "Sneakers or sandals"] },
  smart_casual: { categories: ["tops", "bottoms", "dresses", "shoes", "accessories"], essentials: ["Nice blouse or button-down", "Dress pants or skirt", "Closed-toe shoes or heeled sandals"] },
  formal: { categories: ["tops", "bottoms", "dresses", "shoes", "accessories", "outerwear"], essentials: ["Dress or suit", "Dress shoes", "Formal accessories"] },
  active: { categories: ["activewear", "shoes", "accessories", "gear"], essentials: ["Athletic top", "Athletic shorts/leggings", "Athletic shoes", "Water bottle"] },
  swimwear: { categories: ["swimwear", "shoes", "accessories", "toiletries"], essentials: ["Swimsuit", "Coverup or sarong", "Sandals/flip flops", "Sunscreen", "Sunglasses"] },
  outdoor: { categories: ["tops", "bottoms", "outerwear", "shoes", "gear"], essentials: ["Moisture-wicking top", "Hiking pants/shorts", "Hiking boots or trail shoes", "Hat"] },
  business: { categories: ["tops", "bottoms", "dresses", "shoes", "accessories"], essentials: ["Business suit or blazer", "Dress shirt or blouse", "Dress shoes", "Professional bag"] },
};
```

---

## Step 4: Server Component — `app/trip/[id]/packing/page.tsx`

Replace the existing file. Follow the exact pattern from the itinerary server page:

```typescript
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, UserProfile, FamilyMember } from "@/types/database.types";
import PackingPage from "./packing-page";

export interface PackingPageProps {
  trip: Trip;
  members: TripMember[];
  events: ItineraryEvent[];
  participants: EventParticipant[];
  packingItems: PackingItem[];
  packingOutfits: PackingOutfit[];
  outfitPackingItems: OutfitPackingItem[];
  userProfile: UserProfile;
  familyMembers: FamilyMember[];
  userId: string;
  isHost: boolean;
}

export default async function PackingServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) redirect("/dashboard");

  const isHost = trip.owner_id === user.id;

  // Fetch user profile (for packing preferences, clothing styles, gender)
  const { data: userProfile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();

  // Fetch user's family members (for the family-only person tabs)
  const { data: families } = await supabase.from("families").select("*").eq("owner_id", user.id);
  const familyIds = (families ?? []).map(f => f.id);
  let familyMembers: FamilyMember[] = [];
  if (familyIds.length > 0) {
    const { data } = await supabase.from("family_members").select("*").in("family_id", familyIds);
    familyMembers = (data ?? []) as FamilyMember[];
  }

  // Fetch trip members (accepted only)
  const { data: members } = await supabase.from("trip_members").select("*").eq("trip_id", id).order("created_at");

  // Fetch itinerary events
  const { data: events } = await supabase.from("itinerary_events").select("*").eq("trip_id", id).order("date").order("sort_order");

  // Fetch event participants
  const eventIds = (events ?? []).map(e => e.id);
  let participants: EventParticipant[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase.from("event_participants").select("*").in("event_id", eventIds);
    participants = (data ?? []) as EventParticipant[];
  }

  // Fetch packing items (RLS ensures only family-scoped items returned)
  const { data: packingItems } = await supabase.from("packing_items").select("*").eq("trip_id", id).order("sort_order");

  // Fetch packing outfits (RLS ensures only family-scoped)
  const { data: packingOutfits } = await supabase.from("packing_outfits").select("*").eq("trip_id", id);

  // Fetch outfit-packing-item junctions
  const outfitIds = (packingOutfits ?? []).map(o => o.id);
  let outfitPackingItems: OutfitPackingItem[] = [];
  if (outfitIds.length > 0) {
    const { data } = await supabase.from("outfit_packing_items").select("*").in("outfit_id", outfitIds);
    outfitPackingItems = (data ?? []) as OutfitPackingItem[];
  }

  return (
    <PackingPage
      trip={trip as Trip}
      members={(members ?? []) as TripMember[]}
      events={(events ?? []) as ItineraryEvent[]}
      participants={participants}
      packingItems={(packingItems ?? []) as PackingItem[]}
      packingOutfits={(packingOutfits ?? []) as PackingOutfit[]}
      outfitPackingItems={outfitPackingItems}
      userProfile={userProfile as UserProfile}
      familyMembers={familyMembers}
      userId={user.id}
      isHost={isHost}
    />
  );
}
```

---

## Step 5: Client Component — `app/trip/[id]/packing/packing-page.tsx`

This is the main build. Use `"use client"` at top. Import:

```typescript
"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, EVENT_TYPES, DRESS_CODES, TIME_SLOTS, PACKING_CATEGORIES, DRESS_CODE_SUGGESTIONS, PACKING_STYLES, ORGANIZATION_METHODS, COMPARTMENT_SYSTEMS, CLOTHING_STYLES } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, UserProfile, FamilyMember } from "@/types/database.types";
import type { PackingPageProps } from "./page";
import TripSubNav from "../trip-sub-nav";
```

### Person Tab Logic (FAMILY-ONLY)

Determine which trip members to show as tabs:

```typescript
// The logged-in user's trip_member record
const currentMember = members.find(m => m.user_id === userId);

// Family member IDs owned by this user
const myFamilyMemberIds = new Set(familyMembers.map(fm => fm.id));

// Trip members that belong to the user's family (user_id matches OR family_member_id is in user's family)
const myFamilyTripMembers = members.filter(m =>
  m.status === "accepted" && (
    m.user_id === userId ||
    (m.family_member_id && myFamilyMemberIds.has(m.family_member_id))
  )
);
```

Show tabs ONLY for `myFamilyTripMembers`. Default the active tab to `currentMember`.

### Packing Preferences

Parse the logged-in user's preferences from `userProfile.packing_preferences` (it's JSONB stored as `Json`):

```typescript
const packingPrefs = useMemo(() => {
  const raw = userProfile?.packing_preferences;
  if (!raw || typeof raw !== "object") return null;
  return raw as {
    packing_style?: string;
    organization_method?: string;
    folding_method?: string;
    compartment_system?: string;
    checklist_level?: string;
    planning_timeline?: string;
    just_in_case?: string;
    visual_planning?: string;
  };
}, [userProfile]);

const packingStyle = packingPrefs?.packing_style || "planner";
const orgMethod = packingPrefs?.organization_method || "by_category";
const compartmentSystem = packingPrefs?.compartment_system || "no_preference";
const checklistLevel = packingPrefs?.checklist_level || "standard";
const visualPlanning = packingPrefs?.visual_planning || "digital_preview";
const justInCase = packingPrefs?.just_in_case || "few_extras";
```

### Events for Active Member

Filter events to only those the active member is attending:

```typescript
const activeMemberEvents = useMemo(() => {
  const memberParticipations = participants.filter(
    p => p.trip_member_id === activeMemberId && p.status === "attending"
  );
  const attendingEventIds = new Set(memberParticipations.map(p => p.event_id));
  return events
    .filter(e => e.date && attendingEventIds.has(e.id))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date! < b.date! ? -1 : 1;
      const slotOrder: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };
      return (slotOrder[a.time_slot] || 0) - (slotOrder[b.time_slot] || 0);
    });
}, [events, participants, activeMemberId]);
```

---

### VIEW 1: Event Walk-Through

This is the default view. A carousel of event cards.

**State needed:**
- `currentEventIdx` — which event card is showing
- `showInspoPanel` — boolean, toggles the Pinterest inspo grid
- `activeView` — "walkthrough" | "consolidation" | "checklist"

**Event Card Layout (top to bottom):**

1. **Event Header** — date/time, event type icon, title, location, weather forecast (use trip location + date to show temp estimate), dress code badge
2. **Pinterest Inspo Section** — "Get Inspo" button toggles a panel
   - Shows a search query string built from: `{user clothing_styles} + {dress_code label} + {event_type} + outfit + {gender} + {season from trip dates}`
   - Opens Pinterest in an embedded context. Implementation: use a link that opens `https://pinterest.com/search/pins/?q={encoded_query}` in a new tab — label the button "Browse on Pinterest". Save the concept: when user returns, they can paste a Pinterest pin URL or type a description of their vibe into an "inspo notes" text field that saves to `packing_outfits.inspo_source_url` and `packing_outfits.inspo_label`.
   - Show saved inspo reference at top of section if one exists
3. **Outfit Builder** — list of packing items for this event
   - Show existing items from `packing_items` where `event_id` matches
   - "Add Item" button opens inline form: item name input + category dropdown (from `PACKING_CATEGORIES`)
   - Each item row: icon (from category), name, category badge, multi-use indicator
   - Items can be edited (tap name to edit inline) or deleted (swipe or X button)
   - Show dress-code-based suggestions from `DRESS_CODE_SUGGESTIONS` that the user can tap to quick-add
   - Multi-use detection: if an item with the same name exists for another event, show "↻ Also for: {other event title}" and mark `is_multi_use = true`

**Navigation:** Previous/Next buttons below the card. Dot indicators showing progress.

**CRUD Operations:**
- **Add item:** Insert into `packing_items` with `trip_id`, `trip_member_id`, `event_id`, `name`, `category`. Also create/update `packing_outfits` row for this member+event, and insert into `outfit_packing_items` junction.
- **Edit item:** Update `packing_items` row (name, category)
- **Delete item:** Delete from `packing_items` (cascade removes junction rows)
- **Save inspo:** Upsert into `packing_outfits` with `inspo_source_url`, `inspo_label`

---

### VIEW 2: Consolidation ("The Bed Spread")

**Summary Stats Row:** Three cards showing: Total Items count, Multi-Use Items count, Events count.

**Bag Capacity Gauge (Minimalist only):** If `packingStyle === "minimalist"`, show a progress bar with target of 25 items and a warning if over.

**The Grid:** All packing items for the active member, deduplicated by name. Group by the user's `orgMethod`:
- `by_category` → group by `category` field
- `by_day` → group by the event's date
- `by_activity` → group by event's `event_type`
- `by_outfit` → group by event (each event's items as a group)
- `no_preference` → default to `by_category`

Each item shows as a pill/chip: name, event count badge if >1 (e.g., "×3"), multi-use icon ↻.

**Multi-Use Items Section:** Below the grid, list items that appear in 2+ events. Show which events they're used for. These items only need to be packed once.

**Packing Tips:** Based on `compartmentSystem`, show a contextual tip at the bottom (e.g., packing cubes users get cube count recommendations, compression bag users get bulk item tips).

**Actions:**
- Tap an item to toggle `is_multi_use`
- Remove duplicates: if same item appears for multiple events, it exists as separate `packing_items` rows but the consolidation view collapses them visually and the checklist counts them once

---

### VIEW 3: Final Checklist (Pack & Go)

**Progress Bar:** `{packed}/{total}` with animated fill bar. Green when complete with "All packed!" message.

**Checklist:** All items grouped by category (or user's org method). Each item is a tappable row with:
- Checkbox (styled, not native) — toggles `is_packed` on the `packing_items` row
- Item name (strikethrough when packed)
- Multi-use badge if applicable
- Category progress counter per group header (e.g., "3/5")

**"Don't Forget" Section:** A fixed section at bottom with universal essentials: Phone charger, Medications, Passport/ID, Travel insurance docs. These are NOT stored in DB — they're hardcoded reminders with local-only checkboxes (use component state, not DB).

**Packing Style Variations:**
- **Overpacker:** Show an additional "Just-in-Case Extras" section below the main checklist with suggested backup items (backup dinner outfit, rain jacket, extra shoes, warm layer, loungewear). These ARE stored in DB as `packing_items` with `event_id = null` (general items, not tied to an event).
- **Hyper-Organizer:** Show a "Verification" button at bottom that requires ALL items to be checked before it becomes active. When tapped, shows a confirmation message.
- **Minimalist:** Show the bag capacity gauge at the top of the checklist too.
- **Spontaneous:** Simplify the checklist — show category-level counts instead of individual items (e.g., "Tops (5)" as a collapsible group). Still allow drilling into individual items.

**CRUD:** Toggle `is_packed` — update `packing_items` row immediately on tap (optimistic update pattern).

---

## Empty States

- **No events yet:** Show message "Build your itinerary first — packing is driven by your events." with a link button to `/trip/[id]/itinerary`.
- **No items for an event:** Show dress-code-based suggestions from `DRESS_CODE_SUGGESTIONS` with "Add" buttons.
- **No family members on trip:** Show only the logged-in user's tab (no family tabs).

---

## What NOT to Do

- Do NOT show packing for other people's families — only the logged-in user and their family members
- Do NOT create a standalone `/packing` page — this only exists inside `/trip/[id]/packing`
- Do NOT use external state management — React hooks + Supabase only
- Do NOT introduce Tailwind or CSS modules — inline styles only
- Do NOT use native HTML checkboxes — style custom checkboxes matching the app's design
- Do NOT hardcode mock data — all data comes from Supabase queries
- Do NOT skip activity logging — log every add, edit, delete action
- Do NOT forget the `TripSubNav` component at the top of the page (import from `../trip-sub-nav`)
- Do NOT create wrapper components or utility layers unless there's clear reuse — keep it flat and readable

---

## File Checklist

When complete, you should have modified or created:

1. ✅ SQL executed in Supabase (3 new tables + RLS + indexes)
2. ✅ `types/database.types.ts` — 3 new table types + 6 new convenience aliases
3. ✅ `lib/constants.ts` — `PACKING_CATEGORIES` and `DRESS_CODE_SUGGESTIONS` added
4. ✅ `app/trip/[id]/packing/page.tsx` — server component (replaced placeholder)
5. ✅ `app/trip/[id]/packing/packing-page.tsx` — client component (replaced placeholder)

Reference the mockup at `packing-mockup.jsx` in the project root — it shows the visual layout and interaction patterns for all three views. The mockup uses hardcoded data but the real build must use Supabase for everything.
