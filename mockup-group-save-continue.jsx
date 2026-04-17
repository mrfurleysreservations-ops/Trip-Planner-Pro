import { useState } from "react";

const THEME = {
  accent: "#e8943a",
  accent2: "#c75a2a",
  text: "#1a1a1a",
  muted: "#777",
  bg: "#f8f6f2",
  card: "rgba(0,0,0,0.03)",
  cardBorder: "#e0e0e0",
  headerBg: "#fff",
};

const SUB_NAV_TABS = [
  { key: "itinerary", label: "Itinerary", icon: "📅" },
  { key: "expenses", label: "Expenses", icon: "💰" },
  { key: "packing", label: "Packing", icon: "🧳" },
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "meals", label: "Meals", icon: "🍽️" },
  { key: "group", label: "Group", icon: "👥" },
];

const MOCK_MEMBERS = [
  { id: "1", name: "Joe", role: "host", status: "accepted" },
  { id: "2", name: "Sarah", role: "member", status: "accepted" },
  { id: "3", name: "Marcus", role: "member", status: "pending" },
];

const MOCK_FRIENDS = [
  { id: "f1", name: "Alex Rivera", avatar: null, added: false },
  { id: "f2", name: "Dana Kim", avatar: null, added: true },
  { id: "f3", name: "Priya Patel", avatar: null, added: false },
];

