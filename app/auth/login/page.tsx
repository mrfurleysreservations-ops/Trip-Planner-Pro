"use client";
import { useState, FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a confirmation link!");
    }
    setLoading(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a password reset link!");
    }
    setLoading(false);
  };

  const switchMode = (next: "login" | "signup" | "forgot") => {
    setMode(next);
    setError("");
    setSuccess("");
  };

  const handleSubmit = mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot;

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
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </p>
        </div>

        {/* Form card */}
        <div className="card-glass" style={{ padding: "28px" }}>
          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="input-modern"
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-modern"
                required
              />
            </div>

            {mode !== "forgot" && (
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                  className="input-modern"
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === "login" && (
              <div style={{ textAlign: "right", marginTop: "-16px", marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#999",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontFamily: "'DM Sans', sans-serif",
                    padding: 0,
                  }}
                >
                  Forgot your password?
                </button>
              </div>
            )}

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
              {loading ? "..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </button>
          </form>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", marginTop: "20px" }}>
            {mode === "login" && (
              <>
                <button
                  onClick={() => switchMode("signup")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e8943a",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Don&apos;t have an account? Sign up
                </button>
                <button
                  onClick={() => switchMode("forgot")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e8943a",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontFamily: "'DM Sans', sans-serif",
                    padding: 0,
                  }}
                >
                  Forgot your password?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                onClick={() => switchMode("login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#e8943a",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "forgot" && (
              <>
                <button
                  onClick={() => switchMode("login")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e8943a",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Back to sign in
                </button>
                <button
                  onClick={() => switchMode("signup")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e8943a",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontFamily: "'DM Sans', sans-serif",
                    padding: 0,
                  }}
                >
                  Don&apos;t have an account? Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
