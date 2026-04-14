// ═══════════════════════════════════════════════════════════
//  ONBOARDING THEME & STEP DATA
// ═══════════════════════════════════════════════════════════

export const ACCENT = "#e8943a";
export const ACCENT2 = "#c75a2a";
export const BG = "#f8f8f8";

// ─── Full packing sub-step data with visuals + howItWorks ───

export const PACKING_SUB_STEPS = [
  {
    key: "packingStyle",
    title: "How do you pack?",
    subtitle: "This shapes your entire packing list — what gets suggested, how much, and how it's organized.",
    options: [
      { value: "planner", label: "The Planner", icon: "📋", visual: "planner", tagline: "Every outfit mapped to every event", description: "Your packing list mirrors your itinerary. Each event gets a planned outfit, and the list only includes what's needed.", howItWorks: ["Packing list auto-generates from your itinerary events", "Each event shows a suggested outfit based on dress code", "Nothing extra — if it's not on the schedule, it's not in the bag"] },
      { value: "minimalist", label: "The Minimalist", icon: "🎒", visual: "minimalist", tagline: "One bag. Versatile pieces. Nothing extra.", description: "We suggest mix-and-match pieces that cover multiple events, keeping your total item count low.", howItWorks: ["Suggests versatile items that work across multiple events", "Flags when one item can replace two (e.g., one pair of shoes for hiking + casual)", "Targets a specific bag size — warns you if you're over"] },
      { value: "overpacker", label: "The Overpacker", icon: "🧳", visual: "overpacker", tagline: "Better to have it and not need it", description: "We include backup outfits, weather contingencies, and \"what if\" items so you're covered no matter what.", howItWorks: ["Adds backup outfits for key events", "Includes weather contingency items (rain jacket, layers)", "Suggests comfort extras (extra shoes, loungewear, just-in-case formal)"] },
      { value: "spontaneous", label: "The Spontaneous", icon: "⚡", visual: "spontaneous", tagline: "Throw it in and figure it out", description: "A simplified grab-and-go checklist. No outfit planning — just the essentials so you don't forget the important stuff.", howItWorks: ["Short, high-level checklist (not item-by-item)", "Focus on \"don't forget\" items: charger, meds, passport", "No outfit pairing — just category counts (e.g., \"5 tops, 3 bottoms\")"] },
      { value: "hyper_organizer", label: "The Hyper-Organizer", icon: "🗂️", visual: "hyper_organizer", tagline: "Color-coded. Verified. Nothing left to chance.", description: "Full outfit planning plus a verification step. You'll confirm each item is packed before the trip starts.", howItWorks: ["Complete outfit-to-event mapping with dress code tags", "Pre-trip verification checklist (check off each item as you pack it)", "Repack reminder the night before departure"] },
    ],
  },
  {
    key: "orgMethod",
    title: "How do you organize inside the bag?",
    subtitle: "This determines how your packing list is grouped and how we suggest compartments.",
    options: [
      { value: "by_day", label: "By Day", icon: "📅", visual: "by_day", tagline: "Day 1 cube, Day 2 cube…", description: "Each day of your trip gets its own group. Open one cube, you've got everything for that day.", howItWorks: ["Packing list sorted by trip day", "Suggests one packing cube per day", "Morning + evening items grouped together per day"] },
      { value: "by_category", label: "By Category", icon: "🏷️", visual: "by_category", tagline: "All tops together, all bottoms together", description: "Classic sorting — clothes grouped by type. Easy to find what you need.", howItWorks: ["List grouped: tops, bottoms, shoes, accessories, toiletries", "Suggests cubes by category (one for tops, one for bottoms, etc.)", "Great for mix-and-match dressers"] },
      { value: "by_activity", label: "By Activity", icon: "🎯", visual: "by_activity", tagline: "Beach stuff, dinner stuff, hiking stuff", description: "Grouped by what you're doing. All your beach gear in one spot, dinner outfit in another.", howItWorks: ["List grouped by itinerary event type", "Suggests a bag/cube per activity type", "Shared items (like sunscreen) appear in the first relevant group"] },
      { value: "by_outfit", label: "By Outfit", icon: "👔", visual: "by_outfit", tagline: "Complete outfits grouped together", description: "Each outfit is a self-contained set — top, bottom, shoes, accessories all together.", howItWorks: ["Each event's outfit is one list group", "Accessory and shoe pairings included per outfit", "Visual preview shows the complete look"] },
      { value: "no_preference", label: "No Preference", icon: "🤷", visual: "no_preference_org", tagline: "I don't think about it", description: "We'll use a sensible default based on your trip type — no extra decisions needed.", howItWorks: ["Auto-picks the best grouping based on trip type", "Camping → by activity, Flying → by day, Meetup → by outfit", "You can always re-sort later"] },
    ],
  },
  {
    key: "foldingMethod",
    title: "How do you fold?",
    subtitle: "We'll show packing tips and space estimates based on your method.",
    options: [
      { value: "rolling", label: "Rolling", icon: "🌀", visual: "rolling", tagline: "Roll everything tight to save space", description: "Items are rolled into tight cylinders. Great for maximizing space and reducing wrinkles on casual clothes.", howItWorks: ["Space estimates assume rolled dimensions", "Tips shown for items that don't roll well (blazers, dress shirts)", "Suggests rolling order: heavy items first, light on top"] },
      { value: "konmari", label: "KonMari File Fold", icon: "📁", visual: "konmari", tagline: "Items stand upright so you can see everything", description: "Everything folded into rectangles and filed vertically. You can see every item at a glance when you open the suitcase.", howItWorks: ["Packing view shows items as vertical file-style layout", "Suggests shallow, wide cubes for file folding", "Includes fold-size guides for different garment types"] },
      { value: "bundle", label: "Bundle Wrapping", icon: "🎁", visual: "bundle", tagline: "Wrap clothes around a core for zero wrinkles", description: "Clothes wrapped in layers around a central core (like a toiletry bag). Best for wrinkle-free formal wear.", howItWorks: ["Suggests wrapping order: jackets outside, delicates inside", "Flags items that are good bundle cores (toiletry bag, packing cube)", "Warns when you have too many items for a single bundle"] },
      { value: "flat_fold", label: "Flat Fold", icon: "📄", visual: "flat_fold", tagline: "Traditional fold and stack", description: "Standard folding and stacking. Simple, familiar, no learning curve.", howItWorks: ["Space estimates based on standard folded dimensions", "Suggests heavier items on bottom, lighter on top", "No special packing instructions needed"] },
      { value: "no_preference", label: "No Preference", icon: "🤷", visual: "no_preference_fold", tagline: "Whatever works", description: "We won't show folding-specific tips. Just the list.", howItWorks: ["No folding method tips shown", "Generic space estimates", "You can change this anytime"] },
    ],
  },
  {
    key: "compartmentSystem",
    title: "What do you use to organize inside?",
    subtitle: "This affects how we suggest grouping items and how many containers you'll need.",
    options: [
      { value: "packing_cubes", label: "Packing Cubes", icon: "🧊", visual: "cubes", tagline: "Cubes keep everything contained", description: "Color-coded or labeled cubes that slot into your suitcase. The gold standard for organized packing.", howItWorks: ["Packing list shows cube assignments (e.g., \"Blue cube: Day 1-2 tops\")", "Suggests number of cubes needed based on trip length", "Cube packing order shown for optimal suitcase layout"] },
      { value: "compression_bags", label: "Compression Bags", icon: "🫧", visual: "compression", tagline: "Squeeze out the air, maximize space", description: "Vacuum or roll-down bags that compress clothes flat. Great for bulky items or maximizing carry-on space.", howItWorks: ["Flags bulky items that benefit from compression (sweaters, jackets)", "Space savings estimate shown per bag", "Warns about wrinkle-prone items that shouldn't be compressed"] },
      { value: "ziplock", label: "Ziplock Bags", icon: "🛍️", visual: "ziplock", tagline: "Simple, cheap, see-through", description: "Gallon ziplocks for grouping items. See-through, waterproof, and you probably already have them.", howItWorks: ["Groups items into bag-sized bundles", "Prioritizes waterproofing (toiletries, swimwear, dirty clothes bag)", "Suggests bag sizes: gallon for clothes, quart for toiletries"] },
      { value: "none", label: "Just Toss It In", icon: "🎲", visual: "toss", tagline: "Suitcase is one big compartment", description: "No containers, no cubes — everything goes straight in the bag. Freedom.", howItWorks: ["Flat packing list, no container assignments", "Suggests packing order (shoes at bottom, fragile on top)", "Reminds you to use a separate bag for dirty clothes"] },
      { value: "no_preference", label: "No Preference", icon: "🤷", visual: "no_preference_comp", tagline: "Don't care about this", description: "We'll skip container suggestions entirely.", howItWorks: ["No container assignments in your packing list", "Can always change later if you get into cubes"] },
    ],
  },
] as const;
