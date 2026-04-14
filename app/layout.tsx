import Script from "next/script";
import "./globals.css";
import AppShell from "./components/app-shell";

export const metadata = {
  title: "Trip Planner Pro",
  description: "Organize camping, flying, road trips, and meetups with your crew.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <html lang="en">
      <body>
        {googleMapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`}
            strategy="lazyOnload"
          />
        )}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
