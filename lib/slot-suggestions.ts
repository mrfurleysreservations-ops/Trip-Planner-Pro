// ─── Slot-based outfit builder — shared types, mappings, suggestions ───
//
// The outfit builder on the Packing → Outfits view is a 2×3 grid of slots.
// Each slot is a fixed category; tapping it opens a bottom-sheet modal
// scoped to that slot. This module owns the canonical slot vocabulary and
// the dress-code-keyed suggestion lists rendered inside the modal.
//
// packing_items.category remains the source of truth for persistence;
// SLOT_CATEGORY_MAP maps DB category values back to a slot so existing
// items surface in the right tile. SLOT_INSERT_CATEGORY picks the canonical
// value to store when the modal creates a new item.

export type SlotKey = "dress" | "top" | "layer" | "bottom" | "shoes" | "accessories";

export interface SlotDef {
  key: SlotKey;
  label: string;
  emoji: string;
  /** Single-select slots close on first pick. Accessories accumulates then commits on Done. */
  multi: boolean;
  /** Placeholder shown when the tile is empty. */
  empty: string;
}

export const SLOT_DEFS: Record<SlotKey, SlotDef> = {
  dress:       { key: "dress",       label: "Dress",       emoji: "👗", multi: false, empty: "+ add dress" },
  top:         { key: "top",         label: "Top",         emoji: "👕", multi: false, empty: "+ add top" },
  layer:       { key: "layer",       label: "Layer",       emoji: "🧥", multi: false, empty: "+ optional" },
  bottom:      { key: "bottom",      label: "Bottom",      emoji: "👖", multi: false, empty: "+ add bottom" },
  shoes:       { key: "shoes",       label: "Shoes",       emoji: "👟", multi: false, empty: "+ add shoes" },
  accessories: { key: "accessories", label: "Accessories", emoji: "💼", multi: true,  empty: "+ hat, jewelry…" },
};

// Render order in the 2×3 grid. Dress replaces position 1 when visible.
export const SLOT_ORDER_WITH_DRESS: SlotKey[]   = ["dress", "top", "layer", "bottom", "shoes", "accessories"];
export const SLOT_ORDER_WITHOUT_DRESS: SlotKey[] = ["top", "layer", "bottom", "shoes", "accessories"];

// Tiles visually dimmed when Dress slot is filled.
export const DIMMED_WHEN_DRESS_FILLED: SlotKey[] = ["top", "layer", "bottom"];

// ─── Category ↔ slot mapping ────────────────────────────────────────
// packing_items.category uses plural canonical values (see
// PACKING_CATEGORIES in lib/constants.ts): "dresses", "tops", "outerwear",
// "bottoms", "shoes", "accessories". The alias list covers historic/
// imported rows so they still light up the right tile.

const CATEGORY_TO_SLOT_MAP: Record<string, SlotKey> = {
  // Dress
  dresses: "dress", dress: "dress",
  // Top
  tops: "top", top: "top", shirt: "top", shirts: "top", blouse: "top", blouses: "top",
  // Layer
  outerwear: "layer", layer: "layer", jacket: "layer", jackets: "layer",
  sweater: "layer", sweaters: "layer", cardigan: "layer", cardigans: "layer",
  // Bottom
  bottoms: "bottom", bottom: "bottom", pants: "bottom", shorts: "bottom", skirt: "bottom", skirts: "bottom",
  // Shoes
  shoes: "shoes", footwear: "shoes",
  // Accessories (includes legacy head / hat / jewelry / bag values collapsed by migration)
  accessories: "accessories", accessory: "accessories",
  hat: "accessories", hats: "accessories", headwear: "accessories", head: "accessories",
  jewelry: "accessories", bag: "accessories", bags: "accessories",
};

/** Map a packing_items.category value to a slot, or null if it doesn't belong in the outfit grid. */
export function slotForCategory(category: string | null | undefined): SlotKey | null {
  if (!category) return null;
  return CATEGORY_TO_SLOT_MAP[category.toLowerCase().trim()] ?? null;
}

/** Canonical category to store when inserting a new item from a given slot. */
export const SLOT_INSERT_CATEGORY: Record<SlotKey, string> = {
  dress:       "dresses",
  top:         "tops",
  layer:       "outerwear",
  bottom:      "bottoms",
  shoes:       "shoes",
  accessories: "accessories",
};

// ─── Suggestions ────────────────────────────────────────────────────
// Dress-code-keyed curated lists shown as dashed chips in the sheet when the
// user has nothing to reuse. Kept intentionally short — 4–6 per slot — so
// the sheet stays skimmable. Gender-neutral phrasing; the Dress slot only
// appears when enabled, so gendered items can live there directly.

