"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { ACCENT, BG } from "./constants";
import { PACKING_STYLE_DEFAULTS } from "@/lib/constants";
import type { OnboardingData, OnboardingPageProps, InviterInfo, InviterFriend } from "./types";

import ProgressDots from "./components/progress-dots";
import NavButtons from "./components/nav-buttons";
import StepProfile from "./steps/step-profile";
import StepDetails from "./steps/step-details";
import StepStyle from "./steps/step-style";
import StepPeople from "./steps/step-people";
import StepFriendSuggestions from "./steps/step-friend-suggestions";
import StepPacking from "./steps/step-packing";
import StepDone from "./steps/step-done";
import StepWelcome from "./steps/step-welcome";


// ═══════════════════════════════════════════════════════════
//  STEP SEQUENCING BY ROLE
//  ───────────────────────────────────────────────────────────
//  All In / Helping Out → full 8-step flow.
//  Just Here / Vibes Only → minimal profile + abbreviated done.
//  See docs/role-based-onboarding.md Skip/Keep/Defer matrix.
//  The skipped steps are not deleted — they return as opt-in
//  cards on /profile (Phase F).
//  NOTE: Invitees (arrived via /auth/confirm with invited_at set) never
//  reach this wizard — /auth/confirm routes them to /auth/invitee-setup
//  which asks for name+password only and drops them at the trip invite.
//  They'll see the dashboard's "Finish setting up your profile" card
//  later and come back here at their own pace.
// ═══════════════════════════════════════════════════════════

type StepName =
  | "welcome"
  | "profile"
  | "profile-minimal"
  | "details"
  | "style"
  | "people"
  | "friend-suggestions"
  | "packing"
  | "done"
  | "done-abbreviated";

const FULL_FLOW: StepName[] = [
  "welcome",
  "profile",
  "details",
  "style",
  "people",
  "friend-suggestions",
  "packing",
  "done",
];

const MINIMAL_FLOW: StepName[] = ["profile-minimal", "done-abbreviated"];

function stepsForRole(role: string | null): StepName[] {
  // Full flow for planners/helpers (and if role is unset, assume helping_out)
  if (!role || role === "all_in" || role === "helping_out") return FULL_FLOW;
  // Just Here / Vibes Only — minimal profile + abbreviated done
  if (role === "just_here" || role === "vibes_only") return MINIMAL_FLOW;
  return FULL_FLOW;
}


