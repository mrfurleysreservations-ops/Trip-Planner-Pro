// Trip types
export const TRIP_TYPES = [
  { value: "camping", label: "Camping", icon: "🏕️", tagline: "Into the wild" },
  { value: "flying", label: "Flying", icon: "✈️", tagline: "Beach & beyond" },
  { value: "roadtrip", label: "Road Trip", icon: "🚗", tagline: "Route 66 vibes" },
  { value: "meetup", label: "Meetup", icon: "🤝", tagline: "Get together" },
];

// Visual themes per trip type
export interface ThemeConfig {
  bg: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  card: string;
  cardBorder: string;
  headerBg: string;
  vibeBg?: string;
}

export const THEMES: { [key: string]: ThemeConfig } = {
  home: {
    bg: "#f8f8f8",
    accent: "#e8943a", accent2: "#c75a2a", text: "#1a1a1a", muted: "#777",
    card: "rgba(0,0,0,0.03)", cardBorder: "#e0e0e0",
    headerBg: "#fff",
  },
  camping: {
    bg: "#f5f8f2",
    accent: "#5a9a2f", accent2: "#e68a00", text: "#1a1a1a", muted: "#6a7a5a",
    card: "rgba(90,154,47,0.06)", cardBorder: "rgba(90,154,47,0.2)",
    headerBg: "#eef4e8",
    vibeBg: "radial-gradient(ellipse at 20% 80%, rgba(90,154,47,0.06) 0%, transparent 50%)",
  },
  flying: {
    bg: "#f2f8fa",
    accent: "#0097a7", accent2: "#e65100", text: "#1a1a1a", muted: "#5a7a8a",
    card: "rgba(0,151,167,0.06)", cardBorder: "rgba(0,151,167,0.2)",
    headerBg: "#e8f4f6",
    vibeBg: "radial-gradient(ellipse at 80% 20%, rgba(0,151,167,0.06) 0%, transparent 50%)",
  },
  roadtrip: {
    bg: "#faf6f0",
    accent: "#e65100", accent2: "#f9a825", text: "#1a1a1a", muted: "#8a7a5a",
    card: "rgba(230,81,0,0.06)", cardBorder: "rgba(230,81,0,0.2)",
    headerBg: "#f5ede0",
    vibeBg: "radial-gradient(ellipse at 50% 90%, rgba(230,81,0,0.06) 0%, transparent 50%)",
  },
  meetup: {
    bg: "#f8f2fa",
    accent: "#9c27b0", accent2: "#e91e63", text: "#1a1a1a", muted: "#8a6a9a",
    card: "rgba(156,39,176,0.06)", cardBorder: "rgba(156,39,176,0.2)",
    headerBg: "#f0e4f4",
    vibeBg: "radial-gradient(ellipse at 30% 50%, rgba(156,39,176,0.06) 0%, transparent 50%)",
  },
};

// Member types
export const AGE_TYPES = [
  { value: "adult", label: "Adult", icon: "🧑" },
  { value: "kid", label: "Kid (5-12)", icon: "🧒" },
  { value: "toddler", label: "Toddler (1-4)", icon: "👶" },
  { value: "baby", label: "Baby (<1)", icon: "🍼" },
];

export const APPETITE_TYPES = [
  { value: "light", label: "Light eater", multiplier: 0.7 },
  { value: "normal", label: "Normal eater", multiplier: 1.0 },
  { value: "hungry", label: "Hungry eater", multiplier: 1.4 },
];

// Onboarding — profile constants

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

// Packing preferences

export const PACKING_STYLES = [
  { value: "planner", label: "The Planner", icon: "📋", description: "I lay out outfits for each day and match them to my itinerary" },
  { value: "minimalist", label: "The Minimalist", icon: "🎒", description: "One bag, versatile pieces, nothing extra" },
  { value: "overpacker", label: "The Overpacker", icon: "🧳", description: "Better to have it and not need it than need it and not have it" },
  { value: "spontaneous", label: "The Spontaneous", icon: "⚡", description: "I throw things in last minute and figure it out" },
  { value: "hyper_organizer", label: "The Hyper-Organizer", icon: "🗂️", description: "Color-coded cubes, verified checklists, nothing left to chance" },
] as const;

