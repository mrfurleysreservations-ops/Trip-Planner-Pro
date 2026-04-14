import { useState, useEffect, useRef } from "react";

const ACCENT = "#e8943a";
const ACCENT2 = "#c75a2a";
const BG = "#f8f8f8";

// ═══════════════════════════════════════════════════════════
//  STEP DATA
// ═══════════════════════════════════════════════════════════

const GENDERS = [
  { value: "female", label: "Female", icon: "👩" },
  { value: "male", label: "Male", icon: "👨" },
  { value: "nonbinary", label: "Non-binary", icon: "🧑" },
  { value: "prefer_not", label: "Prefer not to say", icon: "🤍" },
];

const AGE_RANGES = [
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_64", label: "55–64" },
  { value: "65_plus", label: "65+" },
];

const CLOTHING_STYLES = [
  { value: "casual", label: "Casual", icon: "👕", image: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", description: "Jeans, tees, sneakers — comfortable and effortless", palette: ["#5c8db5", "#8fb5d4", "#b8d4e8", "#dceaf4"] },
  { value: "boho", label: "Boho", icon: "🌻", image: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)", description: "Flowy fabrics, earth tones, layered accessories", palette: ["#c97b3a", "#d4a373", "#e6c9a0", "#f5e6d0"] },
  { value: "classic", label: "Classic", icon: "👔", image: "linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%)", description: "Tailored fits, neutral colors, timeless pieces", palette: ["#5d4037", "#8d6e63", "#bcaaa4", "#d7ccc8"] },
  { value: "streetwear", label: "Streetwear", icon: "🧢", image: "linear-gradient(135deg, #1a1a1a 0%, #424242 100%)", description: "Bold logos, oversized fits, sneaker culture", palette: ["#212121", "#616161", "#e53935", "#fdd835"] },
  { value: "preppy", label: "Preppy", icon: "⛵", image: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", description: "Polos, chinos, clean lines, country-club energy", palette: ["#2e7d32", "#1565c0", "#fff", "#f5f5f5"] },
  { value: "athleisure", label: "Athleisure", icon: "🏃", image: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", description: "Performance meets style — leggings, joggers, fresh kicks", palette: ["#7b1fa2", "#ce93d8", "#e0e0e0", "#fff"] },
  { value: "minimalist", label: "Minimalist", icon: "◻️", image: "linear-gradient(135deg, #fafafa 0%, #e0e0e0 100%)", description: "Clean silhouettes, monochrome, quality over quantity", palette: ["#212121", "#757575", "#bdbdbd", "#f5f5f5"] },
  { value: "eclectic", label: "Eclectic", icon: "🎨", image: "linear-gradient(135deg, #fce4ec 0%, #e1f5fe 100%)", description: "A mix of everything — patterns, colors, unique finds", palette: ["#e91e63", "#ff9800", "#4caf50", "#2196f3"] },
];

// ─── Full packing step data with visuals + howItWorks (from original mockup) ───

const PACKING_SUB_STEPS = [
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
];

// Mock existing users for the search/browse demo
const MOCK_APP_USERS = [
  { id: "u1", name: "Sarah Chen", email: "sarah.c@gmail.com", avatar: "👩‍💼", mutualFriends: 3 },
  { id: "u2", name: "Mike Rodriguez", email: "mike.r@outlook.com", avatar: "👨‍🦱", mutualFriends: 1 },
  { id: "u3", name: "Emma Thompson", email: "emma.t@gmail.com", avatar: "👩‍🦰", mutualFriends: 0 },
  { id: "u4", name: "James Wilson", email: "james.w@yahoo.com", avatar: "👨", mutualFriends: 2 },
  { id: "u5", name: "Priya Patel", email: "priya.p@gmail.com", avatar: "👩", mutualFriends: 0 },
  { id: "u6", name: "David Kim", email: "david.k@icloud.com", avatar: "🧑", mutualFriends: 5 },
  { id: "u7", name: "Lisa Nakamura", email: "lisa.n@gmail.com", avatar: "👩‍🎨", mutualFriends: 0 },
  { id: "u8", name: "Carlos Mendez", email: "carlos.m@outlook.com", avatar: "👨‍🍳", mutualFriends: 1 },
  { id: "u9", name: "Rachel Green", email: "rachel.g@gmail.com", avatar: "👱‍♀️", mutualFriends: 0 },
  { id: "u10", name: "Tom Baker", email: "tom.b@yahoo.com", avatar: "🧔", mutualFriends: 0 },
];

// People the inviter is already friends with (shown as suggestions if user was invited)
const MOCK_INVITER = { name: "Alex Murphy", avatar: "😎" };
const MOCK_INVITER_FRIENDS = [
  { id: "u1", name: "Sarah Chen", avatar: "👩‍💼", trips: 4 },
  { id: "u4", name: "James Wilson", avatar: "👨", trips: 2 },
  { id: "u6", name: "David Kim", avatar: "🧑", trips: 7 },
  { id: "u11", name: "Natalie Brooks", avatar: "👩‍🦱", trips: 3 },
  { id: "u12", name: "Ryan Park", avatar: "👨‍💻", trips: 5 },
  { id: "u13", name: "Jess Morales", avatar: "💃", trips: 1 },
];


// ═══════════════════════════════════════════════════════════
//  PACKING VISUAL — full animated previews from original mockup
// ═══════════════════════════════════════════════════════════

function PackingVisual({ type, isActive }) {
  const baseStyle = {
    width: "100%", height: "200px", borderRadius: "16px",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.4s ease", overflow: "hidden", position: "relative",
  };

  if (type === "planner") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fef3e2, #fde8cc)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {["🌅 Morning Hike", "🍽️ Lunch Reservation", "🌙 Dinner & Show"].map((event, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.8)", borderRadius: "12px", padding: "10px 14px", transform: isActive ? "translateX(0)" : "translateX(-20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontSize: "14px" }}>{event}</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#999" }}>→</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["👕", "👖", "👟"].map((item, j) => (
                  <span key={j} style={{ fontSize: "16px", transform: isActive ? "scale(1)" : "scale(0)", transition: `transform 0.3s ease ${i * 0.12 + 0.2 + j * 0.08}s` }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "minimalist") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8f5e9, #c8e6c9)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "48px", transform: isActive ? "scale(1)" : "scale(0.5)", opacity: isActive ? 1 : 0.3, transition: "all 0.5s ease" }}>🎒</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["👕", "👕", "👖", "👟", "🧢"].map((item, i) => (
              <span key={i} style={{ fontSize: "24px", background: "rgba(255,255,255,0.7)", borderRadius: "12px", padding: "8px", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${0.2 + i * 0.08}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#2e7d32", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>5 items — one bag</span>
        </div>
      </div>
    );
  }

  if (type === "overpacker") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e3f2fd, #bbdefb)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", maxWidth: "260px" }}>
            {["👕", "👕", "👕", "👗", "👖", "👖", "👟", "👠", "🧥", "☂️", "🩱", "👔", "🧳", "🧳"].map((item, i) => (
              <span key={i} style={{ fontSize: "20px", background: "rgba(255,255,255,0.6)", borderRadius: "8px", padding: "4px 6px", transform: isActive ? "scale(1)" : "scale(0)", transition: `transform 0.3s ease ${i * 0.04}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1565c0", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.8s" }}>What if there's a pool? What if it snows?</span>
        </div>
      </div>
    );
  }

  if (type === "spontaneous") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff3e0, #ffe0b2)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            {["👕×5", "👖×3", "👟×2"].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.8)", borderRadius: "14px", padding: "14px 18px", fontSize: "18px", fontWeight: 700, textAlign: "center", transform: isActive ? "rotate(0deg)" : `rotate(${(i - 1) * 15}deg)`, transition: `transform 0.5s ease ${i * 0.1}s` }}>{item}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>
            {["🔌 Charger", "💊 Meds", "🛂 Passport"].map((item, i) => (
              <span key={i} style={{ fontSize: "11px", fontWeight: 600, background: "#e65100", color: "#fff", padding: "4px 10px", borderRadius: "20px" }}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "hyper_organizer") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f3e5f5, #e1bee7)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px", width: "100%" }}>
          {[{ event: "Day 1 — Hike", items: "👕👖👟🧢", status: "✅ Verified" }, { event: "Day 1 — Dinner", items: "👔👖👞⌚", status: "✅ Verified" }, { event: "Day 2 — Beach", items: "🩱🩴🕶️🧴", status: "⬜ Not packed" }].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.8)", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", transform: isActive ? "translateX(0)" : "translateX(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontWeight: 600, flex: "1 1 auto", minWidth: "100px" }}>{row.event}</span>
              <span style={{ letterSpacing: "2px" }}>{row.items}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: row.status.startsWith("✅") ? "#2e7d32" : "#999", whiteSpace: "nowrap" }}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_day") {
    const days = [{ label: "Day 1", color: "#e3f2fd", items: ["👕", "👖", "👟", "🧴"] }, { label: "Day 2", color: "#fce4ec", items: ["👗", "👠", "👜"] }, { label: "Day 3", color: "#e8f5e9", items: ["🩱", "🩴", "🕶️"] }];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f5f5f5, #eeeeee)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {days.map((day, i) => (
            <div key={i} style={{ background: day.color, borderRadius: "14px", padding: "12px", textAlign: "center", minWidth: "80px", transform: isActive ? "translateY(0)" : "translateY(30px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>{day.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>{day.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_category") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff8e1, #ffecb3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {[{ label: "Tops", items: ["👕", "👕", "👔"] }, { label: "Bottoms", items: ["👖", "👖"] }, { label: "Shoes", items: ["👟", "👠"] }].map((cat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.7)", borderRadius: "10px", padding: "8px 14px", transform: isActive ? "translateX(0)" : "translateX(-20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.12}s` }}>
              <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "60px" }}>🏷️ {cat.label}</span>
              <div style={{ display: "flex", gap: "6px" }}>{cat.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_activity") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f1f8e9, #dcedc8)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          {[{ label: "🏔️ Hiking", items: ["👕", "👖", "🥾", "🧢"], color: "#e8f5e9" }, { label: "🍽️ Dinner", items: ["👔", "👖", "👞"], color: "#fce4ec" }, { label: "🏖️ Beach", items: ["🩱", "🩴", "🕶️"], color: "#e3f2fd" }].map((act, i) => (
            <div key={i} style={{ background: act.color, borderRadius: "14px", padding: "12px", textAlign: "center", minWidth: "80px", transform: isActive ? "scale(1)" : "scale(0.8)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>{act.label}</div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>{act.items.map((item, j) => <span key={j} style={{ fontSize: "18px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_outfit") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #ede7f6, #d1c4e9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {[{ label: "Outfit 1", items: ["👕", "👖", "👟", "⌚"] }, { label: "Outfit 2", items: ["👗", "👠", "👜", "💍"] }, { label: "Outfit 3", items: ["🩱", "🩴", "🕶️", "🧴"] }].map((outfit, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.7)", borderRadius: "14px", padding: "12px", textAlign: "center", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", color: "#7b1fa2" }}>👔 {outfit.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>{outfit.items.map((item, j) => <span key={j} style={{ fontSize: "20px" }}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "rolling") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e0f7fa, #b2ebf2)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} style={{ width: "36px", height: isActive ? "36px" : "50px", borderRadius: isActive ? "50%" : "6px", background: ["#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1"][i], transition: `all 0.6s ease ${i * 0.1}s`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>{isActive ? "🌀" : ""}</div>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#00838f", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>Rolled tight → 30% more space</span>
        </div>
      </div>
    );
  }

  if (type === "konmari") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fce4ec, #f8bbd0)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "3px", padding: "12px", background: "rgba(255,255,255,0.6)", borderRadius: "12px" }}>
            {["👕", "👕", "👔", "👖", "👖", "👗"].map((item, i) => (
              <div key={i} style={{ width: "32px", height: isActive ? "60px" : "32px", background: "rgba(233,30,99,0.1)", borderRadius: "6px", display: "flex", alignItems: isActive ? "flex-start" : "center", justifyContent: "center", paddingTop: isActive ? "6px" : "0", fontSize: "16px", transition: `all 0.5s ease ${i * 0.08}s` }}>{item}</div>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#c2185b", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.6s" }}>Filed upright — see everything at a glance</span>
        </div>
      </div>
    );
  }

  if (type === "bundle") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f3e5f5, #e1bee7)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative", width: "140px", height: "140px" }}>
            {["🧥", "👔", "👕", "🧴"].map((item, i) => {
              const size = isActive ? 140 - i * 28 : 50;
              const opacity = isActive ? 0.2 + i * 0.25 : 0.5;
              return (
                <div key={i} style={{ position: "absolute", width: `${size}px`, height: `${size}px`, borderRadius: "50%", border: `2px solid rgba(156,39,176,${opacity})`, background: `rgba(156,39,176,${opacity * 0.15})`, top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: i === 3 ? "24px" : "0px", transition: `all 0.6s ease ${i * 0.12}s` }}>{i === 3 && isActive ? item : ""}</div>
              );
            })}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b1fa2", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>Layers wrapped around a core — zero wrinkles</span>
        </div>
      </div>
    );
  }

  if (type === "flat_fold") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #efebe9, #d7ccc8)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {["👕", "👕", "👖", "👔"].map((item, i) => (
            <div key={i} style={{ width: isActive ? "120px" : "80px", height: "32px", background: ["#d7ccc8", "#bcaaa4", "#a1887f", "#8d6e63"][i], borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#fff", transition: `all 0.4s ease ${i * 0.1}s`, transform: isActive ? `translateY(${i * -4}px)` : "translateY(0)" }}>{item}</div>
          ))}
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#5d4037", marginTop: "8px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>Fold, stack, done</span>
        </div>
      </div>
    );
  }

  if (type === "cubes") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8eaf6, #c5cae9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {[{ label: "Tops", color: "#42a5f5", items: "👕👕👔" }, { label: "Bottoms", color: "#66bb6a", items: "👖👖" }, { label: "Misc", color: "#ffa726", items: "🧴🩱🕶️" }].map((cube, i) => (
            <div key={i} style={{ border: `3px solid ${cube.color}`, borderRadius: "12px", padding: "10px", textAlign: "center", background: "rgba(255,255,255,0.7)", minWidth: "75px", transform: isActive ? "scale(1)" : "scale(0.7)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: cube.color, marginBottom: "6px" }}>🧊 {cube.label}</div>
              <div style={{ fontSize: "18px", letterSpacing: "2px" }}>{cube.items}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "compression") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e0f2f1, #b2dfdb)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ width: isActive ? "60px" : "90px", height: isActive ? "40px" : "70px", background: "rgba(0,150,136,0.2)", borderRadius: "10px", border: "2px dashed #009688", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", transition: "all 0.6s ease" }}>🧥</div>
            <span style={{ fontSize: "20px", opacity: isActive ? 1 : 0.3, transition: "opacity 0.4s ease 0.3s" }}>→</span>
            <div style={{ width: "60px", height: "40px", background: "rgba(0,150,136,0.3)", borderRadius: "10px", border: "2px solid #009688", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>🫧</div>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#00796b", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.7s" }}>Compressed — 50% less space</span>
        </div>
      </div>
    );
  }

  if (type === "ziplock") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff9c4, #fff59d)" }}>
        <div style={{ display: "flex", gap: "12px", padding: "16px" }}>
          {[{ label: "Toiletries", items: "🧴🪥💊", size: "Quart" }, { label: "Clothes", items: "👕👖", size: "Gallon" }, { label: "Dirty", items: "🧦", size: "Gallon" }].map((bag, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.6)", border: "2px solid rgba(249,168,37,0.4)", borderRadius: "4px 4px 12px 12px", borderTop: "4px solid #f9a825", padding: "10px", textAlign: "center", minWidth: "70px", transform: isActive ? "translateY(0)" : "translateY(20px)", opacity: isActive ? 1 : 0, transition: `all 0.4s ease ${i * 0.15}s` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#f57f17", marginBottom: "4px" }}>{bag.size}</div>
              <div style={{ fontSize: "16px", letterSpacing: "1px" }}>{bag.items}</div>
              <div style={{ fontSize: "10px", color: "#999", marginTop: "4px" }}>{bag.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "toss") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fafafa, #eeeeee)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "160px", height: "100px", background: "rgba(0,0,0,0.04)", borderRadius: "14px", border: "2px solid #ccc", display: "flex", flexWrap: "wrap", gap: "2px", padding: "10px", justifyContent: "center", alignContent: "center" }}>
            {["👕", "👖", "👗", "👟", "🧴", "👔", "🩱", "📱"].map((item, i) => (
              <span key={i} style={{ fontSize: "18px", transform: isActive ? `rotate(${(i % 2 === 0 ? 1 : -1) * (5 + i * 3)}deg)` : "rotate(0deg)", transition: `transform 0.5s ease ${i * 0.06}s` }}>{item}</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#757575", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}>One big suitcase. Freedom.</span>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fafafa, #f0f0f0)" }}>
      <div style={{ textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>🤷</div>
        <div style={{ fontSize: "13px", color: "#999" }}>We'll pick a sensible default</div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════

function ProgressDots({ total, current }) {
  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "28px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === current ? "28px" : "8px", height: "8px", borderRadius: "4px", background: i <= current ? ACCENT : "#ddd", transition: "all 0.4s ease" }} />
      ))}
    </div>
  );
}

function StepHeader({ step, total, title, subtitle }) {
  return (
    <div style={{ marginBottom: "24px", textAlign: "center" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Step {step} of {total}</div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px", fontFamily: "'Outfit', system-ui, sans-serif" }}>{title}</h2>
      <p style={{ fontSize: "14px", color: "#777", margin: 0, lineHeight: "1.5" }}>{subtitle}</p>
    </div>
  );
}

function PillSelector({ options, selected, onSelect, multiSelect = false }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
      {options.map((opt) => {
        const isSelected = multiSelect ? (selected || []).includes(opt.value) : selected === opt.value;
        return (
          <button key={opt.value} onClick={() => onSelect(opt.value)} style={{ padding: "10px 18px", borderRadius: "24px", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", color: isSelected ? "#fff" : "#1a1a1a", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "8px" }}>
            {opt.icon && <span style={{ fontSize: "16px" }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NavButtons({ onBack, onNext, backLabel = "Back", nextLabel = "Next", nextDisabled = false, showBack = true }) {
  return (
    <div style={{ display: "flex", justifyContent: showBack ? "space-between" : "flex-end", alignItems: "center", marginTop: "28px" }}>
      {showBack && <button onClick={onBack} style={{ padding: "12px 24px", borderRadius: "14px", border: "none", background: "#f0f0f0", color: "#555", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>← {backLabel}</button>}
      <button onClick={onNext} disabled={nextDisabled} style={{ padding: "12px 28px", borderRadius: "14px", border: "none", background: nextDisabled ? "#ddd" : ACCENT, color: nextDisabled ? "#999" : "#fff", fontSize: "15px", fontWeight: 700, cursor: nextDisabled ? "default" : "pointer", transition: "all 0.2s ease" }}>{nextLabel} →</button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  STEP COMPONENTS
// ═══════════════════════════════════════════════════════════

// ─── Step 1: Welcome + Profile ───
function StepProfile({ data, onChange, onNext }) {
  return (
    <div className="fade-in">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧳</div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px", fontFamily: "'Outfit', system-ui, sans-serif" }}>Welcome to Trip Planner Pro</h1>
        <p style={{ fontSize: "15px", color: "#777", margin: 0 }}>Let's get you set up in about 2 minutes</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
        <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "linear-gradient(135deg, #ffe0b2, #ffcc80)", border: `3px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden" }}>
          <span style={{ fontSize: "36px" }}>📸</span>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "10px", fontWeight: 600, textAlign: "center" }}>Upload</div>
        </div>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>Your Name</label>
        <input value={data.name || ""} onChange={(e) => onChange({ name: e.target.value })} placeholder="What should we call you?" style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "16px", fontWeight: 600, outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "8px" }}>I identify as</label>
        <PillSelector options={GENDERS} selected={data.gender} onSelect={(v) => onChange({ gender: v })} />
      </div>
      <NavButtons onNext={onNext} nextDisabled={!data.name?.trim()} showBack={false} nextLabel="Let's go" />
    </div>
  );
}

// ─── Step 2: Age & Phone ───
function StepDetails({ data, onChange, onNext, onBack }) {
  return (
    <div className="fade-in">
      <StepHeader step={2} total={7} title="A little about you" subtitle="This helps us tailor suggestions to your age group and keep your account secure" />
      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "8px" }}>Age Range</label>
        <PillSelector options={AGE_RANGES} selected={data.ageRange} onSelect={(v) => onChange({ ageRange: v })} />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontSize: "12px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>Phone Number <span style={{ fontWeight: 400, color: "#bbb" }}>(optional)</span></label>
        <input value={data.phone || ""} onChange={(e) => onChange({ phone: e.target.value })} placeholder="(555) 123-4567" type="tel" style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "16px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
        <p style={{ fontSize: "11px", color: "#bbb", margin: "6px 0 0", lineHeight: "1.4" }}>Used for trip alerts and reminders only. Never shared.</p>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!data.ageRange} />
    </div>
  );
}

// ─── Step 3: Clothing Style ───
function StepStyle({ data, onChange, onNext, onBack }) {
  const selected = data.clothingStyles || [];
  const toggleStyle = (value) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange({ clothingStyles: next });
  };
  return (
    <div className="fade-in">
      <StepHeader step={3} total={7} title="What's your style?" subtitle="Pick one or more — this helps us suggest outfits and packing ideas that match your vibe" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "8px" }}>
        {CLOTHING_STYLES.map((style) => {
          const isSelected = selected.includes(style.value);
          return (
            <div key={style.value} onClick={() => toggleStyle(style.value)} style={{ borderRadius: "16px", border: `2.5px solid ${isSelected ? ACCENT : "#e0e0e0"}`, overflow: "hidden", cursor: "pointer", transition: "all 0.25s ease", transform: isSelected ? "scale(1.02)" : "scale(1)", boxShadow: isSelected ? "0 4px 16px rgba(232,148,58,0.25)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: "70px", background: style.image, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontSize: "32px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{style.icon}</span>
                {isSelected && <div style={{ position: "absolute", top: "8px", right: "8px", width: "22px", height: "22px", borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px", fontWeight: 700 }}>✓</div>}
                <div style={{ position: "absolute", bottom: "8px", right: "8px", display: "flex", gap: "3px" }}>
                  {style.palette.map((color, i) => <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, border: "1px solid rgba(255,255,255,0.6)" }} />)}
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: "#fff" }}>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{style.label}</div>
                <div style={{ fontSize: "11px", color: "#999", lineHeight: "1.3", marginTop: "2px" }}>{style.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      {selected.length > 0 && <div style={{ textAlign: "center", fontSize: "12px", color: ACCENT, fontWeight: 600, margin: "12px 0 0" }}>{selected.length} style{selected.length > 1 ? "s" : ""} selected</div>}
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={selected.length === 0} />
    </div>
  );
}


// ─── Reusable: User row card ───
function UserRow({ user, isSelected, onToggle, subtitle }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", border: `1.5px solid ${isSelected ? ACCENT : "#eee"}`, background: isSelected ? "rgba(232,148,58,0.04)" : "#fff", cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: isSelected ? "rgba(232,148,58,0.1)" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{user.avatar}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>{user.name}</div>
        <div style={{ fontSize: "11px", color: "#999" }}>{subtitle || user.email}</div>
      </div>
      <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "14px", fontWeight: 700, transition: "all 0.2s", flexShrink: 0 }}>
        {isSelected ? "✓" : ""}
      </div>
    </div>
  );
}

// ─── Step 4: Your People — browsable directory, search filters to top, invite, family ───
function StepPeople({ data, onChange, onNext, onBack }) {
  const [activeTab, setActiveTab] = useState("find");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState([]);
  const [newFamName, setNewFamName] = useState("");
  const [newFamAge, setNewFamAge] = useState("adult");
  const [famLinkSearch, setFamLinkSearch] = useState("");

  const connections = data.connections || [];
  const familyMembers = data.familyMembers || [];

  const TABS = [
    { key: "find", label: "Find People", icon: "🔍" },
    { key: "family", label: "Your Family", icon: "👨‍👩‍👧‍👦" },
    { key: "invite", label: "Invite", icon: "✉️" },
  ];

  const FAM_TYPES = [
    { value: "adult", label: "Adult", icon: "🧑" },
    { value: "kid", label: "Kid (5-12)", icon: "🧒" },
    { value: "toddler", label: "Toddler (1-4)", icon: "👶" },
    { value: "baby", label: "Baby (<1)", icon: "🍼" },
  ];

  // Sort: search matches first, then everyone else
  const sortedUsers = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_APP_USERS;
    const matches = MOCK_APP_USERS.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const rest = MOCK_APP_USERS.filter((u) => !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q));
    return [...matches, ...rest];
  })();

  const hasSearchMatches = searchQuery.trim().length > 0 && sortedUsers.some((u) => u.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || u.email.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const noSearchResults = searchQuery.trim().length > 0 && !hasSearchMatches;

  const toggleConnection = (user) => {
    const exists = connections.find((c) => c.id === user.id);
    if (exists) onChange({ connections: connections.filter((c) => c.id !== user.id) });
    else onChange({ connections: [...connections, { ...user }] });
  };

  const sendInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return;
    setInviteSent((s) => [...s, inviteEmail.trim()]);
    setInviteEmail("");
  };

  // Family: link to an app user or add offline
  const famLinkResults = famLinkSearch.trim().length > 0
    ? MOCK_APP_USERS.filter((u) => u.name.toLowerCase().includes(famLinkSearch.trim().toLowerCase()) || u.email.toLowerCase().includes(famLinkSearch.trim().toLowerCase()))
    : [];

  const addFamilyMember = (nameOrUser, ageType) => {
    const isUser = typeof nameOrUser === "object";
    const entry = {
      id: isUser ? nameOrUser.id : Date.now(),
      name: isUser ? nameOrUser.name : nameOrUser,
      age_type: ageType || newFamAge,
      icon: isUser ? nameOrUser.avatar : (FAM_TYPES.find((t) => t.value === (ageType || newFamAge))?.icon || "🧑"),
      linkedUserId: isUser ? nameOrUser.id : null,
    };
    onChange({ familyMembers: [...familyMembers, entry] });
    setNewFamName("");
    setFamLinkSearch("");
  };

  const removeFamilyMember = (id) => onChange({ familyMembers: familyMembers.filter((m) => m.id !== id) });

  const totalPeople = connections.length + familyMembers.length + inviteSent.length;

  return (
    <div className="fade-in">
      <StepHeader step={4} total={7} title="Who do you travel with?" subtitle="Find people already on the app, build your family, or invite someone new" />

      {/* Selected people summary chips */}
      {totalPeople > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px", justifyContent: "center" }}>
          {connections.map((c) => (
            <span key={`c-${c.id}`} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(232,148,58,0.1)", border: "1.5px solid rgba(232,148,58,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              {c.avatar} {c.name.split(" ")[0]}
              <span onClick={() => toggleConnection(c)} style={{ cursor: "pointer", color: "#ccc", fontSize: "14px", lineHeight: 1 }}>×</span>
            </span>
          ))}
          {familyMembers.map((m) => (
            <span key={`f-${m.id}`} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(76,175,80,0.1)", border: "1.5px solid rgba(76,175,80,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              {m.icon} {m.name} {m.linkedUserId && <span style={{ fontSize: "9px", color: "#4caf50" }}>linked</span>}
              <span onClick={() => removeFamilyMember(m.id)} style={{ cursor: "pointer", color: "#ccc", fontSize: "14px", lineHeight: 1 }}>×</span>
            </span>
          ))}
          {inviteSent.map((email, i) => (
            <span key={`i-${i}`} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(33,150,243,0.1)", border: "1.5px solid rgba(33,150,243,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              ✉️ {email.split("@")[0]} <span style={{ fontSize: "10px", color: "#999" }}>pending</span>
            </span>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "#f0f0f0", borderRadius: "14px", padding: "4px" }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: "11px", border: "none", background: activeTab === tab.key ? "#fff" : "transparent", color: activeTab === tab.key ? "#1a1a1a" : "#999", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Find People — full browsable list, search filters to top ── */}
      {activeTab === "find" && (
        <div className="fade-in">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or email..." style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />

          {/* Divider label when search is active */}
          {searchQuery.trim().length > 0 && hasSearchMatches && (
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: "6px", paddingLeft: "4px" }}>Matches</div>
          )}

          {noSearchResults && (
            <div style={{ textAlign: "center", padding: "14px 0", marginBottom: "8px" }}>
              <div style={{ color: "#bbb", fontSize: "13px", marginBottom: "6px" }}>No one found for "{searchQuery}"</div>
              <button onClick={() => { setInviteEmail(searchQuery.includes("@") ? searchQuery : ""); setActiveTab("invite"); }} style={{ fontSize: "12px", fontWeight: 600, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Invite them by email instead →</button>
            </div>
          )}

          {/* Browsable user list — always visible, search pushes matches to top */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
            {sortedUsers.map((user, i) => {
              const q = searchQuery.trim().toLowerCase();
              const isMatch = q && (user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
              const isAdded = connections.find((c) => c.id === user.id);

              // Show "Everyone on the app" divider after last match
              const isFirstNonMatch = q && !isMatch && i > 0 && (sortedUsers[i - 1].name.toLowerCase().includes(q) || sortedUsers[i - 1].email.toLowerCase().includes(q));

              return (
                <div key={user.id}>
                  {isFirstNonMatch && (
                    <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#bbb", margin: "8px 0 6px", paddingLeft: "4px" }}>Everyone on the app</div>
                  )}
                  <UserRow
                    user={user}
                    isSelected={!!isAdded}
                    onToggle={() => toggleConnection(user)}
                    subtitle={user.mutualFriends > 0 ? `${user.email} · ${user.mutualFriends} mutual` : user.email}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Your Family — link app users or add offline members ── */}
      {activeTab === "family" && (
        <div className="fade-in">
          <p style={{ fontSize: "13px", color: "#777", margin: "0 0 12px", lineHeight: "1.5" }}>
            Add family members you'll pack for. If they're on the app, link their account — otherwise just add their name.
          </p>

          {/* Existing family members */}
          {familyMembers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {familyMembers.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "12px", background: m.linkedUserId ? "rgba(232,148,58,0.04)" : "#f8f8f8", border: `1px solid ${m.linkedUserId ? "rgba(232,148,58,0.2)" : "#eee"}` }}>
                  <span style={{ fontSize: "24px" }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      {FAM_TYPES.find((t) => t.value === m.age_type)?.label}
                      {m.linkedUserId && <span style={{ color: ACCENT, marginLeft: "6px" }}>· Linked to app account</span>}
                    </div>
                  </div>
                  <span onClick={() => removeFamilyMember(m.id)} style={{ fontSize: "16px", color: "#ccc", cursor: "pointer" }}>×</span>
                </div>
              ))}
            </div>
          )}

          {/* Link an existing user as family */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1.5px solid #e0e0e0", marginBottom: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Link someone on the app</div>
            <input value={famLinkSearch} onChange={(e) => setFamLinkSearch(e.target.value)} placeholder="Search app users to link as family..." style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "2px solid #e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
            {famLinkResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "140px", overflowY: "auto" }}>
                {famLinkResults.map((user) => {
                  const alreadyAdded = familyMembers.find((m) => m.linkedUserId === user.id);
                  return (
                    <div key={user.id} onClick={() => { if (!alreadyAdded) addFamilyMember(user, "adult"); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: alreadyAdded ? "#f0f0f0" : "#fafafa", cursor: alreadyAdded ? "default" : "pointer", opacity: alreadyAdded ? 0.5 : 1 }}>
                      <span style={{ fontSize: "18px" }}>{user.avatar}</span>
                      <div style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>{user.name}</div>
                      {alreadyAdded ? <span style={{ fontSize: "10px", color: "#999" }}>Already added</span> : <span style={{ fontSize: "12px", color: ACCENT, fontWeight: 600 }}>+ Link</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add offline member */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1.5px solid #e0e0e0" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#4caf50", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Or add someone without an account</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input value={newFamName} onChange={(e) => setNewFamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newFamName.trim() && addFamilyMember(newFamName.trim())} placeholder="Name" style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "2px solid #e0e0e0", fontSize: "14px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
              <button onClick={() => newFamName.trim() && addFamilyMember(newFamName.trim())} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: ACCENT, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: newFamName.trim() ? 1 : 0.4 }}>+ Add</button>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {FAM_TYPES.map((t) => (
                <button key={t.value} onClick={() => setNewFamAge(t.value)} style={{ padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${newFamAge === t.value ? ACCENT : "#e0e0e0"}`, background: newFamAge === t.value ? "rgba(232,148,58,0.08)" : "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Invite by email ── */}
      {activeTab === "invite" && (
        <div className="fade-in">
          <p style={{ fontSize: "13px", color: "#777", margin: "0 0 12px", lineHeight: "1.5" }}>
            Know someone who should be on the app? Send them an invite — they'll automatically connect with you when they sign up.
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendInvite()} placeholder="friend@email.com" type="email" style={{ flex: 1, padding: "12px 14px", borderRadius: "12px", border: "2px solid #e0e0e0", fontSize: "14px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
            <button onClick={sendInvite} style={{ padding: "12px 18px", borderRadius: "12px", border: "none", background: ACCENT, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: inviteEmail.includes("@") ? 1 : 0.4 }}>Send</button>
          </div>
          {inviteSent.length > 0 && (
            <div style={{ background: "rgba(33,150,243,0.05)", borderRadius: "12px", padding: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#1565c0", textTransform: "uppercase", marginBottom: "8px" }}>Invites sent</div>
              {inviteSent.map((email, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "4px 0" }}>
                  <span style={{ color: "#2196f3" }}>✉️</span>
                  <span style={{ color: "#555" }}>{email}</span>
                  <span style={{ fontSize: "10px", color: "#4caf50", fontWeight: 600, marginLeft: "auto" }}>✓ Sent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextLabel={totalPeople === 0 ? "Skip for now" : "Next"} />
    </div>
  );
}


// ─── Step 5: Friend Suggestions — people your inviter knows ───
function StepFriendSuggestions({ data, onChange, onNext, onBack }) {
  const connections = data.connections || [];

  const toggleFriend = (friend) => {
    const exists = connections.find((c) => c.id === friend.id);
    if (exists) onChange({ connections: connections.filter((c) => c.id !== friend.id) });
    else onChange({ connections: [...connections, { id: friend.id, name: friend.name, avatar: friend.avatar, email: "" }] });
  };

  // Filter out people already connected from Step 4
  const suggestions = MOCK_INVITER_FRIENDS.filter((f) => !connections.find((c) => c.id === f.id));
  const alreadyAdded = MOCK_INVITER_FRIENDS.filter((f) => connections.find((c) => c.id === f.id));

  return (
    <div className="fade-in">
      <StepHeader step={5} total={7} title="People you might know" subtitle={`${MOCK_INVITER.avatar} ${MOCK_INVITER.name} invited you — here are people they travel with`} />

      {/* Inviter badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg, rgba(232,148,58,0.06), rgba(199,90,42,0.06))", border: "1px solid rgba(232,148,58,0.15)", marginBottom: "18px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(232,148,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{MOCK_INVITER.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{MOCK_INVITER.name}</div>
          <div style={{ fontSize: "11px", color: ACCENT }}>Invited you to Trip Planner Pro</div>
        </div>
        <div style={{ background: ACCENT, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "12px" }}>Friends</div>
      </div>

      {/* Already-connected friends from this list */}
      {alreadyAdded.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4caf50", marginBottom: "6px", paddingLeft: "4px" }}>Already connected</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {alreadyAdded.map((f) => (
              <span key={f.id} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(76,175,80,0.08)", border: "1.5px solid rgba(76,175,80,0.2)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                {f.avatar} {f.name.split(" ")[0]} <span style={{ color: "#4caf50" }}>✓</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested friends */}
      {suggestions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", paddingLeft: "4px" }}>Suggested for you</div>
          {suggestions.map((friend) => (
            <div key={friend.id} onClick={() => toggleFriend(friend)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid #eee", background: "#fff", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{friend.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{friend.name}</div>
                <div style={{ fontSize: "11px", color: "#999" }}>{friend.trips} trip{friend.trips !== 1 ? "s" : ""} with {MOCK_INVITER.name.split(" ")[0]}</div>
              </div>
              <button style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: ACCENT, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#999", fontSize: "13px" }}>
          You've already added everyone — nice!
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextLabel={suggestions.length === 0 ? "Next" : "Skip or continue"} />
    </div>
  );
}


// ─── Step 6: Packing Preferences — full visual slider from original mockup ───
function StepPacking({ data, onChange, onNext, onBack }) {
  const [subStep, setSubStep] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const current = PACKING_SUB_STEPS[subStep];
  const currentValue = data[current.key];
  const option = current.options[selectedIndex];

  // Sync selectedIndex when entering a sub-step that already has a saved value
  useEffect(() => {
    const saved = data[current.key];
    if (saved) {
      const idx = current.options.findIndex((o) => o.value === saved);
      if (idx >= 0) setSelectedIndex(idx);
    } else {
      setSelectedIndex(0);
    }
  }, [subStep]);

  const selectOption = (idx) => {
    setSelectedIndex(idx);
    onChange({ [current.key]: current.options[idx].value });
  };

  const nextSub = () => {
    if (!currentValue) onChange({ [current.key]: current.options[selectedIndex].value });
    if (subStep < PACKING_SUB_STEPS.length - 1) setSubStep((s) => s + 1);
    else onNext();
  };

  const prevSub = () => {
    if (subStep > 0) setSubStep((s) => s - 1);
    else onBack();
  };

  return (
    <div className="fade-in">
      <StepHeader step={6} total={7} title={current.title} subtitle={current.subtitle} />

      {/* Sub-step dots */}
      <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "20px" }}>
        {PACKING_SUB_STEPS.map((_, i) => (
          <div key={i} style={{ width: i === subStep ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i <= subStep ? ACCENT2 : "#ddd", transition: "all 0.3s ease" }} />
        ))}
      </div>

      {/* Animated visual preview */}
      <div key={`visual-${subStep}-${selectedIndex}`} style={{ marginBottom: "16px" }}>
        <PackingVisual type={option.visual} isActive={true} />
      </div>

      {/* Horizontal scrolling pill selector */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "14px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {current.options.map((opt, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button key={opt.value} onClick={() => selectOption(i)} style={{ padding: "8px 16px", borderRadius: "24px", border: `2px solid ${isSelected ? ACCENT : "#ddd"}`, background: isSelected ? ACCENT : "#fff", color: isSelected ? "#fff" : "#1a1a1a", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail card with description + how it works */}
      <div key={`detail-${subStep}-${selectedIndex}`} style={{ background: "rgba(232,148,58,0.05)", borderRadius: "16px", padding: "18px", marginBottom: "8px", border: "1px solid rgba(232,148,58,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "28px" }}>{option.icon}</span>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>{option.label}</div>
            <div style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>{option.tagline}</div>
          </div>
        </div>
        <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.6", margin: "0 0 14px" }}>{option.description}</p>
        <div style={{ borderTop: "1px solid rgba(232,148,58,0.15)", paddingTop: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>How this works in your trip</div>
          {option.howItWorks.map((point, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px", fontSize: "12px", color: "#555", lineHeight: "1.5" }}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preference confirmation banner */}
      {currentValue && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "12px", background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.18)", marginBottom: "8px" }}>
          <span style={{ fontSize: "14px" }}>✅</span>
          <span style={{ fontSize: "12px", color: "#2e7d32", fontWeight: 600, flex: 1 }}>
            {option.icon} {option.label} will be saved as your default. You can change it anytime in your profile, or override it per trip.
          </span>
        </div>
      )}

      <NavButtons onBack={prevSub} onNext={nextSub} nextLabel={subStep === PACKING_SUB_STEPS.length - 1 ? "Save & Finish ✓" : "Save & Continue"} />
    </div>
  );
}


// ─── Step 7: Done! ───
function StepDone({ data }) {
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => { setTimeout(() => setShowConfetti(true), 300); }, []);

  const styleName = (data.clothingStyles || []).map((v) => CLOTHING_STYLES.find((s) => s.value === v)?.label).filter(Boolean).join(", ");
  const packOpt = PACKING_SUB_STEPS[0].options.find((s) => s.value === data.packingStyle);
  const orgOpt = PACKING_SUB_STEPS[1].options.find((s) => s.value === data.orgMethod);
  const foldOpt = PACKING_SUB_STEPS[2].options.find((s) => s.value === data.foldingMethod);
  const compOpt = PACKING_SUB_STEPS[3].options.find((s) => s.value === data.compartmentSystem);
  const totalPeople = (data.connections || []).length + (data.familyMembers || []).length;

  return (
    <div className="fade-in" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "64px", marginBottom: "16px" }}>
        <span style={{ display: "inline-block", transform: showConfetti ? "scale(1)" : "scale(0)", transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</span>
      </div>
      <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 8px", fontFamily: "'Outfit', system-ui, sans-serif" }}>You're all set, {data.name?.split(" ")[0] || "traveler"}!</h1>
      <p style={{ fontSize: "15px", color: "#777", margin: "0 0 24px", lineHeight: "1.5" }}>These preferences are saved to your profile and will be used every time you pack for a trip.</p>

      {/* Saved preferences card — emphasis on "these are locked in" */}
      <div style={{ background: "#fff", borderRadius: "20px", padding: "20px", border: "1.5px solid #e0e0e0", textAlign: "left", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: "16px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4caf50", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>✅</span> Your saved preferences
        </div>

        {[
          { label: "Clothing Style", icon: "👕", value: styleName || "Not set" },
          { label: "Packing Style", icon: packOpt?.icon || "📋", value: packOpt?.label || "Not set" },
          { label: "Organization", icon: orgOpt?.icon || "📅", value: orgOpt?.label || "Not set" },
          { label: "Folding Method", icon: foldOpt?.icon || "🌀", value: foldOpt?.label || "Not set" },
          { label: "Compartments", icon: compOpt?.icon || "🧊", value: compOpt?.label || "Not set" },
          { label: "Travelers", icon: "👥", value: totalPeople > 0 ? `You + ${totalPeople} ${totalPeople === 1 ? "person" : "people"}` : "Just you (for now)" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: i < 5 ? "1px solid #f5f5f5" : "none" }}>
            <span style={{ fontSize: "16px", width: "24px", textAlign: "center" }}>{row.icon}</span>
            <span style={{ fontSize: "12px", color: "#999", fontWeight: 600, minWidth: "100px" }}>{row.label}</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginLeft: "auto", textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Change anytime note */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "20px" }}>
        <span style={{ fontSize: "12px", color: "#999" }}>You can update these anytime in</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: ACCENT, cursor: "pointer" }}>Profile → Packing Preferences</span>
      </div>

      {/* Per-trip override note */}
      <div style={{ background: "rgba(232,148,58,0.05)", borderRadius: "14px", padding: "14px 16px", marginBottom: "18px", border: "1px solid rgba(232,148,58,0.12)", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>💡</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT2 }}>These are your defaults — not locked in stone</div>
            <div style={{ fontSize: "11px", color: "#777", lineHeight: "1.5", marginTop: "2px" }}>When you create a trip, you can override any preference for that specific trip. Your profile defaults will always be the starting point.</div>
          </div>
        </div>
      </div>

      {/* Pinterest teaser */}
      <div style={{ background: "linear-gradient(135deg, #fce4ec, #f8bbd0)", borderRadius: "16px", padding: "20px", marginBottom: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>📌</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#c2185b", marginBottom: "4px" }}>Coming Soon: Style Inspiration</div>
        <div style={{ fontSize: "12px", color: "#ad1457", lineHeight: "1.5" }}>When you create a trip, we'll pull outfit inspiration from Pinterest based on your destination, style ({styleName || "your picks"}), and itinerary events.</div>
      </div>

      <button style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: ACCENT, color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(232,148,58,0.35)" }}>Start Planning a Trip →</button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  MAIN ONBOARDING COMPONENT
// ═══════════════════════════════════════════════════════════

export default function OnboardingFlowMockup() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "", gender: null, ageRange: null, phone: "",
    clothingStyles: [], connections: [], familyMembers: [],
    packingStyle: null, orgMethod: null, foldingMethod: null, compartmentSystem: null,
  });
  const containerRef = useRef(null);
  const TOTAL_STEPS = 7;

  const updateData = (updates) => setData((d) => ({ ...d, ...updates }));
  const next = () => { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };
  const back = () => { setStep((s) => Math.max(s - 1, 0)); containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", fontFamily: "'Outfit', system-ui, -apple-system, sans-serif", color: "#1a1a1a", minHeight: "100vh", background: BG }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: BG, padding: "16px 20px 0" }}>
        {step > 0 && step < TOTAL_STEPS - 1 && <ProgressDots total={TOTAL_STEPS} current={step} />}
      </div>
      <div ref={containerRef} style={{ padding: "0 20px 40px", overflow: "auto" }}>
        {step === 0 && <StepProfile data={data} onChange={updateData} onNext={next} />}
        {step === 1 && <StepDetails data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 2 && <StepStyle data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 3 && <StepPeople data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 4 && <StepFriendSuggestions data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 5 && <StepPacking data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 6 && <StepDone data={data} />}
      </div>
      <style>{`
        .fade-in { animation: fadeIn 0.35s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #ccc; }
      `}</style>
    </div>
  );
}
