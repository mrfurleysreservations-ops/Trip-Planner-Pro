import { useState, useEffect, useRef } from "react";

const ACCENT = "#e8943a";
const ACCENT2 = "#c75a2a";

// ─── Step data: each preference with visual previews ───

const STEPS = [
  {
    key: "packing_style",
    title: "How do you pack?",
    subtitle: "This shapes your entire packing list — what gets suggested, how much, and how it's organized.",
    options: [
      {
        value: "planner",
        label: "The Planner",
        icon: "📋",
        visual: "planner",
        tagline: "Every outfit mapped to every event",
        description: "Your packing list mirrors your itinerary. Each event gets a planned outfit, and the list only includes what's needed.",
        howItWorks: [
          "Packing list auto-generates from your itinerary events",
          "Each event shows a suggested outfit based on dress code",
          "Nothing extra — if it's not on the schedule, it's not in the bag",
        ],
      },
      {
        value: "minimalist",
        label: "The Minimalist",
        icon: "🎒",
        visual: "minimalist",
        tagline: "One bag. Versatile pieces. Nothing extra.",
        description: "We suggest mix-and-match pieces that cover multiple events, keeping your total item count low.",
        howItWorks: [
          "Suggests versatile items that work across multiple events",
          "Flags when one item can replace two (e.g., one pair of shoes for hiking + casual)",
          "Targets a specific bag size — warns you if you're over",
        ],
      },
      {
        value: "overpacker",
        label: "The Overpacker",
        icon: "🧳",
        visual: "overpacker",
        tagline: "Better to have it and not need it",
        description: "We include backup outfits, weather contingencies, and \"what if\" items so you're covered no matter what.",
        howItWorks: [
          "Adds backup outfits for key events",
          "Includes weather contingency items (rain jacket, layers)",
          "Suggests comfort extras (extra shoes, loungewear, just-in-case formal)",
        ],
      },
      {
        value: "spontaneous",
        label: "The Spontaneous",
        icon: "⚡",
        visual: "spontaneous",
        tagline: "Throw it in and figure it out",
        description: "A simplified grab-and-go checklist. No outfit planning — just the essentials so you don't forget the important stuff.",
        howItWorks: [
          "Short, high-level checklist (not item-by-item)",
          "Focus on \"don't forget\" items: charger, meds, passport",
          "No outfit pairing — just category counts (e.g., \"5 tops, 3 bottoms\")",
        ],
      },
      {
        value: "hyper_organizer",
        label: "The Hyper-Organizer",
        icon: "🗂️",
        visual: "hyper_organizer",
        tagline: "Color-coded. Verified. Nothing left to chance.",
        description: "Full outfit planning plus a verification step. You'll confirm each item is packed before the trip starts.",
        howItWorks: [
          "Complete outfit-to-event mapping with dress code tags",
          "Pre-trip verification checklist (check off each item as you pack it)",
          "Repack reminder the night before departure",
        ],
      },
    ],
  },
  {
    key: "organization_method",
    title: "How do you organize inside the bag?",
    subtitle: "This determines how your packing list is grouped and how we suggest compartments.",
    options: [
      {
        value: "by_day",
        label: "By Day",
        icon: "📅",
        visual: "by_day",
        tagline: "Day 1 cube, Day 2 cube…",
        description: "Each day of your trip gets its own group. Open one cube, you've got everything for that day.",
        howItWorks: [
          "Packing list sorted by trip day",
          "Suggests one packing cube per day",
          "Morning + evening items grouped together per day",
        ],
      },
      {
        value: "by_category",
        label: "By Category",
        icon: "🏷️",
        visual: "by_category",
        tagline: "All tops together, all bottoms together",
        description: "Classic sorting — clothes grouped by type. Easy to find what you need.",
        howItWorks: [
          "List grouped: tops, bottoms, shoes, accessories, toiletries",
          "Suggests cubes by category (one for tops, one for bottoms, etc.)",
          "Great for mix-and-match dressers",
        ],
      },
      {
        value: "by_activity",
        label: "By Activity",
        icon: "🎯",
        visual: "by_activity",
        tagline: "Beach stuff, dinner stuff, hiking stuff",
        description: "Grouped by what you're doing. All your beach gear in one spot, dinner outfit in another.",
        howItWorks: [
          "List grouped by itinerary event type",
          "Suggests a bag/cube per activity type",
          "Shared items (like sunscreen) appear in the first relevant group",
        ],
      },
      {
        value: "by_outfit",
        label: "By Outfit",
        icon: "👔",
        visual: "by_outfit",
        tagline: "Complete outfits grouped together",
        description: "Each outfit is a self-contained set — top, bottom, shoes, accessories all together.",
        howItWorks: [
          "Each event's outfit is one list group",
          "Accessory and shoe pairings included per outfit",
          "Visual preview shows the complete look",
        ],
      },
      {
        value: "no_preference",
        label: "No Preference",
        icon: "🤷",
        visual: "no_preference_org",
        tagline: "I don't think about it",
        description: "We'll use a sensible default based on your trip type — no extra decisions needed.",
        howItWorks: [
          "Auto-picks the best grouping based on trip type",
          "Camping → by activity, Flying → by day, Meetup → by outfit",
          "You can always re-sort later",
        ],
      },
    ],
  },
  {
    key: "folding_method",
    title: "How do you fold?",
    subtitle: "We'll show packing tips and space estimates based on your method.",
    options: [
      {
        value: "rolling",
        label: "Rolling",
        icon: "🌀",
        visual: "rolling",
        tagline: "Roll everything tight to save space",
        description: "Items are rolled into tight cylinders. Great for maximizing space and reducing wrinkles on casual clothes.",
        howItWorks: [
          "Space estimates assume rolled dimensions",
          "Tips shown for items that don't roll well (blazers, dress shirts)",
          "Suggests rolling order: heavy items first, light on top",
        ],
      },
      {
        value: "konmari",
        label: "KonMari File Fold",
        icon: "📁",
        visual: "konmari",
        tagline: "Items stand upright so you can see everything",
        description: "Everything folded into rectangles and filed vertically. You can see every item at a glance when you open the suitcase.",
        howItWorks: [
          "Packing view shows items as vertical file-style layout",
          "Suggests shallow, wide cubes for file folding",
          "Includes fold-size guides for different garment types",
        ],
      },
      {
        value: "bundle",
        label: "Bundle Wrapping",
        icon: "🎁",
        visual: "bundle",
        tagline: "Wrap clothes around a core for zero wrinkles",
        description: "Clothes wrapped in layers around a central core (like a toiletry bag). Best for wrinkle-free formal wear.",
        howItWorks: [
          "Suggests wrapping order: jackets outside, delicates inside",
          "Flags items that are good bundle cores (toiletry bag, packing cube)",
          "Warns when you have too many items for a single bundle",
        ],
      },
      {
        value: "flat_fold",
        label: "Flat Fold",
        icon: "📄",
        visual: "flat_fold",
        tagline: "Traditional fold and stack",
        description: "Standard folding and stacking. Simple, familiar, no learning curve.",
        howItWorks: [
          "Space estimates based on standard folded dimensions",
          "Suggests heavier items on bottom, lighter on top",
          "No special packing instructions needed",
        ],
      },
      {
        value: "no_preference",
        label: "No Preference",
        icon: "🤷",
        visual: "no_preference_fold",
        tagline: "Whatever works",
        description: "We won't show folding-specific tips. Just the list.",
        howItWorks: [
          "No folding method tips shown",
          "Generic space estimates",
          "You can change this anytime",
        ],
      },
    ],
  },
  {
    key: "compartment_system",
    title: "What do you use to organize inside?",
    subtitle: "This affects how we suggest grouping items and how many containers you'll need.",
    options: [
      {
        value: "packing_cubes",
        label: "Packing Cubes",
        icon: "🧊",
        visual: "cubes",
        tagline: "Cubes keep everything contained",
        description: "Color-coded or labeled cubes that slot into your suitcase. The gold standard for organized packing.",
        howItWorks: [
          "Packing list shows cube assignments (e.g., \"Blue cube: Day 1-2 tops\")",
          "Suggests number of cubes needed based on trip length",
          "Cube packing order shown for optimal suitcase layout",
        ],
      },
      {
        value: "compression_bags",
        label: "Compression Bags",
        icon: "🫧",
        visual: "compression",
        tagline: "Squeeze out the air, maximize space",
        description: "Vacuum or roll-down bags that compress clothes flat. Great for bulky items or maximizing carry-on space.",
        howItWorks: [
          "Flags bulky items that benefit from compression (sweaters, jackets)",
          "Space savings estimate shown per bag",
          "Warns about wrinkle-prone items that shouldn't be compressed",
        ],
      },
      {
        value: "ziplock",
        label: "Ziplock Bags",
        icon: "🛍️",
        visual: "ziplock",
        tagline: "Simple, cheap, see-through",
        description: "Gallon ziplocks for grouping items. See-through, waterproof, and you probably already have them.",
        howItWorks: [
          "Groups items into bag-sized bundles",
          "Prioritizes waterproofing (toiletries, swimwear, dirty clothes bag)",
          "Suggests bag sizes: gallon for clothes, quart for toiletries",
        ],
      },
      {
        value: "none",
        label: "Just Toss It In",
        icon: "🎲",
        visual: "toss",
        tagline: "Suitcase is one big compartment",
        description: "No containers, no cubes — everything goes straight in the bag. Freedom.",
        howItWorks: [
          "Flat packing list, no container assignments",
          "Suggests packing order (shoes at bottom, fragile on top)",
          "Reminds you to use a separate bag for dirty clothes",
        ],
      },
      {
        value: "no_preference",
        label: "No Preference",
        icon: "🤷",
        visual: "no_preference_comp",
        tagline: "Don't care about this",
        description: "We'll skip container suggestions entirely.",
        howItWorks: [
          "No container assignments in your packing list",
          "Can always change later if you get into cubes",
        ],
      },
    ],
  },
];

