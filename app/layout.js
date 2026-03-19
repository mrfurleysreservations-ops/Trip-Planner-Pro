import "./globals.css";

export const metadata = {
  title: "Trip Planner Pro",
  description: "Organize camping, flying, road trips, and meetups with your crew.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