export const ORGANIZATION_METHODS = [
  { value: "by_day", label: "By Day", icon: "📅", description: "Day 1 cube, Day 2 cube..." },
  { value: "by_category", label: "By Category", icon: "🏷️", description: "All tops together, all bottoms together" },
  { value: "by_activity", label: "By Activity", icon: "🎯", description: "Beach stuff, dinner stuff, hiking stuff" },
  { value: "by_outfit", label: "By Outfit", icon: "👔", description: "Complete outfits grouped together" },
  { value: "no_preference", label: "No Preference", icon: "🤷", description: "I don't think about it" },
] as const;

export const FOLDING_METHODS = [
  { value: "rolling", label: "Rolling", icon: "🌀", description: "Roll everything tight to save space" },
  { value: "konmari", label: "KonMari File Fold", icon: "📁", description: "Items stand upright so I can see everything" },
  { value: "bundle", label: "Bundle Wrapping", icon: "🎁", description: "Wrap clothes around a core for zero wrinkles" },
  { value: "flat_fold", label: "Flat Fold", icon: "📄", description: "Traditional fold and stack" },
  { value: "no_preference", label: "No Preference", icon: "🤷", description: "Whatever works" },
] as const;

export const COMPARTMENT_SYSTEMS = [
  { value: "packing_cubes", label: "Packing Cubes", icon: "🧊" },
  { value: "compression_bags", label: "Compression Bags", icon: "🫧" },
  { value: "ziplock", label: "Ziplock Bags", icon: "🛍️" },
  { value: "none", label: "Just Toss It In", icon: "🎲" },
  { value: "no_preference", label: "No Preference", icon: "🤷" },
] as const;

export const CHECKLIST_LEVELS = [
  { value: "minimal", label: "Minimal", description: "Just remind me of the big stuff" },
  { value: "standard", label: "Standard", description: "A solid checklist I can check off" },
  { value: "detailed", label: "Detailed", description: "Sub-categories, quantities, the works" },
  { value: "obsessive", label: "Obsessive", description: "Verification step, repack confirmation, nothing forgotten" },
] as const;

export const PLANNING_TIMELINES = [
  { value: "weeks_ahead", label: "Weeks Before", icon: "📆" },
  { value: "days_ahead", label: "A Few Days Before", icon: "🗓️" },
  { value: "night_before", label: "Night Before", icon: "🌙" },
  { value: "morning_of", label: "Morning Of", icon: "☀️" },
] as const;

export const JUST_IN_CASE_LEVELS = [
  { value: "only_planned", label: "Only What's Planned", description: "If it's not on the itinerary, it's not in the bag" },
  { value: "few_extras", label: "A Few Extras", description: "One backup outfit, just in case" },
  { value: "every_scenario", label: "Every Scenario", description: "What if there's a pool? What if it snows?" },
] as const;

export const VISUAL_PLANNING_STYLES = [
  { value: "lay_out_physical", label: "Lay It All Out", icon: "🛏️", description: "I spread everything on the bed first" },
  { value: "digital_preview", label: "Digital Preview", icon: "📱", description: "Show me a visual checklist on screen" },
  { value: "skip", label: "Skip This Step", icon: "⏭️", description: "Just give me the list" },
] as const;

// Inventory
export const ITEM_CATEGORIES = [
  { value: "gear", label: "Gear", icon: "⛺" },
  { value: "electronics", label: "Electronics", icon: "🔌" },
  { value: "cleaning", label: "Cleaning", icon: "🧹" },
  { value: "kitchen", label: "Kitchen", icon: "🍳" },
  { value: "clothing", label: "Clothing", icon: "👕" },
  { value: "safety", label: "First Aid", icon: "🩹" },
  { value: "comfort", label: "Bedding", icon: "🛏️" },
  { value: "tools", label: "Tools", icon: "🔧" },
  { value: "food", label: "Food", icon: "🥫" },
  { value: "other", label: "Other", icon: "📦" },
];

