"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { TripData } from "@/lib/trip-data";

const TripDataContext = createContext<TripData | null>(null);

export function TripDataProvider({
  value,
  children,
}: {
  value: TripData;
  children: ReactNode;
}) {
  return (
    <TripDataContext.Provider value={value}>
      {children}
    </TripDataContext.Provider>
  );
}

/**
 * Hook for client components under `/app/trip/[id]/*` to read the shared
 * trip data (trip row, members, events, userId, isHost) that the layout
 * fetched server-side. Throws if used outside the provider — that means a
 * component is being rendered outside the trip segment and should be
 * getting its data some other way.
 */
export function useTripData(): TripData {
  const ctx = useContext(TripDataContext);
  if (!ctx) {
    throw new Error(
      "useTripData must be used inside <TripDataProvider> — are you " +
        "rendering a trip component outside of /app/trip/[id]/*?",
    );
  }
  return ctx;
}