const StatusChip = ({ status }) => {
  const styles = {
    pending:  { bg: "#fef3cd", text: "#856404", label: "Pending" },
    accepted: { bg: "#d4edda", text: "#155724", label: "Accepted" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 10,
      fontSize: 9, fontWeight: 600, background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  );
};

const Toggle = ({ checked, disabled }) => (
  <div style={{
    position: "relative", width: 36, height: 20, borderRadius: 20,
    background: checked ? THEME.accent : "#ccc",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "0.3s",
  }}>
    <div style={{
      position: "absolute", height: 14, width: 14,
      left: checked ? 19 : 3, bottom: 3,
      background: "#fff", borderRadius: "50%", transition: "0.3s",
    }} />
  </div>
);

export default function MockupGroupSaveContinue() {
  const [activeTab, setActiveTab] = useState("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const hostMember = MOCK_MEMBERS.find((m) => m.role === "host");
  const otherMembers = MOCK_MEMBERS.filter((m) => m.role !== "host");

  const filteredFriends = MOCK_FRIENDS.filter(
    (f) => !friendSearch || f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const tabBtnStyle = (active) => ({
    flex: 1, padding: "12px 16px", background: "none", border: "none",
    borderBottom: `3px solid ${active ? THEME.accent : "transparent"}`,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    fontWeight: active ? 700 : 500, color: active ? THEME.accent : THEME.muted,
    textAlign: "center", marginBottom: -2,
  });

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      background: THEME.bg,
      minHeight: "100vh",
      maxWidth: "420px",
      margin: "0 auto",
      position: "relative",
      color: THEME.text,
      paddingBottom: "140px",
    }}>
      {/* ── Status bar mock ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 20px", fontSize: 12, fontWeight: 600, color: THEME.text,
        background: THEME.headerBg, borderBottom: `1px solid ${THEME.cardBorder}`,
      }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 4, fontSize: 14 }}>📶 🔋</span>
      </div>

      {/* ── Header ── */}
      <div style={{
        background: THEME.headerBg,
        padding: "14px 20px",
        borderBottom: `1px solid ${THEME.cardBorder}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, cursor: "pointer", color: THEME.muted }}>←</span>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: THEME.text,
          }}>
            Group
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* ═══ ROSTER: Who's Going ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16 }}>Who's Going</span>
            <span style={{
              fontSize: 12, color: THEME.muted, fontWeight: 500,
              background: `${THEME.accent}18`, padding: "2px 10px", borderRadius: 20,
            }}>
              {MOCK_MEMBERS.length} people
            </span>
          </div>
        </div>

        {/* Horizontal scroll roster */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <div style={{
            display: "flex", gap: 12, overflowX: "auto", padding: "4px 0 12px",
            scrollBehavior: "smooth", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
          }}>
            {/* Host chip */}
            {hostMember && (
              <div style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "12px 14px", minWidth: 90,
                background: `${THEME.accent}1a`, border: `1.5px solid ${THEME.accent}`,
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", background: THEME.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 18,
                }}>
                  {hostMember.name[0]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{hostMember.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 700, background: THEME.accent, color: "#fff",
                  padding: "1px 6px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.03em",
                }}>Host</span>
                <Toggle checked={true} disabled={true} />
              </div>
            )}

            {/* Other members */}
            {otherMembers.map((m) => (
              <div key={m.id} style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "12px 14px", minWidth: 90,
                background: `${THEME.accent}0a`, border: `1.5px solid ${THEME.cardBorder}`,
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: `${THEME.accent}1a`, color: THEME.text,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 18,
                }}>
                  {m.name[0]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <StatusChip status={m.status} />
                <Toggle checked={true} />
              </div>
            ))}
          </div>
          {/* Fade edge */}
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 12, width: 40,
            background: `linear-gradient(to right, transparent, ${THEME.bg})`, pointerEvents: "none",
          }} />
        </div>

        {/* ═══ ADD PEOPLE ═══ */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Add People</div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `2px solid ${THEME.cardBorder}` }}>
          <button style={tabBtnStyle(activeTab === "friends")} onClick={() => setActiveTab("friends")}>👥 Friends</button>
          <button style={tabBtnStyle(activeTab === "families")} onClick={() => setActiveTab("families")}>🏠 Families</button>
        </div>

        {/* ─── FRIENDS TAB ─── */}
        {activeTab === "friends" && (
          <div>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="Search friends..."
                style={{
                  width: "100%", boxSizing: "border-box", paddingLeft: 36,
                  padding: "10px 14px 10px 36px", fontSize: 14,
                  border: `1px solid ${THEME.cardBorder}`, borderRadius: 10,
                  background: "rgba(0,0,0,0.02)", outline: "none",
                }}
              />
            </div>

            {/* Friend list */}
            <div style={{ fontSize: 11, fontWeight: 600, color: THEME.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Your Friends
            </div>
            {filteredFriends.map((f) => (
              <div key={f.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                border: `1px solid ${THEME.cardBorder}`, background: THEME.card,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: THEME.accent,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 14, fontWeight: 700,
                  }}>
                    {f.name[0]}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</div>
                </div>
                {f.added ? (
                  <span style={{ padding: "6px 14px", background: "#d4edda", color: "#155724", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✓ Added</span>
                ) : (
                  <button style={{
                    background: THEME.accent, color: "#fff", border: "none",
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    + Add
                  </button>
                )}
              </div>
            ))}

            {/* External invite form */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${THEME.cardBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✉️ Invite someone new</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Name"
                  style={{
                    flex: "1 1 140px", padding: "10px 14px", fontSize: 14,
                    border: `1px solid ${THEME.cardBorder}`, borderRadius: 10,
                    background: "rgba(0,0,0,0.02)", outline: "none",
                  }}
                />
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email (optional)"
                  style={{
                    flex: "1 1 140px", padding: "10px 14px", fontSize: 14,
                    border: `1px solid ${THEME.cardBorder}`, borderRadius: 10,
                    background: "rgba(0,0,0,0.02)", outline: "none",
                  }}
                />
                <button style={{
                  background: THEME.accent, color: "#fff", border: "none",
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  opacity: !inviteName.trim() ? 0.5 : 1,
                }}>
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── FAMILIES TAB ─── */}
        {activeTab === "families" && (
          <div style={{ textAlign: "center", padding: 32, color: THEME.muted, fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
            No families found. Create a family in your <span style={{ color: THEME.accent, cursor: "pointer" }}>Profile</span> to add them here.
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
           STICKY "Save & Continue" BUTTON
           Sits ABOVE the bottom tab nav (bottom: 56px)
         ══════════════════════════════════════════════ */}
      <div style={{
        position: "fixed",
        bottom: 56,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 420,
        zIndex: 101,
        padding: "0 16px 12px",
        boxSizing: "border-box",
        background: `linear-gradient(to top, ${THEME.bg} 70%, transparent)`,
        pointerEvents: "none",
      }}>
        <button
          style={{
            pointerEvents: "auto",
            width: "100%",
            padding: "16px 24px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accent2} 100%)`,
            border: "none",
            borderRadius: 14,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s ease",
            minHeight: 52,
          }}
        >
          Save & Continue to Your Trip →
        </button>
      </div>

      {/* ── Bottom Tab Nav (TripSubNav) ── */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 420,
        zIndex: 100,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 56,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid #e5e5e5",
        padding: "0 4px",
      }}>
        {SUB_NAV_TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
              height: "100%", background: "none", border: "none",
              borderTop: `3px solid ${tab.key === "group" ? THEME.accent : "transparent"}`,
              cursor: "pointer", padding: 0, minWidth: 0,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: tab.key === "group" ? 700 : 500,
              color: tab.key === "group" ? THEME.accent : "#999",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
            }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}