export const CAR_ZONES = [
  { value: "frunk", label: "Frunk" },
  { value: "trunk", label: "Trunk" },
  { value: "roofbox", label: "Roof Box" },
  { value: "backseat", label: "Back Seats" },
  { value: "frontseat", label: "Front Seats" },
  { value: "towhitch", label: "Tow Hitch" },
  { value: "none", label: "Not Assigned" },
];

// ─── Gear Library (Phase 1) ───
// Reusable gear bins live on /gear and are keyed to a car location.
// CAR_LOCATIONS is the canonical ordering used for grouping, color, and the
// `default_location` check constraint on public.gear_bins.
export const CAR_LOCATIONS = [
  { value: 'frunk',     label: 'Frunk',     color: '#4a7bc8' },
  { value: 'cabin',     label: 'Cabin',     color: '#9b59b6' },
  { value: 'trunk',     label: 'Trunk',     color: '#e65100' },
  { value: 'roofbox',   label: 'Roofbox',   color: '#0097a7' },
  { value: 'tow_hitch', label: 'Tow hitch', color: '#c8503a' },
] as const;

export type CarLocation = typeof CAR_LOCATIONS[number]['value'];

export const GEAR_ICONS = [
  '📦','🏕️','🔥','💧','🛌','🧰','🩹','🎣','🧺','🔦',
  '🚴','🧗','❄️','🌞','🛶','🧭','⛺','🪵','🍳','🔋',
] as const;

export const MEALS = ["Breakfast", "Lunch", "Dinner"];

export const SUGGESTED_MEALS: { [key: string]: { name: string; ingredients: string; baseServings: number }[] } = {
  Breakfast: [
    { name: "Pancakes & Bacon", ingredients: "2 cups pancake mix\n4 eggs\n1 cup milk\n1 lb bacon\n1/2 cup syrup", baseServings: 4 },
    { name: "Egg Burritos", ingredients: "12 eggs\n1 lb sausage\n8 tortillas\n2 cups cheese\n1 jar salsa", baseServings: 8 },
    { name: "French Toast", ingredients: "1 loaf bread\n6 eggs\n1 cup milk\n2 tsp cinnamon\n2 tbsp butter", baseServings: 4 },
  ],
  Lunch: [
    { name: "Burgers", ingredients: "3 lbs ground beef\n12 buns\nlettuce, tomato\n12 cheese slices\nketchup", baseServings: 6 },
    { name: "Quesadillas", ingredients: "2 lbs chicken\n12 tortillas\n3 cups cheese\n1 jar salsa", baseServings: 6 },
    { name: "Walking Tacos", ingredients: "2 lbs ground beef\n1 taco seasoning\n8 bags Fritos\n2 cups cheese", baseServings: 8 },
  ],
  Dinner: [
    { name: "Foil Fajitas", ingredients: "3 lbs chicken\n3 peppers\n2 onions\n12 tortillas\nfajita seasoning", baseServings: 6 },
    { name: "Campfire Chili", ingredients: "3 lbs beef\n3 cans beans\n2 cans tomatoes\nchili seasoning", baseServings: 8 },
    { name: "Steak & Potatoes", ingredients: "4 lbs steak\n3 lbs potatoes\n2 heads broccoli\n4 tbsp butter", baseServings: 6 },
  ],
};

// Booking types for logistics
export const BOOKING_TYPES = [
  { value: "flight", label: "Flight", icon: "✈️" },
  { value: "hotel", label: "Hotel / Lodging", icon: "🏨" },
  { value: "car_rental", label: "Car Rental", icon: "🚗" },
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
] as const;

// Expense categories
export const EXPENSE_CATEGORIES = [
  { value: "activity", label: "Activity", icon: "🎯" },
  { value: "dining", label: "Dining", icon: "🍽️" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "groceries", label: "Groceries", icon: "🛒" },
  { value: "hotel", label: "Lodging", icon: "🏨" },
  { value: "other", label: "Other", icon: "💳" },
] as const;

