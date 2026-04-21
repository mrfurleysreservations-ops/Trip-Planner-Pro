"use client";
import { useState, useMemo, useCallback } from "react";
import type { TripMember } from "@/types/database.types";
import type { ThemeConfig } from "@/lib/constants";

// One row of the 20-row bulk invite grid. We keep the array length fixed at 20
// and just reset entries to the empty shape — never push/pop — so row numbering
// stays stable while the user edits.
export type BulkRow = {
  name: string;
  email: string;
  emailInvalid: boolean;
  duplicate: boolean;
  error: string | null;
};

const ROW_COUNT = 20;
const emptyRow = (): BulkRow => ({ name: "", email: "", emailInvalid: false, duplicate: false, error: null });
const emptyRows = (): BulkRow[] => Array.from({ length: ROW_COUNT }, emptyRow);

// Same regex sendExternalInvite uses — keep in lockstep.
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export interface BulkInviteModalProps {
  tripId: string;
  userId: string;
  theme: ThemeConfig;
  // Case-insensitive lookup source for the "already on trip" duplicate check.
  existingEmails: Set<string>;
  // Shared per-invite helper extracted from sendExternalInvite. Keeps the single-
  // and bulk-invite flows in lockstep for DB insert + email trigger.
  insertMember: (
    name: string,
    email: string
  ) => Promise<{ ok: true; member: TripMember } | { ok: false; error: string }>;
  onClose: () => void;
  // Called once per successful Send-all batch. Parent appends to its members
  // state and (at its discretion) logs activity + shows a toast.
  onSuccess: (addedMembers: TripMember[]) => void;
}

