import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OnboardingPage from "./onboarding-page";

export default async function OnboardingRoute() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, avatar_url, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <OnboardingPage
      userId={user.id}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
    />
  );
}
