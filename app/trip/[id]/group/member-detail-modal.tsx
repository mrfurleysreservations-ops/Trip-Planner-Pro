"use client";
import { useState, type ReactNode } from "react";
import type { TripMember } from "@/types/database.types";
import { ROLE_PREFERENCES, type ThemeConfig } from "@/lib/constants";
import { StatusChip } from "./group-page";

export interface MemberDetailModalProps {
  member: TripMember;            // the chip that was tapped — parent only renders when set
  theme: ThemeConfig;            // trip-type theme (th)
  isHost: boolean;               // current viewer — gates the Remove action
  onClose: () => void;
  onRemove: (memberId: string) => Promise<void> | void;  // parent's existing removeMember
}

export default function MemberDetailModal({
  member,
  theme: th,
  isHost,
  onClose,
  onRemove,
}: MemberDetailModalProps) {
  // Two-step confirm: default footer → ask → remove. `removing` locks the
  // Yes button while the parent's async delete is in-flight.
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isHostChip = member.role === "host";
  // Hosts can't be removed. Non-hosts can't remove anyone. Both filter out the
  // Remove button entirely (vs. disabling) per spec.
  const canRemove = isHost && !isHostChip;

  const rolePref = ROLE_PREFERENCES.find((r) => r.value === member.role_preference);
  const rolePrefLabel = rolePref ? `${rolePref.icon} ${rolePref.label}` : "Not set";

  // Three identity variants render in this order of precedence:
  //   (1) app-user member  → member.email
  //   (2) family-linked    → "Family member (no email)"
  //   (3) external invite  → member.email (same as #1)
  // The family check uses family_member_id so a family row with a stray email
  // still surfaces as "Family member".
  const emailLine =
    member.email || (member.family_member_id ? "Family member (no email)" : "—");

  const addedDate = new Date(member.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Parent's removeMember already handles DB delete + state + activity log, so
  // we just await it and close. Closing on failure too — the parent surfaces
  // any UI error itself (today: console.error + setLoading(false)).
  const handleConfirmRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await onRemove(member.id);
    } finally {
      setRemoving(false);
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
          background: th.bg,
          animation: "slideUp 0.2s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sticky header — mirrors bulk-invite-modal */}
        <div
          style={{
            position: "sticky",
            top: 0,
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${th.cardBorder}`,
            background: th.bg,
            borderRadius: "20px 20px 0 0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                margin: 0,
                color: th.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {member.name}
            </h3>
            <div style={{ fontSize: 11, color: th.muted, marginTop: 2 }}>
              View info and manage this person on the trip.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: th.muted,
              padding: 4,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            overflowY: "auto",
            padding: "20px 20px 20px",
            flex: 1,
          }}
        >
          {/* Profile header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 26,
                background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                flexShrink: 0,
              }}
            >
              {member.name[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: th.text,
                  lineHeight: 1.15,
                }}
              >
                {member.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: th.muted,
                  marginTop: 2,
                  wordBreak: "break-all",
                }}
              >
                {emailLine}
              </div>
            </div>
          </div>

          {/* Detail list */}
          <div
            style={{
              background: "#fff",
              border: `1px solid ${th.cardBorder}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <DetailRow theme={th} label="Role" value={isHostChip ? "Host" : "Member"} />
            <DetailRow theme={th} label="Status" value={<StatusChip status={member.status} />} />
            <DetailRow theme={th} label="Role preference" value={rolePrefLabel} />
            <DetailRow theme={th} label="Added" value={addedDate} isLast />
          </div>

          {/* Confirmation banner — sits below the detail list when confirming */}
          {confirming && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "#fff3cd",
                border: "1px solid #ffeaa7",
                borderRadius: 12,
                fontSize: 13,
                color: "#856404",
              }}
            >
              ⚠️ <strong>Remove {member.name} from this trip?</strong>
              <br />
              They&apos;ll lose access to the itinerary, packing, and expenses. You can re-invite them later.
            </div>
          )}
        </div>

        {/* Sticky footer — swaps between default and confirm states */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: th.bg,
            padding: "12px 20px 14px",
            borderTop: `1px solid ${th.cardBorder}`,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {confirming ? (
            <>
              <button
                onClick={() => setConfirming(false)}
                disabled={removing}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: removing ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  background: "transparent",
                  color: "#555",
                  border: "1.5px solid #d0d0d0",
                  opacity: removing ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={removing}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: removing ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  background: "#d9534f",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(217,83,79,0.3)",
                  opacity: removing ? 0.7 : 1,
                }}
              >
                {removing ? "Removing…" : `Yes, remove ${member.name}`}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: "transparent",
                  color: "#555",
                  border: "1.5px solid #d0d0d0",
                }}
              >
                Close
              </button>
              {canRemove && (
                <button
                  onClick={() => setConfirming(true)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    background: "transparent",
                    color: "#d9534f",
                    border: "1.5px solid #d9534f",
                  }}
                >
                  🗑 Remove from trip
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Label / value row inside the detail card. Extracted for readability — all
// four rows use identical chrome, only the final one drops the divider.
function DetailRow({
  theme: th,
  label,
  value,
  isLast = false,
}: {
  theme: ThemeConfig;
  label: string;
  value: ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        borderBottom: isLast ? "none" : `1px solid ${th.cardBorder}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: th.muted, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          color: th.text,
          fontWeight: 600,
          textAlign: "right",
          marginLeft: 12,
        }}
      >
        {value}
      </span>
    </div>
  );
}