export default function BulkInviteModal({
  theme: th,
  existingEmails,
  insertMember,
  onClose,
  onSuccess,
}: BulkInviteModalProps) {
  const [rows, setRows] = useState<BulkRow[]>(emptyRows);
  const [sending, setSending] = useState(false);
  const [retryMode, setRetryMode] = useState(false); // true once a send attempt left failed rows behind

  // Lowercased once so per-keystroke duplicate scans stay cheap.
  const existingLowered = useMemo(() => {
    const s = new Set<string>();
    existingEmails.forEach((e) => s.add(e.toLowerCase()));
    return s;
  }, [existingEmails]);

  // Recompute the per-row duplicate flag across (a) other filled rows in this
  // modal and (b) emails already on the trip. Runs after every input change.
  const recomputeDuplicates = useCallback(
    (rowsNow: BulkRow[]): BulkRow[] => {
      const emailCount: Record<string, number> = {};
      rowsNow.forEach((r) => {
        const e = r.email.trim().toLowerCase();
        if (!e) return;
        emailCount[e] = (emailCount[e] || 0) + 1;
      });
      return rowsNow.map((r) => {
        const e = r.email.trim().toLowerCase();
        const dup = !!e && (emailCount[e] > 1 || existingLowered.has(e));
        return { ...r, duplicate: dup };
      });
    },
    [existingLowered]
  );

  const onNameChange = (i: number, v: string) => {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], name: v, error: null };
      return next;
    });
  };

  // Clear emailInvalid while typing — we only re-validate on blur (spec: too
  // noisy otherwise). Duplicates DO re-evaluate live so you see the red as soon
  // as you finish typing a dup.
  const onEmailChange = (i: number, v: string) => {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], email: v, emailInvalid: false, error: null };
      return recomputeDuplicates(next);
    });
  };

  const onEmailBlur = (i: number) => {
    setRows((prev) => {
      const next = prev.slice();
      const e = next[i].email.trim();
      next[i] = { ...next[i], emailInvalid: e.length > 0 && !isValidEmail(e) };
      return next;
    });
  };

  const clearRow = (i: number) => {
    setRows((prev) => {
      const next = prev.slice();
      next[i] = emptyRow();
      return recomputeDuplicates(next);
    });
  };

  const clearAll = () => {
    setRows(emptyRows());
    setRetryMode(false);
  };

  // ─── Status counters (drive the footer string) ─────────────────────
  const filled = rows.filter((r) => r.name.trim() || r.email.trim());
  const missingName = filled.filter((r) => !r.name.trim()).length;
  const missingEmail = filled.filter((r) => !r.email.trim()).length;
  const invalid = filled.filter(
    (r) => r.email.trim().length > 0 && !isValidEmail(r.email)
  ).length;
  const alreadyOn = filled.filter((r) => {
    const e = r.email.trim().toLowerCase();
    return !!e && existingLowered.has(e);
  }).length;

  const isRowReady = (r: BulkRow) => {
    const e = r.email.trim().toLowerCase();
    return (
      r.name.trim().length > 0 &&
      r.email.trim().length > 0 &&
      isValidEmail(r.email) &&
      !r.duplicate
    );
  };
  const readyCount = rows.filter(isRowReady).length;

  // ─── Send flow ─────────────────────────────────────────────────────
  // p-limit-style concurrency cap of 5 in flight — no external dep.
  const handleSendAll = async () => {
    if (sending || readyCount === 0) return;
    setSending(true);

    // Snapshot ready indices before mutation. Re-reading live state during the
    // async loop would risk racing.
    const readyIndices: number[] = [];
    rows.forEach((r, i) => {
      if (isRowReady(r)) readyIndices.push(i);
    });

    const results = new Map<
      number,
      { ok: true; member: TripMember } | { ok: false; error: string }
    >();
    const queue = [...readyIndices];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const idx = queue.shift();
        if (idx === undefined) return;
        const r = rows[idx];
        try {
          const res = await insertMember(r.name.trim(), r.email.trim());
          results.set(idx, res);
        } catch (e: any) {
          results.set(idx, { ok: false, error: e?.message || "Failed to send" });
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(5, queue.length); i++) workers.push(worker());
    await Promise.all(workers);

    // Apply results: successful rows reset to empty, failures keep their data
    // and get a per-row error label.
    const added: TripMember[] = [];
    let failedThisRound = 0;
    setRows((prev) => {
      const next = prev.slice();
      for (const [idx, res] of results) {
        if (res.ok) {
          added.push(res.member);
          next[idx] = emptyRow();
        } else {
          failedThisRound++;
          next[idx] = { ...next[idx], error: res.error || "Failed to send" };
        }
      }
      return recomputeDuplicates(next);
    });

    if (added.length > 0) onSuccess(added);

    setSending(false);

    if (failedThisRound === 0 && added.length > 0) {
      onClose();
    } else if (failedThisRound > 0) {
      setRetryMode(true);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  const successStatusCount = rows.filter((r) => r.error === null && !r.name && !r.email).length; // not used directly, but kept for clarity

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
        {/* Sticky header */}
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
          <div>
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                margin: 0,
                color: th.text,
              }}
            >
              ✉️ Invite multiple people
            </h3>
            <div style={{ fontSize: 11, color: th.muted, marginTop: 2 }}>
              Up to 20 at once. Empty rows are skipped.
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
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            overflowY: "auto",
            padding: "14px 20px 14px",
            flex: 1,
          }}
        >
          {rows.map((r, i) => {
            const hasContent = !!(r.name || r.email);
            const emailBad = r.emailInvalid || r.duplicate;
            const nameBad = false; // name has no regex rule; missing-name shows in footer only
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px 1fr 1fr 22px",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#bbb",
                      fontWeight: 600,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </div>
                  <input
                    value={r.name}
                    onChange={(e) => onNameChange(i, e.target.value)}
                    placeholder="Name"
                    className="input-modern"
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      borderRadius: 8,
                      ...(nameBad
                        ? {
                            borderColor: "#d9534f",
                            boxShadow: "0 0 0 3px rgba(217,83,79,0.08)",
                          }
                        : null),
                    }}
                  />
                  <input
                    value={r.email}
                    onChange={(e) => onEmailChange(i, e.target.value)}
                    onBlur={() => onEmailBlur(i)}
                    placeholder="Email"
                    type="email"
                    className="input-modern"
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      borderRadius: 8,
                      ...(emailBad
                        ? {
                            borderColor: "#d9534f",
                            boxShadow: "0 0 0 3px rgba(217,83,79,0.08)",
                          }
                        : null),
                    }}
                  />
                  <button
                    onClick={() => clearRow(i)}
                    aria-label={`Clear row ${i + 1}`}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#d9534f";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#bbb";
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#bbb",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                      visibility: hasContent ? "visible" : "hidden",
                    }}
                  >
                    ×
                  </button>
                </div>
                {r.error && (
                  <div
                    style={{
                      marginLeft: 28, // line up with name input
                      marginTop: 3,
                      fontSize: 11,
                      color: "#d9534f",
                      fontWeight: 500,
                    }}
                  >
                    {r.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky footer */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: th.bg,
            padding: "12px 20px 14px",
            borderTop: `1px solid ${th.cardBorder}`,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: "#5a5a5a", flex: "1 1 180px", minWidth: 0 }}>
            <span>
              <strong>{readyCount}</strong> ready to send
            </span>
            {(missingName > 0 || missingEmail > 0 || invalid > 0 || alreadyOn > 0) && (
              <span style={{ color: "#c75a2a", fontWeight: 500 }}>
                {missingName > 0 && ` · ${missingName} missing name`}
                {missingEmail > 0 && ` · ${missingEmail} missing email`}
                {invalid > 0 && ` · ${invalid} invalid`}
                {alreadyOn > 0 && ` · ${alreadyOn} already on trip`}
              </span>
            )}
            {retryMode && (
              <div style={{ fontSize: 11, color: "#d9534f", fontWeight: 600, marginTop: 2 }}>
                Some rows failed — fix or retry.
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={clearAll}
              disabled={sending}
              style={{
                background: "transparent",
                color: "#777",
                border: "1.5px solid #e0e0e0",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: sending ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                opacity: sending ? 0.5 : 1,
              }}
            >
              Clear
            </button>
            <button
              onClick={handleSendAll}
              disabled={sending || readyCount === 0}
              style={{
                background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                boxShadow: `0 2px 8px ${th.accent}4d`,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: sending || readyCount === 0 ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                opacity: sending || readyCount === 0 ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {sending
                ? "Sending…"
                : readyCount === 0
                ? "Send all"
                : `Send ${readyCount} invite${readyCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
