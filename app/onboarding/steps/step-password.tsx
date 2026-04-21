"use client";

import { useState } from "react";
import { ACCENT } from "../constants";
import type { OnboardingData } from "../types";

interface StepPasswordProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  userEmail: string;
}

/**
 * Password step — only shown to users who arrived via a Supabase invite
 * (user.invited_at is set and user_metadata.password_set is not). Lets an
 * invitee pick a password so they can log back in later with email + password
 * instead of requesting another magic link.
 *
 * Validation (match + length) is re-checked in onboarding-page.tsx before
 * calling supabase.auth.updateUser, so this component only needs to reflect
 * state — the Next button gating lives in getNavConfig().
 */
export default function StepPassword({ data, onChange, userEmail }: StepPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  const password = data.password || "";
  const confirm = data.passwordConfirm || "";

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <div className="fade-in">
      <div style={{ textAlign: "center", marginBottom: "24px", marginTop: "20px" }}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
        <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 6px", fontFamily: "'Outfit', system-ui, sans-serif" }}>
          Create a password
        </h1>
        <p style={{ fontSize: "15px", color: "#777", margin: 0, lineHeight: 1.5 }}>
          So you can sign back in anytime with your email and password — no more magic links.
        </p>
      </div>

      {userEmail && (
        <div
          style={{
            background: "#f7f7f7",
            border: "1px solid #ececec",
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "#666",
            marginBottom: "16px",
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

      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "14px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>
          Password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "14px",
            border: `2px solid ${tooShort ? "#f08080" : "#e0e0e0"}`,
            fontSize: "16px",
            fontWeight: 500,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { if (!tooShort) e.target.style.borderColor = ACCENT; }}
          onBlur={(e) => { if (!tooShort) e.target.style.borderColor = "#e0e0e0"; }}
        />
        {tooShort && (
          <div style={{ fontSize: "12px", color: "#c94f4f", marginTop: "6px" }}>
            Password must be at least 8 characters.
          </div>
        )}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "14px", fontWeight: 600, color: "#999", display: "block", marginBottom: "6px" }}>
          Confirm password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => onChange({ passwordConfirm: e.target.value })}
          placeholder="Re-enter password"
          autoComplete="new-password"
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "14px",
            border: `2px solid ${mismatch ? "#f08080" : "#e0e0e0"}`,
            fontSize: "16px",
            fontWeight: 500,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { if (!mismatch) e.target.style.borderColor = ACCENT; }}
          onBlur={(e) => { if (!mismatch) e.target.style.borderColor = "#e0e0e0"; }}
        />
        {mismatch && (
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
          padding: "4px 0",
        }}
      >
        {showPassword ? "Hide password" : "Show password"}
      </button>
    </div>
  );
}
