import type { ReactNode } from "react";
import { getTripData } from "@/lib/trip-data";
import { TripDataProvider } from "./trip-data-context";

export default async function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  const tripData = await getTripData(params.id);

  return (
    <TripDataProvider value={tripData}>
      {children}
    </TripDataProvider>
  );
}
