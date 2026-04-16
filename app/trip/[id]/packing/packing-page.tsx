"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, EVENT_TYPES, DRESS_CODES, TIME_SLOTS, PACKING_CATEGORIES, DRESS_CODE_SUGGESTIONS, getDressCodeEssentials, getDailyEssentials } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, OutfitGroup, OutfitGroupEvent, UserProfile, FamilyMember, PackingBag, PackingBagSection, PackingBagContainer, PackingItemAssignment } from "@/types/database.types";
import type { PackingPageProps } from "./page";
import TripSubNav from "../trip-sub-nav";

// ─── Inspo Image type (matches API route response) ───
interface InspoImage {
  id: string;
  url: string;
  urlFull: string;
  thumb: string;
  alt: string;
  color: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

// ─── Helpers ───

const DRESS_CODE_COLORS: Record<string, string> = {
  casual: "#4caf50", smart_casual: "#0097a7", formal: "#7b1fa2",
  active: "#e65100", swimwear: "#00bcd4", outdoor: "#558b2f", business: "#37474f",
};

const CAT_ICON_MAP: Record<string, string> = {};
PACKING_CATEGORIES.forEach(c => { CAT_ICON_MAP[c.value] = c.icon; });

function getCatIcon(cat: string): string {
  return CAT_ICON_MAP[cat] || "📦";
}

function getEventTypeIcon(eventType: string): string {
  const found = EVENT_TYPES.find(e => e.value === eventType);
  return found?.icon || "📌";
}

function getDressCodeLabel(code: string | null): string {
  if (!code) return "";
  const found = DRESS_CODES.find(d => d.value === code);
  return found?.label || code;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getTimeSlotLabel(slot: string): string {
  const found = TIME_SLOTS.find(t => t.value === slot);
  return found?.label || slot;
}

function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

// Infer packing category from item name keywords
function inferCategory(itemName: string): string {
  const lower = itemName.toLowerCase();
  if (/\b(shirt|tee|top|blouse|polo|cami|tank)\b/.test(lower)) return "tops";
  if (/\b(pants|jeans|shorts|chinos|skirt|trousers)\b/.test(lower)) return "bottoms";
  if (/\b(dress|gown|jumpsuit|romper)\b/.test(lower)) return "dresses";
  if (/\b(jacket|blazer|coat|hoodie|sweater|cardigan|sport coat)\b/.test(lower)) return "outerwear";
  if (/\b(shoes|sneakers|boots|loafers|heels|sandals|flats|pumps|flip flops|espadrille)\b/.test(lower)) return "shoes";
  if (/\b(underwear|bra|socks|boxers|briefs|undershirt)\b/.test(lower)) return "undergarments";
  if (/\b(watch|belt|jewelry|earrings|necklace|bracelet|sunglasses|hat|cap|scarf|tie|pocket square|bag|tote|purse|clutch|backpack|daypack)\b/.test(lower)) return "accessories";
  if (/\b(swim|bikini|trunks|rashguard|coverup|sarong)\b/.test(lower)) return "swimwear";
  if (/\b(athletic|leggings|sports bra|sweatband|hair ties)\b/.test(lower)) return "activewear";
  if (/\b(sunscreen|toiletries|spf)\b/.test(lower)) return "toiletries";
  if (/\b(water bottle|gear|dry bag)\b/.test(lower)) return "gear";
  return "other";
}

const STYLE_DESCRIPTIONS: Record<string, { icon: string; label: string; desc: string }> = {
  planner: { icon: "📋", label: "Planner Mode", desc: "Each event gets a mapped outfit based on dress code" },
  minimalist: { icon: "🎒", label: "Minimalist Mode", desc: "Versatile pieces that work across multiple events" },
  overpacker: { icon: "🧳", label: "Overpacker Mode", desc: "Includes backups, contingencies & just-in-case items" },
  spontaneous: { icon: "⚡", label: "Quick Pack Mode", desc: "Essentials only — grab and go" },
  hyper_organizer: { icon: "🗂️", label: "Hyper-Organizer Mode", desc: "Full mapping with verification checklist" },
};

const DONT_FORGET_ITEMS = ["Phone charger", "Medications", "Passport / ID", "Travel insurance docs"];

// Bedtime suggestions — gender-aware
function getBedtimeSuggestions(gender: string | null): { name: string; category: string }[] {
  const base = [
    { name: "Pajama bottoms / sweats", category: "sleepwear" },
    { name: "Sleep shirt", category: "sleepwear" },
    { name: "Slippers or flip flops", category: "shoes" },
  ];
  if (gender === "female") {
    return [
      { name: "Pajama set or nightgown", category: "sleepwear" },
      { name: "Sleep shorts", category: "sleepwear" },
      { name: "Cozy socks", category: "undergarments" },
      { name: "Sleep mask", category: "accessories" },
      { name: "Hair ties / scrunchie", category: "accessories" },
      { name: "Slippers", category: "shoes" },
    ];
  }
  if (gender === "male") {
    return [
      { name: "Pajama pants / sweats", category: "sleepwear" },
      { name: "Sleep shirt or tank", category: "sleepwear" },
      { name: "Slippers or slides", category: "shoes" },
    ];
  }
  return base;
}

// Toiletries & extras suggestions — gender-aware
function getToiletriesAndExtrasSuggestions(gender: string | null): { section: string; items: { name: string; category: string }[] }[] {
  const toiletries: { name: string; category: string }[] = [
    { name: "Toothbrush", category: "toiletries" },
    { name: "Toothpaste", category: "toiletries" },
    { name: "Deodorant", category: "toiletries" },
    { name: "Shampoo", category: "toiletries" },
    { name: "Conditioner", category: "toiletries" },
    { name: "Body wash / soap", category: "toiletries" },
    { name: "Razor", category: "toiletries" },
    { name: "Sunscreen", category: "toiletries" },
    { name: "Lip balm", category: "toiletries" },
  ];
  if (gender === "female") {
    toiletries.push(
      { name: "Makeup bag", category: "toiletries" },
      { name: "Makeup remover", category: "toiletries" },
      { name: "Skincare (moisturizer / serum)", category: "toiletries" },
      { name: "Dry shampoo", category: "toiletries" },
      { name: "Hair brush / comb", category: "toiletries" },
      { name: "Hair dryer / styling tools", category: "toiletries" },
      { name: "Feminine products", category: "toiletries" },
    );
  }
  if (gender === "male") {
    toiletries.push(
      { name: "Shaving cream", category: "toiletries" },
      { name: "Cologne", category: "toiletries" },
      { name: "Hair product / gel", category: "toiletries" },
      { name: "Comb / brush", category: "toiletries" },
    );
  }

  const electronics = [
    { name: "Phone charger", category: "electronics" },
    { name: "Earbuds / headphones", category: "electronics" },
    { name: "Portable battery pack", category: "electronics" },
    { name: "Laptop + charger", category: "electronics" },
    { name: "Camera", category: "electronics" },
    { name: "Adapter / converter", category: "electronics" },
  ];

  const documents = [
    { name: "Passport / ID", category: "documents" },
    { name: "Boarding pass", category: "documents" },
    { name: "Travel insurance info", category: "documents" },
    { name: "Hotel confirmation", category: "documents" },
    { name: "Credit cards / cash", category: "documents" },
  ];

  const misc = [
    { name: "Reusable water bottle", category: "gear" },
    { name: "Travel pillow", category: "gear" },
    { name: "Laundry bag (for dirty clothes)", category: "gear" },
    { name: "Snacks", category: "other" },
    { name: "Book / Kindle", category: "other" },
  ];

  return [
    { section: "Toiletries", items: toiletries },
    { section: "Electronics", items: electronics },
    { section: "Documents", items: documents },
    { section: "Misc", items: misc },
  ];
}

const JUST_IN_CASE_EXTRAS = [
  "Backup dinner outfit", "Rain jacket", "Extra pair of shoes",
  "Warm layer (just in case)", "Loungewear / PJs",
];

// Overpacker bonus suggestions per dress code
function getOverpackerExtras(dressCode: string | null, gender: string | null): string[] {
  const extras: string[] = ["Backup outfit (same vibe)", "Stain remover pen"];
  if (dressCode === "casual" || dressCode === "smart_casual") extras.push("Extra layering piece", "Backup shoes");
  if (dressCode === "formal" || dressCode === "business") extras.push("Lint roller", "Spare tie / pocket square", "Shoe polish wipes", "Wrinkle release spray");
  if (dressCode === "active" || dressCode === "outdoor") extras.push("Extra socks", "Blister bandaids", "Backup athletic shirt", "Compression bag");
  if (dressCode === "swimwear") extras.push("Extra towel", "Backup swimsuit", "Waterproof phone pouch", "After-sun lotion");
  if (gender === "female") extras.push("Bobby pins", "Safety pins", "Fashion tape");
  if (gender === "male") extras.push("Extra undershirt", "Belt (backup)");
  return extras;
}


// ─── Main Component ───

export default function PackingPage({
  trip, members, events, participants, packingItems: initialPackingItems,
  packingOutfits: initialPackingOutfits, outfitPackingItems: initialOutfitPackingItems,
  outfitGroups: initialOutfitGroups, outfitGroupEvents: initialOutfitGroupEvents,
  userProfile, familyMembers, userId, isHost,
  packingBags: initialPackingBags, packingBagSections: initialPackingBagSections,
  packingBagContainers: initialPackingBagContainers, packingItemAssignments: initialPackingItemAssignments,
}: PackingPageProps) {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const th = THEMES[trip.trip_type] || THEMES.home;
  const accent = th.accent;

  // ─── Person tab logic (family-only) ───
  const myFamilyMemberIds = useMemo(() => new Set(familyMembers.map(fm => fm.id)), [familyMembers]);

  const myFamilyTripMembers = useMemo(() =>
    members.filter(m =>
      m.status === "accepted" && (
        m.user_id === userId ||
        (m.family_member_id && myFamilyMemberIds.has(m.family_member_id))
      )
    ), [members, userId, myFamilyMemberIds]);

  const currentMember = members.find(m => m.user_id === userId);
  const [activeMemberId, setActiveMemberId] = useState<string>(currentMember?.id || myFamilyTripMembers[0]?.id || "");

  // ─── Packing preferences ───
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

  const ps = STYLE_DESCRIPTIONS[packingStyle] || STYLE_DESCRIPTIONS.planner;

  // ─── State ───
  const [activeView, setActiveView] = useState<"grouping" | "walkthrough" | "checklist">(packingStyle === "spontaneous" ? "walkthrough" : "grouping");
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [showInspoPanel, setShowInspoPanel] = useState(false);
  const autoGroupingRef = useRef(false); // Guard against concurrent autoGroupEvents calls
  const [items, setItems] = useState<PackingItem[]>(initialPackingItems);
  const [outfits, setOutfits] = useState<PackingOutfit[]>(initialPackingOutfits);
  const [junctions, setJunctions] = useState<OutfitPackingItem[]>(initialOutfitPackingItems);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("other");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [dontForgetChecked, setDontForgetChecked] = useState<Record<string, boolean>>({});
  const [justInCaseItems, setJustInCaseItems] = useState<PackingItem[]>([]);
  // Outfit reuse state
  const [showReuseDropdown, setShowReuseDropdown] = useState(false);
  const [reusingOutfit, setReusingOutfit] = useState(false);
  // Inspo engine state
  const [inspoImages, setInspoImages] = useState<InspoImage[]>([]);
  const [inspoLoading, setInspoLoading] = useState(false);
  const [inspoError, setInspoError] = useState<string | null>(null);
  const [inspoPage, setInspoPage] = useState(1);
  const [inspoHasMore, setInspoHasMore] = useState(false);
  const [uploadingInspo, setUploadingInspo] = useState(false);
  // Quick Pack: quantity-based packing
  const [quickPackQty, setQuickPackQty] = useState<Record<string, number>>({});
  const [quickPackAdded, setQuickPackAdded] = useState(false);

  // ─── Bag hierarchy state ───
  const [bags, setBags] = useState<PackingBag[]>(initialPackingBags);
  const [bagSections, setBagSections] = useState<PackingBagSection[]>(initialPackingBagSections);
  const [bagContainers, setBagContainers] = useState<PackingBagContainer[]>(initialPackingBagContainers);
  const [itemAssignments, setItemAssignments] = useState<PackingItemAssignment[]>(initialPackingItemAssignments);
  const [editingBags, setEditingBags] = useState(false);
  const [newBagName, setNewBagName] = useState("");
  const [addingSectionToBag, setAddingSectionToBag] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [addingContainerToSection, setAddingContainerToSection] = useState<string | null>(null);
  const [newContainerName, setNewContainerName] = useState("");
  const bagSetupRef = useRef<HTMLDivElement>(null);

  // ─── Outfit Group state ───
  const [ofGroups, setOfGroups] = useState<OutfitGroup[]>(initialOutfitGroups);
  const [ofGroupEvents, setOfGroupEvents] = useState<OutfitGroupEvent[]>(initialOutfitGroupEvents);
  const [groupingSelectedId, setGroupingSelectedId] = useState<string | null>(null);
  const [groupingMergeSource, setGroupingMergeSource] = useState<string | null>(null);
  const [groupingActiveDay, setGroupingActiveDay] = useState(0);
  // Essentials quantity state (underwear, socks, bras)
  const [essentialsQty, setEssentialsQty] = useState<Record<string, number>>({});
  const [essentialsAdded, setEssentialsAdded] = useState(false);

  // ─── Events for active member ───
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

  // ─── Trip duration for Quick Pack ───
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return activeMemberEvents.length > 0 ? Math.max(1, new Set(activeMemberEvents.map(e => e.date)).size) : 3;
    const start = new Date(trip.start_date + "T12:00:00");
    const end = new Date(trip.end_date + "T12:00:00");
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [trip.start_date, trip.end_date, activeMemberEvents]);
  const tripNights = Math.max(1, tripDays - 1);

  // ─── Outfit Groups: computed data for active member ───
  const memberOutfitGroups = useMemo(() =>
    ofGroups.filter(g => g.trip_member_id === activeMemberId).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.sort_order - b.sort_order;
    }), [ofGroups, activeMemberId]);

  // Group events by date for the grouping UI
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ItineraryEvent[]>();
    activeMemberEvents.forEach(e => {
      if (!e.date) return;
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    });
    return map;
  }, [activeMemberEvents]);

  // Get events in a specific outfit group
  const getGroupEvents = useCallback((groupId: string): ItineraryEvent[] => {
    const eventIds = ofGroupEvents.filter(ge => ge.outfit_group_id === groupId).map(ge => ge.event_id);
    return activeMemberEvents.filter(e => eventIds.includes(e.id));
  }, [ofGroupEvents, activeMemberEvents]);

  // ─── Auto-group events by dress code per day ───
  // ─── Find events that aren't in ANY outfit group yet ───
  const ungroupedEvents = useMemo(() => {
    const groupedEventIds = new Set(ofGroupEvents.map(ge => ge.event_id));
    return activeMemberEvents.filter(e => !groupedEventIds.has(e.id));
  }, [activeMemberEvents, ofGroupEvents]);

  const autoGroupEvents = useCallback(async () => {
    if (autoGroupingRef.current) return;
    autoGroupingRef.current = true;
    try {
      // Incremental: only group events that aren't in any group yet
      if (ungroupedEvents.length === 0) return;

      // Bucket ungrouped events by date + dress code
      const buckets = new Map<string, ItineraryEvent[]>();
      ungroupedEvents.forEach(evt => {
        const dc = evt.dress_code || "casual";
        const key = `${evt.date}__${dc}`;
        const bucket = buckets.get(key) || [];
        bucket.push(evt);
        buckets.set(key, bucket);
      });

      const newGroups: OutfitGroup[] = [];
      const newGroupEvents: OutfitGroupEvent[] = [];
      let sortOrder = memberOutfitGroups.length;

      for (const [, bucketEvents] of buckets) {
        const firstEvt = bucketEvents[0];
        const date = firstEvt.date!;
        const dressCode = firstEvt.dress_code || "casual";

        // Check if there's an existing group on the same day with the same dress code
        const existingGroup = memberOutfitGroups.find(g => g.date === date && g.dress_code === dressCode);

        if (existingGroup) {
          // Add events to the existing group instead of creating a new one
          for (const evt of bucketEvents) {
            const { data: ge } = await supabase.from("outfit_group_events").insert({
              outfit_group_id: existingGroup.id,
              event_id: evt.id,
            }).select().single();
            if (ge) newGroupEvents.push(ge as OutfitGroupEvent);
          }
        } else {
          // Create a new group
          const label = `${getDressCodeLabel(dressCode)} — ${formatDate(date)}`;
          const { data: group, error } = await supabase.from("outfit_groups").insert({
            trip_id: trip.id,
            trip_member_id: activeMemberId,
            date,
            label,
            dress_code: dressCode,
            sort_order: sortOrder++,
          }).select().single();

          if (error || !group) continue;
          newGroups.push(group as OutfitGroup);

          for (const evt of bucketEvents) {
            const { data: ge } = await supabase.from("outfit_group_events").insert({
              outfit_group_id: group.id,
              event_id: evt.id,
            }).select().single();
            if (ge) newGroupEvents.push(ge as OutfitGroupEvent);
          }
        }
      }

      if (newGroups.length > 0) {
        setOfGroups(prev => [...prev, ...newGroups]);
      }
      if (newGroupEvents.length > 0) {
        setOfGroupEvents(prev => [...prev, ...newGroupEvents]);
      }
    } finally {
      autoGroupingRef.current = false;
    }
  }, [supabase, trip.id, activeMemberId, memberOutfitGroups, ungroupedEvents]);

  // Auto-group whenever there are ungrouped events (works on mount AND when new events appear)
  useEffect(() => {
    if (ungroupedEvents.length > 0) {
      autoGroupEvents();
    }
  }, [ungroupedEvents.length, autoGroupEvents]);

  // ─── Merge two outfit groups ───
  const mergeGroups = useCallback(async (sourceGroupId: string, targetGroupId: string) => {
    // Move all events from source → target
    const sourceEventIds = ofGroupEvents
      .filter(ge => ge.outfit_group_id === sourceGroupId)
      .map(ge => ge.event_id);

    for (const eventId of sourceEventIds) {
      const ge = ofGroupEvents.find(g => g.outfit_group_id === sourceGroupId && g.event_id === eventId);
      if (ge) {
        await supabase.from("outfit_group_events").update({ outfit_group_id: targetGroupId }).eq("id", ge.id);
      }
    }

    // Delete the now-empty source group
    await supabase.from("outfit_groups").delete().eq("id", sourceGroupId);

    setOfGroupEvents(prev => prev.map(ge =>
      ge.outfit_group_id === sourceGroupId ? { ...ge, outfit_group_id: targetGroupId } : ge
    ));
    setOfGroups(prev => prev.filter(g => g.id !== sourceGroupId));
    setGroupingMergeSource(null);
    setGroupingSelectedId(null);
  }, [supabase, ofGroupEvents]);

  // ─── Split an outfit group at a specific event ───
  const splitGroup = useCallback(async (groupId: string, afterEventId: string) => {
    const groupEvts = getGroupEvents(groupId);
    const splitIdx = groupEvts.findIndex(e => e.id === afterEventId);
    if (splitIdx < 0 || splitIdx >= groupEvts.length - 1) return; // Can't split at last event

    const afterEvents = groupEvts.slice(splitIdx + 1);
    const oldGroup = ofGroups.find(g => g.id === groupId);
    if (!oldGroup) return;

    // Create a new group for the split-off events
    const { data: newGroup } = await supabase.from("outfit_groups").insert({
      trip_id: trip.id,
      trip_member_id: activeMemberId,
      date: oldGroup.date,
      label: `${oldGroup.label} (split)`,
      dress_code: oldGroup.dress_code,
      sort_order: oldGroup.sort_order + 1,
    }).select().single();

    if (!newGroup) return;

    // Move events to new group
    for (const evt of afterEvents) {
      const ge = ofGroupEvents.find(g => g.outfit_group_id === groupId && g.event_id === evt.id);
      if (ge) {
        await supabase.from("outfit_group_events").update({ outfit_group_id: newGroup.id }).eq("id", ge.id);
      }
    }

    const afterEventIds = new Set(afterEvents.map(e => e.id));
    setOfGroupEvents(prev => prev.map(ge =>
      ge.outfit_group_id === groupId && afterEventIds.has(ge.event_id) ? { ...ge, outfit_group_id: newGroup.id } : ge
    ));
    setOfGroups(prev => [...prev, newGroup as OutfitGroup]);
    setGroupingSelectedId(null);
  }, [supabase, trip.id, activeMemberId, ofGroups, ofGroupEvents, getGroupEvents]);

  // ─── Essentials: auto-calculate quantities ───
  const essentialsDefaults = useMemo(() => {
    const gender = userProfile?.gender || null;
    const rows: { key: string; icon: string; label: string; defaultQty: number; itemName: string; category: string; note: string }[] = [
      { key: "underwear", icon: "🩲", label: "Underwear", defaultQty: tripDays + 1, itemName: "Underwear", category: "undergarments", note: `${tripDays} days + 1 spare` },
      { key: "socks", icon: "🧦", label: "Socks (pairs)", defaultQty: tripDays, itemName: "Socks", category: "undergarments", note: `1 pair per day` },
    ];
    if (gender === "female") {
      rows.push({ key: "bras", icon: "👙", label: "Bras", defaultQty: Math.min(tripDays, 3), itemName: "Bra", category: "undergarments", note: "Up to 3, rotate" });
    }
    return rows;
  }, [tripDays, userProfile]);

  // Initialize essentials quantities
  useEffect(() => {
    if (Object.keys(essentialsQty).length === 0 && !essentialsAdded) {
      const defaults: Record<string, number> = {};
      essentialsDefaults.forEach(r => { defaults[r.key] = r.defaultQty; });
      setEssentialsQty(defaults);
    }
  }, [essentialsDefaults, essentialsQty, essentialsAdded]);

  // Quick Pack: smart defaults based on trip length & events
  const quickPackDefaults = useMemo(() => {
    const dressCodesPresent = new Set(activeMemberEvents.map(e => e.dress_code).filter(Boolean));
    const hasFormal = dressCodesPresent.has("formal") || dressCodesPresent.has("business");
    const hasSwim = dressCodesPresent.has("swimwear");
    const hasActive = dressCodesPresent.has("active") || dressCodesPresent.has("outdoor");
    const gender = userProfile?.gender || null;

    // Clothing only — undergarments are handled in the Essentials step
    const rows: { key: string; icon: string; label: string; defaultQty: number; itemName: string; category: string; note: string }[] = [
      { key: "tops", icon: "👕", label: "T-shirts / Tops", defaultQty: tripDays, itemName: gender === "female" ? "Top" : "T-shirt", category: "tops", note: `1 per day × ${tripDays} days` },
      { key: "bottoms", icon: "👖", label: gender === "female" ? "Pants / Skirts" : "Pants / Shorts", defaultQty: Math.ceil(tripDays / 2), itemName: gender === "female" ? "Pants / Skirt" : "Pants / Shorts", category: "bottoms", note: "Re-wear every 2 days" },
      { key: "shoes", icon: "👟", label: "Shoes (pairs)", defaultQty: Math.min(2, Math.ceil(dressCodesPresent.size / 2) + 1), itemName: "Shoes", category: "shoes", note: "1 casual + 1 for events" },
      { key: "outerwear", icon: "🧥", label: "Jacket / Layer", defaultQty: 1, itemName: "Jacket", category: "outerwear", note: "1 versatile layer" },
    ];

    // Special event add-ons
    if (hasFormal) {
      rows.push({ key: "formal", icon: "👔", label: gender === "female" ? "Dress / Formal outfit" : "Dress shirt + Slacks", defaultQty: 1, itemName: gender === "female" ? "Formal dress" : "Dress shirt", category: gender === "female" ? "dresses" : "tops", note: "For formal events" });
      if (gender === "male") rows.push({ key: "formal_bottoms", icon: "👖", label: "Dress pants", defaultQty: 1, itemName: "Dress pants", category: "bottoms", note: "For formal events" });
    }
    if (hasSwim) {
      rows.push({ key: "swim", icon: "🩳", label: gender === "female" ? "Swimsuit" : "Swim trunks", defaultQty: 1, itemName: gender === "female" ? "Swimsuit" : "Swim trunks", category: "swimwear", note: "For pool / beach" });
    }
    if (hasActive) {
      rows.push({ key: "active", icon: "🏃", label: "Athletic wear", defaultQty: 1, itemName: "Athletic outfit", category: "activewear", note: "For active events" });
    }

    return rows;
  }, [tripDays, activeMemberEvents, userProfile]);

  // Initialize quickPackQty from defaults (only once)
  useEffect(() => {
    if (packingStyle === "spontaneous" && Object.keys(quickPackQty).length === 0 && !quickPackAdded) {
      const defaults: Record<string, number> = {};
      quickPackDefaults.forEach(r => { defaults[r.key] = r.defaultQty; });
      setQuickPackQty(defaults);
    }
  }, [packingStyle, quickPackDefaults, quickPackQty, quickPackAdded]);

  // ─── Walk-through steps: outfit groups + Bedtime + Essentials ───
  const PSEUDO_BEDTIME = "bedtime";
  const PSEUDO_ESSENTIALS = "essentials";
  const walkthroughGroups = memberOutfitGroups; // use outfit groups as steps
  const totalSteps = walkthroughGroups.length + 2; // +2 for bedtime & essentials
  const currentStepType: "outfitGroup" | "bedtime" | "essentials" = currentEventIdx < walkthroughGroups.length
    ? "outfitGroup"
    : currentEventIdx === walkthroughGroups.length
      ? "bedtime"
      : "essentials";
  const currentOutfitGroup = currentStepType === "outfitGroup" ? (walkthroughGroups[currentEventIdx] || null) : null;
  const currentGroupEvents = currentOutfitGroup ? getGroupEvents(currentOutfitGroup.id) : [];
  // For backward compatibility, use first event's data for dress code/inspo context
  const currentEvent = currentGroupEvents[0] || null;

  // ─── Items for active member ───
  const memberItems = useMemo(() => items.filter(i => i.trip_member_id === activeMemberId), [items, activeMemberId]);
  const currentGroupEventIds = useMemo(() => new Set(currentGroupEvents.map(e => e.id)), [currentGroupEvents]);
  const currentEventItems = useMemo(() => currentOutfitGroup
    ? memberItems.filter(i => i.event_id && currentGroupEventIds.has(i.event_id))
    : [], [memberItems, currentOutfitGroup, currentGroupEventIds]);

  // General items (event_id = null) — used for bedtime, toiletries, extras
  const generalItems = useMemo(() => memberItems.filter(i => i.event_id === null), [memberItems]);

  // ─── Outfit for current group (use first event in group for outfit lookup) ───
  const currentOutfit = useMemo(() => {
    if (!currentOutfitGroup) return null;
    // Look for outfit linked to group, or fallback to first event
    const byGroup = outfits.find(o => o.trip_member_id === activeMemberId && o.outfit_group_id === currentOutfitGroup.id);
    if (byGroup) return byGroup;
    if (currentEvent) return outfits.find(o => o.trip_member_id === activeMemberId && o.event_id === currentEvent.id) || null;
    return null;
  }, [outfits, activeMemberId, currentOutfitGroup, currentEvent]);

  // Reset inspo panel when event changes
  useEffect(() => {
    setInspoImages([]);
    setInspoPage(1);
    setInspoHasMore(false);
    setInspoError(null);
    setShowInspoPanel(false);
  }, [currentEventIdx, activeMemberId]);

  // Load just-in-case items (event_id = null)
  useEffect(() => {
    setJustInCaseItems(memberItems.filter(i => i.event_id === null));
  }, [memberItems]);

  // ─── Consolidated items (deduped by name) — includes event-linked AND general items ───
  const consolidatedItems = useMemo(() => {
    const map = new Map<string, { item: PackingItem; events: ItineraryEvent[]; eventCount: number }>();
    // Event-linked items
    memberItems.filter(i => i.event_id).forEach(item => {
      const existing = map.get(item.name);
      const evt = events.find(e => e.id === item.event_id);
      if (existing) {
        if (evt) existing.events.push(evt);
        existing.eventCount++;
      } else {
        map.set(item.name, { item, events: evt ? [evt] : [], eventCount: 1 });
      }
    });
    // General items (bedtime, toiletries, extras) — event_id is null
    memberItems.filter(i => !i.event_id).forEach(item => {
      if (!map.has(item.name)) {
        map.set(item.name, { item, events: [], eventCount: 0 });
      }
    });
    return Array.from(map.values());
  }, [memberItems, events]);

  // ─── Multi-use detection for an item name ───
  const getMultiUseInfo = useCallback((itemName: string, excludeEventId?: string) => {
    const others = memberItems.filter(i => i.name === itemName && i.event_id && i.event_id !== excludeEventId);
    return others.map(i => {
      const evt = events.find(e => e.id === i.event_id);
      return evt?.title || "";
    }).filter(Boolean);
  }, [memberItems, events]);

  // ─── Other outfit groups that have items (for "Wear same outfit as..." reuse) ───
  const eventsWithItems = useMemo(() => {
    if (!currentOutfitGroup) return [];
    // Show first event of each other group that has items
    return walkthroughGroups.filter(g => g.id !== currentOutfitGroup.id).map(g => {
      const gEvts = getGroupEvents(g.id);
      const hasItems = gEvts.some(e => memberItems.some(i => i.event_id === e.id));
      if (!hasItems) return null;
      return gEvts[0]; // return first event as representative
    }).filter(Boolean) as ItineraryEvent[];
  }, [walkthroughGroups, currentOutfitGroup, getGroupEvents, memberItems]);

  // ─── Reuse outfit from another event ───
  const reuseOutfitFrom = useCallback(async (sourceEventId: string) => {
    if (!currentEvent) return;
    setReusingOutfit(true);
    try {
      const sourceItems = memberItems.filter(i => i.event_id === sourceEventId);
      for (const srcItem of sourceItems) {
        // Check if this item name already exists for the current event
        const alreadyExists = items.some(i => i.trip_member_id === activeMemberId && i.event_id === currentEvent.id && i.name === srcItem.name);
        if (alreadyExists) continue;

        const { data, error } = await supabase.from("packing_items").insert({
          trip_id: trip.id,
          trip_member_id: activeMemberId,
          event_id: currentEvent.id,
          name: srcItem.name,
          category: srcItem.category,
          is_multi_use: true,
          sort_order: items.filter(i => i.event_id === currentEvent.id).length,
        }).select().single();

        if (error) { console.error("reuseOutfit insert error:", error); continue; }
        if (data) {
          setItems(prev => [...prev, data as PackingItem]);
        }

        // Mark the source item as multi-use too
        if (!srcItem.is_multi_use) {
          await supabase.from("packing_items").update({ is_multi_use: true }).eq("id", srcItem.id);
          setItems(prev => prev.map(i => i.id === srcItem.id ? { ...i, is_multi_use: true } : i));
        }
      }

      // Copy inspo if source event has one and current doesn't
      const sourceOutfit = outfits.find(o => o.trip_member_id === activeMemberId && o.event_id === sourceEventId);
      if (sourceOutfit?.inspo_image_url && !currentOutfit?.inspo_image_url) {
        const { data: newOutfit } = await supabase.from("packing_outfits").upsert({
          trip_id: trip.id,
          trip_member_id: activeMemberId,
          event_id: currentEvent.id,
          inspo_image_url: sourceOutfit.inspo_image_url,
          inspo_source_url: sourceOutfit.inspo_source_url,
          inspo_label: sourceOutfit.inspo_label,
        }, { onConflict: "trip_member_id,event_id" }).select().single();
        if (newOutfit) setOutfits(prev => [...prev.filter(o => o.id !== newOutfit.id), newOutfit as PackingOutfit]);
      }

      const sourceEvent = events.find(e => e.id === sourceEventId);
      await logActivity(supabase, {
        tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
        action: "added", entityType: "packing_item",
        entityName: `Reused outfit from "${sourceEvent?.title || "another event"}"`,
        detail: `Copied ${sourceItems.length} items`,
        linkPath: `/trip/${trip.id}/packing`,
      });
    } finally {
      setReusingOutfit(false);
      setShowReuseDropdown(false);
    }
  }, [supabase, trip.id, activeMemberId, currentEvent, currentOutfit, memberItems, items, outfits, events, userId, userProfile]);

  // ─── Inspo search query ───
  const inspoSearchQuery = useMemo(() => {
    if (!currentEvent) return "";
    const styles = userProfile?.clothing_styles || [];
    const gender = userProfile?.gender || "";
    const dressCode = getDressCodeLabel(currentEvent.dress_code).toLowerCase();
    const eventType = currentEvent.event_type;
    const genderWord = gender === "female" ? "women" : gender === "male" ? "men" : "";
    // Build a rich search query for Unsplash
    const season = (() => {
      if (!trip.start_date) return "";
      const month = new Date(trip.start_date + "T12:00:00").getMonth();
      if (month >= 2 && month <= 4) return "spring";
      if (month >= 5 && month <= 7) return "summer";
      if (month >= 8 && month <= 10) return "fall";
      return "winter";
    })();
    return `${styles[0] || ""} ${dressCode} ${eventType} outfit ${genderWord} ${season}`.replace(/\s+/g, " ").trim();
  }, [currentEvent, userProfile, trip.start_date]);

  // ─── Fetch inspo images from Unsplash ───
  const fetchInspoImages = useCallback(async (page = 1) => {
    if (!inspoSearchQuery) return;
    setInspoLoading(true);
    setInspoError(null);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(inspoSearchQuery)}&per_page=9&page=${page}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "NO_API_KEY") {
          throw new Error("NO_API_KEY");
        }
        console.error("Inspo fetch failed:", res.status, body);
        throw new Error(`API_ERROR_${res.status}`);
      }
      const data = await res.json();
      if (page === 1) {
        setInspoImages(data.images || []);
      } else {
        setInspoImages(prev => [...prev, ...(data.images || [])]);
      }
      setInspoPage(page);
      setInspoHasMore(page < (data.totalPages || 0));
    } catch (err) {
      if (err instanceof Error && err.message === "NO_API_KEY") {
        setInspoError("Outfit inspiration isn't set up yet. The site owner needs to add an Unsplash API key.");
      } else if (err instanceof Error && err.message.startsWith("API_ERROR_")) {
        const status = err.message.replace("API_ERROR_", "");
        setInspoError(`Unsplash returned an error (${status}). Check browser console for details.`);
      } else {
        setInspoError("Couldn't load images. Check your connection and try again.");
      }
    } finally {
      setInspoLoading(false);
    }
  }, [inspoSearchQuery]);

  // ─── Select an inspo image from the grid ───
  const selectInspoImage = useCallback(async (image: InspoImage) => {
    if (!currentEvent) return;
    const { data, error } = await supabase.from("packing_outfits").upsert({
      trip_id: trip.id,
      trip_member_id: activeMemberId,
      event_id: currentEvent.id,
      inspo_image_url: image.urlFull,
      inspo_source_url: image.unsplashUrl,
      inspo_label: image.alt || "Outfit inspiration",
    }, { onConflict: "trip_member_id,event_id" }).select().single();
    if (error) { console.error("selectInspoImage error:", error); return; }
    if (data) setOutfits(prev => [...prev.filter(o => o.id !== data.id), data as PackingOutfit]);
    setShowInspoPanel(false);
    await logActivity(supabase, {
      tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
      action: "updated", entityType: "packing_outfit", entityName: `Inspo for ${currentEvent.title}`,
      linkPath: `/trip/${trip.id}/packing`,
    });
  }, [supabase, trip.id, activeMemberId, currentEvent, userId, userProfile]);

  // ─── Upload user's own inspo image ───
  const uploadInspoImage = useCallback(async (file: File) => {
    if (!currentEvent) return;
    setUploadingInspo(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `inspo/${trip.id}/${activeMemberId}/${currentEvent.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inspo-images").upload(filePath, file, { upsert: true });
      if (uploadError) { console.error("Upload error:", uploadError); return; }
      const { data: urlData } = supabase.storage.from("inspo-images").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { data, error } = await supabase.from("packing_outfits").upsert({
        trip_id: trip.id,
        trip_member_id: activeMemberId,
        event_id: currentEvent.id,
        inspo_image_url: publicUrl,
        inspo_source_url: null,
        inspo_label: "My uploaded inspo",
      }, { onConflict: "trip_member_id,event_id" }).select().single();
      if (error) { console.error("Save uploaded inspo error:", error); return; }
      if (data) setOutfits(prev => [...prev.filter(o => o.id !== data.id), data as PackingOutfit]);
      setShowInspoPanel(false);
      await logActivity(supabase, {
        tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
        action: "updated", entityType: "packing_outfit", entityName: `Uploaded inspo for ${currentEvent.title}`,
        linkPath: `/trip/${trip.id}/packing`,
      });
    } finally {
      setUploadingInspo(false);
    }
  }, [supabase, trip.id, activeMemberId, currentEvent, userId, userProfile]);

  // ─── Clear saved inspo ───
  const clearInspo = useCallback(async () => {
    if (!currentOutfit) return;
    await supabase.from("packing_outfits").update({
      inspo_image_url: null, inspo_source_url: null, inspo_label: null,
    }).eq("id", currentOutfit.id);
    setOutfits(prev => prev.map(o => o.id === currentOutfit.id ? { ...o, inspo_image_url: null, inspo_source_url: null, inspo_label: null } : o));
  }, [supabase, currentOutfit]);

  // ─── CRUD: Add item ───
  const addItem = useCallback(async (name: string, category: string, eventId: string | null) => {
    if (!name.trim()) return;
    const isMulti = memberItems.some(i => i.name === name.trim() && i.event_id !== eventId);
    const { data, error } = await supabase.from("packing_items").insert({
      trip_id: trip.id,
      trip_member_id: activeMemberId,
      event_id: eventId,
      name: name.trim(),
      category,
      is_multi_use: isMulti,
      sort_order: memberItems.length,
    }).select().single();

    if (error) { console.error("addItem error:", error); return; }
    if (!data) return;

    setItems(prev => [...prev, data as PackingItem]);

    // If multi-use, update existing items with same name
    if (isMulti) {
      const toUpdate = memberItems.filter(i => i.name === name.trim() && !i.is_multi_use);
      for (const item of toUpdate) {
        await supabase.from("packing_items").update({ is_multi_use: true }).eq("id", item.id);
      }
      setItems(prev => prev.map(i => i.name === name.trim() && i.trip_member_id === activeMemberId ? { ...i, is_multi_use: true } : i));
    }

    // Create/ensure outfit exists and add junction
    if (eventId) {
      let outfitId = currentOutfit?.id;
      if (!outfitId) {
        const { data: newOutfit } = await supabase.from("packing_outfits").upsert({
          trip_id: trip.id,
          trip_member_id: activeMemberId,
          event_id: eventId,
        }, { onConflict: "trip_member_id,event_id" }).select().single();
        if (newOutfit) {
          outfitId = newOutfit.id;
          setOutfits(prev => [...prev.filter(o => o.id !== newOutfit.id), newOutfit as PackingOutfit]);
        }
      }
      if (outfitId) {
        const { data: junction } = await supabase.from("outfit_packing_items").insert({
          outfit_id: outfitId,
          packing_item_id: data.id,
          sort_order: currentEventItems.length,
        }).select().single();
        if (junction) setJunctions(prev => [...prev, junction as OutfitPackingItem]);
      }
    }

    await logActivity(supabase, {
      tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
      action: "added", entityType: "packing_item", entityName: name.trim(),
      entityId: data.id, linkPath: `/trip/${trip.id}/packing`,
    });

    setNewItemName("");
    setNewItemCategory("other");
    setAddingItem(false);
  }, [supabase, trip.id, activeMemberId, memberItems, currentOutfit, currentEventItems, userId, userProfile]);

  // ─── CRUD: Edit item ───
  const editItem = useCallback(async (itemId: string, newName: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("packing_items").update({ name: newName.trim(), updated_at: new Date().toISOString() }).eq("id", itemId);
    if (error) { console.error("editItem error:", error); return; }
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, name: newName.trim() } : i));
    setEditingItemId(null);
    setEditingItemName("");
    await logActivity(supabase, {
      tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
      action: "edited", entityType: "packing_item", entityName: newName.trim(),
      entityId: itemId, linkPath: `/trip/${trip.id}/packing`,
    });
  }, [supabase, trip.id, userId, userProfile]);

  // ─── CRUD: Delete item ───
  const deleteItem = useCallback(async (itemId: string, itemName: string) => {
    const { error } = await supabase.from("packing_items").delete().eq("id", itemId);
    if (error) { console.error("deleteItem error:", error); return; }
    setItems(prev => prev.filter(i => i.id !== itemId));
    setJunctions(prev => prev.filter(j => j.packing_item_id !== itemId));
    await logActivity(supabase, {
      tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
      action: "deleted", entityType: "packing_item", entityName: itemName,
      entityId: itemId, linkPath: `/trip/${trip.id}/packing`,
    });
  }, [supabase, trip.id, userId, userProfile]);

  // ─── CRUD: Toggle packed ───
  // Toggles ALL items with the same name for this member (so multi-use items pack/unpack together)
  const togglePacked = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const newVal = !item.is_packed;
    // Find all items with same name for this member (handles multi-use deduplication)
    const siblingIds = items
      .filter(i => i.name === item.name && i.trip_member_id === item.trip_member_id)
      .map(i => i.id);
    // Optimistic update all siblings
    setItems(prev => prev.map(i => siblingIds.includes(i.id) ? { ...i, is_packed: newVal } : i));
    // Update all siblings in DB
    for (const sid of siblingIds) {
      await supabase.from("packing_items").update({ is_packed: newVal, updated_at: new Date().toISOString() }).eq("id", sid);
    }
    await logActivity(supabase, {
      tripId: trip.id, userId, userName: userProfile?.full_name || "Someone",
      action: newVal ? "packed" : "unpacked", entityType: "packing_item", entityName: item.name,
      entityId: itemId, linkPath: `/trip/${trip.id}/packing`,
    });
  }, [supabase, items, trip.id, userId, userProfile]);

  // ─── CRUD: Add just-in-case extra ───
  const addJustInCaseExtra = useCallback(async (name: string) => {
    await addItem(name, "other", null);
  }, [addItem]);

  // ─── Grouping helpers for consolidation/checklist ───
  const groupItems = useCallback((itemsList: { item: PackingItem; events: ItineraryEvent[]; eventCount: number }[]) => {
    const groups: Record<string, typeof itemsList> = {};
    const method = orgMethod === "no_preference" ? "by_category" : orgMethod;

    itemsList.forEach(entry => {
      let key: string;
      if (method === "by_category") {
        key = entry.item.category;
      } else if (method === "by_day") {
        key = entry.events[0]?.date ? formatDate(entry.events[0].date) : "Unassigned";
      } else if (method === "by_activity") {
        key = entry.events[0]?.event_type || "other";
      } else if (method === "by_outfit") {
        key = entry.events[0]?.title || "General";
      } else {
        key = entry.item.category;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return groups;
  }, [orgMethod]);

  // ─── Bag CRUD ───
  const addBag = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from("packing_bags").insert({
      user_id: userId, name: name.trim(), icon: "🧳", bag_type: "carry-on", sort_order: bags.length,
    }).select().single();
    if (error || !data) { console.error("addBag error:", error); return; }
    setBags(prev => [...prev, data as PackingBag]);
  }, [supabase, userId, bags.length]);

  const addBagSection = useCallback(async (bagId: string, name: string) => {
    if (!name.trim()) return;
    const existingSections = bagSections.filter(s => s.bag_id === bagId);
    const { data, error } = await supabase.from("packing_bag_sections").insert({
      bag_id: bagId, name: name.trim(), sort_order: existingSections.length,
    }).select().single();
    if (error || !data) { console.error("addBagSection error:", error); return; }
    setBagSections(prev => [...prev, data as PackingBagSection]);
  }, [supabase, bagSections]);

  const addBagContainer = useCallback(async (sectionId: string, name: string) => {
    if (!name.trim()) return;
    const existingContainers = bagContainers.filter(c => c.section_id === sectionId);
    const { data, error } = await supabase.from("packing_bag_containers").insert({
      section_id: sectionId, name: name.trim(), sort_order: existingContainers.length,
    }).select().single();
    if (error || !data) { console.error("addBagContainer error:", error); return; }
    setBagContainers(prev => [...prev, data as PackingBagContainer]);
  }, [supabase, bagContainers]);

  // ─── Bag assignment handler ───
  const assignItemToBag = useCallback(async (itemId: string, field: "bag_id" | "section_id" | "container_id", value: string | null) => {
    const existing = itemAssignments.find(a => a.packing_item_id === itemId && a.trip_id === trip.id);
    const updates: Record<string, string | null> = { [field]: value || null };
    // Cascade clears
    if (field === "bag_id") { updates.section_id = null; updates.container_id = null; }
    if (field === "section_id") { updates.container_id = null; }

    if (existing) {
      const { error } = await supabase.from("packing_item_assignments").update(updates).eq("id", existing.id);
      if (error) { console.error("assignItemToBag update error:", error); return; }
      setItemAssignments(prev => prev.map(a => a.id === existing.id ? { ...a, ...updates } : a));
    } else {
      const { data, error } = await supabase.from("packing_item_assignments").insert({
        packing_item_id: itemId, trip_id: trip.id, ...updates,
      }).select().single();
      if (error || !data) { console.error("assignItemToBag insert error:", error); return; }
      setItemAssignments(prev => [...prev, data as PackingItemAssignment]);
    }

    // Auto-check as packed when bag is assigned
    if (field === "bag_id" && value) {
      const item = items.find(i => i.id === itemId);
      if (item && !item.is_packed) {
        await togglePacked(itemId);
      }
    }
  }, [supabase, trip.id, itemAssignments, items, togglePacked]);

  // Helper: get assignment for an item
  const getAssignment = useCallback((itemId: string) => {
    return itemAssignments.find(a => a.packing_item_id === itemId && a.trip_id === trip.id);
  }, [itemAssignments, trip.id]);

  // ─── Checklist stats (based on consolidated items, not raw duplicates) ───
  const packedCount = consolidatedItems.filter(e => e.item.is_packed).length;
  const totalCount = consolidatedItems.length;
  const multiUseCount = consolidatedItems.filter(e => e.eventCount > 1).length;
  const assignedToBagCount = consolidatedItems.filter(e => getAssignment(e.item.id)?.bag_id).length;

  // Completion state
  const allPacked = packedCount === totalCount && totalCount > 0;
  const [showAllSet, setShowAllSet] = useState(false);
  useEffect(() => {
    if (allPacked) {
      const timer = setTimeout(() => setShowAllSet(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowAllSet(false);
    }
  }, [allPacked]);

  // ─── Empty state ───
  if (activeMemberEvents.length === 0 && (activeView === "walkthrough" || activeView === "grouping")) {
    return (
      <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
        {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
        <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, position: "relative", zIndex: 2 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", margin: 0 }}>{trip.name}</h2>
        </div>
        <TripSubNav tripId={trip.id} theme={th} />
        {/* Person Tabs */}
        <div style={{ display: "flex", gap: "0", padding: "0 16px", background: th.bg, borderBottom: `1px solid ${th.cardBorder}`, overflowX: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
          {myFamilyTripMembers.map(m => (
            <button key={m.id} onClick={() => { setActiveMemberId(m.id); setCurrentEventIdx(0); }} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${m.id === activeMemberId ? accent : "transparent"}`, cursor: "pointer", transition: "all 0.2s" }}>
              <span style={{ fontSize: "13px", fontWeight: m.id === activeMemberId ? 700 : 500, color: m.id === activeMemberId ? th.text : th.muted, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
              {m.role === "host" && <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "8px", background: `${accent}18`, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Host</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "60px 20px", maxWidth: "500px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>Build your itinerary first</h3>
          <p style={{ color: th.muted, fontSize: "13px", marginBottom: "20px" }}>Packing is driven by your events. Add events to the itinerary and opt in participants — then come back here to plan outfits.</p>
          <button onClick={() => router.push(`/trip/${trip.id}/itinerary`)} style={{ padding: "10px 24px", background: accent, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Go to Itinerary →</button>
        </div>
      </div>
    );
  }

  // ─── Packing gate: block if onboarding not completed ───
  if (!userProfile?.onboarding_completed) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "36px 28px",
          maxWidth: "380px",
          width: "90%",
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "14px" }}>📋</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px" }}>Set up your profile first</h2>
          <p style={{ fontSize: "14px", color: "#666", lineHeight: 1.5, margin: "0 0 24px" }}>
            Before we can build your packing list, we need to know your style, preferences, and who you're packing for. It only takes 2 minutes.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(232,148,58,0.35)",
              marginBottom: "10px",
            }}
          >
            Set Up Now →
          </button>
          <button
            onClick={() => router.back()}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "2px solid #e0e0e0",
              background: "#fff",
              color: "#555",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}

      {/* Header */}
      <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", margin: 0 }}>{trip.name}</h2>
            {trip.start_date && trip.end_date && (
              <span style={{ fontSize: "12px", color: th.muted }}>{formatDate(trip.start_date)} – {formatDate(trip.end_date)} · {trip.location || ""}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: `${accent}14`, padding: "4px 10px", borderRadius: "20px" }}>
            <span style={{ fontSize: "13px" }}>{ps.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: accent }}>{ps.label}</span>
          </div>
        </div>
      </div>

      <TripSubNav tripId={trip.id} theme={th} />

      {/* Person Tabs */}
      <div style={{ display: "flex", gap: "0", padding: "0 16px", background: th.bg, borderBottom: `1px solid ${th.cardBorder}`, overflowX: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
        {myFamilyTripMembers.map(m => (
          <button key={m.id} onClick={() => { setActiveMemberId(m.id); setCurrentEventIdx(0); }} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${m.id === activeMemberId ? accent : "transparent"}`, cursor: "pointer", transition: "all 0.2s" }}>
            <span style={{ fontSize: "13px", fontWeight: m.id === activeMemberId ? 700 : 500, color: m.id === activeMemberId ? th.text : th.muted, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
            {m.role === "host" && <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "8px", background: `${accent}18`, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Host</span>}
          </button>
        ))}
      </div>

      {/* Packing Style Banner */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ margin: "12px 16px 0", padding: "10px 14px", background: `${accent}0a`, border: `1px solid ${th.cardBorder}`, borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: th.muted }}>{ps.desc}</span>
        </div>

        {/* View Switcher */}
        {packingStyle === "spontaneous" ? (
          <div style={{ display: "flex", gap: "0", padding: "0 16px", margin: "12px 0 0", overflowX: "auto", scrollbarWidth: "none" }}>
            {(["walkthrough", "checklist"] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)} style={{ flex: "0 0 auto", padding: "10px 16px", background: "none", border: "none", borderBottom: `3px solid ${activeView === v ? accent : "transparent"}`, cursor: "pointer", fontSize: "13px", fontWeight: activeView === v ? 700 : 500, color: activeView === v ? accent : th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                {v === "walkthrough" ? "Quick Pack" : "Pack & Go ✓"}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0", padding: "0 16px", margin: "12px 0 0", overflowX: "auto", scrollbarWidth: "none" }}>
            {(["grouping", "walkthrough", "checklist"] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)} style={{ flex: "0 0 auto", padding: "10px 16px", background: "none", border: "none", borderBottom: `3px solid ${activeView === v ? accent : "transparent"}`, cursor: "pointer", fontSize: "13px", fontWeight: activeView === v ? 700 : 500, color: activeView === v ? accent : th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                {v === "grouping" ? "Group" : v === "walkthrough" ? "Outfits" : "Pack & Go ✓"}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  VIEW: GROUPING                                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === "grouping" && (
          <div style={{ padding: "16px" }}>
            {memberOutfitGroups.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗂️</div>
                <p style={{ fontSize: "13px", color: th.muted, marginBottom: "16px" }}>Events are being automatically grouped by dress code. If no events found, add events to the itinerary first.</p>
                <button onClick={autoGroupEvents} style={{ padding: "10px 20px", background: accent, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Re-Group Events</button>
              </div>
            ) : (
              <>
                {/* 2a: Instructional header */}
                <div style={{ padding: "12px 14px", background: `${accent}06`, border: `1px solid ${th.cardBorder}`, borderRadius: "12px", marginBottom: "14px" }}>
                  <p style={{ fontSize: "12px", color: th.muted, margin: 0, lineHeight: 1.5 }}>
                    Your events are auto-grouped by day and dress code — events with the same vibe share one outfit. If two groups could share the same outfit, merge them. Otherwise, you're good to go.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>Outfit Groups ({memberOutfitGroups.length})</span>
                  {groupingMergeSource && (
                    <button onClick={() => setGroupingMergeSource(null)} style={{ fontSize: "11px", padding: "4px 10px", background: "#fff3e0", color: "#e65100", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Cancel Merge</button>
                  )}
                </div>

                {/* Day tabs */}
                {(() => {
                  const uniqueDates = [...new Set(memberOutfitGroups.map(g => g.date))].sort();
                  return (
                    <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", scrollbarWidth: "none" }}>
                      {uniqueDates.map((date, idx) => (
                        <button key={date} onClick={() => setGroupingActiveDay(idx)} style={{ flex: "0 0 auto", padding: "6px 12px", borderRadius: "16px", border: `1px solid ${idx === groupingActiveDay ? accent : th.cardBorder}`, background: idx === groupingActiveDay ? `${accent}14` : "white", color: idx === groupingActiveDay ? accent : th.muted, fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          {formatDate(date)}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Groups for active day */}
                {(() => {
                  const uniqueDates = [...new Set(memberOutfitGroups.map(g => g.date))].sort();
                  const activeDate = uniqueDates[groupingActiveDay] || uniqueDates[0];
                  const dayGroups = memberOutfitGroups.filter(g => g.date === activeDate);

                  return dayGroups.map(group => {
                    const groupEvents = getGroupEvents(group.id);
                    const isSelected = groupingSelectedId === group.id;
                    const isMergeSource = groupingMergeSource === group.id;
                    const isMergeTarget = groupingMergeSource && groupingMergeSource !== group.id;
                    const itemCount = memberItems.filter(i => i.event_id && groupEvents.some(e => e.id === i.event_id)).length;

                    return (
                      <div key={group.id} onClick={() => setGroupingSelectedId(isSelected ? null : group.id)} style={{ background: "white", borderRadius: "16px", border: `1px solid ${isMergeSource ? "#e65100" : isSelected ? accent : th.cardBorder}`, overflow: "hidden", marginBottom: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", cursor: "pointer", transition: "all 0.2s" }}>
                        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "14px" }}>{getEventTypeIcon(groupEvents[0]?.event_type || "other")}</span>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 700 }}>{group.label}</div>
                              <div style={{ fontSize: "11px", color: th.muted }}>
                                {groupEvents.length} event{groupEvents.length !== 1 ? "s" : ""} · {itemCount} item{itemCount !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                          <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em", background: `${DRESS_CODE_COLORS[group.dress_code || "casual"] || accent}18`, color: DRESS_CODE_COLORS[group.dress_code || "casual"] || accent }}>{getDressCodeLabel(group.dress_code)}</span>
                        </div>

                        {/* Events within group */}
                        {groupEvents.map((evt, eIdx) => (
                          <div key={evt.id} style={{ padding: "8px 18px 8px 44px", borderTop: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px" }}>{getEventTypeIcon(evt.event_type)}</span>
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{evt.title}</span>
                            <span style={{ fontSize: "10px", color: th.muted, marginLeft: "auto" }}>
                              {getTimeSlotLabel(evt.time_slot)}
                              {evt.start_time && ` · ${formatTime12h(evt.start_time)}`}
                            </span>
                            {/* Split button — only if group has 2+ events and not the last event */}
                            {isSelected && groupEvents.length > 1 && eIdx < groupEvents.length - 1 && (
                              <button onClick={(e) => { e.stopPropagation(); splitGroup(group.id, evt.id); }} style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "8px", background: "#e3f2fd", color: "#1565c0", border: "none", cursor: "pointer", fontWeight: 700, marginLeft: "4px" }}>Split ↓</button>
                            )}
                          </div>
                        ))}

                        {/* Action row: merge/split — always visible */}
                        {isMergeTarget ? (
                          <div style={{ padding: "8px 18px", borderTop: `1px solid ${th.cardBorder}`, background: `#e6510008` }}>
                            <button onClick={(e) => { e.stopPropagation(); mergeGroups(groupingMergeSource!, group.id); }} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "8px", background: "#e65100", color: "white", border: "none", cursor: "pointer", fontWeight: 700, width: "100%" }}>Merge here ↓</button>
                          </div>
                        ) : (
                          <div style={{ padding: "8px 18px", borderTop: `1px solid ${th.cardBorder}`, display: "flex", gap: "8px" }}>
                            {!groupingMergeSource && dayGroups.length > 1 && (
                              <button onClick={(e) => { e.stopPropagation(); setGroupingMergeSource(group.id); }} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", background: "#fff3e0", color: "#e65100", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Merge with…</button>
                            )}
                            {groupEvents.length > 1 && !groupingMergeSource && (
                              <button onClick={(e) => { e.stopPropagation(); splitGroup(group.id, groupEvents[0].id); }} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", background: "#e3f2fd", color: "#1565c0", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Split</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {/* Spacer for sticky CTA */}
                <div style={{ height: "80px" }} />

                {/* Sticky gradient CTA */}
                <div style={{ position: "fixed", bottom: "56px", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "480px", zIndex: 101, padding: "0 16px 12px", boxSizing: "border-box" as const, background: `linear-gradient(to top, ${th.bg} 70%, transparent)`, pointerEvents: "none" as const }}>
                  <button onClick={() => setActiveView("walkthrough")} style={{ pointerEvents: "auto" as const, width: "100%", padding: "16px 24px", fontSize: "16px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#fff", background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`, border: "none", borderRadius: "14px", cursor: "pointer", boxShadow: "0 4px 20px rgba(232,148,58,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s ease", minHeight: "52px" }}>
                    Looks good → Build Outfits
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  VIEW: WALKTHROUGH                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === "walkthrough" && (
          <div style={{ padding: "16px" }}>

            {/* Progress indicator */}
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: th.muted }}>
                {currentStepType === "outfitGroup"
                  ? `Outfit ${currentEventIdx + 1} of ${walkthroughGroups.length}`
                  : currentStepType === "bedtime"
                    ? "Bedtime"
                    : "Essentials"}
                {" "}· Step {currentEventIdx + 1} of {totalSteps}
              </span>
            </div>

            {/* Timeline dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "16px" }}>
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <button key={idx} onClick={() => setCurrentEventIdx(idx)} style={{ width: idx === currentEventIdx ? "20px" : "8px", height: "8px", borderRadius: "4px", background: idx === currentEventIdx ? accent : idx < currentEventIdx ? `${accent}60` : `${accent}20`, border: "none", cursor: "pointer", transition: "all 0.2s" }} />
              ))}
            </div>

            {/* ─── SPONTANEOUS: Quick Pack Mode ─── */}
            {packingStyle === "spontaneous" && currentStepType === "outfitGroup" ? (
              <div style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚡</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Quick Pack</span>
                  </div>
                  <p style={{ fontSize: "12px", color: th.muted, margin: 0 }}>
                    Set quantities for a {tripDays}-day, {tripNights}-night trip. We'll add items to your checklist automatically.
                  </p>
                </div>

                {/* Quantity rows */}
                <div style={{ padding: "8px 0" }}>
                  {quickPackDefaults.map(row => (
                    <div key={row.key} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                      <span style={{ fontSize: "16px", marginRight: "10px" }}>{row.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: "10px", color: th.muted }}>{row.note}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => setQuickPackQty(prev => ({ ...prev, [row.key]: Math.max(0, (prev[row.key] || row.defaultQty) - 1) }))} style={{ width: "28px", height: "28px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, background: "white", cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontSize: "15px", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{quickPackQty[row.key] ?? row.defaultQty}</span>
                        <button onClick={() => setQuickPackQty(prev => ({ ...prev, [row.key]: (prev[row.key] || row.defaultQty) + 1 }))} style={{ width: "28px", height: "28px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, background: "white", cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add items button */}
                <div style={{ padding: "14px 18px" }}>
                  {!quickPackAdded ? (
                    <button onClick={async () => {
                      for (const row of quickPackDefaults) {
                        const qty = quickPackQty[row.key] ?? row.defaultQty;
                        for (let n = 1; n <= qty; n++) {
                          await addItem(qty > 1 ? `${row.itemName} #${n}` : row.itemName, row.category, null);
                        }
                      }
                      setQuickPackAdded(true);
                    }} style={{ width: "100%", padding: "12px", background: accent, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add to Packing List</button>
                  ) : (
                    <div style={{ textAlign: "center", color: "#2e7d32", fontSize: "13px", fontWeight: 700 }}>✓ Items added to your list!</div>
                  )}
                </div>
              </div>
            ) : currentStepType === "outfitGroup" && currentOutfitGroup && currentEvent ? (
              /* ─── STANDARD: Event Outfit Card ─── */
              <div style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>

                {/* Event header */}
                <div style={{ padding: "18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "16px" }}>{getEventTypeIcon(currentEvent.event_type)}</span>
                        <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{currentOutfitGroup.label}</span>
                      </div>
                      {/* Events in this group */}
                      <div style={{ marginTop: "6px" }}>
                        {currentGroupEvents.map(evt => (
                          <div key={evt.id} style={{ fontSize: "11px", color: th.muted, paddingLeft: "26px" }}>
                            {getEventTypeIcon(evt.event_type)} {evt.title}
                            {evt.start_time && ` · ${formatTime12h(evt.start_time)}`}
                            {evt.location && ` · ${evt.location}`}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em", background: `${DRESS_CODE_COLORS[currentEvent.dress_code || "casual"] || accent}18`, color: DRESS_CODE_COLORS[currentEvent.dress_code || "casual"] || accent, flexShrink: 0 }}>{getDressCodeLabel(currentEvent.dress_code)}</span>
                  </div>
                </div>

                {/* ─── Inspo panel (moved above items) ─── */}
                <button onClick={() => { if (!showInspoPanel) fetchInspoImages(); setShowInspoPanel(!showInspoPanel); }} style={{ width: "100%", padding: "12px 18px", background: `${accent}06`, border: "none", borderTop: `1px solid ${th.cardBorder}`, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: accent, fontFamily: "'DM Sans', sans-serif", textAlign: "left" as const }}>
                  {showInspoPanel ? "Hide Inspo ▲" : "✨ Get Outfit Inspo"}
                </button>

                {showInspoPanel && (
                  <div style={{ padding: "14px 18px", borderTop: `1px solid ${th.cardBorder}` }}>
                    <div style={{ fontSize: "10px", color: th.muted, marginBottom: "8px" }}>Search: {inspoSearchQuery}</div>
                    {inspoLoading && <div style={{ textAlign: "center", padding: "20px", color: th.muted, fontSize: "12px" }}>Loading inspiration…</div>}
                    {inspoError && <div style={{ textAlign: "center", padding: "12px", color: "#c62828", fontSize: "12px" }}>{inspoError}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {inspoImages.map(img => (
                        <button key={img.id} onClick={() => selectInspoImage(img)} style={{ padding: 0, border: `2px solid transparent`, borderRadius: "8px", cursor: "pointer", overflow: "hidden", background: img.color || "#eee", aspectRatio: "1" }}>
                          <img src={img.thumb} alt={img.alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                      ))}
                    </div>
                    {inspoHasMore && !inspoLoading && (
                      <button onClick={() => fetchInspoImages(inspoPage + 1)} style={{ width: "100%", padding: "8px", marginTop: "8px", background: "none", border: `1px solid ${th.cardBorder}`, borderRadius: "8px", fontSize: "11px", fontWeight: 600, color: accent, cursor: "pointer" }}>Load More</button>
                    )}
                    <div style={{ marginTop: "10px", borderTop: `1px solid ${th.cardBorder}`, paddingTop: "10px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: accent, cursor: "pointer" }}>
                        📷 Upload your own
                        <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) uploadInspoImage(e.target.files[0]); }} style={{ display: "none" }} />
                      </label>
                      {uploadingInspo && <span style={{ fontSize: "10px", color: th.muted }}>Uploading…</span>}
                    </div>
                  </div>
                )}

                {/* Saved inspo */}
                {currentOutfit?.inspo_image_url && (
                  <div style={{ padding: "12px 18px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={currentOutfit.inspo_image_url} alt="Outfit inspo" style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "11px", color: th.muted }}>Outfit Inspo</span>
                      <div style={{ fontSize: "12px", fontWeight: 600 }}>{currentOutfit.inspo_label || "Inspiration"}</div>
                    </div>
                    <button onClick={clearInspo} style={{ fontSize: "10px", padding: "4px 8px", borderRadius: "6px", background: "#ffebee", color: "#c62828", border: "none", cursor: "pointer", fontWeight: 700 }}>Clear</button>
                  </div>
                )}

                {/* ─── Outfit reuse ─── */}
                {eventsWithItems.length > 0 && currentEventItems.length === 0 && (
                  <div style={{ padding: "10px 18px", borderBottom: `1px solid ${th.cardBorder}`, background: `${accent}06` }}>
                    <button onClick={() => setShowReuseDropdown(!showReuseDropdown)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: accent, padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
                      <span>↻</span> Wear same outfit as…
                    </button>
                    {showReuseDropdown && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {eventsWithItems.map(evt => (
                          <button key={evt.id} onClick={() => reuseOutfitFrom(evt.id)} disabled={reusingOutfit} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "white", border: `1px solid ${th.cardBorder}`, borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontFamily: "'DM Sans', sans-serif", textAlign: "left" as const }}>
                            <span>{getEventTypeIcon(evt.event_type)}</span>
                            <span style={{ fontWeight: 600 }}>{evt.title}</span>
                            <span style={{ fontSize: "10px", color: th.muted, marginLeft: "auto" }}>{formatDate(evt.date)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Items list ─── */}
                <div>
                  {currentEventItems.map((item, idx) => {
                    const multiUseEvents = getMultiUseInfo(item.name, item.event_id || undefined);
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px", borderBottom: idx < currentEventItems.length - 1 ? `1px solid ${th.cardBorder}` : "none" }}>
                        <span style={{ fontSize: "14px" }}>{getCatIcon(item.category)}</span>
                        {editingItemId === item.id ? (
                          <input autoFocus value={editingItemName} onChange={e => setEditingItemName(e.target.value)} onBlur={() => { editItem(item.id, editingItemName); }} onKeyDown={e => { if (e.key === "Enter") editItem(item.id, editingItemName); if (e.key === "Escape") { setEditingItemId(null); setEditingItemName(""); } }} style={{ flex: 1, fontSize: "13px", fontWeight: 600, border: "none", borderBottom: `2px solid ${accent}`, outline: "none", padding: "2px 0", fontFamily: "'DM Sans', sans-serif", background: "transparent" }} />
                        ) : (
                          <span onClick={() => { setEditingItemId(item.id); setEditingItemName(item.name); }} style={{ flex: 1, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{item.name}</span>
                        )}
                        <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: `${accent}10`, color: accent, fontWeight: 700, textTransform: "uppercase" as const }}>{item.category}</span>
                        {multiUseEvents.length > 0 && (
                          <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: "#e8f5e9", color: "#2e7d32", fontWeight: 700 }}>↻ ×{multiUseEvents.length + 1}</span>
                        )}
                        <button onClick={() => deleteItem(item.id, item.name)} style={{ background: "none", border: "none", color: "#e57373", cursor: "pointer", fontSize: "14px", padding: "2px", lineHeight: 1 }}>✕</button>
                      </div>
                    );
                  })}

                  {/* Add item form */}
                  {addingItem ? (
                    <div style={{ padding: "10px 18px", borderTop: currentEventItems.length > 0 ? `1px solid ${th.cardBorder}` : "none", display: "flex", gap: "6px", alignItems: "center" }}>
                      <input autoFocus placeholder="Item name…" value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newItemName.trim()) { addItem(newItemName, newItemCategory, currentEvent.id); } if (e.key === "Escape") setAddingItem(false); }} style={{ flex: 1, fontSize: "13px", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                      <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} style={{ fontSize: "11px", padding: "8px 6px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, fontFamily: "'DM Sans', sans-serif" }}>
                        {PACKING_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                        ))}
                      </select>
                      <button onClick={() => { if (newItemName.trim()) addItem(newItemName, newItemCategory, currentEvent.id); }} style={{ padding: "8px 14px", background: accent, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Add</button>
                      <button onClick={() => setAddingItem(false)} style={{ background: "none", border: "none", color: th.muted, cursor: "pointer", fontSize: "14px" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingItem(true)} style={{ width: "100%", padding: "12px 18px", background: "none", border: "none", borderTop: currentEventItems.length > 0 ? `1px solid ${th.cardBorder}` : "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: accent, fontFamily: "'DM Sans', sans-serif", textAlign: "left" }}>+ Add Item</button>
                  )}
                </div>

                {/* ─── Dress code suggestions (persistent — below items) ─── */}
                {currentEvent.dress_code && (
                  <div style={{ padding: "12px 18px", borderTop: `1px solid ${th.cardBorder}`, background: `${accent}04` }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: th.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Suggested for {getDressCodeLabel(currentEvent.dress_code)}</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {(getDressCodeEssentials(currentEvent.dress_code, userProfile?.gender || null) || []).map((suggestion, sIdx) => {
                        const alreadyAdded = currentEventItems.some(i => i.name === suggestion);
                        return (
                          <button key={sIdx} onClick={() => { if (!alreadyAdded) addItem(suggestion, inferCategory(suggestion), currentEvent.id); }} disabled={alreadyAdded} style={{ padding: "5px 10px", borderRadius: "16px", border: `1px solid ${alreadyAdded ? "#c8e6c9" : th.cardBorder}`, background: alreadyAdded ? "#e8f5e9" : "white", fontSize: "11px", fontWeight: 600, cursor: alreadyAdded ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "4px", color: alreadyAdded ? "#2e7d32" : th.text }}>
                            <span style={{ fontSize: "10px" }}>{alreadyAdded ? "✓" : getCatIcon(inferCategory(suggestion))}</span> {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Overpacker: extra suggestions per event */}
                {packingStyle === "overpacker" && currentEvent.dress_code && (
                  <div style={{ padding: "12px 18px", borderTop: `1px solid ${th.cardBorder}`, background: "#fff8e1" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#e65100", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>🧳 Overpacker Extras</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {getOverpackerExtras(currentEvent.dress_code, userProfile?.gender || null).map((extra, eIdx) => {
                        const alreadyAdded = currentEventItems.some(i => i.name === extra);
                        return (
                          <button key={eIdx} onClick={() => { if (!alreadyAdded) addItem(extra, inferCategory(extra), currentEvent.id); }} disabled={alreadyAdded} style={{ padding: "5px 10px", borderRadius: "16px", border: `1px solid ${alreadyAdded ? "#c8e6c9" : "#ffe0b2"}`, background: alreadyAdded ? "#e8f5e9" : "white", fontSize: "11px", fontWeight: 600, cursor: alreadyAdded ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", color: alreadyAdded ? "#2e7d32" : "#e65100" }}>
                            {alreadyAdded ? "✓ " : "+ "}{extra}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            ) : currentStepType === "bedtime" ? (
              /* ─── BEDTIME PSEUDO-EVENT ─── */
              <div style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>😴</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Bedtime</span>
                  </div>
                  <div style={{ fontSize: "12px", color: th.muted, marginTop: "4px" }}>{tripNights} night{tripNights !== 1 ? "s" : ""}</div>
                </div>

                {/* Existing bedtime items */}
                {generalItems.filter(i => i.category === "sleepwear" || i.name.toLowerCase().includes("sleep") || i.name.toLowerCase().includes("pajama") || i.name.toLowerCase().includes("slipper")).map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                    <span style={{ fontSize: "14px" }}>{getCatIcon(item.category)}</span>
                    <span style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>{item.name}</span>
                    <button onClick={() => deleteItem(item.id, item.name)} style={{ background: "none", border: "none", color: "#e57373", cursor: "pointer", fontSize: "14px", padding: "2px" }}>✕</button>
                  </div>
                ))}

                {/* Bedtime suggestions */}
                <div style={{ padding: "12px 18px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: th.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Suggestions</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {getBedtimeSuggestions(userProfile?.gender || null).map((sug, sIdx) => {
                      const alreadyAdded = generalItems.some(i => i.name === sug.name);
                      return (
                        <button key={sIdx} onClick={() => { if (!alreadyAdded) addItem(sug.name, sug.category, null); }} disabled={alreadyAdded} style={{ padding: "5px 10px", borderRadius: "16px", border: `1px solid ${alreadyAdded ? "#c8e6c9" : th.cardBorder}`, background: alreadyAdded ? "#e8f5e9" : "white", fontSize: "11px", fontWeight: 600, cursor: alreadyAdded ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", color: alreadyAdded ? "#2e7d32" : th.text }}>
                          {alreadyAdded ? "✓ " : "+ "}{sug.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : currentStepType === "essentials" ? (
              /* ─── ESSENTIALS PSEUDO-EVENT (Undergarments + Toiletries) ─── */
              <div style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🧳</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Essentials</span>
                  </div>
                  <div style={{ fontSize: "12px", color: th.muted, marginTop: "4px" }}>Undergarments, toiletries & extras for {tripDays} days</div>
                </div>

                {/* Undergarments quantity pickers */}
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${th.cardBorder}` }}>
                  <div style={{ padding: "6px 18px", fontSize: "11px", fontWeight: 700, color: th.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Undergarments</div>
                  {essentialsDefaults.map(row => (
                    <div key={row.key} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                      <span style={{ fontSize: "16px", marginRight: "10px" }}>{row.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: "10px", color: th.muted }}>{row.note}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => setEssentialsQty(prev => ({ ...prev, [row.key]: Math.max(0, (prev[row.key] || row.defaultQty) - 1) }))} style={{ width: "28px", height: "28px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, background: "white", cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontSize: "15px", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{essentialsQty[row.key] ?? row.defaultQty}</span>
                        <button onClick={() => setEssentialsQty(prev => ({ ...prev, [row.key]: (prev[row.key] || row.defaultQty) + 1 }))} style={{ width: "28px", height: "28px", borderRadius: "8px", border: `1px solid ${th.cardBorder}`, background: "white", cursor: "pointer", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toiletries & extras suggestions */}
                {getToiletriesAndExtrasSuggestions(userProfile?.gender || null).map(section => (
                  <div key={section.section} style={{ padding: "12px 18px", borderBottom: `1px solid ${th.cardBorder}` }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: th.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{section.section}</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {section.items.map((sug, sIdx) => {
                        const alreadyAdded = generalItems.some(i => i.name === sug.name);
                        return (
                          <button key={sIdx} onClick={() => { if (!alreadyAdded) addItem(sug.name, sug.category, null); }} disabled={alreadyAdded} style={{ padding: "5px 10px", borderRadius: "16px", border: `1px solid ${alreadyAdded ? "#c8e6c9" : th.cardBorder}`, background: alreadyAdded ? "#e8f5e9" : "white", fontSize: "11px", fontWeight: 600, cursor: alreadyAdded ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", color: alreadyAdded ? "#2e7d32" : th.text }}>
                            {alreadyAdded ? "✓ " : "+ "}{sug.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Add essentials to list */}
                <div style={{ padding: "14px 18px" }}>
                  {!essentialsAdded ? (
                    <button onClick={async () => {
                      for (const row of essentialsDefaults) {
                        const qty = essentialsQty[row.key] ?? row.defaultQty;
                        for (let n = 1; n <= qty; n++) {
                          await addItem(qty > 1 ? `${row.itemName} #${n}` : row.itemName, row.category, null);
                        }
                      }
                      setEssentialsAdded(true);
                    }} style={{ width: "100%", padding: "12px", background: accent, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add Essentials to List</button>
                  ) : (
                    <div style={{ textAlign: "center", color: "#2e7d32", fontSize: "13px", fontWeight: 700 }}>✓ Essentials added!</div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Spacer for fixed nav */}
            <div style={{ height: "80px" }} />
          </div>
        )}

        {/* Fixed bottom navigation for walkthrough — outside the scrollable div, same pattern as sticky CTA */}
        {activeView === "walkthrough" && (
          <div style={{ position: "fixed", bottom: "56px", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "480px", zIndex: 101, padding: "0 16px 12px", boxSizing: "border-box" as const, background: `linear-gradient(to top, ${th.bg} 70%, transparent)`, pointerEvents: "none" as const }}>
            <div style={{ pointerEvents: "auto" as const, display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "14px", padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
              <button disabled={currentEventIdx === 0} onClick={() => setCurrentEventIdx(prev => Math.max(0, prev - 1))} style={{ padding: "10px 14px", borderRadius: "10px", border: `1px solid ${th.cardBorder}`, background: "white", fontSize: "13px", fontWeight: 700, cursor: currentEventIdx === 0 ? "not-allowed" : "pointer", opacity: currentEventIdx === 0 ? 0.4 : 1, fontFamily: "'DM Sans', sans-serif" }}>← Prev</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: "12px", fontWeight: 700, color: accent, fontFamily: "'DM Sans', sans-serif" }}>Step {currentEventIdx + 1} of {totalSteps}</span>
              {currentEventIdx < totalSteps - 1 ? (
                <button onClick={() => setCurrentEventIdx(prev => Math.min(totalSteps - 1, prev + 1))} style={{ padding: "10px 14px", borderRadius: "10px", background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`, color: "white", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(232,148,58,0.3)" }}>
                  Next →
                </button>
              ) : (
                <button onClick={() => setActiveView("checklist")} style={{ padding: "10px 14px", borderRadius: "10px", background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`, color: "white", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(232,148,58,0.3)" }}>Pack & Go →</button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  VIEW: CHECKLIST (Pack & Go)                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === "checklist" && (
          <div style={{ padding: "16px" }}>
            {/* CSS for completion animation */}
            <style>{`
              @keyframes checkDraw {
                0% { transform: scale(0) rotate(-45deg); opacity: 0; }
                50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes fadeUp {
                0% { opacity: 0; transform: translateY(8px); }
                100% { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* 4e: Completion animation */}
            {showAllSet && (
              <div style={{ background: "white", borderRadius: "16px", border: "1px solid #2e7d3230", padding: "24px 18px", marginBottom: "14px", textAlign: "center" }}>
                <div style={{ animation: "checkDraw 0.5s ease-out forwards", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "50%", background: "#2e7d32", marginBottom: "10px" }}>
                  <span style={{ color: "#fff", fontSize: "24px", fontWeight: 900 }}>✓</span>
                </div>
                <div style={{ animation: "fadeUp 0.4s ease-out 0.3s both", fontSize: "16px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#2e7d32" }}>
                  You're all set!
                </div>
                {assignedToBagCount < totalCount && (
                  <div style={{ animation: "fadeUp 0.4s ease-out 0.6s both", fontSize: "12px", color: th.muted, marginTop: "8px" }}>
                    Want to organize into bags?{" "}
                    <span onClick={() => { setEditingBags(true); bagSetupRef.current?.scrollIntoView({ behavior: "smooth" }); }} style={{ color: accent, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                      Set up your bags ↓
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4a: Summary stats line */}
            <div style={{ fontSize: "12px", color: th.muted, marginBottom: "12px", textAlign: "center" }}>
              {consolidatedItems.length} items · {multiUseCount} multi-use · {memberOutfitGroups.length} outfit groups
            </div>

            {/* Progress bar */}
            <div style={{ background: "white", borderRadius: "12px", border: `1px solid ${th.cardBorder}`, padding: "14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700 }}>{allPacked ? "All packed! 🎉" : `${packedCount} of ${totalCount} packed`}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: accent }}>{totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0}%</span>
              </div>
              <div style={{ height: "8px", background: "#f5f5f5", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: allPacked ? "#2e7d32" : accent, width: `${totalCount > 0 ? (packedCount / totalCount) * 100 : 0}%`, borderRadius: "4px", transition: "width 0.3s" }} />
              </div>
            </div>

            {/* 4b: Your Bags setup card */}
            <div ref={bagSetupRef} style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, padding: "16px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>🧳 Your Bags</div>
                  <div style={{ fontSize: "11px", color: th.muted, marginTop: "2px" }}>Optional — organize where things go</div>
                </div>
                <button onClick={() => setEditingBags(!editingBags)} style={{
                  background: editingBags ? `${accent}18` : "#f5f5f5",
                  border: `1px solid ${editingBags ? accent : th.cardBorder}`,
                  borderRadius: "8px", padding: "5px 10px", cursor: "pointer",
                  color: editingBags ? accent : th.muted, fontSize: "11px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                }}>
                  {editingBags ? "Done" : "Edit Bags"}
                </button>
              </div>

              {/* Bag pills (collapsed state) */}
              {bags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {bags.map(bag => {
                    const bSections = bagSections.filter(s => s.bag_id === bag.id);
                    const bContainers = bagContainers.filter(c => bSections.some(s => s.id === c.section_id));
                    return (
                      <div key={bag.id} style={{ background: "#f8f8f8", border: `1px solid ${th.cardBorder}`, borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>
                        <span style={{ marginRight: "4px" }}>{bag.icon}</span>
                        <span style={{ fontWeight: 600 }}>{bag.name}</span>
                        <span style={{ color: th.muted, marginLeft: "6px", fontSize: "10px" }}>
                          {bSections.length}s{bContainers.length > 0 ? ` · ${bContainers.length}c` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {bags.length === 0 && !editingBags && (
                <div style={{ fontSize: "12px", color: th.muted, fontStyle: "italic" }}>No bags set up yet</div>
              )}

              {/* Edit mode (expanded) */}
              {editingBags && (
                <div style={{ marginTop: "12px", borderTop: `1px solid ${th.cardBorder}`, paddingTop: "12px" }}>
                  {bags.map(bag => {
                    const bSections = bagSections.filter(s => s.bag_id === bag.id).sort((a, b) => a.sort_order - b.sort_order);
                    return (
                      <div key={bag.id} style={{ marginBottom: "14px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: "4px" }}>{bag.icon} {bag.name}</div>
                        {bSections.map(section => {
                          const sContainers = bagContainers.filter(c => c.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);
                          return (
                            <div key={section.id} style={{ marginLeft: "14px", borderLeft: `2px solid ${th.cardBorder}`, paddingLeft: "10px", marginBottom: "4px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 600, padding: "3px 0", fontFamily: "'DM Sans', sans-serif" }}>{section.name}</div>
                              {sContainers.map(c => (
                                <div key={c.id} style={{ marginLeft: "10px", fontSize: "10px", color: th.muted, padding: "2px 0", borderLeft: "2px solid #f0f0f0", paddingLeft: "8px" }}>📦 {c.name}</div>
                              ))}
                              {addingContainerToSection === section.id ? (
                                <div style={{ display: "flex", gap: "4px", marginLeft: "10px", marginTop: "3px" }}>
                                  <input value={newContainerName} onChange={e => setNewContainerName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addBagContainer(section.id, newContainerName); setNewContainerName(""); setAddingContainerToSection(null); } if (e.key === "Escape") setAddingContainerToSection(null); }} placeholder="Cube name..." autoFocus style={{ fontSize: "10px", padding: "3px 6px", borderRadius: "4px", border: `1px solid ${th.cardBorder}`, background: "white", flex: 1, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                                  <button onClick={() => { addBagContainer(section.id, newContainerName); setNewContainerName(""); setAddingContainerToSection(null); }} style={{ background: accent, border: "none", borderRadius: "4px", color: "#fff", fontSize: "10px", padding: "3px 8px", cursor: "pointer" }}>Add</button>
                                </div>
                              ) : (
                                <div onClick={() => { setAddingContainerToSection(section.id); setNewContainerName(""); }} style={{ marginLeft: "10px", fontSize: "10px", color: accent, cursor: "pointer", padding: "2px 0" }}>+ cube / pouch</div>
                              )}
                            </div>
                          );
                        })}
                        {addingSectionToBag === bag.id ? (
                          <div style={{ display: "flex", gap: "4px", marginLeft: "14px", marginTop: "3px" }}>
                            <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addBagSection(bag.id, newSectionName); setNewSectionName(""); setAddingSectionToBag(null); } if (e.key === "Escape") setAddingSectionToBag(null); }} placeholder="Section name..." autoFocus style={{ fontSize: "10px", padding: "3px 6px", borderRadius: "4px", border: `1px solid ${th.cardBorder}`, background: "white", flex: 1, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                            <button onClick={() => { addBagSection(bag.id, newSectionName); setNewSectionName(""); setAddingSectionToBag(null); }} style={{ background: accent, border: "none", borderRadius: "4px", color: "#fff", fontSize: "10px", padding: "3px 8px", cursor: "pointer" }}>Add</button>
                          </div>
                        ) : (
                          <div onClick={() => { setAddingSectionToBag(bag.id); setNewSectionName(""); }} style={{ marginLeft: "14px", fontSize: "10px", color: accent, cursor: "pointer", padding: "3px 0" }}>+ section</div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", paddingTop: "8px", borderTop: "1px solid #f0f0f0" }}>
                    <input value={newBagName} onChange={e => setNewBagName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addBag(newBagName); setNewBagName(""); } }} placeholder="New bag name..." style={{ fontSize: "11px", padding: "5px 8px", borderRadius: "6px", border: `1px solid ${th.cardBorder}`, background: "white", flex: 1, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                    <button onClick={() => { addBag(newBagName); setNewBagName(""); }} style={{ background: accent, border: "none", borderRadius: "6px", color: "#fff", fontSize: "11px", padding: "5px 12px", cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>+ Add Bag</button>
                  </div>
                </div>
              )}
            </div>

            {/* Minimalist gauge */}
            {packingStyle === "minimalist" && (
              <div style={{ background: "white", borderRadius: "12px", border: `1px solid ${th.cardBorder}`, padding: "10px 14px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px" }}>🎒</span>
                <div style={{ flex: 1, height: "6px", background: "#f5f5f5", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: consolidatedItems.length > 25 ? "#c62828" : "#2e7d32", width: `${Math.min(100, (consolidatedItems.length / 25) * 100)}%`, borderRadius: "3px" }} />
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: consolidatedItems.length > 25 ? "#c62828" : "#2e7d32" }}>{consolidatedItems.length}/25</span>
              </div>
            )}

            {/* 4c: Grouped checklist items with bag assignment dropdowns */}
            {Object.entries(groupItems(consolidatedItems)).map(([groupKey, groupEntries]) => {
              const groupPacked = groupEntries.filter(e => e.item.is_packed).length;
              const catInfo = PACKING_CATEGORIES.find(c => c.value === groupKey);

              return (
                <div key={groupKey} style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", marginBottom: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px" }}>{catInfo?.icon || "📦"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "capitalize" as const }}>{catInfo?.label || groupKey}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: groupPacked === groupEntries.length ? "#2e7d32" : th.muted, fontWeight: 600 }}>{groupPacked}/{groupEntries.length}</span>
                  </div>

                  {/* Spontaneous: collapsible group */}
                  {packingStyle === "spontaneous" ? (
                    <SpontaneousGroup entries={groupEntries} accent={accent} th={th} togglePacked={togglePacked} />
                  ) : (
                    groupEntries.map((entry, idx) => {
                      const assignment = getAssignment(entry.item.id);
                      const selectedBag = bags.find(b => b.id === assignment?.bag_id);
                      const selectedBagSections = selectedBag ? bagSections.filter(s => s.bag_id === selectedBag.id) : [];
                      const selectedSection = selectedBagSections.find(s => s.id === assignment?.section_id);
                      const selectedSectionContainers = selectedSection ? bagContainers.filter(c => c.section_id === selectedSection.id) : [];
                      return (
                        <div key={entry.item.id} style={{ padding: "8px 18px", borderBottom: idx < groupEntries.length - 1 ? `1px solid ${th.cardBorder}` : "none", background: entry.item.is_packed ? `${accent}04` : "transparent" }}>
                          {/* Row 1: checkbox + name */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div onClick={() => togglePacked(entry.item.id)} style={{ width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0, cursor: "pointer", border: `2px solid ${entry.item.is_packed ? accent : "#d0d0d0"}`, background: entry.item.is_packed ? accent : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {entry.item.is_packed && <span style={{ color: "white", fontSize: "12px", fontWeight: 900 }}>✓</span>}
                            </div>
                            <span style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: entry.item.is_packed ? th.muted : th.text, textDecoration: entry.item.is_packed ? "line-through" : "none", fontFamily: "'DM Sans', sans-serif" }}>{entry.item.name}</span>
                            {entry.eventCount > 1 && (
                              <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: "#e8f5e9", color: "#2e7d32", fontWeight: 700 }}>↻ ×{entry.eventCount}</span>
                            )}
                          </div>
                          {/* Row 2: bag assignment dropdowns */}
                          {bags.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", marginTop: "6px", marginLeft: "32px" }}>
                              <select value={assignment?.bag_id || ""} onChange={e => assignItemToBag(entry.item.id, "bag_id", e.target.value || null)} style={{ fontSize: "10px", padding: "3px 5px", borderRadius: "4px", border: `1px solid ${th.cardBorder}`, background: "white", color: th.text, cursor: "pointer", minWidth: 0, flex: 1, fontFamily: "'DM Sans', sans-serif" }}>
                                <option value="">Bag...</option>
                                {bags.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                              </select>
                              <select value={assignment?.section_id || ""} onChange={e => assignItemToBag(entry.item.id, "section_id", e.target.value || null)} style={{ fontSize: "10px", padding: "3px 5px", borderRadius: "4px", border: `1px solid ${th.cardBorder}`, background: "white", color: th.text, cursor: "pointer", minWidth: 0, flex: 1, fontFamily: "'DM Sans', sans-serif", opacity: selectedBag ? 1 : 0.35 }} disabled={!selectedBag}>
                                <option value="">Section...</option>
                                {selectedBagSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <select value={assignment?.container_id || ""} onChange={e => assignItemToBag(entry.item.id, "container_id", e.target.value || null)} style={{ fontSize: "10px", padding: "3px 5px", borderRadius: "4px", border: `1px solid ${th.cardBorder}`, background: "white", color: th.text, cursor: "pointer", minWidth: 0, flex: 1, fontFamily: "'DM Sans', sans-serif", opacity: selectedSectionContainers.length > 0 ? 1 : 0.35 }} disabled={selectedSectionContainers.length === 0}>
                                <option value="">Cube...</option>
                                {selectedSectionContainers.map(c => <option key={c.id} value={c.id}>📦 {c.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

            {/* Don't Forget section */}
            <div style={{ marginTop: "16px", background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span style={{ fontSize: "13px", fontWeight: 700 }}>Don't Forget</span>
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "10px", background: "#fff3e0", color: "#e65100", fontWeight: 700 }}>Reminders</span>
              </div>
              {DONT_FORGET_ITEMS.map((reminderName, idx) => (
                <button key={idx} onClick={() => setDontForgetChecked(prev => ({ ...prev, [reminderName]: !prev[reminderName] }))} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 18px", background: dontForgetChecked[reminderName] ? `${accent}06` : "transparent", border: "none", borderBottom: idx < DONT_FORGET_ITEMS.length - 1 ? "1px solid #f5f5f5" : "none", cursor: "pointer", textAlign: "left" as const, fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${dontForgetChecked[reminderName] ? accent : "#d0d0d0"}`, background: dontForgetChecked[reminderName] ? accent : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {dontForgetChecked[reminderName] && <span style={{ color: "white", fontSize: "12px", fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: dontForgetChecked[reminderName] ? th.muted : th.text, textDecoration: dontForgetChecked[reminderName] ? "line-through" : "none" }}>{reminderName}</span>
                </button>
              ))}
            </div>

            {/* Overpacker: Just-in-Case Extras */}
            {packingStyle === "overpacker" && (
              <div style={{ marginTop: "16px", background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>🧳</span>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>Just-in-Case Extras</span>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "10px", background: "#fff3e0", color: "#e65100", fontWeight: 700 }}>Backup</span>
                </div>
                {JUST_IN_CASE_EXTRAS.map((extraName, idx) => {
                  const existingItem = justInCaseItems.find(i => i.name === extraName);
                  return (
                    <button key={idx} onClick={async () => {
                      if (existingItem) {
                        await togglePacked(existingItem.id);
                      } else {
                        await addJustInCaseExtra(extraName);
                      }
                    }} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 18px", background: existingItem?.is_packed ? `${accent}06` : "transparent", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left" as const, fontFamily: "'DM Sans', sans-serif" }}>
                      <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${existingItem?.is_packed ? accent : "#d0d0d0"}`, background: existingItem?.is_packed ? accent : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {existingItem?.is_packed && <span style={{ color: "white", fontSize: "12px", fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: existingItem?.is_packed ? th.muted : th.text, textDecoration: existingItem?.is_packed ? "line-through" : "none" }}>{extraName}</span>
                      {!existingItem && <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: "#fff3e0", color: "#e65100", fontWeight: 600, marginLeft: "auto" }}>Tap to add</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 4d: Bag Summary tree */}
            {(() => {
              const bagsWithAssignments = bags.map(bag => {
                const bagItems = consolidatedItems.filter(e => getAssignment(e.item.id)?.bag_id === bag.id);
                return { ...bag, bagItems, itemCount: bagItems.length };
              }).filter(b => b.itemCount > 0);

              if (bagsWithAssignments.length === 0) return null;

              return (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🗂️</span> Bag Summary
                  </div>
                  {bagsWithAssignments.map(bag => {
                    const bSections = bagSections.filter(s => s.bag_id === bag.id);
                    return (
                      <div key={bag.id} style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", marginBottom: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "18px" }}>{bag.icon}</span>
                            <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{bag.name}</span>
                          </div>
                          <span style={{ fontSize: "11px", color: th.muted, fontWeight: 600 }}>{bag.itemCount} items</span>
                        </div>
                        {bSections.map(section => {
                          const sectionItems = bag.bagItems.filter(e => getAssignment(e.item.id)?.section_id === section.id);
                          if (sectionItems.length === 0) return null;
                          const sContainers = bagContainers.filter(c => c.section_id === section.id);
                          return (
                            <div key={section.id} style={{ padding: "6px 18px 6px 28px", borderBottom: "1px solid #f8f8f8" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: th.text, marginBottom: "3px", fontFamily: "'DM Sans', sans-serif" }}>{section.name}</div>
                              {sContainers.map(container => {
                                const cItems = sectionItems.filter(e => getAssignment(e.item.id)?.container_id === container.id);
                                if (cItems.length === 0) return null;
                                return (
                                  <div key={container.id} style={{ marginLeft: "10px", marginBottom: "3px", borderLeft: "2px solid #f0f0f0", paddingLeft: "8px" }}>
                                    <div style={{ fontSize: "10px", color: th.muted, fontWeight: 600, marginBottom: "1px" }}>📦 {container.name}</div>
                                    {cItems.map(e => (
                                      <div key={e.item.id} style={{ fontSize: "11px", color: th.text, padding: "1px 0", fontFamily: "'DM Sans', sans-serif" }}>{e.item.name}</div>
                                    ))}
                                  </div>
                                );
                              })}
                              {sectionItems.filter(e => !getAssignment(e.item.id)?.container_id).map(e => (
                                <div key={e.item.id} style={{ fontSize: "11px", color: th.text, padding: "1px 0", fontFamily: "'DM Sans', sans-serif" }}>{e.item.name}</div>
                              ))}
                            </div>
                          );
                        })}
                        {bag.bagItems.filter(e => !getAssignment(e.item.id)?.section_id).map(e => (
                          <div key={e.item.id} style={{ padding: "4px 18px", fontSize: "11px", color: th.text, display: "flex", alignItems: "center", gap: "6px", fontFamily: "'DM Sans', sans-serif" }}>
                            {e.item.name}
                            <span style={{ fontSize: "9px", color: "#e65100" }}>unsorted</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div style={{ height: "80px" }} />
    </div>
  );
}

// ─── Spontaneous Packing Style: Collapsible category group ───
function SpontaneousGroup({ entries, accent, th, togglePacked }: {
  entries: { item: PackingItem; events: ItineraryEvent[]; eventCount: number }[];
  accent: string;
  th: { text: string; muted: string; cardBorder: string };
  togglePacked: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const packedCount = entries.filter(e => e.item.is_packed).length;

  return (
    <div style={{ padding: "6px 18px 12px" }}>
      <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: "12px", color: th.muted, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▶</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: th.text }}>{entries.length} items</span>
        <span style={{ fontSize: "10px", color: packedCount === entries.length ? "#2e7d32" : th.muted }}>({packedCount} packed)</span>
      </button>
      {expanded && entries.map((entry, idx) => (
        <button key={entry.item.id} onClick={() => togglePacked(entry.item.id)} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 0", background: "none", border: "none", borderBottom: idx < entries.length - 1 ? "1px solid #f5f5f5" : "none", cursor: "pointer", textAlign: "left" as const, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "5px", border: `2px solid ${entry.item.is_packed ? accent : "#d0d0d0"}`, background: entry.item.is_packed ? accent : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {entry.item.is_packed && <span style={{ color: "white", fontSize: "11px", fontWeight: 900 }}>✓</span>}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: entry.item.is_packed ? th.muted : th.text, textDecoration: entry.item.is_packed ? "line-through" : "none" }}>{entry.item.name}</span>
        </button>
      ))}
    </div>
  );
}
