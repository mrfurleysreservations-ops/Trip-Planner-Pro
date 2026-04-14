# Prompt: Trip Hub Redesign — Travel & Lodging on the Hub

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

---

## Goal

Move the bookings/logistics data (hotels, flights, car rentals, restaurants) onto the **Trip Hub** page (`/trip/[id]`) so it displays directly below the Weather card. The current Logistics page will be repurposed as the Expenses page in a separate prompt — this prompt only handles the hub side.

The bookings data already exists in the `trip_bookings` table and the Logistics page (`app/trip/[id]/logistics/logistics-page.tsx`) already has full CRUD. We are **relocating the display + add form onto the hub** and **upgrading the address inputs to use Google Places autocomplete**.

---

## Step 1 — Update the Sub-Navigation

In `app/trip/[id]/trip-sub-nav.tsx`, rename the Logistics tab to Expenses:

```
Change line 11 from:
  { key: "logistics", label: "Logistics", icon: "🚐", segment: "logistics" }
To:
  { key: "expenses", label: "Expenses", icon: "💰", segment: "expenses" }
```

This means the sub-nav order becomes: Group → Notes → Itinerary → Packing → Meals → **Expenses**

---

## Step 2 — Fetch Bookings in the Trip Hub Server Component

In `app/trip/[id]/page.tsx`, the server component already fetches `trip`, `members`, and weather data. Add a query for `trip_bookings`:

```typescript
const { data: bookings } = await supabase
  .from("trip_bookings")
  .select("*")
  .eq("trip_id", id)
  .order("start_date", { ascending: true });
```

Pass `bookings: bookings || []` as a prop to the client component. Update the `TripPageProps` interface to include `bookings: TripBooking[]`.

---

## Step 3 — Build the Travel & Lodging Section on the Hub Client

In `app/trip/[id]/trip-page.tsx`, add a **"Travel & Lodging"** section below the Weather card. This section should:

### 3a — Display bookings in collapsible cards

Each booking type gets a collapsible card (accordion-style, click header to expand/collapse):

- **🏨 Hotel / Lodging** — Show: provider name (title), **location/address as a tappable Google Maps link** (`https://www.google.com/maps/search/${encodeURIComponent(address)}`), confirmation number (styled as monospace accent color), dates, room type, cost, and a **📌 notes row** (warm yellow background `#fff8e1`, border `#ffe0826e`) for things like gate codes, contact info, late check-in instructions.

- **✈️ Flights** — Group all flights under one collapsible. Each flight is a sub-card showing: who (use member name lookup), flight number + route, date + time, confirmation number. Flights don't need the map link but should show departure/arrival airports prominently.

- **🚗 Car Rental** — Show: provider + vehicle type (title), **pickup location as a tappable Maps link**, confirmation number, pickup/dropoff dates, cost, and **📌 notes row** for driver info, gas policy, etc.

- **🍽️ Restaurant** — Show: name (title), **address as a tappable Maps link**, date + time, party size, confirmation number if any, and **📌 notes row** for dress code, dietary notes, etc.

### 3b — Location rows

Every booking type that has an `address`, `pickup_location`, or `dropoff_location` field should display it as a tappable row:
```
📍 [address text]
   Tap to open in Maps  ↗
```
Styled with `background: ${th.accent}08`, `border: 1px solid ${th.accent}15`, rounded, with the text as a link to Google Maps search.

### 3c — Notes rows

Every booking's `notes` field, when populated, should display in a pinned-style row:
```
📌 [notes text]
```
Styled with warm yellow background (`#fff8e1`), border (`1px solid #ffe0826e`), rounded. This is where gate codes, contact numbers, driver info, dietary notes etc. live.

### 3d — Add Booking form

Include a "+ Add" button next to the "Travel & Lodging" heading. Clicking it opens the same add-booking form that currently exists in the Logistics page — type selector pills (Flight, Hotel, Car Rental, Restaurant), type-specific fields, save/cancel buttons. 

**Critical change:** All address/location inputs (hotel address, restaurant address, car rental pickup/dropoff locations) must use the `usePlacesAutocomplete` hook from `@/lib/use-places-autocomplete` with `{ types: ["establishment"] }`. Follow the exact same ref pattern used in the itinerary page:

```typescript
const bookingAddressRef = usePlacesAutocomplete(
  (place) => setAddAddress(place),
  { types: ["establishment"] },
);
// Then on the input:
<input ref={bookingAddressRef} value={addAddress} onChange={(e) => setAddAddress(e.target.value)} ... />
```

### 3e — Delete + Edit support

Each expanded booking card should have an edit button and a delete button (with confirmation). Only the person who added the booking or the trip host can edit/delete. Follow the same `canEdit` pattern from notes-page.tsx.

### 3f — Activity logging

Log activity when bookings are added, edited, or deleted — use `logActivity` from `@/lib/trip-activity` with `entityType: "booking"`. Follow the same pattern used in notes and itinerary.

---

## Step 4 — Empty State

If no bookings exist, show:
```
🧳
No travel or lodging info yet
Add your hotel, flights, car rentals, and reservations so everyone has the details.
[+ Add Booking] button
```

---

## Step 5 — Hub Section Order

The final hub layout from top to bottom should be:
1. Header (trip name, location, dates, member count)
2. Sub-navigation tabs
3. Weather card (existing — no changes)
4. **Travel & Lodging section (NEW — from this prompt)**
5. Quick actions / "Ready to plan?" section (existing)

---

## Step 6 — Clean Up Logistics Page (Partial)

**Do NOT delete** `app/trip/[id]/logistics/` yet — that will become the Expenses page in a separate prompt. But do the following:

- In the Logistics page header, change the "Next" button to point to expenses: `router.push(\`/trip/${trip.id}/expenses\`)`
- If the logistics page has a hardcoded "Logistics" title in the header, leave it for now — the expenses prompt will handle the full replacement.

---

## Step 7 — Verification

1. Verify the hub displays all booking types in collapsible cards with location links and notes rows
2. Verify address inputs use Google Places autocomplete (type a real address and confirm dropdown appears)
3. Verify tapping a location row opens Google Maps in a new tab
4. Verify CRUD (add, edit, delete) works for all 4 booking types
5. Verify the sub-nav now says "Expenses" instead of "Logistics"
6. Verify no TypeScript errors — run `npx tsc --noEmit`
7. Verify the existing Logistics page still loads (it will be repurposed later)
8. Verify activity logging works for booking actions

---

## Files You Will Touch

- `app/trip/[id]/trip-sub-nav.tsx` — rename Logistics → Expenses
- `app/trip/[id]/page.tsx` — fetch bookings, pass to client
- `app/trip/[id]/trip-page.tsx` — add Travel & Lodging section with CRUD
- `types/database.types.ts` — no changes needed (TripBooking type already exists)
- `lib/constants.ts` — no changes needed (BOOKING_TYPES already exists)

## Files to Reference (read but don't modify)

- `app/trip/[id]/logistics/logistics-page.tsx` — copy the add-booking form logic, type-specific fields, and CRUD operations from here
- `lib/use-places-autocomplete.ts` — the hook for Google Places
- `app/trip/[id]/itinerary/itinerary-page.tsx` — reference for how `usePlacesAutocomplete` is attached to inputs
- `app/trip/[id]/notes/notes-page.tsx` — reference for collapsible cards, edit/delete patterns, activity logging
