# Packing V3 — Header Pattern + Group Navigation

## Preamble (ALWAYS follow this)
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Overview

Two changes across two files. No new tables, no SQL, no new dependencies.

**Change 1:** Fix the header on `packing-page.tsx` and `meals-page.tsx` to match the `[← ] Page Name` pattern that already exists on Itinerary, Expenses, Notes, and Group pages.

**Change 2:** Rework the Group tab inside `packing-page.tsx` — replace the single "Looks good → Build Outfits" CTA with day-based Prev/Next sticky navigation, add bold merge instruction text, and make family member tabs functional.

---

## Change 1 — Header Pattern (2 files)

### Current state (what's already correct — DO NOT TOUCH these)

These 4 sub-pages already have the correct `[← ] Page Name` header. Leave them alone:

- `app/trip/[id]/itinerary/itinerary-page.tsx` (line ~1228): `← Itinerary`
- `app/trip/[id]/expenses/expenses-page.tsx` (line ~517): `← Expenses`
- `app/trip/[id]/notes/notes-page.tsx` (line ~503): `← Notes`
- `app/trip/[id]/group/group-page.tsx` (line ~297): `← Group`

`app/trip/[id]/trip-page.tsx` (Trip Hub, line ~710–712) already has `← back to Dashboard`. Leave it alone.

### Fix: `app/trip/[id]/packing/packing-page.tsx`

There are **two** header blocks that need changing in this file (the packing style selection early return AND the main return). Both currently show `{trip.name}` with dates/location.

**Header block 1 — Packing style selection screen** (~line 1078):
```tsx
// CURRENT (remove this):
<div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, position: "relative", zIndex: 2 }}>
  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", margin: 0 }}>{trip.name}</h2>
</div>

// REPLACE WITH:
<div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 2 }}>
  <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>Packing</h2>
</div>
```

**Header block 2 — Main packing page** (~line 1162–1176):
```tsx
// CURRENT (remove this entire block):
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

// REPLACE WITH:
<div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>Packing</h2>
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: `${accent}14`, padding: "4px 10px", borderRadius: "20px" }}>
    <span style={{ fontSize: "13px" }}>{ps.icon}</span>
    <span style={{ fontSize: "11px", fontWeight: 700, color: accent }}>{ps.label}</span>
  </div>
</div>
```

Keep the packing style pill (icon + label) on the right side — just remove the trip name, dates, and location.

### Fix: `app/trip/[id]/meals/meals-page.tsx`

**Current** (~line 12–16):
```tsx
<div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, position: "relative", zIndex: 1 }}>
  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", color: th.text, margin: 0 }}>
    {trip.name}
  </h2>
</div>
```

**Replace with** (same pattern as Notes, Group, etc.):
```tsx
<div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
  <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>Meals</h2>
</div>
```

**Note:** `meals-page.tsx` will need `useRouter` from `next/navigation` if it doesn't already import it. Check before adding a duplicate import.

---

## Change 2 — Group Tab Rework (`packing-page.tsx` only)

### 2a: Bold merge instruction text

Replace the current instructional header card (~line 1228–1233):

```tsx
// CURRENT:
<div style={{ padding: "12px 14px", background: `${accent}06`, border: `1px solid ${th.cardBorder}`, borderRadius: "12px", marginBottom: "14px" }}>
  <p style={{ fontSize: "12px", color: th.muted, margin: 0, lineHeight: 1.5 }}>
    Your events are auto-grouped by day and dress code — events with the same vibe share one outfit. If two groups could share the same outfit, merge them. Otherwise, you're good to go.
  </p>
</div>

// REPLACE WITH:
<div style={{ marginBottom: "16px" }}>
  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", color: th.text, margin: "0 0 4px", lineHeight: 1.3 }}>
    Wearing the same outfit to multiple events?
  </h3>
  <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>
    Merge those events together.
  </p>
</div>
```

### 2b: Replace single CTA with Prev/Next day-based navigation

The current Group tab shows day tabs as horizontal pill buttons (~lines 1242–1254) and has a single sticky CTA "Looks good → Build Outfits" (~lines 1323–1328).

**Remove** the horizontal day tab pills (lines 1242–1254). Days will now be navigated via Prev/Next buttons.

**Replace** the sticky CTA block (lines 1323–1328) with a **two-button Prev/Next sticky CTA**:

```tsx
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
```

**Also add a day indicator** above the outfit groups (where the day pills used to be) so users know which day they're viewing:

```tsx
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
```

Place this day indicator **above** the "Outfit Groups (N)" count line.

### 2c: Make family member (person) tabs functional

The person tabs (~lines 1181–1188) already exist and already call `setActiveMemberId(m.id)` on click. They already switch context — the `activeMemberId` drives `activeMemberEvents`, `memberOutfitGroups`, `memberItems`, etc. throughout all tabs.

**Verify** that clicking a person tab:
1. Updates `activeMemberId`
2. Resets `currentEventIdx` to 0 (already does: `setCurrentEventIdx(0)`)
3. Resets `groupingActiveDay` to 0 (ADD this — currently missing)

In the person tab click handler (~line 1183), add `setGroupingActiveDay(0)`:
```tsx
onClick={() => { setActiveMemberId(m.id); setCurrentEventIdx(0); setGroupingActiveDay(0); }}
```

This ensures when switching family members, the Group tab starts on Day 1.

---

## Files Modified (summary)

| File | What Changed |
|------|-------------|
| `app/trip/[id]/packing/packing-page.tsx` | Header → `[← ] Packing`, Group tab merge text, Prev/Next CTA, member tab reset |
| `app/trip/[id]/meals/meals-page.tsx` | Header → `[← ] Meals` with back arrow |

---

## Verification Checklist

After making changes, verify:
1. `npx tsc --noEmit` passes with no errors
2. All 6 sub-pages now have consistent `[← ] Page Name` headers (Itinerary, Expenses, Packing, Notes, Meals, Group)
3. Trip Hub still shows `← back to Dashboard` with trip name
4. Packing Group tab shows bold "Wearing the same outfit..." text
5. Group tab Prev/Next navigates through days correctly
6. On the last day, "Next Day →" becomes "Build Outfits →" and advances to Outfits tab
7. On the first day, only the "Next Day →" / "Build Outfits →" button shows (no Prev)
8. Clicking a family member tab resets to Day 1
9. The packing style pill (icon + label) still displays on the right side of the packing header