export default function OnboardingPage({
  userId,
  userEmail,
  userName,
  avatarUrl,
  defaultRolePreference,
  standalone = false,
  standaloneStep = null,
  onboardingCompleted = false,
  nextUrl = null,
  initialProfileSeed,
}: OnboardingPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const containerRef = useRef<HTMLDivElement>(null);
  void userEmail; // reserved for future use; kept on props for callsite parity

  // In standalone mode, the "flow" is a single existing step so we can reuse the
  // step components verbatim. Nav + save paths are swapped for a profile-return CTA.
  const activeSteps = useMemo(() => {
    if (standalone && standaloneStep) return [standaloneStep as StepName];
    return stepsForRole(defaultRolePreference);
  }, [defaultRolePreference, standalone, standaloneStep]);
  const isMinimalFlow = !standalone && activeSteps === MINIMAL_FLOW;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Check if user was invited (for friend suggestions step — full flow only)
  const [inviter, setInviter] = useState<InviterInfo | null>(null);
  const [inviterFriends, setInviterFriends] = useState<InviterFriend[]>([]);
  const [hasInviter, setHasInviter] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    name: userName || "",
    avatarUrl: avatarUrl || null,
    // Pre-seed existing profile values in standalone mode so users can edit, not
    // re-enter. In the initial onboarding flow initialProfileSeed is either absent
    // or still null/empty, matching the original behavior.
    gender: initialProfileSeed?.gender ?? null,
    ageRange: initialProfileSeed?.ageRange ?? null,
    phone: initialProfileSeed?.phone ?? "",
    clothingStyles: initialProfileSeed?.clothingStyles ?? [],
    connections: [],
    familyMembers: [],
    invitesSent: [],
    packingStyle: initialProfileSeed?.packingPrefs.packing_style ?? null,
    orgMethod: initialProfileSeed?.packingPrefs.organization_method ?? null,
    foldingMethod: initialProfileSeed?.packingPrefs.folding_method ?? null,
    compartmentSystem: initialProfileSeed?.packingPrefs.compartment_system ?? null,
  });

  // ─── Check for inviter on mount (full flow only — minimal flow never hits the suggestions step) ───
  useEffect(() => {
    if (isMinimalFlow || standalone) return;
    const checkInviter = async () => {
      // Check if anyone has a pending friend_link pointing at us (they invited us)
      const { data: links } = await supabase
        .from("friend_links")
        .select("user_id")
        .eq("friend_id", userId)
        .limit(1);

      if (links && links.length > 0) {
        const inviterId = links[0].user_id;

        // Fetch inviter profile
        const { data: inviterProfile } = await supabase
          .from("user_profiles")
          .select("id, full_name, avatar_url")
          .eq("id", inviterId)
          .single();

        if (inviterProfile) {
          setInviter({
            id: inviterProfile.id,
            name: inviterProfile.full_name || "Someone",
            avatar: "😎",
            avatar_url: inviterProfile.avatar_url,
          });

          // Fetch inviter's friends
          const { data: friendLinks } = await supabase
            .from("friend_links")
            .select("friend_id")
            .eq("user_id", inviterId)
            .eq("status", "accepted");

          if (friendLinks && friendLinks.length > 0) {
            const friendIds = friendLinks.map((l) => l.friend_id).filter((id) => id !== userId);
            if (friendIds.length > 0) {
              const { data: friendProfiles } = await supabase
                .from("user_profiles")
                .select("id, full_name, avatar_url")
                .in("id", friendIds);

              if (friendProfiles) {
                setInviterFriends(friendProfiles.map((p) => ({
                  id: p.id,
                  name: p.full_name || "Unknown",
                  avatar: "🧑",
                  avatar_url: p.avatar_url,
                  trips: 0, // Could be computed but not critical for MVP
                })));
              }
            }
          }
          setHasInviter(true);
        }
      }
    };
    checkInviter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isMinimalFlow, standalone]);

  // ─── State & Navigation ───
  const updateData = (updates: Partial<OnboardingData>) => setData((d) => ({ ...d, ...updates }));

  const currentStepName: StepName = activeSteps[step];

  // In the full flow we skip friend-suggestions unless the user was actually invited.
  // Walk forward or backward until we land on a step that should be shown.
  const advance = (direction: 1 | -1) => {
    setStep((s) => {
      let next = s + direction;
      while (next > 0 && next < activeSteps.length - 1) {
        const name = activeSteps[next];
        if (name === "friend-suggestions" && !hasInviter) {
          next += direction;
          continue;
        }
        break;
      }
      // Never go back to the welcome gate once we've left it
      if (direction === -1 && activeSteps[next] === "welcome") next = Math.min(s, activeSteps.length - 1);
      return Math.max(0, Math.min(next, activeSteps.length - 1));
    });
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => advance(1);
  const back = () => advance(-1);

  // ─── Standalone Save (upgrade-path mode) ───
  // Persists only the fields that belong to the active step, preserves other
  // profile fields, and returns to /profile. Never flips onboarding_completed
  // back to true if it was already true — the user has already completed it.
  const saveStandalone = async () => {
    if (saving || !standalone || !standaloneStep) return;
    setSaving(true);

    try {
      const update: Record<string, unknown> = {};

      if (standaloneStep === "details") {
        update.gender = data.gender;
        update.age_range = data.ageRange;
        update.phone = data.phone || null;
      } else if (standaloneStep === "style") {
        update.clothing_styles = data.clothingStyles;
      } else if (standaloneStep === "packing") {
        const style = data.packingStyle || "planner";
        const defaults = PACKING_STYLE_DEFAULTS[style] || PACKING_STYLE_DEFAULTS.planner;
        update.packing_preferences = {
          packing_style: data.packingStyle,
          organization_method: data.orgMethod || defaults.organization_method,
          folding_method: data.foldingMethod || defaults.folding_method,
          compartment_system: data.compartmentSystem || defaults.compartment_system,
          checklist_level: defaults.checklist_level,
          planning_timeline: defaults.planning_timeline,
          just_in_case_level: defaults.just_in_case_level,
          visual_planning: defaults.visual_planning,
        };
      }
      // "people" doesn't push anything into user_profiles — it creates rows in
      // families / family_members / friend_links below.

      // First-timers going through a standalone step still get credit for finishing
      // onboarding; already-completed users are left alone.
      if (!onboardingCompleted) update.onboarding_completed = true;

      if (Object.keys(update).length > 0) {
        await supabase.from("user_profiles").update(update).eq("id", userId);
        // Seed the middleware fast-path cookie if this write just completed
        // onboarding. Colocated with the DB write so the two stay in sync.
        if (update.onboarding_completed) {
          document.cookie = "onboarding_completed=true; path=/; max-age=31536000; samesite=lax";
        }
      }

      if (standaloneStep === "people") {
        // Create family members — mirrors the logic in saveAndFinish, scoped to one step.
        if (data.familyMembers.length > 0) {
          const { data: families } = await supabase
            .from("families")
            .select("id")
            .eq("owner_id", userId)
            .limit(1);

          let familyId: string;
          if (families && families.length > 0) {
            familyId = families[0].id;
          } else {
            const { data: newFamily } = await supabase
              .from("families")
              .insert({ owner_id: userId, name: `${data.name || userName || "Your"}'s Family` })
              .select("id")
              .single();
            familyId = newFamily!.id;
          }

          for (const member of data.familyMembers) {
            await supabase.from("family_members").insert({
              family_id: familyId,
              name: member.name,
              age_type: member.age_type,
              linked_user_id: member.linkedUserId || null,
            });
          }
        }

        for (const connection of data.connections) {
          const { data: existing } = await supabase
            .from("friend_links")
            .select("id")
            .or(`and(user_id.eq.${userId},friend_id.eq.${connection.id}),and(user_id.eq.${connection.id},friend_id.eq.${userId})`)
            .limit(1);
          if (!existing || existing.length === 0) {
            await supabase.from("friend_links").insert({
              user_id: userId,
              friend_id: connection.id,
              status: "pending",
            });
          }
        }
      }

      router.push("/profile");
    } catch (err) {
      console.error("Error saving standalone onboarding step:", err);
      setSaving(false);
    }
  };

  // ─── Data Persistence ───
  const saveAndFinish = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // 1. Update user_profiles
      await supabase.from("user_profiles").update({
        full_name: data.name,
        avatar_url: data.avatarUrl,
        gender: data.gender,
        age_range: data.ageRange,
        phone: data.phone || null,
        clothing_styles: data.clothingStyles,
        packing_preferences: {
          packing_style: data.packingStyle,
          organization_method: data.orgMethod || (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).organization_method,
          folding_method: data.foldingMethod || (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).folding_method,
          compartment_system: data.compartmentSystem || (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).compartment_system,
          checklist_level: (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).checklist_level,
          planning_timeline: (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).planning_timeline,
          just_in_case_level: (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).just_in_case_level,
          visual_planning: (PACKING_STYLE_DEFAULTS[data.packingStyle || "planner"] || {}).visual_planning,
        },
        onboarding_completed: true,
      }).eq("id", userId);

      // 2. Create friend_links for connections
      for (const connection of data.connections) {
        // Check if link already exists in either direction
        const { data: existing } = await supabase
          .from("friend_links")
          .select("id")
          .or(`and(user_id.eq.${userId},friend_id.eq.${connection.id}),and(user_id.eq.${connection.id},friend_id.eq.${userId})`)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("friend_links").insert({
            user_id: userId,
            friend_id: connection.id,
            status: "pending",
          });
        }
      }

      // 3. Create family members
      if (data.familyMembers.length > 0) {
        // Get or create family for user
        let { data: families } = await supabase
          .from("families")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);

        let familyId: string;
        if (families && families.length > 0) {
          familyId = families[0].id;
        } else {
          const { data: newFamily } = await supabase
            .from("families")
            .insert({ owner_id: userId, name: `${data.name}'s Family` })
            .select("id")
            .single();
          familyId = newFamily!.id;
        }

        for (const member of data.familyMembers) {
          await supabase.from("family_members").insert({
            family_id: familyId,
            name: member.name,
            age_type: member.age_type,
            linked_user_id: member.linkedUserId || null,
          });
        }
      }

      // 4. Store email invites as friend_links with "invited" status
      // (simplified — in production this would trigger email sends)

      // Clear skip cookie now that onboarding is complete, and seed the
      // middleware fast-path cookie so the next navigation doesn't need to
      // hit user_profiles to confirm.
      document.cookie = "skipped_onboarding=; path=/; max-age=0";
      document.cookie = "onboarding_completed=true; path=/; max-age=31536000; samesite=lax";

      // Invite flow: land on the trip invite page instead of /dashboard when
      // /auth/confirm threaded a `next` param through onboarding.
      router.push(nextUrl || "/dashboard");
    } catch (err) {
      console.error("Error saving onboarding data:", err);
      setSaving(false);
    }
  };

  // ─── Nav config per step ───
  // Returns null when the step owns its own CTA (welcome gate, done screens).
  const getNavConfig = (): { showBack: boolean; nextLabel: string; nextDisabled: boolean; onBack: () => void; onNext: () => void } | null => {
    // Standalone mode: single-step upgrade path. Back returns to /profile, Save
    // persists just that step's fields. We still reuse per-step disabled logic.
    if (standalone) {
      const back = () => router.push("/profile");
      switch (currentStepName) {
        case "details":
          return { showBack: true, nextLabel: saving ? "Saving…" : "Save", nextDisabled: saving || !data.ageRange, onBack: back, onNext: saveStandalone };
        case "style":
          return { showBack: true, nextLabel: saving ? "Saving…" : "Save", nextDisabled: saving || (data.clothingStyles || []).length === 0, onBack: back, onNext: saveStandalone };
        case "people": {
          const totalPeople = (data.connections || []).length + (data.familyMembers || []).length + (data.invitesSent || []).length;
          return { showBack: true, nextLabel: saving ? "Saving…" : "Save", nextDisabled: saving || totalPeople === 0, onBack: back, onNext: saveStandalone };
        }
        case "packing":
          return { showBack: true, nextLabel: saving ? "Saving…" : "Save", nextDisabled: saving || !data.packingStyle, onBack: back, onNext: saveStandalone };
        default:
          return null;
      }
    }

    switch (currentStepName) {
      case "welcome":
      case "done":
      case "done-abbreviated":
        return null;
      case "profile":
        return { showBack: false, nextLabel: "Let's go", nextDisabled: !data.name?.trim(), onBack: back, onNext: next };
      case "profile-minimal":
        // Minimal flow has no back button (profile is step 0) and the CTA takes the user
        // straight to the abbreviated done screen.
        return { showBack: false, nextLabel: "Let's go", nextDisabled: !data.name?.trim(), onBack: back, onNext: next };
      case "details":
        return { showBack: true, nextLabel: "Next", nextDisabled: !data.ageRange, onBack: back, onNext: next };
      case "style":
        return { showBack: true, nextLabel: "Next", nextDisabled: (data.clothingStyles || []).length === 0, onBack: back, onNext: next };
      case "people": {
        const totalPeople = (data.connections || []).length + (data.familyMembers || []).length + (data.invitesSent || []).length;
        return { showBack: true, nextLabel: totalPeople === 0 ? "Skip for now" : "Next", nextDisabled: false, onBack: back, onNext: next };
      }
      case "friend-suggestions": {
        const suggestionsLeft = inviterFriends.filter((f) => !(data.connections || []).find((c) => c.id === f.id)).length;
        return { showBack: true, nextLabel: suggestionsLeft === 0 ? "Next" : "Skip or continue", nextDisabled: false, onBack: back, onNext: next };
      }
      case "packing":
        return { showBack: true, nextLabel: "Save & Continue", nextDisabled: false, onBack: back, onNext: next };
      default:
        return null;
    }
  };

  const navConfig = getNavConfig();

  // Progress dots are only meaningful inside the full flow (5 visible middle steps).
  // The 2-step minimal flow hides them entirely — it's self-evidently short.
  // Standalone mode is a single-step re-entry point, so dots are also hidden.
  const showProgressDots =
    !isMinimalFlow &&
    !standalone &&
    currentStepName !== "welcome" &&
    currentStepName !== "profile" &&
    currentStepName !== "done";
  const visibleStepTotal = FULL_FLOW.length - 1; // hide welcome from dots
  const visibleStepIndex = Math.max(0, FULL_FLOW.indexOf(currentStepName) - 1);

  // ─── Render ───
  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", fontFamily: "'Outfit', system-ui, -apple-system, sans-serif", color: "#1a1a1a", minHeight: "100vh", background: BG }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: BG, padding: "10px 16px 0" }}>
        {showProgressDots && <ProgressDots total={visibleStepTotal} current={visibleStepIndex} />}
      </div>
      <div ref={containerRef} style={{ padding: currentStepName === "welcome" ? "0" : "0 16px 80px" }}>
        {currentStepName === "welcome" && <StepWelcome onSetup={next} onSkip={() => router.push(nextUrl || "/dashboard")} exploreUrl={nextUrl || "/dashboard"} />}
        {currentStepName === "profile" && <StepProfile data={data} onChange={updateData} userId={userId} />}
        {currentStepName === "profile-minimal" && <StepProfile data={data} onChange={updateData} userId={userId} minimal />}
        {currentStepName === "details" && <StepDetails data={data} onChange={updateData} />}
        {currentStepName === "style" && <StepStyle data={data} onChange={updateData} />}
        {currentStepName === "people" && <StepPeople data={data} onChange={updateData} userId={userId} />}
        {currentStepName === "friend-suggestions" && hasInviter && inviter && (
          <StepFriendSuggestions data={data} onChange={updateData} inviter={inviter} inviterFriends={inviterFriends} />
        )}
        {currentStepName === "packing" && <StepPacking data={data} onChange={updateData} />}
        {currentStepName === "done" && <StepDone data={data} />}
        {currentStepName === "done-abbreviated" && (
          <StepDone data={data} abbreviated onFinish={saveAndFinish} saving={saving} />
        )}
      </div>
      {navConfig && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: "480px", margin: "0 auto", padding: "12px 20px", background: "#fff", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", zIndex: 20 }}>
          <NavButtons onBack={navConfig.onBack} onNext={navConfig.onNext} nextLabel={navConfig.nextLabel} nextDisabled={navConfig.nextDisabled} showBack={navConfig.showBack} />
        </div>
      )}
      {currentStepName === "done" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: "480px", margin: "0 auto", padding: "12px 20px", background: "#fff", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", zIndex: 20 }}>
          <button onClick={saveAndFinish} disabled={saving} style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: saving ? "#ddd" : ACCENT, color: saving ? "#999" : "#fff", fontSize: "16px", fontWeight: 700, cursor: saving ? "default" : "pointer", boxShadow: saving ? "none" : "0 4px 16px rgba(232,148,58,0.35)" }}>{saving ? "Saving…" : "Start Planning a Trip →"}</button>
        </div>
      )}
      <style>{`
        .fade-in { animation: fadeIn 0.35s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #ccc; }
      `}</style>
    </div>
  );
}
