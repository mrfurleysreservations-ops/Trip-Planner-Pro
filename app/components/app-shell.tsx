"use client";
import { usePathname } from "next/navigation";

// Auth routes that should NOT show the shell
const AUTH_ROUTES = ["/auth/login", "/auth/callback", "/"];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Don't wrap auth pages
  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  // Every non-auth route now renders its own top chrome:
  //   - Top-level pages (dashboard, chats, friends, gear, profile, alerts) render
  //     their own sticky TopNav header.
  //   - Trip pages (/trip/[id]/...) render no top chrome and use TripSubNav at
  //     the bottom.
  // AppShell just supplies the page-level background.
  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f8" }}>
      {children}
    </div>
  );
}