// ─── Visual preview components for each packing style ───

function PackingVisual({ type, isActive }) {
  const baseStyle = {
    width: "100%",
    height: "200px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.4s ease",
    overflow: "hidden",
    position: "relative",
  };

  if (type === "planner") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fef3e2, #fde8cc)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {["🌅 Morning Hike", "🍽️ Lunch Reservation", "🌙 Dinner & Show"].map((event, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.8)",
                borderRadius: "12px",
                padding: "10px 14px",
                transform: isActive ? "translateX(0)" : "translateX(-20px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.12}s`,
              }}
            >
              <span style={{ fontSize: "14px" }}>{event}</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#999" }}>→</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["👕", "👖", "👟"].map((item, j) => (
                  <span
                    key={j}
                    style={{
                      fontSize: "16px",
                      transform: isActive ? "scale(1)" : "scale(0)",
                      transition: `transform 0.3s ease ${i * 0.12 + 0.2 + j * 0.08}s`,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "minimalist") {
    const items = ["👕", "👕", "👖", "👟", "🧢"];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8f5e9, #c8e6c9)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              fontSize: "48px",
              transform: isActive ? "scale(1)" : "scale(0.5)",
              opacity: isActive ? 1 : 0.3,
              transition: "all 0.5s ease",
            }}
          >
            🎒
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {items.map((item, i) => (
              <span
                key={i}
                style={{
                  fontSize: "24px",
                  background: "rgba(255,255,255,0.7)",
                  borderRadius: "12px",
                  padding: "8px",
                  transform: isActive ? "translateY(0)" : "translateY(20px)",
                  opacity: isActive ? 1 : 0,
                  transition: `all 0.4s ease ${0.2 + i * 0.08}s`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#2e7d32",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.6s",
            }}
          >
            5 items — one bag
          </span>
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
              <span
                key={i}
                style={{
                  fontSize: "20px",
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: "8px",
                  padding: "4px 6px",
                  transform: isActive ? "scale(1)" : "scale(0)",
                  transition: `transform 0.3s ease ${i * 0.04}s`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#1565c0",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.8s",
            }}
          >
            What if there's a pool? What if it snows?
          </span>
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
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  fontSize: "18px",
                  fontWeight: 700,
                  textAlign: "center",
                  transform: isActive ? "rotate(0deg)" : `rotate(${(i - 1) * 15}deg)`,
                  transition: `transform 0.5s ease ${i * 0.1}s`,
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.5s",
            }}
          >
            {["🔌 Charger", "💊 Meds", "🛂 Passport"].map((item, i) => (
              <span
                key={i}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "#e65100",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: "20px",
                }}
              >
                {item}
              </span>
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
          {[
            { event: "Day 1 — Hike", items: "👕👖👟🧢", status: "✅ Verified" },
            { event: "Day 1 — Dinner", items: "👔👖👞⌚", status: "✅ Verified" },
            { event: "Day 2 — Beach", items: "🩱🩴🕶️🧴", status: "⬜ Not packed" },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.8)",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "12px",
                transform: isActive ? "translateX(0)" : "translateX(20px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.12}s`,
              }}
            >
              <span style={{ fontWeight: 600, flex: "1 1 auto", minWidth: "100px" }}>{row.event}</span>
              <span style={{ letterSpacing: "2px" }}>{row.items}</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: row.status.startsWith("✅") ? "#2e7d32" : "#999",
                  whiteSpace: "nowrap",
                }}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Organization method visuals ───

  if (type === "by_day") {
    const days = [
      { label: "Day 1", color: "#e3f2fd", items: ["👕", "👖", "👟", "🧴"] },
      { label: "Day 2", color: "#fce4ec", items: ["👗", "👠", "👜"] },
      { label: "Day 3", color: "#e8f5e9", items: ["🩱", "🩴", "🕶️"] },
    ];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f5f5f5, #eeeeee)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {days.map((day, i) => (
            <div
              key={i}
              style={{
                background: day.color,
                borderRadius: "14px",
                padding: "12px",
                textAlign: "center",
                minWidth: "80px",
                transform: isActive ? "translateY(0)" : "translateY(30px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>{day.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                {day.items.map((item, j) => (
                  <span key={j} style={{ fontSize: "20px" }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_category") {
    const cats = [
      { label: "Tops", items: ["👕", "👕", "👔"] },
      { label: "Bottoms", items: ["👖", "👖"] },
      { label: "Shoes", items: ["👟", "👠"] },
    ];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff8e1, #ffecb3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "20px", width: "100%" }}>
          {cats.map((cat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.7)",
                borderRadius: "10px",
                padding: "8px 14px",
                transform: isActive ? "translateX(0)" : "translateX(-20px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.12}s`,
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "60px" }}>🏷️ {cat.label}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {cat.items.map((item, j) => (
                  <span key={j} style={{ fontSize: "20px" }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_activity") {
    const activities = [
      { label: "🏔️ Hiking", items: ["👕", "👖", "🥾", "🧢"], color: "#e8f5e9" },
      { label: "🍽️ Dinner", items: ["👔", "👖", "👞"], color: "#fce4ec" },
      { label: "🏖️ Beach", items: ["🩱", "🩴", "🕶️"], color: "#e3f2fd" },
    ];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #f1f8e9, #dcedc8)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          {activities.map((act, i) => (
            <div
              key={i}
              style={{
                background: act.color,
                borderRadius: "14px",
                padding: "12px",
                textAlign: "center",
                minWidth: "80px",
                transform: isActive ? "scale(1)" : "scale(0.8)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>{act.label}</div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                {act.items.map((item, j) => (
                  <span key={j} style={{ fontSize: "18px" }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "by_outfit") {
    const outfits = [
      { label: "Outfit 1", items: ["👕", "👖", "👟", "⌚"] },
      { label: "Outfit 2", items: ["👗", "👠", "👜", "💍"] },
      { label: "Outfit 3", items: ["🩱", "🩴", "🕶️", "🧴"] },
    ];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #ede7f6, #d1c4e9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {outfits.map((outfit, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.7)",
                borderRadius: "14px",
                padding: "12px",
                textAlign: "center",
                transform: isActive ? "translateY(0)" : "translateY(20px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", color: "#7b1fa2" }}>
                👔 {outfit.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                {outfit.items.map((item, j) => (
                  <span key={j} style={{ fontSize: "20px" }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Folding method visuals ───

  if (type === "rolling") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e0f7fa, #b2ebf2)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div
                key={i}
                style={{
                  width: "36px",
                  height: isActive ? "36px" : "50px",
                  borderRadius: isActive ? "50%" : "6px",
                  background: ["#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1"][i],
                  transition: `all 0.6s ease ${i * 0.1}s`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                }}
              >
                {isActive ? "🌀" : ""}
              </div>
            ))}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#00838f",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.6s",
            }}
          >
            Rolled tight → 30% more space
          </span>
        </div>
      </div>
    );
  }

  if (type === "konmari") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fce4ec, #f8bbd0)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              gap: "3px",
              padding: "12px",
              background: "rgba(255,255,255,0.6)",
              borderRadius: "12px",
            }}
          >
            {["👕", "👕", "👔", "👖", "👖", "👗"].map((item, i) => (
              <div
                key={i}
                style={{
                  width: "32px",
                  height: isActive ? "60px" : "32px",
                  background: "rgba(233,30,99,0.1)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: isActive ? "flex-start" : "center",
                  justifyContent: "center",
                  paddingTop: isActive ? "6px" : "0",
                  fontSize: "16px",
                  transition: `all 0.5s ease ${i * 0.08}s`,
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#c2185b",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.6s",
            }}
          >
            Filed upright — see everything at a glance
          </span>
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
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: "50%",
                    border: `2px solid rgba(156,39,176,${opacity})`,
                    background: `rgba(156,39,176,${opacity * 0.15})`,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: i === 3 ? "24px" : "0px",
                    transition: `all 0.6s ease ${i * 0.12}s`,
                  }}
                >
                  {i === 3 && isActive ? item : ""}
                </div>
              );
            })}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#7b1fa2",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.7s",
            }}
          >
            Layers wrapped around a core — zero wrinkles
          </span>
        </div>
      </div>
    );
  }

  if (type === "flat_fold") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #efebe9, #d7ccc8)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {["👕", "👕", "👖", "👔"].map((item, i) => (
            <div
              key={i}
              style={{
                width: isActive ? "120px" : "80px",
                height: "32px",
                background: ["#d7ccc8", "#bcaaa4", "#a1887f", "#8d6e63"][i],
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                color: "#fff",
                transition: `all 0.4s ease ${i * 0.1}s`,
                transform: isActive ? `translateY(${i * -4}px)` : "translateY(0)",
              }}
            >
              {item}
            </div>
          ))}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#5d4037",
              marginTop: "8px",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.5s",
            }}
          >
            Fold, stack, done
          </span>
        </div>
      </div>
    );
  }

  // ─── Compartment system visuals ───

  if (type === "cubes") {
    const cubes = [
      { label: "Tops", color: "#42a5f5", items: "👕👕👔" },
      { label: "Bottoms", color: "#66bb6a", items: "👖👖" },
      { label: "Misc", color: "#ffa726", items: "🧴🩱🕶️" },
    ];
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #e8eaf6, #c5cae9)" }}>
        <div style={{ display: "flex", gap: "10px", padding: "16px" }}>
          {cubes.map((cube, i) => (
            <div
              key={i}
              style={{
                border: `3px solid ${cube.color}`,
                borderRadius: "12px",
                padding: "10px",
                textAlign: "center",
                background: "rgba(255,255,255,0.7)",
                minWidth: "75px",
                transform: isActive ? "scale(1)" : "scale(0.7)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, color: cube.color, marginBottom: "6px" }}>
                🧊 {cube.label}
              </div>
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
            <div
              style={{
                width: isActive ? "60px" : "90px",
                height: isActive ? "40px" : "70px",
                background: "rgba(0,150,136,0.2)",
                borderRadius: "10px",
                border: "2px dashed #009688",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                transition: "all 0.6s ease",
              }}
            >
              🧥
            </div>
            <span style={{ fontSize: "20px", opacity: isActive ? 1 : 0.3, transition: "opacity 0.4s ease 0.3s" }}>
              →
            </span>
            <div
              style={{
                width: "60px",
                height: "40px",
                background: "rgba(0,150,136,0.3)",
                borderRadius: "10px",
                border: "2px solid #009688",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                opacity: isActive ? 1 : 0,
                transition: "opacity 0.4s ease 0.5s",
              }}
            >
              🫧
            </div>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#00796b",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.7s",
            }}
          >
            Compressed — 50% less space
          </span>
        </div>
      </div>
    );
  }

  if (type === "ziplock") {
    return (
      <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fff9c4, #fff59d)" }}>
        <div style={{ display: "flex", gap: "12px", padding: "16px" }}>
          {[
            { label: "Toiletries", items: "🧴🪥💊", size: "Quart" },
            { label: "Clothes", items: "👕👖", size: "Gallon" },
            { label: "Dirty", items: "🧦", size: "Gallon" },
          ].map((bag, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "2px solid rgba(249,168,37,0.4)",
                borderRadius: "4px 4px 12px 12px",
                borderTop: `4px solid #f9a825`,
                padding: "10px",
                textAlign: "center",
                minWidth: "70px",
                transform: isActive ? "translateY(0)" : "translateY(20px)",
                opacity: isActive ? 1 : 0,
                transition: `all 0.4s ease ${i * 0.15}s`,
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#f57f17", marginBottom: "4px" }}>
                {bag.size}
              </div>
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
          <div
            style={{
              width: "160px",
              height: "100px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "14px",
              border: "2px solid #ccc",
              display: "flex",
              flexWrap: "wrap",
              gap: "2px",
              padding: "10px",
              justifyContent: "center",
              alignContent: "center",
            }}
          >
            {["👕", "👖", "👗", "👟", "🧴", "👔", "🩱", "📱"].map((item, i) => (
              <span
                key={i}
                style={{
                  fontSize: "18px",
                  transform: isActive ? `rotate(${(i % 2 === 0 ? 1 : -1) * (5 + i * 3)}deg)` : "rotate(0deg)",
                  transition: `transform 0.5s ease ${i * 0.06}s`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#757575",
              opacity: isActive ? 1 : 0,
              transition: "opacity 0.4s ease 0.5s",
            }}
          >
            One big suitcase. Freedom.
          </span>
        </div>
      </div>
    );
  }

  // Fallback for no_preference variants
  return (
    <div style={{ ...baseStyle, background: "linear-gradient(135deg, #fafafa, #f0f0f0)" }}>
      <div style={{ textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>🤷</div>
        <div style={{ fontSize: "13px", color: "#999" }}>We'll pick a sensible default</div>
      </div>
    </div>
  );
}

// ─── Main Mockup Component ───

export default function PackingSetupMockup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selections, setSelections] = useState({});
  const [animKey, setAnimKey] = useState(0);
  const containerRef = useRef(null);

  const step = STEPS[currentStep];
  const option = step.options[selectedIndex];

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [selectedIndex, currentStep]);

  const selectOption = (idx) => {
    setSelectedIndex(idx);
    setSelections((s) => ({ ...s, [step.key]: step.options[idx].value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setSelectedIndex(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setSelectedIndex(0);
    }
  };

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
        color: "#1a1a1a",
        padding: "20px",
      }}
    >
      {/* Progress bar */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px" }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: i <= currentStep ? ACCENT : "#e0e0e0",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Step header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
          Step {currentStep + 1} of {STEPS.length}
        </div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px" }}>{step.title}</h2>
        <p style={{ fontSize: "13px", color: "#777", margin: 0, lineHeight: "1.5" }}>{step.subtitle}</p>
      </div>

      {/* Visual preview */}
      <div key={`visual-${currentStep}-${selectedIndex}`} style={{ marginBottom: "20px" }}>
        <PackingVisual type={option.visual} isActive={true} />
      </div>

      {/* Option selector — horizontal pills */}
      <div
        ref={containerRef}
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "8px",
          marginBottom: "16px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {step.options.map((opt, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              key={opt.value}
              onClick={() => selectOption(i)}
              style={{
                padding: "8px 16px",
                borderRadius: "24px",
                border: `2px solid ${isSelected ? ACCENT : "#ddd"}`,
                background: isSelected ? ACCENT : "#fff",
                color: isSelected ? "#fff" : "#1a1a1a",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexShrink: 0,
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selected option detail */}
      <div
        key={`detail-${currentStep}-${selectedIndex}`}
        style={{
          background: "rgba(232,148,58,0.05)",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "20px",
          border: "1px solid rgba(232,148,58,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "28px" }}>{option.icon}</span>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>{option.label}</div>
            <div style={{ fontSize: "12px", color: "#999", fontStyle: "italic" }}>{option.tagline}</div>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.6", margin: "0 0 14px" }}>{option.description}</p>

        <div style={{ borderTop: "1px solid rgba(232,148,58,0.15)", paddingTop: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
            How this works in your trip
          </div>
          {option.howItWorks.map((point, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: "6px",
                fontSize: "12px",
                color: "#555",
                lineHeight: "1.5",
              }}
            >
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            border: "none",
            background: currentStep === 0 ? "#f0f0f0" : "#e0e0e0",
            color: currentStep === 0 ? "#ccc" : "#555",
            fontSize: "14px",
            fontWeight: 600,
            cursor: currentStep === 0 ? "default" : "pointer",
          }}
        >
          ← Back
        </button>
        <button
          onClick={nextStep}
          style={{
            padding: "10px 24px",
            borderRadius: "12px",
            border: "none",
            background: currentStep === STEPS.length - 1 ? "#2e7d32" : ACCENT,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
        >
          {currentStep === STEPS.length - 1 ? "✓ Done" : "Next →"}
        </button>
      </div>
    </div>
  );
}
