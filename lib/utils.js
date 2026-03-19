import { APPETITE_TYPES } from "./constants";

const AGE_PORTION = { adult: 1, kid: 0.65, toddler: 0.35, baby: 0 };

export const getPortionMultiplier = (member) => {
  const ageMult = AGE_PORTION[member.age_type || "adult"] || 1;
  const appetiteMult = (APPETITE_TYPES.find((a) => a.value === member.appetite) || APPETITE_TYPES[1]).multiplier;
  return ageMult * appetiteMult;
};

export const getPortionCount = (families, attendance, mealKey) => {
  let total = 0;
  const breakdown = { adults: 0, kids: 0, toddlers: 0, babies: 0 };
  families.forEach((fam) => {
    if (!attendance[fam.id]?.[mealKey]) return;
    (fam.members || []).forEach((m) => {
      const age = m.age_type || "adult";
      if (age === "baby") { breakdown.babies++; return; }
      if (age === "adult") breakdown.adults++;
      else if (age === "kid") breakdown.kids++;
      else breakdown.toddlers++;
      total += getPortionMultiplier(m);
    });
  });
  return { total: Math.round(total * 10) / 10, breakdown };
};

export const scaleIngredientLine = (line, portionCount, baseServings = 4) => {
  const ratio = portionCount / baseServings;
  if (ratio === 1 || !line.trim()) return line;
  const match = line.match(/^([\d]+(?:\.[\d]+)?(?:\s*\/\s*[\d]+)?)\s*(.*)/);
  if (!match) return line;
  let num = match[1].includes("/")
    ? match[1].split("/").map((p) => parseFloat(p.trim())).reduce((a, b) => a / b)
    : parseFloat(match[1]);
  const scaled = num * ratio;
  return `${scaled % 1 === 0 ? scaled : scaled.toFixed(1)} ${match[2]}`;
};

export const generateDays = (start, end) => {
  if (!start || !end) return [];
  const days = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (s <= e) {
    days.push(s.toISOString().split("T")[0]);
    s.setDate(s.getDate() + 1);
  }
  return days;
};

export const formatDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

export const mealIcon = (m) => m === "Breakfast" ? "🌅" : m === "Lunch" ? "☀️" : "🌙";

export const ageIcon = (v) => {
  const map = { adult: "🧑", kid: "🧒", toddler: "👶", baby: "🍼" };
  return map[v] || "🧑";
};

export const catIcon = (v) => {
  const map = { gear: "⛺", electronics: "🔌", cleaning: "🧹", kitchen: "🍳", clothing: "👕", safety: "🩹", comfort: "🛏️", tools: "🔧", food: "🥫", other: "📦" };
  return map[v] || "📦";
};
