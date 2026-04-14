"use client";
import { useState, FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess("Password updated! Redirecting...");
      setLoading(false);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f8f8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ maxWidth: "420px", width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧭</div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "32px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
          }}>
            Trip Planner Pro
          </h1>
          <p style={{ color: "#777", fontSize: "14px", marginTop: "8px" }}>
            Set your new password
          </p>
        </div>

        {/* Form card */}
        <div className="card-glass" style={{ padding: "28px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="input-modern"
                required
                minLength={6}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="input-modern"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(225, 70, 70, 0.08)",
                border: "1px solid rgba(225, 70, 70, 0.2)",
                color: "#c0392b",
                fontSize: "13px",
                marginBottom: "16px",
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(124, 179, 66, 0.08)",
                border: "1px solid rgba(124, 179, 66, 0.2)",
                color: "#2e7d32",
                fontSize: "13px",
                marginBottom: "16px",
              }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn"
              style={{
                width: "100%",
                background: "#e8943a",
                fontSize: "15px",
                padding: "12px",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "..." : "Update Password"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <a
              href="/auth/login"
              style={{
                color: "#e8943a",
                fontSize: "14px",
                fontFamily: "'DM Sans', sans-serif",
                textDecoration: "none",
              }}
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
