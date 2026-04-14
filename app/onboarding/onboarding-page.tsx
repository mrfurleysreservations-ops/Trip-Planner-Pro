"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { BG } from "./constants";
import { PACKING_STYLE_DEFAULTS } from "@/lib/constants";
import type { OnboardingData, OnboardingPageProps, InviterInfo, InviterFriend } from "./types";

import ProgressDots from "./components/progress-dots";
import StepProfile from "./steps/step-profile";
import StepDetails from "./steps/step-details";
import StepStyle from "./steps/step-style";
import StepPeople from "./steps/step-people";
import StepFriendSuggestions from "./steps/step-friend-suggestions";
import StepPacking from "./steps/step-packing";
import StepDone from "./steps/step-done";


// ═══════════════════════════════════════════════════════════
//  MAIN ONBOARDING COMPONENT
// ═══════════════════════════════════════════════════════════

const TOTAL_STEPS = 7;

export default function OnboardingPage({ userId, userEmail, userName, avatarUrl }: OnboardingPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Check if user was invited (for friend suggestions step)
  const [inviter, setInviter] = useState<InviterInfo | null>(null);
  const [inviterFriends, setInviterFriends] = useState<InviterFriend[]>([]);
  const [hasInviter, setHasInviter] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    name: userName || "",
    avatarUrl: avatarUrl || null,
    gender: null,
    ageRange: null,
    phone: "",
    clothingStyles: [],
    connections: [],
    familyMembers: [],
    invitesSent: [],
    packingStyle: null,
    orgMethod: null,
    foldingMethod: null,
    compartmentSystem: null,
  });

  // ─── Check for inviter on mount ───
  useEffect(() => {
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
  }, [userId]);

  // ─── State & Navigation ───
  const updateData = (updates: Partial<OnboardingData>) => setData((d) => ({ ...d, ...updates }));

  const next = () => {
    setStep((s) => {
      let nextStep = Math.min(s + 1, TOTAL_STEPS - 1);
      // Skip friend suggestions step (4) if user was NOT invited
      if (nextStep === 4 && !hasInviter) nextStep = 5;
      return nextStep;
    });
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStep((s) => {
      let prevStep = Math.max(s - 1, 0);
      // Skip friend suggestions step (4) if user was NOT invited
      if (prevStep === 4 && !hasInviter) prevStep = 3;
      return prevStep;
    });
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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

      router.push("/dashboard");
    } catch (err) {
      console.error("Error saving onboarding data:", err);
      setSaving(false);
    }
  };

  // ─── Render ───
  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", fontFamily: "'Outfit', system-ui, -apple-system, sans-serif", color: "#1a1a1a", minHeight: "100vh", background: BG }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: BG, padding: "16px 20px 0" }}>
        {step > 0 && step < TOTAL_STEPS - 1 && <ProgressDots total={TOTAL_STEPS} current={step} />}
      </div>
      <div ref={containerRef} style={{ padding: "0 20px 40px", overflow: "auto" }}>
        {step === 0 && <StepProfile data={data} onChange={updateData} onNext={next} userId={userId} />}
        {step === 1 && <StepDetails data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 2 && <StepStyle data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 3 && <StepPeople data={data} onChange={updateData} onNext={next} onBack={back} userId={userId} />}
        {step === 4 && hasInviter && inviter && <StepFriendSuggestions data={data} onChange={updateData} onNext={next} onBack={back} inviter={inviter} inviterFriends={inviterFriends} />}
        {step === 5 && <StepPacking data={data} onChange={updateData} onNext={next} onBack={back} />}
        {step === 6 && <StepDone data={data} onFinish={saveAndFinish} />}
      </div>
      <style>{`
        .fade-in { animation: fadeIn 0.35s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #ccc; }
      `}</style>
    </div>
  );
}
