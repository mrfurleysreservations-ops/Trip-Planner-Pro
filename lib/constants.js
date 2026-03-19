// Trip types
export const TRIP_TYPES = [
  { value: "camping", label: "Camping", icon: "🏕️", tagline: "Into the wild" },
  { value: "flying", label: "Flying", icon: "✈️", tagline: "Beach & beyond" },
  { value: "roadtrip", label: "Road Trip", icon: "🚗", tagline: "Route 66 vibes" },
  { value: "meetup", label: "Meetup", icon: "🤝", tagline: "Get together" },
];

// Visual themes per trip type
export const THEMES = {
  home: {
    bg: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    accent: "#e8943a", accent2: "#c75a2a", text: "#e8e6e3", muted: "#8a8a9a",
    card: "rgba(255,255,255,0.06)", cardBorder: "rgba(255,255,255,0.1)",
    headerBg: "rgba(0,0,0,0.3)",
  },
  camping: {
    bg: "linear-gradient(160deg, #1a2e1a 0%, #0d1f0d 40%, #162216 100%)",
    accent: "#7cb342", accent2: "#ff8f00", text: "#e0e8d8", muted: "#7a8a6a",
    card: "rgba(255,255,255,0.07)", cardBorder: "rgba(124,179,66,0.2)",
    headerBg: "linear-gradient(90deg, #2e4a1e, #1a3a0a)",
    vibeBg: "radial-gradient(ellipse at 20% 80%, rgba(255,143,0,0.08) 0%, transparent 50%)",
  },
  flying: {
    bg: "linear-gradient(160deg, #0a1628 0%, #0d2137 40%, #1a3a5c 100%)",
    accent: "#00bcd4", accent2: "#ff7043", text: "#e0f0f8", muted: "#6a8a9a",
    card: "rgba(255,255,255,0.07)", cardBorder: "rgba(0,188,212,0.2)",
    headerBg: "linear-gradient(90deg, #004d5c, #00838f)",
    vibeBg: "radial-gradient(ellipse at 80% 20%, rgba(0,188,212,0.1) 0%, transparent 50%)",
  },
  roadtrip: {
    bg: "linear-gradient(160deg, #1f1008 0%, #2a1a0a 40%, #3a2210 100%)",
    accent: "#ff6d00", accent2: "#ffab00", text: "#f0e8d8", muted: "#9a8a6a",
    card: "rgba(255,255,255,0.07)", cardBorder: "rgba(255,109,0,0.2)",
    headerBg: "linear-gradient(90deg, #4a2800, #6d3a00)",
    vibeBg: "radial-gradient(ellipse at 50% 90%, rgba(255,109,0,0.08) 0%, transparent 50%)",
  },
  meetup: {
    bg: "linear-gradient(160deg, #1a0a2e 0%, #2a1040 40%, #1e0836 100%)",
    accent: "#ce93d8", accent2: "#f48fb1", text: "#f0e8f8", muted: "#9a7aaa",
    card: "rgba(255,255,255,0.07)", cardBorder: "rgba(206,147,216,0.2)",
    headerBg: "linear-gradient(90deg, #4a1a6e, #6a2a8e)",
    vibeBg: "radial-gradient(ellipse at 30% 50%, rgba(206,147,216,0.08) 0%, transparent 50%)",
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

export const MEALS = ["Breakfast", "Lunch", "Dinner"];

export const SUGGESTED_MEALS = {
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
