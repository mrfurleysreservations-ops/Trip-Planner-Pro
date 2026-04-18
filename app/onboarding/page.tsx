import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OnboardingPage from "./onboarding-page";

const STANDALONE_STEPS = new Set(["details", "style", "people", "packing"]);

export default async function OnboardingRoute({
  searchParams,
}: {
  searchParams?: { standalone?: string; step?: string };
}) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "full_name, avatar_url, onboarding_completed, default_role_preference, gender, age_range, phone, clothing_styles, packing_preferences"
    )
    .eq("id", user.id)
    .single();

  // ─── Standalone upgrade-path mode ───
  // Upsell cards on /profile deep-link here with ?standalone=1&step=<name>. In that
  // mode we skip the onboarding_completed redirect so users who already finished
  // onboarding can still opt into a skipped step.
  const rawStandalone = searchParams?.standalone === "1";
  const rawStep = searchParams?.step ?? null;
  const standalone = rawStandalone && !!rawStep && STANDALONE_STEPS.has(rawStep);

  if (!standalone && profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const prefs = (profile?.packing_preferences ?? null) as Record<string, string | null> | null;

  return (
    <OnboardingPage
      userId={user.id}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      defaultRolePreference={profile?.default_role_preference ?? null}
      standalone={standalone}
      standaloneStep={standalone ? rawStep : null}
      onboardingCompleted={profile?.onboarding_completed ?? false}
      initialProfileSeed={{
        gender: profile?.gender ?? null,
        ageRange: profile?.age_range ?? null,
        phone: profile?.phone ?? null,
        clothingStyles: profile?.clothing_styles ?? [],
        packingPrefs: {
          packing_style: prefs?.packing_style ?? null,
          organization_method: prefs?.organization_method ?? null,
          folding_method: prefs?.folding_method ?? null,
          compartment_system: prefs?.compartment_system ?? null,
        },
      }}
    />
  );
}
