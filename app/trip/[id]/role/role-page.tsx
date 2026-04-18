"use client";
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { THEMES, ROLE_PREFERENCES } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { RolePageProps } from "./page";

type RoleValue = (typeof ROLE_PREFERENCES)[number]["value"];

const SAFE_DEFAULT_ROLE: RoleValue = "helping_out";

export default function RolePage({
  trip,
  currentMember,
  defaultRole,
  inviterName,
  userId,
  userName,
  redirectTo,
}: RolePageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  // Pre-select the user's existing account-level default if they have one.
  // Fall back to their current per-trip pick only if that was an *explicit*
  // prior selection (anything other than the schema default 'helping_out'
  // could also come from a prior change — we can't distinguish, so we don't
  // assume. Safer to ask fresh unless the account-level default is set.)
  const initialRole: RoleValue | null = useMemo(() => {
    const candidates = [defaultRole, currentMember.role_preference];
    for (const c of candidates) {
      const hit = ROLE_PREFERENCES.find((r) => r.value === c);
      if (hit) return hit.value as RoleValue;
    }
    return null;
  }, [defaultRole, currentMember.role_preference]);

  const [selectedRole, setSelectedRole] = useState<RoleValue | null>(initialRole);
  const [saving, setSaving] = useState(false);

  const selectedMeta = selectedRole
    ? ROLE_PREFERENCES.find((r) => r.value === selectedRole)!
    : null;

  const inviterInitial = (inviterName || "").trim().charAt(0).toUpperCase();

  // ─── Commit a pick ───
  const handleSelect = useCallback(
    async (role: RoleValue) => {
      if (saving) return;
      const meta = ROLE_PREFERENCES.find((r) => r.value === role);
      if (!meta) return;

      setSaving(true);
      try {
        const nowIso = new Date().toISOString();

        // Only override chat_notification_level when the user hasn't
        // explicitly customized it from the in-chat settings sheet. We
        // detect "untouched" by checking whether the CURRENT level still
        // matches the PREVIOUS role's default — if it does, they never
        // strayed and it's safe to advance with the new role's default.
        const prevRoleMeta = ROLE_PREFERENCES.find(
          (r) => r.value === currentMember.role_preference
        );
        const prevDefault = prevRoleMeta?.chatDefault ?? null;
        const currentLevel = currentMember.chat_notification_level;
        const userCustomized =
          prevDefault !== null && currentLevel !== prevDefault;

        const memberUpdate: {
          role_preference: RoleValue;
          updated_at: string;
          chat_notification_level?: string;
        } = {
          role_preference: role,
          updated_at: nowIso,
        };
        if (!userCustomized) {
          memberUpdate.chat_notification_level = meta.chatDefault;
        }

        const { error: memberErr } = await supabase
          .from("trip_members")
          .update(memberUpdate)
          .eq("id", currentMember.id);

        if (memberErr) {
          console.error("role-picker: trip_members update failed", memberErr);
          setSaving(false);
          return;
        }

        // Only seed the account-level default if the user doesn't have one.
        // Preserves an intentional prior pick made on another trip.
        if (!defaultRole) {
          const { error: profileErr } = await supabase
            .from("user_profiles")
            .update({
              default_role_preference: role,
              updated_at: nowIso,
            })
            .eq("id", userId);
          if (profileErr) {
            // Non-fatal — the trip_member row is the source of truth.
            console.error("role-picker: user_profiles update failed", profileErr);
          }
        }

        await logActivity(supabase, {
          tripId: trip.id,
          userId,
          userName,
          action: "updated",
          entityType: "member",
          entityName: userName,
          detail: `Role: ${meta.label}`,
          linkPath: `/trip/${trip.id}`,
        });

        router.push(redirectTo);
      } catch (e) {
        console.error("role-picker: unexpected error", e);
        setSaving(false);
      }
    },
    [
      saving,
      supabase,
      currentMember.id,
      currentMember.role_preference,
      currentMember.chat_notification_level,
      defaultRole,
      userId,
      userName,
      trip.id,
      redirectTo,
      router,
    ]
  );

  const handleSkip = useCallback(() => {
    // Skip = land on Helping Out (safe middle ground — no density gated off).
    handleSelect(SAFE_DEFAULT_ROLE);
  }, [handleSelect]);

  const handleContinue = useCallback(() => {
    if (!selectedRole) return;
    handleSelect(selectedRole);
  }, [selectedRole, handleSelect]);

  // ─── Render ───
  return (
    <div
      style={{
        minHeight: "100vh",
        background: th.bg,
        color: th.text,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ─── STICKY TOP REGION ─────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: th.headerBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              fontSize: 17,
              color: th.text,
            }}
          >
            Trip Planner Pro
          </span>
          <button
            onClick={handleSkip}
            disabled={saving}
            style={{
              background: "transparent",
              border: "none",
              color: th.muted,
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              padding: "6px 8px",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Skip →
          </button>
        </div>
      </div>

      {/* ─── SCROLLABLE BODY ───────────────────────────────── */}
      <div
        style={{
          flex: 1,
          padding: "20px 16px 24px",
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {inviterName && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 18,
              borderRadius: 16,
              background: th.card,
              border: `1px solid ${th.cardBorder}`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: th.accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                flexShrink: 0,
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {inviterInitial || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: th.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {inviterName} invited you to
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: th.text,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {trip.name}
              </div>
            </div>
          </div>
        )}

        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 24,
            fontWeight: 800,
            lineHeight: 1.25,
            margin: 0,
            marginBottom: 6,
            color: th.text,
          }}
        >
          What's your energy on this trip?
        </h1>
        <p
          style={{
            fontSize: 13,
            color: th.muted,
            margin: 0,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Be honest. We'll set the app up so it actually matches how you want to travel.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ROLE_PREFERENCES.map((role) => {
            const active = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value as RoleValue)}
                disabled={saving}
                aria-pressed={active}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 16,
                  background: active ? `${th.accent}0f` : th.card,
                  border: active
                    ? `2px solid ${th.accent}`
                    : `2px solid ${th.cardBorder}`,
                  boxShadow: active
                    ? `0 4px 12px ${th.accent}2e`
                    : "none",
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                  width: "100%",
                  color: th.text,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: active ? `${th.accent}2e` : "rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    flexShrink: 0,
                  }}
                >
                  {role.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 16,
                      fontWeight: 800,
                      color: th.text,
                    }}
                  >
                    {role.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: th.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginTop: 2,
                    }}
                  >
                    {role.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── STICKY BOTTOM CTA ─────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 20,
          background: th.headerBg,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "12px 16px 16px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <button
            onClick={handleContinue}
            disabled={!selectedMeta || saving}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 14,
              border: "none",
              background: selectedMeta ? th.accent : "rgba(0,0,0,0.08)",
              color: selectedMeta ? "#fff" : th.muted,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              cursor: !selectedMeta || saving ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {saving
              ? "Saving…"
              : selectedMeta
              ? `Continue as ${selectedMeta.label} →`
              : "Pick one to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
