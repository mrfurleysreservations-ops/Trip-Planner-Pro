/**
 * Centralized TanStack Query keys, scoped by trip. All keys follow the
 * pattern ["trip", tripId, <resource>, ...optional sub-keys] so
 * invalidating ["trip", tripId] nukes every query for that trip.
 *
 * Using a factory instead of inline literals gives us:
 *  - Typo-free invalidation (you can't misspell a function name)
 *  - Auto-complete across the codebase
 *  - One place to see every cached resource this app tracks
 *
 * Add new entries here when introducing a new query — do NOT inline
 * string tuples at call sites.
 */
export const tripKeys = {
  all: (tripId: string) => ["trip", tripId] as const,

  // Itinerary tab
  eventParticipants: (tripId: string) =>
    ["trip", tripId, "event-participants"] as const,
  eventExpenseTotals: (tripId: string) =>
    ["trip", tripId, "event-expense-totals"] as const,

  // Expenses tab
  expenses: (tripId: string) => ["trip", tripId, "expenses"] as const,
  expensePayers: (tripId: string) =>
    ["trip", tripId, "expense-payers"] as const,
  expenseSplits: (tripId: string) =>
    ["trip", tripId, "expense-splits"] as const,

  // Chat tab
  chatMessages: (tripId: string) =>
    ["trip", tripId, "chat-messages"] as const,
  chatReadState: (tripId: string) =>
    ["trip", tripId, "chat-read-state"] as const,

  // Packing tab
  packingItems: (tripId: string) =>
    ["trip", tripId, "packing-items"] as const,
  packingOutfits: (tripId: string) =>
    ["trip", tripId, "packing-outfits"] as const,
  packingOutfitGroups: (tripId: string) =>
    ["trip", tripId, "packing-outfit-groups"] as const,
  packingBagSections: (tripId: string) =>
    ["trip", tripId, "packing-bag-sections"] as const,
  packingContainers: (tripId: string) =>
    ["trip", tripId, "packing-containers"] as const,
  packingAssignments: (tripId: string) =>
    ["trip", tripId, "packing-assignments"] as const,
  gearLibrary: (tripId: string) =>
    ["trip", tripId, "gear-library"] as const,

  // Notes tab
  notes: (tripId: string) => ["trip", tripId, "notes"] as const,

  // Supplies tab
  supplies: (tripId: string) => ["trip", tripId, "supplies"] as const,
  mealItems: (tripId: string) => ["trip", tripId, "meal-items"] as const,
  mealParticipants: (tripId: string) =>
    ["trip", tripId, "meal-participants"] as const,
  groceryCheckoffs: (tripId: string) =>
    ["trip", tripId, "grocery-checkoffs"] as const,

  // Group tab (beyond shared members context)
  bookings: (tripId: string) => ["trip", tripId, "bookings"] as const,
  invitations: (tripId: string) => ["trip", tripId, "invitations"] as const,
};