// Expense split types
export const SPLIT_TYPES = [
  { value: "family", label: "Split by Family/Person", description: "Each family or single counts as one equal share" },
  { value: "per_person", label: "Split Per Head", description: "Divided by total headcount — families pay more" },
  { value: "custom", label: "Custom Amounts", description: "Set each party's share manually" },
] as const;

// ─── Supplies (Phase 1) ───
// Grocery aisle ordering for the derived Grocery view — kept in
// shopping order so the rendered list reads top-to-bottom as a
// reasonable store path. `value` mirrors the meal_items.grocery_section
// check constraint exactly.
export const GROCERY_SECTIONS = [
  { value: 'produce',   label: 'Produce' },
  { value: 'meat',      label: 'Meat & Seafood' },
  { value: 'dairy',     label: 'Dairy & Eggs' },
  { value: 'pantry',    label: 'Pantry' },
  { value: 'bakery',    label: 'Bakery' },
  { value: 'frozen',    label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'snacks',    label: 'Snacks' },
  { value: 'other',     label: 'Other' },
] as const;
export type GrocerySection = typeof GROCERY_SECTIONS[number]['value'];

// Shared non-food supplies bought/consumed for the trip. Durable owned
// gear lives in the separate Gear Library (gear_bins/gear_items), not
// here. `value` mirrors the supply_items.category check constraint.
export const SUPPLY_CATEGORIES = [
  { value: 'fuel',        label: 'Fuel' },         // firewood, propane, charcoal, lighter fluid
  { value: 'consumables', label: 'Consumables' },  // ice, batteries, duct tape, zip ties
  { value: 'disposables', label: 'Disposables' },  // paper plates, cups, trash bags
  { value: 'toiletries',  label: 'Toiletries' },   // sunscreen, bug spray, wipes, TP
  { value: 'event',       label: 'Event' },        // sashes, decorations, favors, games
  { value: 'other',       label: 'Other' },
] as const;
export type SupplyCategory = typeof SUPPLY_CATEGORIES[number]['value'];

export const SUPPLY_STATUSES = [
  { value: 'needed',    label: 'Needed',    color: '#c75a2a' },
  { value: 'claimed',   label: 'Claimed',   color: '#e8943a' },
  { value: 'purchased', label: 'Purchased', color: '#4a7c59' },
] as const;
export type SupplyStatus = typeof SUPPLY_STATUSES[number]['value'];

export const MEAL_UNITS = [
  'each','lb','oz','g','kg','cup','tbsp','tsp','bottle','bag','pkg','gal','qt',
] as const;

// Itinerary event types
export const EVENT_TYPES = [
  { value: "travel", label: "Travel", icon: "✈️" },
  { value: "activity", label: "Activity", icon: "🎯" },
  { value: "dining", label: "Dining", icon: "🍽️" },
  { value: "outdoors", label: "Outdoors", icon: "🌿" },
  { value: "nightlife", label: "Nightlife", icon: "🌙" },
  { value: "downtime", label: "Downtime", icon: "☕" },
  { value: "shopping", label: "Shopping", icon: "🛍️" },
  { value: "other", label: "Other", icon: "📌" },
] as const;

