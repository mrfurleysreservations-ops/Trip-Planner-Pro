"use client";
import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

export default function Providers({ children }: { children: ReactNode }) {
  // useState lazy-init so the client is created exactly once per client
  // boot — avoids re-creating it on every React render and avoids the
  // "new client per request" footgun on the server side of hydration.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,         // 30s — data considered fresh
            gcTime: 5 * 60 * 1_000,    // 5 min — kept in memory even if unused
            refetchOnWindowFocus: true, // TanStack default, stated explicitly
            retry: 1,                   // one retry on transient failure
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
