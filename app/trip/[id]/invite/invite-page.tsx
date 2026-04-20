"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { THEMES } from "@/lib/constants";
import type { Trip } from "@/types/database.types";

interface Props {
  trip: Trip;
  hostName: string;
  userId: string;
  userEmail: string;
  ownRowId: string | null;
  ownRowStatus: string | null;  // pending | accepted | declined
  emailRowId: string | null;    // external invite row matching their email, if any
}

// Landing page shown after a user clicks the invite email link. Three shapes:
// 1) They're already accepted → auto-continue to the trip hub.
// 2) They have a pending trip_members row → show Accept / Decline.
// 3) They don't have a row but were invited via email before creating an
//    account → upgrade the external invite row to their user_id, then Accept.
export default function InviteLanding({
  trip,
  hostName,
  userId,
  userEmail,
  ownRowId,
  ownRowStatus,
  emailRowId,
}: Props) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToTrip = () => router.push(`/trip/${trip.id}`);

  // Already accepted: jump straight in.
  if (ownRowStatus === "accepted") {
    router.replace(`/trip/${trip.id}`);
  }

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      if (ownRowId) {
        const { error } = await supabase
          .from("trip_members")
          .update({ status: "accepted" })
          .eq("id", ownRowId);
        if (error) throw error;
      } else if (emailRowId) {
        // Claim the external invite: stamp our user_id on it + accept.
        const { error } = await supabase
          .from("trip_members")
          .update({ user_id: userId, status: "accepted", invite_token: null })
          .eq("id", emailRowId);
        if (error) throw error;
      } else {
        // No row found — the host probably removed the invite, or this is
        // a stale link. Bounce back.
        throw new Error("No pending invite found for this account");
      }
      goToTrip();
    } catch (e: any) {
      console.error("invite accept failed:", e);
      setError(e?.message || "Couldn't accept the invite");
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = ownRowId || emailRowId;
      if (id) {
        await supabase.from("trip_members").update({ status: "declined" }).eq("id", id);
      }
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Couldn't decline");
      setBusy(false);
    }
  };

  const hasAnyRow = !!(ownRowId || emailRowId);
  const declined = ownRowStatus === "declined";

  return (
    <div style={{
      minHeight: "100vh",
      background: th.bg,
      color: th.text,
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: 440,
        width: "100%",
        background: th.card,
        border: `1.5px solid ${th.cardBorder}`,
        borderRadius: 20,
        padding: 28,
        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          fontSize: 42,
          textAlign: "center",
          marginBottom: 12,
        }}>
          ✈️
        </div>

        <div style={{
          fontSize: 13,
          textAlign: "center",
          color: th.muted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          marginBottom: 4,
        }}>
          You're invited
        </div>

        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: 26,
          textAlign: "center",
          margin: "0 0 8px",
          color: th.text,
        }}>
          {trip.name}
        </h1>

        <div style={{ textAlign: "center", fontSize: 14, color: th.muted, marginBottom: 20 }}>
          {hostName} added you to this trip.
        </div>

        <div style={{
          background: `${th.accent}0f`,
          border: `1px solid ${th.accent}33`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 20,
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <div><strong>Where:</strong> {trip.location || "TBD"}</div>
          {trip.start_date && (
            <div style={{ marginTop: 4 }}>
              <strong>When:</strong> {trip.start_date}
              {trip.end_date ? ` → ${trip.end_date}` : ""}
            </div>
          )}
          <div style={{ marginTop: 4, fontSize: 11, color: th.muted }}>
            Invited as {userEmail}
          </div>
        </div>

        {error && (
          <div style={{
            padding: "10px 12px",
            background: "#fff3cd",
            border: "1px solid #ffeaa7",
            borderRadius: 8,
            color: "#856404",
            fontSize: 12,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {declined ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: th.muted, marginBottom: 12 }}>
              You previously declined this trip.
            </div>
            <button
              onClick={accept}
              disabled={busy}
              className="btn"
              style={{
                background: th.accent,
                color: "#fff",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                borderRadius: 10,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Change my mind — join trip
            </button>
          </div>
        ) : hasAnyRow ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={accept}
              disabled={busy}
              style={{
                flex: 1,
                background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                color: "#fff",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                borderRadius: 10,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
                boxShadow: `0 2px 8px ${th.accent}4d`,
              }}
            >
              {busy ? "…" : "Accept & join"}
            </button>
            <button
              onClick={decline}
              disabled={busy}
              style={{
                background: "transparent",
                color: th.muted,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                border: `1px solid ${th.cardBorder}`,
                borderRadius: 10,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Decline
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: th.muted, marginBottom: 12 }}>
              We couldn't find an active invite for {userEmail}. Ask {hostName} to re-send.
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                background: "transparent",
                color: th.accent,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${th.accent}`,
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
