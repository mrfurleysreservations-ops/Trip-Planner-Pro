"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, EVENT_TYPES, DRESS_CODES, TIME_SLOTS, PACKING_CATEGORIES, DRESS_CODE_SUGGESTIONS, getDressCodeEssentials, getDailyEssentials } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, OutfitGroup, OutfitGroupEvent, UserProfile, FamilyMember, PackingBag, PackingBagSection, PackingBagContainer, PackingItemAssignment } from "@/types/database.types";
import type { PackingPageProps } from "./page";
import type { TimeOfDay, WeatherBucket, ForecastCell, ForecastMap } from "@/lib/weather";
import { weatherChipText } from "@/lib/weather";
import TripSubNav from "../trip-sub-nav";
import { useTripData } from "../trip-data-context";
import SlotModal, { type ReuseChip } from "@/components/packing/slot-modal";
import GearView from "@/components/gear/gear-view";
import {
  SLOT_DEFS,
  SLOT_ORDER_WITH_DRESS,
  SLOT_ORDER_WITHOUT_DRESS,
  DIMMED_WHEN_DRESS_FILLED,
  SLOT_INSERT_CATEGORY,
  slotForCategory,
  type SlotKey,
} from "@/lib/slot-suggestions";

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

// Long-form variant used on the outfit card's day-header strip.
// Returns e.g. "Friday · April 17" — spelled-out weekday + month so the card
// reads as an obvious "here's which day you're packing for" label.
function formatLongDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  return `${weekday} · ${month} ${day}`;
}

