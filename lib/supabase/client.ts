import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

// Browser client — use ONLY in "use client" components.
// Do not call this in server components, route handlers, or middleware.
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