// ─── Role Preferences (RSVP Energy) ───
// Per-trip role that drives UI density: default tab, sub-nav order, chat noise level.
// Must never hide features — only reorder/re-default them. See docs/role-based-onboarding.md.
//
// Sub-nav invariants (enforced by TripSubNav + lib/role-density.ts):
//   • `primaryTabs.length === 4` — exactly 4 tabs ride in the bottom bar.
//   • Every segment in `primaryTabs` MUST also appear in `subNavOrder`.
//   • The ⋯ More sheet renders `subNavOrder.filter(t => !primaryTabs.includes(t))`,
//     preserving `subNavOrder` as the canonical ordering of all 7 tabs.
//   • Adding a new tab = append it to `subNavOrder` for each role. It auto-shows
//     in the More sheet; no other code changes required.
export const ROLE_PREFERENCES = [
  {
    value: "all_in",
    label: "All In",
    icon: "🔥",
    tagline: "I'm doing this, get out of my way",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "expenses", "chat", "packing", "notes", "supplies", "group"],
    primaryTabs: ["itinerary", "expenses", "chat", "packing"],
    chatDefault: "all",
  },
  {
    value: "helping_out",
    label: "Helping Out",
    icon: "🙌",
    tagline: "I've got you on whatever you need",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "packing", "chat", "expenses", "notes", "supplies", "group"],
    primaryTabs: ["itinerary", "packing", "chat", "expenses"],
    chatDefault: "all",
  },
  {
    value: "just_here",
    label: "Just Here",
    icon: "🎟️",
    tagline: "I showed up, that's the contribution",
    defaultTab: "expenses",
    subNavOrder: ["expenses", "chat", "itinerary", "group", "packing", "notes", "supplies"],
    primaryTabs: ["expenses", "chat", "itinerary", "group"],
    chatDefault: "mentions",
  },
  {
    value: "vibes_only",
    label: "Vibes Only",
    icon: "✌️",
    tagline: "Don't @ me, I'll see you there",
    defaultTab: "itinerary",
    subNavOrder: ["itinerary", "expenses", "chat", "group", "packing", "notes", "supplies"],
    primaryTabs: ["itinerary", "chat", "expenses", "group"],
    chatDefault: "muted",
  },
] as const;

export type RolePreference = (typeof ROLE_PREFERENCES)[number]["value"];

// Note conversion destinations (categorization at conversion time, not creation)
export const NOTE_CONVERT_OPTIONS = [
  { value: "event", label: "Itinerary Event", icon: "📅", description: "Add to the schedule with a date & time" },
  { value: "packing", label: "Packing / Shopping Item", icon: "🛍️", description: "Something to buy, bring, or pack" },
  { value: "meal", label: "Meal", icon: "🍽️", description: "Restaurant, recipe, or food to plan" },
  { value: "supply", label: "Supply", icon: "🛒", description: "Shared gear, fuel, or consumables the group needs" },
  { value: "reference", label: "Keep as Reference", icon: "📌", description: "Pin this note — no action needed" },
] as const;

// Dress codes for itinerary events
export const DRESS_CODES = [
  { value: "casual", label: "Casual" },
  { value: "smart_casual", label: "Smart Casual" },
  { value: "formal", label: "Formal" },
  { value: "active", label: "Active / Athletic" },
  { value: "swimwear", label: "Swimwear" },
  { value: "outdoor", label: "Outdoor / Hiking" },
  { value: "business", label: "Business" },
] as const;

// Time slot display order
export const TIME_SLOTS = [
  { value: "morning", label: "Morning", icon: "🌅" },
  { value: "afternoon", label: "Afternoon", icon: "☀️" },
  { value: "evening", label: "Evening", icon: "🌙" },
] as const;