// Given an outfit group's date and the trip's start/end dates, return a
// "Day N of M" label. Falls back to empty when trip dates aren't set yet.
function tripDayLabel(groupDate: string | null, tripStart: string | null, totalDays: number): string {
  if (!groupDate || !tripStart || totalDays <= 0) return "";
  const g = new Date(groupDate + "T12:00:00").getTime();
  const s = new Date(tripStart + "T12:00:00").getTime();
  const idx = Math.round((g - s) / (1000 * 60 * 60 * 24)) + 1;
  if (idx < 1 || idx > totalDays) return ""; // out-of-range → hide rather than lie
  return `Day ${idx} of ${totalDays}`;
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

// ─── Time-of-day bucketing for an event ───
// morning 05–10, afternoon 11–15, evening 16–20, night 21–04
function getEventTimeOfDay(evt: ItineraryEvent): TimeOfDay {
  if (evt.start_time) {
    const h = parseInt(evt.start_time.split(":")[0], 10);
    if (!isNaN(h)) {
      if (h >= 5 && h <= 10) return "morning";
      if (h >= 11 && h <= 15) return "afternoon";
      if (h >= 16 && h <= 20) return "evening";
      return "night";
    }
  }
  // Fallback: time_slot if it matches one of the four buckets
  const ts = evt.time_slot;
  if (ts === "morning" || ts === "afternoon" || ts === "evening" || ts === "night") return ts;
  return "afternoon";
}

// ─── Outfit tier + half-day grouping (grouping V2.1) ───
// Real packing mirrors real outfit changes. Casual + smart_casual collapse into
// one "casual family" tier that carries you through the day. Swim/active/formal
// always split because they're genuinely different outfits. Day splits into
// Daytime (morning+afternoon) vs Evening (evening+night) since most people
// change before dinner.
type OutfitTier = "casual" | "swim" | "active" | "formal";
type DayHalf = "day" | "eve";

function tierOf(dressCode: string | null | undefined): OutfitTier {
  if (dressCode === "swimwear") return "swim";
  if (dressCode === "active") return "active";
  if (dressCode === "formal") return "formal";
  return "casual"; // casual, smart_casual, business_casual, outdoor, business, null
}

function halfOf(tod: TimeOfDay): DayHalf {
  return (tod === "morning" || tod === "afternoon") ? "day" : "eve";
}

function halfLabel(half: DayHalf): string {
  return half === "day" ? "Daytime" : "Evening";
}

// Severity ranking: rain/snow rank highest so they dominate a half if present.
const WEATHER_SEVERITY: Record<WeatherBucket, number> = {
  snowy: 7, rainy: 6, cold: 5, hot_sunny: 4, warm_sunny: 3, mild: 2, unknown: 1,
};

// For a given (date, half), pick the most "severe" weather bucket across the
// TODs that fall inside that half. Used so a daytime-casual group gets one
// coherent weather bucket even though it spans morning + afternoon.
function weatherForHalf(forecast: ForecastMap, date: string | null, half: DayHalf): WeatherBucket {
  if (!date) return "unknown";
  const day = forecast[date];
  if (!day) return "unknown";
  const tods: TimeOfDay[] = half === "day" ? ["morning", "afternoon"] : ["evening", "night"];
  let best: WeatherBucket = "unknown";
  for (const t of tods) {
    const cell = day[t] || day["all_day"];
    if (!cell) continue;
    const bucket = (cell.bucket || "unknown") as WeatherBucket;
    if ((WEATHER_SEVERITY[bucket] || 0) > (WEATHER_SEVERITY[best] || 0)) best = bucket;
  }
  return best;
}

// ─── Time-of-day band visuals (shared between grouping + outfit cards) ───
// Colors stored as explicit start/end so multi-TOD groups can blend into a
// span-aware gradient (e.g. Morning-Afternoon fades sunrise → midday).
const TOD_BAND_STYLES: Record<TimeOfDay, { startColor: string; endColor: string; textColor: string; chipBg: string; emoji: string; label: string }> = {
  morning:   { startColor: "#f9c876", endColor: "#e8943a", textColor: "#fff",    chipBg: "rgba(255,255,255,0.25)",  emoji: "🌅", label: "Morning" },
  afternoon: { startColor: "#e8943a", endColor: "#c75a2a", textColor: "#fff",    chipBg: "rgba(255,255,255,0.25)",  emoji: "☀️", label: "Afternoon" },
  evening:   { startColor: "#7c4a9e", endColor: "#452a66", textColor: "#fff",    chipBg: "rgba(255,255,255,0.25)",  emoji: "🌆", label: "Evening" },
  night:     { startColor: "#1a2340", endColor: "#0a1020", textColor: "#ffd97a", chipBg: "rgba(255,217,122,0.16)", emoji: "🌙", label: "Night" },
};

const TOD_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

// Compute the distinct TODs covered by a group's events, sorted chronologically.
function spanTodsForEvents(events: ItineraryEvent[], fallback: TimeOfDay): TimeOfDay[] {
  if (events.length === 0) return [fallback];
  const present = new Set<TimeOfDay>();
  for (const e of events) {
    // Inline bucketing (keeps this a module-scope helper, no closure needed).
    let tod: TimeOfDay = fallback;
    if (e.start_time) {
      const h = parseInt(e.start_time.split(":")[0], 10);
      if (!isNaN(h)) {
        if (h >= 5 && h <= 10) tod = "morning";
        else if (h >= 11 && h <= 15) tod = "afternoon";
        else if (h >= 16 && h <= 20) tod = "evening";
        else tod = "night";
      }
    } else if (e.time_slot === "morning" || e.time_slot === "afternoon" || e.time_slot === "evening" || e.time_slot === "night") {
      tod = e.time_slot as TimeOfDay;
    }
    present.add(tod);
  }
  return TOD_ORDER.filter(t => present.has(t));
}

// Build a band style (gradient + label + emoji + text colors) for a span of
// TODs. Blends the earliest TOD's start color → latest TOD's end color, with
// a mid-stop from any intermediate TOD so 3-TOD spans don't go off-hue.
function buildBandForSpan(tods: TimeOfDay[]): { gradient: string; label: string; emoji: string; textColor: string; chipBg: string } {
  const ordered = tods.length > 0 ? tods : (["afternoon"] as TimeOfDay[]);
  const first = TOD_BAND_STYLES[ordered[0]];
  const last = TOD_BAND_STYLES[ordered[ordered.length - 1]];
  const stops: string[] = [first.startColor];
  if (ordered.length >= 3) {
    const mid = TOD_BAND_STYLES[ordered[Math.floor(ordered.length / 2)]];
    stops.push(mid.startColor);
  }
  stops.push(last.endColor);
  const gradient = `linear-gradient(90deg, ${stops.join(", ")})`;
  const label = ordered.map(t => TOD_BAND_STYLES[t].label).join("-");
  const emoji = ordered.length === 1 ? first.emoji : `${first.emoji} → ${last.emoji}`;
  // Night dominates text/chip styling if it's part of the span — else use the
  // last TOD's (which shares the light-on-dark pattern for morning/afternoon/
  // evening anyway).
  const nightInSpan = ordered.includes("night");
  const styleSource = nightInSpan ? TOD_BAND_STYLES.night : last;
  return { gradient, label, emoji, textColor: styleSource.textColor, chipBg: styleSource.chipBg };
}

function getCellFromForecast(forecast: ForecastMap, date: string | null, tod: TimeOfDay): ForecastCell | undefined {
  if (!date) return undefined;
  const day = forecast[date];
  if (!day) return undefined;
  return day[tod] || day["all_day"];
}

// Map an OutfitGroup's stored bucket back to a display chip when forecast lookup fails
function chipFromGroupMetadata(bucket: string | null, cell: ForecastCell | undefined): string {
  if (cell) return weatherChipText(cell);
  if (!bucket || bucket === "unknown") return "— weather pending";
  // Synthesize a label from the bucket alone (no temp available)
  switch (bucket as WeatherBucket) {
    case "hot_sunny": return "☀️ hot";
    case "warm_sunny": return "☀️ clear";
    case "mild": return "⛅ mild";
    case "cold": return "🥶 cold";
    case "rainy": return "🌧️ rain";
    case "snowy": return "❄️ snow";
    default: return "— weather pending";
  }
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
  participants, packingItems: initialPackingItems,
  packingOutfits: initialPackingOutfits, outfitPackingItems: initialOutfitPackingItems,
  outfitGroups: initialOutfitGroups, outfitGroupEvents: initialOutfitGroupEvents,
  userProfile, familyMembers,
  packingBags: initialPackingBags, packingBagSections: initialPackingBagSections,
  packingBagContainers: initialPackingBagContainers, packingItemAssignments: initialPackingItemAssignments,
  weatherForecast,
  libraryBins, libraryItems, tripGearBins, primaryVehicleName,
}: PackingPageProps) {
  const { trip, members, events, userId, isHost } = useTripData();
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
  const [activeView, setActiveView] = useState<"grouping" | "walkthrough" | "checklist" | "gear">(packingStyle === "spontaneous" ? "walkthrough" : "grouping");
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

  // ─── Slot-based outfit builder state ───
  // activeSlot opens the bottom-sheet picker for that slot.
  // overrideConfirm shows the "you're wearing a dress — add a [X] anyway?"
  // prompt when tapping a tile dimmed by a filled Dress slot.
  // dressSlotOverrides is an optimistic-update overlay for
  // trip_members.show_dress_slot so the UI updates instantly on toggle.
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [overrideConfirm, setOverrideConfirm] = useState<SlotKey | null>(null);
  const [dressSlotOverrides, setDressSlotOverrides] = useState<Record<string, boolean>>({});
  // Event timeline rows sit above the slot grid on the outfit card. Default
  // to collapsed so the 2×3 grid is the first thing in view — users can tap
  // the dress-code row to expand event details when they want them.
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // ─── Events for active member ───
  const activeMemberEvents = useMemo(() => {
    // Host + the host's own family (wife, kids — anyone linked via
    // family_member_id) are treated as auto-attending every trip event. No
    // opt-in dance for them; it's your family, they're going. Genuine outside
    // invitees (separate user accounts, no family link) still use the
    // event_participants opt-in filter.
    const am = members.find(m => m.id === activeMemberId);
    const isFamily = Boolean(am && (am.user_id === userId || am.family_member_id));

    const datedEvents = events.filter(e => e.date);
    const sorter = (a: ItineraryEvent, b: ItineraryEvent) => {
      if (a.date !== b.date) return a.date! < b.date! ? -1 : 1;
      const slotOrder: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };
      return (slotOrder[a.time_slot] || 0) - (slotOrder[b.time_slot] || 0);
    };

    if (isFamily) {
      return [...datedEvents].sort(sorter);
    }

    const memberParticipations = participants.filter(
      p => p.trip_member_id === activeMemberId && p.status === "attending"
    );
    const attendingEventIds = new Set(memberParticipations.map(p => p.event_id));
    return datedEvents.filter(e => attendingEventIds.has(e.id)).sort(sorter);
  }, [events, participants, activeMemberId, members, userId]);

  // ─── Trip duration for Quick Pack ───
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return activeMemberEvents.length > 0 ? Math.max(1, new Set(activeMemberEvents.map(e => e.date)).size) : 3;
    const start = new Date(trip.start_date + "T12:00:00");
    const end = new Date(trip.end_date + "T12:00:00");
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [trip.start_date, trip.end_date, activeMemberEvents]);
  const tripNights = Math.max(1, tripDays - 1);

  // ─── Outfit Groups: computed data for active member ───
  // Sort by (date, earliest event start_time in that group) so groups appear in
  // the real chronological order the user will wear them. Falls back to
  // sort_order when times tie or are missing.
  const memberOutfitGroups = useMemo(() => {
    const groupAnchor = new Map<string, string>();
    ofGroups.forEach(g => {
      if (g.trip_member_id !== activeMemberId) return;
      const eventIds = new Set(
        ofGroupEvents.filter(ge => ge.outfit_group_id === g.id).map(ge => ge.event_id)
      );
      const starts = activeMemberEvents
        .filter(e => eventIds.has(e.id))
        .map(e => e.start_time || "99:99")
        .sort();
      groupAnchor.set(g.id, starts[0] || "99:99");
    });
    return ofGroups.filter(g => g.trip_member_id === activeMemberId).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = groupAnchor.get(a.id) || "99:99";
      const bt = groupAnchor.get(b.id) || "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
  }, [ofGroups, ofGroupEvents, activeMemberEvents, activeMemberId]);

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
  // ─── Find events that aren't in this member's outfit groups yet ───
  // outfit_groups are per-member. "Ungrouped for this member" means the event
  // isn't in any outfit_group owned by activeMemberId — an event can be grouped
  // for the host but still ungrouped for Claire, and we need to group it for
  // her too. Filtering only by `ofGroupEvents` (cross-member) was the bug that
  // caused family members to land on an empty "Re-Group Events" state: once
  // the host was grouped, every event id was considered "grouped" and the
  // auto-group effect never fired for anyone else.
  const ungroupedEvents = useMemo(() => {
    const memberGroupIds = new Set(
      ofGroups.filter(g => g.trip_member_id === activeMemberId).map(g => g.id)
    );
    const groupedForMember = new Set(
      ofGroupEvents
        .filter(ge => memberGroupIds.has(ge.outfit_group_id))
        .map(ge => ge.event_id)
    );
    return activeMemberEvents.filter(e => !groupedForMember.has(e.id));
  }, [activeMemberEvents, ofGroupEvents, ofGroups, activeMemberId]);

  const autoGroupEvents = useCallback(async () => {
    if (autoGroupingRef.current) return;
    autoGroupingRef.current = true;
    try {
      // Incremental: only group events that aren't in any group yet
      if (ungroupedEvents.length === 0) return;

      // Composite-key buckets: (date, tier, day-half, weather).
      //   tier: casual/swim/active/formal — casual + smart_casual collapse into
      //         the "casual family" because you wear effectively the same outfit.
      //   half: "day" (morning+afternoon) or "eve" (evening+night) — most people
      //         change once before dinner.
      // Hard-split tiers (swim/active/formal) still get their own group per event
      // because they're genuinely separate outfits.
      const buckets = new Map<string, ItineraryEvent[]>();
      const bucketMeta = new Map<string, {
        date: string;
        tier: OutfitTier;
        half: DayHalf;
        weather: WeatherBucket;
        dressCode: string;
      }>();

      ungroupedEvents.forEach(evt => {
        const dressCode = evt.dress_code || "casual";
        const tier = tierOf(dressCode);
        const tod = getEventTimeOfDay(evt);
        const half = halfOf(tod);
        const weather = weatherForHalf(weatherForecast, evt.date, half);
        const isHardSplit = tier !== "casual";
        const keyTail = isHardSplit ? `__${evt.id}` : "";
        const key = `${evt.date}__${tier}__${half}__${weather}${keyTail}`;
        const bucket = buckets.get(key) || [];
        bucket.push(evt);
        buckets.set(key, bucket);
        if (!bucketMeta.has(key)) {
          bucketMeta.set(key, { date: evt.date!, tier, half, weather, dressCode });
        }
      });

      // Sort buckets by their earliest event so newly created groups get
      // sort_order values in chronological order (belt + suspenders with the
      // chronological sort in memberOutfitGroups).
      const orderedBuckets = [...buckets.entries()].sort((a, b) => {
        const aEarliest = a[1].map(e => e.start_time || "99:99").sort()[0] || "99:99";
        const bEarliest = b[1].map(e => e.start_time || "99:99").sort()[0] || "99:99";
        const metaA = bucketMeta.get(a[0])!;
        const metaB = bucketMeta.get(b[0])!;
        if (metaA.date !== metaB.date) return metaA.date < metaB.date ? -1 : 1;
        return aEarliest < bEarliest ? -1 : aEarliest > bEarliest ? 1 : 0;
      });

      const newGroups: OutfitGroup[] = [];
      const newGroupEvents: OutfitGroupEvent[] = [];
      let sortOrder = memberOutfitGroups.length;

      // Find an existing group that matches this bucket; unknown weather is a
      // wildcard on either side so weather arriving after grouping still fits.
      const findExistingMatch = (date: string, tier: OutfitTier, half: DayHalf, weather: WeatherBucket) => {
        if (tier !== "casual") return undefined; // hard-split tiers never merge
        return memberOutfitGroups.find(g => {
          if (g.date !== date) return false;
          if (tierOf(g.dress_code) !== tier) return false;
          const gTod = (g.time_of_day || "afternoon") as TimeOfDay;
          if (halfOf(gTod) !== half) return false;
          const gw = (g.weather_bucket || "unknown") as WeatherBucket;
          if (gw === "unknown" || weather === "unknown") return true;
          return gw === weather;
        });
      };

      const labelFor = (tier: OutfitTier, half: DayHalf, dressCode: string): string => {
        if (tier === "swim") return "Pool / Swim";
        if (tier === "active") return "Active";
        if (tier === "formal") return "Formal";
        return `${halfLabel(half)} · ${getDressCodeLabel(dressCode) || "Casual"}`;
      };

      // Representative TOD stored on the group (for card band styling). Casual
      // groups span a whole half-day, so pick the half's primary TOD.
      const repTodFor = (tier: OutfitTier, half: DayHalf, firstTod: TimeOfDay): TimeOfDay => {
        if (tier !== "casual") return firstTod;
        return half === "day" ? "afternoon" : "evening";
      };

      for (const [key, bucketEvents] of orderedBuckets) {
        const meta = bucketMeta.get(key)!;
        const { date, tier, half, weather, dressCode } = meta;

        const existingGroup = findExistingMatch(date, tier, half, weather);

        if (existingGroup) {
          for (const evt of bucketEvents) {
            const { data: ge, error: geErr } = await supabase.from("outfit_group_events").insert({
              outfit_group_id: existingGroup.id,
              event_id: evt.id,
            }).select().single();
            if (geErr) console.error("[autoGroupEvents] outfit_group_events insert failed", geErr);
            if (ge) newGroupEvents.push(ge as OutfitGroupEvent);
          }
        } else {
          const sortedEvents = [...bucketEvents].sort(
            (x, y) => (x.start_time || "99:99").localeCompare(y.start_time || "99:99")
          );
          const firstTod = getEventTimeOfDay(sortedEvents[0]);
          const todForGroup = repTodFor(tier, half, firstTod);
          // Store the most-dressy code among the bucket so styling reflects the
          // "peak" of the outfit (e.g. smart_casual > casual).
          const DRESS_RANK: Record<string, number> = {
            formal: 5, business: 4, smart_casual: 3, business_casual: 3,
            outdoor: 2, casual: 1, active: 1, swimwear: 1,
          };
          const peakDressCode = sortedEvents
            .map(e => e.dress_code || "casual")
            .reduce((best, dc) => ((DRESS_RANK[dc] || 0) > (DRESS_RANK[best] || 0) ? dc : best), dressCode);
          const label = labelFor(tier, half, peakDressCode);

          const { data: group, error } = await supabase.from("outfit_groups").insert({
            trip_id: trip.id,
            trip_member_id: activeMemberId,
            date,
            label,
            dress_code: peakDressCode,
            time_of_day: todForGroup,
            weather_bucket: weather,
            sort_order: sortOrder++,
          }).select().single();

          if (error || !group) {
            if (error) console.error("[autoGroupEvents] outfit_groups insert failed", error);
            continue;
          }
          newGroups.push(group as OutfitGroup);

          for (const evt of sortedEvents) {
            const { data: ge, error: geErr } = await supabase.from("outfit_group_events").insert({
              outfit_group_id: group.id,
              event_id: evt.id,
            }).select().single();
            if (geErr) console.error("[autoGroupEvents] outfit_group_events insert failed", geErr);
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
  }, [supabase, trip.id, activeMemberId, memberOutfitGroups, ungroupedEvents, weatherForecast]);

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

    // Create a new group for the split-off events — carry over the metadata
    // that drives card styling + re-grouping (time_of_day, weather_bucket) so
    // the split group renders with the same band/weather chip.
    const { data: newGroup } = await supabase.from("outfit_groups").insert({
      trip_id: trip.id,
      trip_member_id: activeMemberId,
      date: oldGroup.date,
      label: `${oldGroup.label} (split)`,
      dress_code: oldGroup.dress_code,
      time_of_day: oldGroup.time_of_day,
      weather_bucket: oldGroup.weather_bucket,
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

  // ─── Rebuild groups: nuke this member's groups and let auto-group recreate ───
  // Useful after the grouping logic changes, or when the user wants a clean
  // re-pass. Any manual merges/splits are cleared.
  const rebuildGroups = useCallback(async () => {
    if (typeof window !== "undefined" && !window.confirm("Rebuild outfit groups for this member? Any splits or merges you've done will be cleared.")) {
      return;
    }
    const memberGroupIds = ofGroups.filter(g => g.trip_member_id === activeMemberId).map(g => g.id);
    if (memberGroupIds.length > 0) {
      await supabase.from("outfit_group_events").delete().in("outfit_group_id", memberGroupIds);
      await supabase.from("outfit_groups").delete().in("id", memberGroupIds);
    }
    setOfGroupEvents(prev => prev.filter(ge => !memberGroupIds.includes(ge.outfit_group_id)));
    setOfGroups(prev => prev.filter(g => !memberGroupIds.includes(g.id)));
    setGroupingSelectedId(null);
    setGroupingMergeSource(null);
    // The useEffect on ungroupedEvents.length will trigger autoGroupEvents next.
  }, [supabase, ofGroups, activeMemberId]);

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

  // ─── Slot-based outfit builder: derived values ───
  // Resolves the 2×3 grid. show_dress_slot is the persisted per-member flag;
  // dressSlotOverrides is an optimistic overlay so the tile appears/vanishes
  // the moment the toggle flips, before the Supabase update resolves.
  const activeMember = useMemo(
    () => members.find(m => m.id === activeMemberId) || null,
    [members, activeMemberId],
  );
  const showsDress = useMemo(() => {
    if (!activeMember) return false;
    if (Object.prototype.hasOwnProperty.call(dressSlotOverrides, activeMember.id)) {
      return dressSlotOverrides[activeMember.id];
    }
    return Boolean(activeMember.show_dress_slot);
  }, [activeMember, dressSlotOverrides]);
  const slotOrder = showsDress ? SLOT_ORDER_WITH_DRESS : SLOT_ORDER_WITHOUT_DRESS;

  // Items belonging to the current outfit group, bucketed into slot tiles.
  // Anything whose category doesn't map to a slot (toiletries, documents…)
  // falls through and continues to live in its existing surfaces.
  const currentSlotItems = useMemo(() => {
    const buckets: Record<SlotKey, PackingItem[]> = {
      dress: [], top: [], layer: [], bottom: [], shoes: [], accessories: [],
    };
    currentEventItems.forEach(i => {
      const slot = slotForCategory(i.category);
      if (slot) buckets[slot].push(i);
    });
    return buckets;
  }, [currentEventItems]);

  // Reuse chips per slot — names already packed elsewhere by this member,
  // deduped by name + counted. Items already in the current group are
  // excluded so we don't offer a pick the user just made. Sort by highest
  // reuse count first so well-worn pieces surface.
  const slotReuseChips = useMemo(() => {
    const counts: Record<SlotKey, Map<string, number>> = {
      dress: new Map(), top: new Map(), layer: new Map(),
      bottom: new Map(), shoes: new Map(), accessories: new Map(),
    };
    const inCurrent: Record<SlotKey, Set<string>> = {
      dress: new Set(), top: new Set(), layer: new Set(),
      bottom: new Set(), shoes: new Set(), accessories: new Set(),
    };
    (Object.keys(currentSlotItems) as SlotKey[]).forEach(k => {
      currentSlotItems[k].forEach(i => inCurrent[k].add(i.name.toLowerCase()));
    });
    memberItems.forEach(i => {
      const slot = slotForCategory(i.category);
      if (!slot) return;
      if (inCurrent[slot].has(i.name.toLowerCase())) return;
      counts[slot].set(i.name, (counts[slot].get(i.name) || 0) + 1);
    });
    const out: Record<SlotKey, ReuseChip[]> = {
      dress: [], top: [], layer: [], bottom: [], shoes: [], accessories: [],
    };
    (Object.keys(counts) as SlotKey[]).forEach(slot => {
      out[slot] = Array.from(counts[slot].entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    });
    return out;
  }, [memberItems, currentSlotItems]);

  // ─── Outfit for current group (use first event in group for outfit lookup) ───
  const currentOutfit = useMemo(() => {
    if (!currentOutfitGroup) return null;
    // Look for outfit linked to group, or fallback to first event
    const byGroup = outfits.find(o => o.trip_member_id === activeMemberId && o.outfit_group_id === currentOutfitGroup.id);
    if (byGroup) return byGroup;
    if (currentEvent) return outfits.find(o => o.trip_member_id === activeMemberId && o.event_id === currentEvent.id) || null;
    return null;
  }, [outfits, activeMemberId, currentOutfitGroup, currentEvent]);

  // Reset inspo panel + timeline expansion when event or member changes.
  // Each new outfit card lands collapsed so the slot grid is above the fold.
  useEffect(() => {
    setInspoImages([]);
    setInspoPage(1);
    setInspoHasMore(false);
    setInspoError(null);
    setShowInspoPanel(false);
    setTimelineExpanded(false);
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

  // ─── Slot modal handlers ───
  // handleSlotAdd: commit N names to the given slot for the current event.
  // The slot's canonical category (dresses / tops / outerwear / bottoms /
  // shoes / accessories) is fixed — the modal never picks a category, so
  // the slot you tap is the slot the item lands in.
  const handleSlotAdd = useCallback(async (slot: SlotKey, names: string[]) => {
    if (!currentEvent) return;
    for (const name of names) {
      await addItem(name, SLOT_INSERT_CATEGORY[slot], currentEvent.id);
    }
  }, [addItem, currentEvent]);

  // handleSlotRemove: wrapper so the modal can remove by id only.
  const handleSlotRemove = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await deleteItem(itemId, item.name);
  }, [items, deleteItem]);

  // toggleDressSlot: flips trip_members.show_dress_slot for the active
  // member. Optimistic overlay applied first, reverted on Supabase error.
  const toggleDressSlot = useCallback(async (next: boolean) => {
    if (!activeMember) return;
    const id = activeMember.id;
    setDressSlotOverrides(prev => ({ ...prev, [id]: next }));
    const { error } = await supabase
      .from("trip_members")
      .update({ show_dress_slot: next })
      .eq("id", id);
    if (error) {
      console.error("toggleDressSlot error:", error);
      setDressSlotOverrides(prev => ({ ...prev, [id]: !next }));
    }
  }, [supabase, activeMember]);

  // openSlot: tile-tap handler. Top/Layer/Bottom are dimmed while a Dress
  // is in place — tapping a dimmed tile shows the swap-confirm prompt
  // instead of opening the picker.
  const openSlot = useCallback((slot: SlotKey) => {
    const dressFilled = currentSlotItems.dress.length > 0;
    if (dressFilled && DIMMED_WHEN_DRESS_FILLED.includes(slot)) {
      setOverrideConfirm(slot);
      return;
    }
    setActiveSlot(slot);
  }, [currentSlotItems]);

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

  // ─── Shared card scaffolding (Variant D): TOD band + meta row + timeline ───
  // Used by both the grouping card and the walkthrough outfit card.
  function renderCardScaffolding(args: {
    group: OutfitGroup;
    eventsInGroup: ItineraryEvent[];
    rightCounts: string;
    // When provided, the meta row becomes a tappable expand/collapse target
    // and the event timeline rows are hidden in the collapsed state so the
    // slot grid below is visible without scrolling. Legacy call sites that
    // omit these behave as before (timeline always expanded).
    collapsible?: boolean;
    expanded?: boolean;
    onToggleExpanded?: () => void;
  }) {
    const { group, eventsInGroup, rightCounts, collapsible, expanded, onToggleExpanded } = args;
    const showTimeline = !collapsible || expanded;
    const repTod = ((group.time_of_day as TimeOfDay) || "afternoon") as TimeOfDay;
    // Span label + blended gradient derived from the actual events' times
    // (falls back to the group's stored TOD when the group is empty).
    const spanTods = spanTodsForEvents(eventsInGroup, repTod);
    const band = buildBandForSpan(spanTods);
    // Weather lookup: prefer the span's first TOD (matches when the outfit
    // is put on) — falls back to the stored bucket via chipFromGroupMetadata.
    const weatherLookupTod = spanTods[0] || repTod;
    const cell = getCellFromForecast(weatherForecast, group.date, weatherLookupTod);
    const chip = chipFromGroupMetadata(group.weather_bucket, cell);
    const dressCode = group.dress_code || "casual";
    const dcColor = DRESS_CODE_COLORS[dressCode] || accent;

    // Day header: spelled-out weekday + date + trip-day counter so users
    // scrolling through 27 outfits never have to guess which day a card is for.
    // Hidden when the group has no date (shouldn't happen in practice but keeps
    // the card clean for any orphaned groups).
    const longDate = formatLongDate(group.date);
    const dayLabel = tripDayLabel(group.date, trip.start_date, tripDays);

    return (
      <>
        {/* Day header strip — warm-neutral divider sitting above the TOD band. */}
        {longDate && (
          <div style={{ padding: "6px 14px", background: "#fdf9f1", borderBottom: "1px solid #f0ebe4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "12px", color: "#2a2a2a" }}>{longDate}</span>
            {dayLabel && (
              <span style={{ fontSize: "10px", color: "#b8a68a", letterSpacing: "0.1em", textTransform: "uppercase" as const, fontWeight: 600 }}>{dayLabel}</span>
            )}
          </div>
        )}

        {/* Gradient time-of-day band */}
        <div style={{ padding: "9px 16px", background: band.gradient, color: band.textColor, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
          <span>{band.emoji} {band.label}</span>
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: 0, textTransform: "none" as const, background: band.chipBg, padding: "3px 9px", borderRadius: "12px" }}>{chip}</span>
        </div>

        {/* Meta row: dress-code pill + counts. Doubles as the expand/collapse
            handle when collapsible — chevron rotates to signal state. */}
        <div
          onClick={collapsible && onToggleExpanded ? onToggleExpanded : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? Boolean(expanded) : undefined}
          style={{ padding: "10px 16px", borderBottom: "1px solid #f0ebe4", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: collapsible ? "pointer" : "default", userSelect: "none" as const }}
        >
          <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", background: `${dcColor}18`, color: dcColor }}>{getDressCodeLabel(dressCode)}</span>
          <span style={{ fontSize: "11px", color: "#777", display: "flex", alignItems: "center", gap: "6px" }}>
            {rightCounts}
            {collapsible && (
              <span aria-hidden style={{ display: "inline-block", fontSize: "10px", color: "#999", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
            )}
          </span>
        </div>

        {/* Timeline event rows — hidden when collapsed */}
        {showTimeline && eventsInGroup.map((evt, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === eventsInGroup.length - 1;
          const subParts: string[] = [];
          if (evt.start_time) subParts.push(formatTime12h(evt.start_time));
          if (evt.location) subParts.push(evt.location);
          return (
            <div key={evt.id} style={{ display: "flex", alignItems: "flex-start", padding: "10px 16px", position: "relative" as const }}>
              {/* Vertical line via inner span (we trim top/bottom for first/last via height) */}
              <span aria-hidden style={{ position: "absolute" as const, left: 23, top: isFirst ? "50%" : 0, bottom: isLast ? "50%" : 0, width: 2, background: "#e8e8e8" }} />
              {/* Dot */}
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, position: "relative" as const, zIndex: 1, flexShrink: 0, marginLeft: 7, marginRight: 14, marginTop: 4, border: "2px solid #fff", boxShadow: `0 0 0 1px ${accent}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{getEventTypeIcon(evt.event_type)} {evt.title}</div>
                {subParts.length > 0 && (
                  <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>{subParts.join(" · ")}</div>
                )}
                {evt.description && (
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.4 }}>{evt.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  // ─── Empty state ───
  // Two distinct causes, two distinct messages:
  //   (A) The trip itself has no events yet        → "Build your itinerary first"
  //   (B) The trip has events, but THIS member     → "{Name} isn't opted in yet"
  //       isn't opted into any of them               (prompts host to add them in Itinerary)
  // Both land on the same CTA (Go to Itinerary) but the copy points the user
  // at the right thing to do next.
  if (activeMemberEvents.length === 0 && (activeView === "walkthrough" || activeView === "grouping")) {
    const tripHasEvents = events.length > 0;
    const memberFirstName = (activeMember?.name || "").split(" ")[0] || "This person";
    const title = tripHasEvents
      ? `${memberFirstName} isn't opted into any events yet`
      : "Build your itinerary first";
    const body = tripHasEvents
      ? `The trip has events — ${memberFirstName} just hasn't been opted in yet. Head to the itinerary, tap an event, and add ${memberFirstName} to the participants.`
      : "Packing is driven by your events. Add events to the itinerary and opt in participants — then come back here to plan outfits.";
    const emoji = tripHasEvents ? "🙋" : "📅";

    return (
      <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
        {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
        <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 2 }}>
          <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>Packing</h2>
        </div>
        <TripSubNav tripId={trip.id} theme={th} role={currentMember?.role_preference ?? null} />
        {/* Person Tabs — stay clickable so Joe can jump back to a member who IS opted in. */}
        <div style={{ display: "flex", gap: "0", padding: "0 16px", background: th.bg, borderBottom: `1px solid ${th.cardBorder}`, overflowX: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
          {myFamilyTripMembers.map(m => (
            <button key={m.id} onClick={() => { setActiveMemberId(m.id); setCurrentEventIdx(0); setGroupingActiveDay(0); }} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${m.id === activeMemberId ? accent : "transparent"}`, cursor: "pointer", transition: "all 0.2s" }}>
              <span style={{ fontSize: "13px", fontWeight: m.id === activeMemberId ? 700 : 500, color: m.id === activeMemberId ? th.text : th.muted, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
              {m.role === "host" && <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "8px", background: `${accent}18`, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Host</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "60px 20px", maxWidth: "500px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>{emoji}</div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>{title}</h3>
          <p style={{ color: th.muted, fontSize: "13px", marginBottom: "20px" }}>{body}</p>
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

      {/* ═══ STICKY TOP REGION — header + person tabs + view pill ═══ */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: th.headerBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${th.cardBorder}`,
      }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => router.push(`/trip/${trip.id}`)}
              aria-label="Back to trip hub"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `${accent}1a`,
                border: `1.5px solid ${accent}40`,
                color: accent,
                fontSize: 22,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s",
              }}
            >
              ←
            </button>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: "0 0 0 10px" }}>Packing</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: `${accent}14`, padding: "4px 10px", borderRadius: "20px" }}>
            <span style={{ fontSize: "13px" }}>{ps.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: accent }}>{ps.label}</span>
          </div>
        </div>

        {/* Person Tabs — hidden in Gear view since gear is family-shared, not per-person */}
        {activeView !== "gear" && (
          <div style={{ display: "flex", gap: "0", padding: "0 16px", background: th.bg, borderBottom: `1px solid ${th.cardBorder}`, overflowX: "auto", scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
            {myFamilyTripMembers.map(m => (
              <button key={m.id} onClick={() => { setActiveMemberId(m.id); setCurrentEventIdx(0); setGroupingActiveDay(0); }} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${m.id === activeMemberId ? accent : "transparent"}`, cursor: "pointer", transition: "all 0.2s" }}>
                <span style={{ fontSize: "13px", fontWeight: m.id === activeMemberId ? 700 : 500, color: m.id === activeMemberId ? th.text : th.muted, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
                {m.role === "host" && <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "8px", background: `${accent}18`, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Host</span>}
              </button>
            ))}
          </div>
        )}

        {/* View Switcher — canonical pill */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 16px 10px" }}>
          <div style={{ display: "inline-flex", background: th.card, border: `1.5px solid ${th.cardBorder}`, borderRadius: 20 }}>
            {(() => {
              // Gear is the host's car-loading tab — it's family-shared and
              // has no per-person breakdown, so only the host sees the pill.
              const baseViews = packingStyle === "spontaneous"
                ? [
                    { value: "walkthrough" as const, label: "Quick Pack" },
                    { value: "checklist" as const, label: "Pack & Go ✓" },
                  ]
                : [
                    { value: "grouping" as const, label: "Group" },
                    { value: "walkthrough" as const, label: "Outfits" },
                    { value: "checklist" as const, label: "Pack & Go ✓" },
                  ];
              return isHost
                ? [...baseViews, { value: "gear" as const, label: "Gear" }]
                : baseViews;
            })().map(v => (
              <button
                key={v.value}
                onClick={() => setActiveView(v.value)}
                style={{
                  background: activeView === v.value ? accent : "transparent",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: activeView === v.value ? 700 : 500,
                  color: activeView === v.value ? "#fff" : th.muted,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TripSubNav tripId={trip.id} theme={th} role={currentMember?.role_preference ?? null} />

      {/* Packing Style Banner — hidden in Gear view (gear is a car-loading tab, not a packing-style concern) */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {activeView !== "gear" && (
          <div style={{ margin: "12px 16px 0", padding: "10px 14px", background: `${accent}0a`, border: `1px solid ${th.cardBorder}`, borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", color: th.muted }}>{ps.desc}</span>
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
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", color: th.text, margin: "0 0 4px", lineHeight: 1.3 }}>
                    Wearing the same outfit to multiple events?
                  </h3>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>
                    Merge those events together.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>Outfit Groups ({memberOutfitGroups.length})</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {groupingMergeSource && (
                      <button onClick={() => setGroupingMergeSource(null)} style={{ fontSize: "11px", padding: "4px 10px", background: "#fff3e0", color: "#e65100", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Cancel Merge</button>
                    )}
                    {!groupingMergeSource && (
                      <button onClick={rebuildGroups} style={{ fontSize: "11px", padding: "4px 10px", background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }} title="Delete and re-create groups using the latest grouping rules">↻ Rebuild</button>
                    )}
                  </div>
                </div>

                {/* Day indicator */}
                {(() => {
                  const uniqueDates = [...new Set(memberOutfitGroups.map(g => g.date))].sort();
                  const activeDate = uniqueDates[groupingActiveDay] || uniqueDates[0];
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: th.text }}>
                        Day {groupingActiveDay + 1} — {formatDate(activeDate)}
                      </span>
                      <span style={{ fontSize: "11px", color: th.muted }}>
                        {groupingActiveDay + 1} of {uniqueDates.length}
                      </span>
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
                    const packedCountForGroup = memberItems.filter(i => i.event_id && groupEvents.some(e => e.id === i.event_id) && i.is_packed).length;

                    return (
                      <div key={group.id} onClick={() => setGroupingSelectedId(isSelected ? null : group.id)} style={{ background: "white", borderRadius: "16px", border: `1px solid ${isMergeSource ? "#e65100" : isSelected ? accent : th.cardBorder}`, overflow: "hidden", marginBottom: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", cursor: "pointer", transition: "all 0.2s" }}>
                        {renderCardScaffolding({
                          group,
                          eventsInGroup: groupEvents,
                          rightCounts: `${groupEvents.length} event${groupEvents.length !== 1 ? "s" : ""} · ${packedCountForGroup}/${itemCount} packed`,
                        })}

                        {/* Action row: merge/split */}
                        {isMergeTarget ? (
                          <div style={{ padding: "8px 16px 10px", borderTop: "1px solid #f0ebe4", background: "#fafafa" }}>
                            <button onClick={(e) => { e.stopPropagation(); mergeGroups(groupingMergeSource!, group.id); }} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "8px", background: "#e65100", color: "white", border: "none", cursor: "pointer", fontWeight: 700, width: "100%" }}>Merge here ↓</button>
                          </div>
                        ) : (
                          (() => {
                            const showMerge = !groupingMergeSource && dayGroups.length > 1;
                            const showSplit = groupEvents.length > 1 && !groupingMergeSource;
                            if (!showMerge && !showSplit) return null;
                            return (
                              <div style={{ padding: "8px 16px 10px", borderTop: "1px solid #f0ebe4", background: "#fafafa", display: "flex", gap: "8px" }}>
                                {showMerge && (
                                  <button onClick={(e) => { e.stopPropagation(); setGroupingMergeSource(group.id); }} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", background: "#fff3e0", color: "#e65100", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Merge with…</button>
                                )}
                                {showSplit && (
                                  <button onClick={(e) => { e.stopPropagation(); splitGroup(group.id, groupEvents[0].id); }} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", background: "#e3f2fd", color: "#1565c0", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Split</button>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  });
                })()}

                {/* Spacer for sticky CTA */}
                <div style={{ height: "80px" }} />

                {/* Sticky gradient Prev/Next CTA */}
                <div style={{ position: "fixed", bottom: "56px", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "480px", zIndex: 101, padding: "0 16px 12px", boxSizing: "border-box" as const, background: `linear-gradient(to top, ${th.bg} 70%, transparent)`, pointerEvents: "none" as const }}>
                  <div style={{ display: "flex", gap: "10px", pointerEvents: "auto" as const }}>
                    {/* Prev button — hidden on first day */}
                    {groupingActiveDay > 0 && (
                      <button onClick={() => setGroupingActiveDay(groupingActiveDay - 1)} style={{ flex: 1, padding: "16px 24px", fontSize: "16px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: accent, background: "white", border: `2px solid ${accent}`, borderRadius: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "52px" }}>
                        ← Prev Day
                      </button>
                    )}
                    {/* Next / Build Outfits button */}
                    <button onClick={() => {
                      const uniqueDates = [...new Set(memberOutfitGroups.map(g => g.date))].sort();
                      if (groupingActiveDay < uniqueDates.length - 1) {
                        setGroupingActiveDay(groupingActiveDay + 1);
                      } else {
                        setActiveView("walkthrough");
                      }
                    }} style={{ flex: 1, padding: "16px 24px", fontSize: "16px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#fff", background: `linear-gradient(135deg, ${accent} 0%, ${th.accent2} 100%)`, border: "none", borderRadius: "14px", cursor: "pointer", boxShadow: "0 4px 20px rgba(232,148,58,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "52px" }}>
                      {(() => {
                        const uniqueDates = [...new Set(memberOutfitGroups.map(g => g.date))].sort();
                        return groupingActiveDay < uniqueDates.length - 1 ? "Next Day →" : "Build Outfits →";
                      })()}
                    </button>
                  </div>
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
              /* ─── STANDARD: Event Outfit Card (Variant D) ─── */
              <div style={{ background: "white", borderRadius: "16px", border: `1px solid ${th.cardBorder}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>

                {/* Shared scaffolding: TOD band + meta row + timeline.
                    Timeline is collapsed by default on the outfit card so
                    the slot grid is the first thing users see. Tap the meta
                    row (dress code / counts) to expand event details. */}
                {renderCardScaffolding({
                  group: currentOutfitGroup,
                  eventsInGroup: currentGroupEvents,
                  rightCounts: `${currentGroupEvents.length} event${currentGroupEvents.length !== 1 ? "s" : ""} · ${currentEventItems.length} item${currentEventItems.length !== 1 ? "s" : ""}`,
                  collapsible: true,
                  expanded: timelineExpanded,
                  onToggleExpanded: () => setTimelineExpanded(e => !e),
                })}

                {/* ─── "Wear same outfit as…" reuse dropdown (above inspo per Variant D) ─── */}
                {eventsWithItems.length > 0 && currentEventItems.length === 0 && (
                  <div style={{ padding: "10px 16px", borderTop: "1px solid #f0ebe4", background: `${accent}06` }}>
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

                {/* ─── Dress slot toggle (per-member setting) ─── */}
                {/* Compact inline switch. Gates the Dress tile without a full settings page. */}
                <div style={{ padding: "10px 18px", borderTop: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: th.text }}>Include Dress slot</div>
                    <div style={{ fontSize: "10px", color: th.muted, marginTop: "2px" }}>Shows a pink-tinted Dress tile in the outfit grid.</div>
                  </div>
                  <button
                    onClick={() => toggleDressSlot(!showsDress)}
                    role="switch"
                    aria-checked={showsDress}
                    aria-label="Include Dress slot"
                    style={{
                      width: "44px", height: "24px", borderRadius: "12px",
                      background: showsDress ? "#ec4899" : "#d0c8b8",
                      border: "none", cursor: "pointer", padding: 0, position: "relative",
                      transition: "background 0.15s",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: "3px", left: showsDress ? "22px" : "3px",
                      width: "18px", height: "18px", borderRadius: "50%",
                      background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      transition: "left 0.15s",
                    }} />
                  </button>
                </div>

                {/* ─── Outfit slot grid (2×3) ─── */}
                {/* Each tile is scoped to a single slot. Tapping opens SlotModal;
                    tapping a tile dimmed by a filled Dress raises overrideConfirm. */}
                <div style={{ padding: "14px 16px", borderTop: `1px solid ${th.cardBorder}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                    {slotOrder.map(slotKey => {
                      const def = SLOT_DEFS[slotKey];
                      const bucket = currentSlotItems[slotKey];
                      const filled = bucket.length > 0;
                      const dressFilled = currentSlotItems.dress.length > 0;
                      const dimmed = dressFilled && DIMMED_WHEN_DRESS_FILLED.includes(slotKey);
                      const isDress = slotKey === "dress";
                      return (
                        <button
                          key={slotKey}
                          onClick={() => openSlot(slotKey)}
                          aria-label={filled ? `${def.label} (${bucket.length} item${bucket.length === 1 ? "" : "s"})` : `Add ${def.label}`}
                          style={{
                            padding: "14px 12px",
                            minHeight: "96px",
                            borderRadius: "14px",
                            border: filled
                              ? `1px solid ${isDress ? "#ec4899" : accent}`
                              : `1.5px dashed ${isDress ? "#f3a8cf" : "#d8cfbd"}`,
                            background: filled
                              ? (isDress ? "#fdf2f8" : "white")
                              : (isDress ? "#fff1f8" : "#fffdf8"),
                            cursor: "pointer",
                            display: "flex", flexDirection: "column",
                            alignItems: "flex-start", justifyContent: "flex-start", gap: "6px",
                            fontFamily: "'DM Sans', sans-serif", textAlign: "left" as const,
                            opacity: dimmed ? 0.42 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "18px" }}>{def.emoji}</span>
                            <span style={{
                              fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const,
                              letterSpacing: "0.06em",
                              color: isDress ? "#c73a86" : (filled ? accent : th.muted),
                            }}>{def.label}</span>
                          </div>
                          {filled ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                              {bucket.slice(0, 3).map(item => (
                                <div
                                  key={item.id}
                                  style={{
                                    fontSize: "13px", fontWeight: 600, color: th.text, lineHeight: 1.25,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, width: "100%",
                                  }}
                                >{item.name}</div>
                              ))}
                              {bucket.length > 3 && (
                                <div style={{ fontSize: "10px", color: th.muted, fontWeight: 600 }}>+{bucket.length - 3} more</div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: "12px", color: "#a0927a", fontWeight: 500 }}>{def.empty}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Override confirm: Dress is filled, user tapped Top/Layer/Bottom ─── */}
                {overrideConfirm && (
                  <div style={{ padding: "14px 16px", borderTop: `1px solid ${th.cardBorder}`, background: "#fdf2f8" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#9f2969", marginBottom: "4px" }}>
                      You're wearing a dress for this event.
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b4160", marginBottom: "10px" }}>
                      Add a {SLOT_DEFS[overrideConfirm].label.toLowerCase()} anyway? This will remove the dress and swap to separates.
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={async () => {
                          const toRemove = currentSlotItems.dress.slice();
                          const nextSlot = overrideConfirm;
                          for (const i of toRemove) await deleteItem(i.id, i.name);
                          setOverrideConfirm(null);
                          setActiveSlot(nextSlot);
                        }}
                        style={{ padding: "8px 14px", borderRadius: "10px", background: "#ec4899", color: "white", border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >Swap out dress</button>
                      <button
                        onClick={() => setOverrideConfirm(null)}
                        style={{ padding: "8px 14px", borderRadius: "10px", background: "white", color: th.muted, border: `1px solid ${th.cardBorder}`, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >Keep dress</button>
                    </div>
                  </div>
                )}

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

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  VIEW: GEAR (host-only, family-shared car-loading view)   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeView === "gear" && isHost && (
          <div style={{ padding: "0 16px" }}>
            <GearView
              tripId={trip.id}
              userId={userId}
              isHost={isHost}
              initialLibraryBins={libraryBins}
              initialLibraryItems={libraryItems}
              initialTripGearBins={tripGearBins}
              primaryVehicleName={primaryVehicleName}
              theme={th}
            />
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div style={{ height: "80px" }} />

      {/* ─── Slot modal (bottom-sheet picker) ─── */}
      {/* Rendered here so the scrim overlays the full page, not just the card. */}
      {activeSlot && currentEvent && (
        <SlotModal
          slotType={activeSlot}
          tripId={trip.id}
          activeMemberId={activeMemberId}
          outfitGroupId={currentOutfitGroup?.id || null}
          dressCode={currentEvent.dress_code}
          reuseChips={slotReuseChips[activeSlot]}
          currentInSlot={currentSlotItems[activeSlot]}
          onAdd={(names) => handleSlotAdd(activeSlot, names)}
          onRemove={handleSlotRemove}
          onClose={() => setActiveSlot(null)}
        />
      )}
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
