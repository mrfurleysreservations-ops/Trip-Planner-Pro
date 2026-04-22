import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 1. Get the current user via the normal (anon) client
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Delete the user via the admin client (service role key)
    //    Password verification happens client-side before calling this route.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfiguration — service role key not set" },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 3. Sign out the current session
    await supabase.auth.signOut();

    // Clear per-user onboarding cookies on the way out so the next sign-in
    // on this device evaluates the gate fresh.
    const res = NextResponse.json({ success: true });
    res.cookies.set("onboarding_completed", "", { path: "/", maxAge: 0, sameSite: "lax" });
    res.cookies.set("skipped_onboarding", "", { path: "/", maxAge: 0, sameSite: "lax" });
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