type DressCodeKey = "casual" | "smart_casual" | "formal" | "active" | "swimwear" | "outdoor" | "business";

const DEFAULT_DRESS_CODE: DressCodeKey = "casual";

const SUGGESTIONS: Record<SlotKey, Record<DressCodeKey, string[]>> = {
  dress: {
    casual:       ["Sundress", "T-shirt dress", "Midi dress", "Wrap dress"],
    smart_casual: ["Midi dress", "Wrap dress", "Slip dress", "Shirt dress"],
    formal:       ["Cocktail dress", "Gown", "Little black dress", "Maxi dress"],
    active:       ["Tennis dress", "Athletic dress"],
    swimwear:     ["Beach coverup dress", "Kaftan"],
    outdoor:      ["Hiking dress", "Athletic wrap dress"],
    business:     ["Sheath dress", "A-line dress", "Shirt dress"],
  },
  top: {
    casual:       ["T-shirt", "Tank top", "Henley", "Graphic tee", "Long-sleeve"],
    smart_casual: ["Cotton blouse", "Button-up shirt", "Tank top", "Henley", "Sundress top"],
    formal:       ["Silk blouse", "Dress shirt", "Tuxedo shirt", "Formal top"],
    active:       ["Athletic tank", "Performance tee", "Long-sleeve base layer", "Sports bra"],
    swimwear:     ["Bikini top", "One-piece", "Rashguard", "Tankini top"],
    outdoor:      ["Moisture-wicking tee", "Flannel", "Base layer top", "UPF long-sleeve"],
    business:     ["Button-up shirt", "Shell top", "Blouse", "Turtleneck"],
  },
  layer: {
    casual:       ["Cardigan", "Denim jacket", "Hoodie", "Light sweater"],
    smart_casual: ["Blazer", "Light cardigan", "Cropped jacket", "Shacket"],
    formal:       ["Suit jacket", "Tuxedo jacket", "Wrap", "Shawl"],
    active:       ["Windbreaker", "Quarter-zip", "Track jacket", "Puffer vest"],
    swimwear:     ["Kaftan", "Linen shirt", "Lightweight coverup"],
    outdoor:      ["Rain shell", "Fleece", "Puffer", "Softshell"],
    business:     ["Blazer", "Sport coat", "Cardigan"],
  },
  bottom: {
    casual:       ["Jeans", "Chino shorts", "Joggers", "Casual shorts"],
    smart_casual: ["Chinos", "Midi skirt", "Dress pants", "Dark jeans"],
    formal:       ["Tuxedo pants", "Dress pants", "Formal skirt"],
    active:       ["Leggings", "Athletic shorts", "Joggers", "Bike shorts"],
    swimwear:     ["Swim trunks", "Board shorts", "Sarong"],
    outdoor:      ["Hiking pants", "Convertible pants", "Hiking shorts"],
    business:     ["Dress pants", "Pencil skirt", "Trousers"],
  },
  shoes: {
    casual:       ["White sneakers", "Sandals", "Slip-ons", "Loafers"],
    smart_casual: ["Loafers", "Clean sneakers", "Heeled sandals", "Ankle boots"],
    formal:       ["Oxfords", "Heels", "Dress flats", "Patent leather"],
    active:       ["Running shoes", "Cross-trainers", "Tennis shoes"],
    swimwear:     ["Flip flops", "Slides", "Water shoes"],
    outdoor:      ["Hiking boots", "Trail runners", "Waterproof boots"],
    business:     ["Oxfords", "Pumps", "Loafers", "Professional flats"],
  },
  accessories: {
    casual:       ["Sunglasses", "Baseball cap", "Watch", "Crossbody bag", "Simple necklace"],
    smart_casual: ["Watch", "Sunglasses", "Statement earrings", "Belt", "Clutch"],
    formal:       ["Formal watch", "Bow tie", "Cufflinks", "Clutch", "Statement jewelry"],
    active:       ["Baseball cap", "Sweatband", "Fitness watch", "Hair ties"],
    swimwear:     ["Wide-brim hat", "Sunglasses", "Beach tote", "Sunscreen"],
    outdoor:      ["Cap or beanie", "Sunglasses", "Daypack", "Bandana"],
    business:     ["Watch", "Belt", "Tie", "Professional bag", "Simple earrings"],
  },
};

/**
 * Suggestion chips for a slot, keyed to an event's dress code. Falls back to
 * casual when the dress code is unset or unknown so the sheet is never empty.
 */
export function getSlotSuggestions(slot: SlotKey, dressCode: string | null | undefined): string[] {
  const key = (dressCode || "").toLowerCase() as DressCodeKey;
  const byCode = SUGGESTIONS[slot];
  return byCode[key] || byCode[DEFAULT_DRESS_CODE] || [];
}
