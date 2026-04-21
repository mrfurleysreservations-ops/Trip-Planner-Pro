"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// Accent matches the rest of the app; kept inline so this route has no extra deps.
const ACCENT = "#e8943a";
const BG = "#faf9f7";

interface InviteeSetupPageProps {
  userId: string;
  userEmail: string;
  initialName: string;
  nextUrl: string | null;
}

export default function InviteeSetupPage({
  userId,
  userEmail,
  initialName,
  nextUrl,
}: InviteeSetupPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [name, setName] = useState(initialName || "");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const passwordLongEnough = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPw;
  const canSubmit = trimmedName.length > 0 && passwordLongEnough && passwordsMatch && !saving;

  // Destination after setup — defaults to /dashboard; /auth/confirm threads the
  // invite landing page as ?next= so invitees end up on the RSVP card.
  const destination = nextUrl || "/dashboard";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      // Set password + stamp password_set so repeat visits skip this page.
      const { error: pwErr } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });
      if (pwErr) {
        setError(pwErr.message || "Couldn't save your password. Try again?");
        setSaving(false);
        return;
      }

      // Persist name on user_profiles so it shows throughout the app. We
      // intentionally do NOT flip onboarding_completed — the user hasn't
      // gone through the full wizard. The dashboard's "Finish setting up
      // your profile" card handles the nudge from here.
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .update({ full_name: trimmedName })
        .eq("id", userId);
      if (profileErr) {
        // Non-fatal for invite flow — name can be edited later from /profile.
        console.error("Failed to update full_name during invitee setup:", profileErr);
      }

      router.push(destination);
    } catch (err) {
      console.error("Invitee setup failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
        color: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          width: "100%",
          margin: "0 auto",
          padding: "32px 20px 40px",
          flex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2 }}>
            You&apos;re almost in
          </h1>
          <p style={{ fontSize: "15px", color: "#777", margin: 0, lineHeight: 1.5 }}>
            Set your name and a password, then we&apos;ll take you to the trip.
          </p>
        </div>

        {userEmail && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ececec",
              borderRadius: "12px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "#666",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>📧</span>
            <span>
              Signed in as <strong style={{ color: "#1a1a1a" }}>{userEmail}</strong>
            </span>
          </div>
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: "18px",
            border: "1.5px solid #e8e8e8",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            padding: "20px",
          }}
        >
          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#999",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "2px solid #e0e0e0",
                fontSize: "16px",
                fontWeight: 500,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = ACCENT)}
              onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#999",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `2px solid ${password.length > 0 && !passwordLongEnough ? "#f08080" : "#e0e0e0"}`,
                fontSize: "16px",
                fontWeight: 500,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                if (!(password.length > 0 && !passwordLongEnough)) e.target.style.borderColor = ACCENT;
              }}
              onBlur={(e) => {
                if (!(password.length > 0 && !passwordLongEnough)) e.target.style.borderColor = "#e0e0e0";
              }}
            />
            {password.length > 0 && !passwordLongEnough && (
              <div style={{ fontSize: "12px", color: "#c94f4f", marginTop: "6px" }}>
                Password must be at least 8 characters.
              </div>
            )}
          </div>

          <div style={{ marginBottom: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#999",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Confirm password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `2px solid ${confirmPw.length > 0 && !passwordsMatch ? "#f08080" : "#e0e0e0"}`,
                fontSize: "16px",
                fontWeight: 500,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                if (!(confirmPw.length > 0 && !passwordsMatch)) e.target.style.borderColor = ACCENT;
              }}
              onBlur={(e) => {
                if (!(confirmPw.length > 0 && !passwordsMatch)) e.target.style.borderColor = "#e0e0e0";
              }}
            />
            {confirmPw.length > 0 && !passwordsMatch && (
              <div style={{ fontSize: "12px", color: "#c94f4f", marginTop: "6px" }}>
                Passwords don&apos;t match.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "#777",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 0 12px",
            }}
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>

          {error && (
            <div
              style={{
                background: "#fff2f0",
                border: "1px solid #f5c2c0",
                color: "#a63a37",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: canSubmit ? ACCENT : "#ddd",
              color: canSubmit ? "#fff" : "#999",
              fontSize: "16px",
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "default",
              boxShadow: canSubmit ? "0 4px 16px rgba(232,148,58,0.35)" : "none",
            }}
          >
            {saving ? "Saving…" : "Continue to Trip →"}
          </button>

          <p style={{ fontSize: "12px", color: "#999", marginTop: "14px", textAlign: "center", lineHeight: 1.5 }}>
            You can fill out the rest of your profile later from the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