// Packing item categories (for the packing page item categorization)
export const PACKING_CATEGORIES = [
  { value: "tops", label: "Tops", icon: "👕" },
  { value: "bottoms", label: "Bottoms", icon: "👖" },
  { value: "dresses", label: "Dresses", icon: "👗" },
  { value: "outerwear", label: "Outerwear", icon: "🧥" },
  { value: "shoes", label: "Shoes", icon: "👟" },
  { value: "undergarments", label: "Undergarments", icon: "🩲" },
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

// Dress code to suggested item categories mapping — gender-aware
// Use getDressCodeSuggestions(dressCode, gender) to get the right list
export interface DressCodeSuggestion {
  categories: string[];
  female: string[];
  male: string[];
  neutral: string[];
}

export const DRESS_CODE_SUGGESTIONS: Record<string, DressCodeSuggestion> = {
  casual: {
    categories: ["tops", "bottoms", "shoes", "accessories"],
    female: ["Comfortable tee or blouse", "Jeans or casual shorts", "Sneakers or sandals", "Crossbody bag"],
    male: ["T-shirt or polo", "Jeans or chinos", "Sneakers or loafers", "Watch or sunglasses"],
    neutral: ["Comfortable top", "Casual pants or shorts", "Sneakers or sandals"],
  },
  smart_casual: {
    categories: ["tops", "bottoms", "dresses", "shoes", "accessories"],
    female: ["Nice blouse or silk top", "Dress pants or midi skirt", "Heeled sandals or flats", "Statement jewelry"],
    male: ["Button-down shirt", "Chinos or dress pants", "Loafers or clean sneakers", "Belt"],
    neutral: ["Button-down or nice top", "Dress pants or skirt", "Closed-toe shoes"],
  },
  formal: {
    categories: ["tops", "bottoms", "dresses", "shoes", "accessories", "outerwear"],
    female: ["Cocktail dress or gown", "Heels or dressy flats", "Clutch purse", "Formal jewelry"],
    male: ["Suit jacket", "Dress shirt", "Dress pants", "Dress shoes", "Tie or pocket square"],
    neutral: ["Formal outfit", "Dress shoes", "Formal accessories"],
  },
  active: {
    categories: ["activewear", "shoes", "accessories", "gear"],
    female: ["Athletic top or sports bra", "Leggings or athletic shorts", "Athletic shoes", "Hair ties", "Water bottle"],
    male: ["Athletic shirt", "Athletic shorts", "Athletic shoes", "Sweatband or hat", "Water bottle"],
    neutral: ["Athletic top", "Athletic shorts or leggings", "Athletic shoes", "Water bottle"],
  },
  swimwear: {
    categories: ["swimwear", "shoes", "accessories", "toiletries"],
    female: ["Bikini or one-piece", "Coverup or sarong", "Sandals or flip flops", "Sunscreen", "Sunglasses", "Beach tote"],
    male: ["Swim trunks", "Rashguard or tank top", "Sandals or flip flops", "Sunscreen", "Sunglasses"],
    neutral: ["Swimsuit", "Coverup", "Sandals or flip flops", "Sunscreen", "Sunglasses"],
  },
  outdoor: {
    categories: ["tops", "bottoms", "outerwear", "shoes", "gear"],
    female: ["Moisture-wicking top", "Hiking pants or shorts", "Hiking boots or trail shoes", "Sun hat", "Daypack"],
    male: ["Moisture-wicking shirt", "Hiking pants or shorts", "Hiking boots or trail shoes", "Cap or hat", "Daypack"],
    neutral: ["Moisture-wicking top", "Hiking pants or shorts", "Hiking boots or trail shoes", "Hat"],
  },
  business: {
    categories: ["tops", "bottoms", "dresses", "shoes", "accessories"],
    female: ["Blazer", "Blouse or shell top", "Dress pants or pencil skirt", "Pumps or professional flats", "Professional tote"],
    male: ["Sport coat or blazer", "Dress shirt", "Dress pants", "Dress shoes", "Belt", "Professional bag"],
    neutral: ["Blazer", "Dress shirt or blouse", "Dress pants", "Dress shoes", "Professional bag"],
  },
};

// Helper to get suggestions for a gender
export function getDressCodeEssentials(dressCode: string, gender: string | null): string[] {
  const suggestions = DRESS_CODE_SUGGESTIONS[dressCode];
  if (!suggestions) return [];
  if (gender === "female") return suggestions.female;
  if (gender === "male") return suggestions.male;
  return suggestions.neutral;
}

// Daily essentials — gender-aware undergarments + basics
// These are suggested once per trip day, not per event
export function getDailyEssentials(gender: string | null): string[] {
  const base = ["Underwear", "Socks"];
  if (gender === "female") return [...base, "Bra"];
  return base;
}

// ─── Upgrade-path upsell cards (Profile → "Upgrade your trip experience") ───
// Re-surface onboarding steps skipped by Just Here / Vibes Only users so they can
// opt in later without re-doing onboarding. `showWhen` is evaluated by the profile
// page (e.g. "profile_incomplete" checks gender + age_range). See
// docs/role-based-onboarding.md → "Upgrade Paths".
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

export type UpsellCardKey = (typeof UPSELL_CARDS)[number]["key"];

// ─── Packing Style Defaults ───
// Maps each packing style to smart defaults for all sub-preferences.
// Used by onboarding (auto-fill on style pick) and profile (reset to defaults).
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
