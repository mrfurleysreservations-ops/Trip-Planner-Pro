"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import StepHeader from "../components/step-header";
import UserRow from "../components/user-row";
import { ACCENT } from "../constants";
import type { StepProps, AppUser, FamilyEntry } from "../types";

const FAM_TYPES = [
  { value: "adult", label: "Adult", icon: "🧑" },
  { value: "kid", label: "Kid (5-12)", icon: "🧒" },
  { value: "toddler", label: "Toddler (1-4)", icon: "👶" },
  { value: "baby", label: "Baby (<1)", icon: "🍼" },
];

const TABS = [
  { key: "find", label: "Find People", icon: "🔍" },
  { key: "family", label: "Your Family", icon: "👨‍👩‍👧‍👦" },
  { key: "invite", label: "Invite", icon: "✉️" },
];

export default function StepPeople({ data, onChange, userId }: StepProps & { userId: string }) {
  const [activeTab, setActiveTab] = useState("find");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [newFamName, setNewFamName] = useState("");
  const [newFamAge, setNewFamAge] = useState("adult");
  const [famLinkSearch, setFamLinkSearch] = useState("");
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [famLinkResults, setFamLinkResults] = useState<AppUser[]>([]);
  const supabase = createBrowserSupabaseClient();

  const connections = data.connections || [];
  const familyMembers = data.familyMembers || [];
  const inviteSent = data.invitesSent || [];

  // Fetch all app users on mount (exclude self)
  useEffect(() => {
    const fetchUsers = async () => {
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url")
        .neq("id", userId)
        .order("full_name");
      if (users) {
        setAppUsers(users.map((u) => ({
          id: u.id,
          name: u.full_name || u.email || "Unknown",
          email: u.email || "",
          avatar: "🧑",
          avatar_url: u.avatar_url,
          mutualFriends: 0,
        })));
      }
    };
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Sort: search matches first, then everyone else
  const sortedUsers = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return appUsers;
    const matches = appUsers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const rest = appUsers.filter((u) => !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q));
    return [...matches, ...rest];
  })();

  const hasSearchMatches = searchQuery.trim().length > 0 && sortedUsers.some((u) => u.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || u.email.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const noSearchResults = searchQuery.trim().length > 0 && !hasSearchMatches;

  const toggleConnection = (user: AppUser) => {
    const exists = connections.find((c) => c.id === user.id);
    if (exists) onChange({ connections: connections.filter((c) => c.id !== user.id) });
    else onChange({ connections: [...connections, { ...user }] });
  };

  const sendInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return;
    onChange({ invitesSent: [...inviteSent, inviteEmail.trim()] });
    setInviteEmail("");
  };

  // Family: link to an app user or add offline
  useEffect(() => {
    if (famLinkSearch.trim().length > 0) {
      const q = famLinkSearch.trim().toLowerCase();
      setFamLinkResults(appUsers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
    } else {
      setFamLinkResults([]);
    }
  }, [famLinkSearch, appUsers]);

  const addFamilyMember = (nameOrUser: string | AppUser, ageType?: string) => {
    const isUser = typeof nameOrUser === "object";
    const entry: FamilyEntry = {
      id: isUser ? nameOrUser.id : Date.now().toString(),
      name: isUser ? nameOrUser.name : nameOrUser,
      age_type: ageType || newFamAge,
      icon: isUser ? (nameOrUser.avatar || "🧑") : (FAM_TYPES.find((t) => t.value === (ageType || newFamAge))?.icon || "🧑"),
      linkedUserId: isUser ? nameOrUser.id : null,
    };
    onChange({ familyMembers: [...familyMembers, entry] });
    setNewFamName("");
    setFamLinkSearch("");
  };

  const removeFamilyMember = (id: string | number) => onChange({ familyMembers: familyMembers.filter((m) => m.id !== id) });

  const totalPeople = connections.length + familyMembers.length + inviteSent.length;

  return (
    <div className="fade-in">
      <StepHeader step={4} total={7} title="Who do you travel with?" subtitle="Find people already on the app, build your family, or invite someone new" />

      {/* Selected people summary chips */}
      {totalPeople > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px", justifyContent: "center" }}>
          {connections.map((c) => (
            <span key={`c-${c.id}`} style={{ fontSize: "13px", fontWeight: 600, background: "rgba(232,148,58,0.1)", border: "1.5px solid rgba(232,148,58,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }} /> : c.avatar} {c.name.split(" ")[0]}
              <span onClick={() => toggleConnection(c)} style={{ cursor: "pointer", color: "#ccc", fontSize: "14px", lineHeight: 1 }}>×</span>
            </span>
          ))}
          {familyMembers.map((m) => (
            <span key={`f-${m.id}`} style={{ fontSize: "13px", fontWeight: 600, background: "rgba(76,175,80,0.1)", border: "1.5px solid rgba(76,175,80,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              {m.icon} {m.name} {m.linkedUserId && <span style={{ fontSize: "9px", color: "#4caf50" }}>linked</span>}
              <span onClick={() => removeFamilyMember(m.id)} style={{ cursor: "pointer", color: "#ccc", fontSize: "14px", lineHeight: 1 }}>×</span>
            </span>
          ))}
          {inviteSent.map((email, i) => (
            <span key={`i-${i}`} style={{ fontSize: "13px", fontWeight: 600, background: "rgba(33,150,243,0.1)", border: "1.5px solid rgba(33,150,243,0.25)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              ✉️ {email.split("@")[0]} <span style={{ fontSize: "10px", color: "#999" }}>pending</span>
            </span>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "#f0f0f0", borderRadius: "14px", padding: "4px" }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: "11px", border: "none", background: activeTab === tab.key ? "#fff" : "transparent", color: activeTab === tab.key ? "#1a1a1a" : "#999", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Find People ── */}
      {activeTab === "find" && (
        <div className="fade-in">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or email..." style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "2px solid #e0e0e0", fontSize: "16px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />

          {searchQuery.trim().length > 0 && hasSearchMatches && (
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: "6px", paddingLeft: "4px" }}>Matches</div>
          )}

          {noSearchResults && (
            <div style={{ textAlign: "center", padding: "14px 0", marginBottom: "8px" }}>
              <div style={{ color: "#bbb", fontSize: "13px", marginBottom: "6px" }}>No one found for &quot;{searchQuery}&quot;</div>
              <button onClick={() => { setInviteEmail(searchQuery.includes("@") ? searchQuery : ""); setActiveTab("invite"); }} style={{ fontSize: "12px", fontWeight: 600, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Invite them by email instead →</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
            {sortedUsers.map((user, i) => {
              const q = searchQuery.trim().toLowerCase();
              const isMatch = q && (user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
              const isAdded = connections.find((c) => c.id === user.id);
              const isFirstNonMatch = q && !isMatch && i > 0 && (sortedUsers[i - 1].name.toLowerCase().includes(q) || sortedUsers[i - 1].email.toLowerCase().includes(q));

              return (
                <div key={user.id}>
                  {isFirstNonMatch && (
                    <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#bbb", margin: "8px 0 6px", paddingLeft: "4px" }}>Everyone on the app</div>
                  )}
                  <UserRow
                    user={user}
                    isSelected={!!isAdded}
                    onToggle={() => toggleConnection(user)}
                    subtitle={user.mutualFriends > 0 ? `${user.email} · ${user.mutualFriends} mutual` : user.email}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Your Family ── */}
      {activeTab === "family" && (
        <div className="fade-in">
          <p style={{ fontSize: "14px", color: "#777", margin: "0 0 12px", lineHeight: "1.5" }}>
            Add family members you&apos;ll pack for. If they&apos;re on the app, link their account — otherwise just add their name.
          </p>

          {familyMembers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {familyMembers.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "12px", background: m.linkedUserId ? "rgba(232,148,58,0.04)" : "#f8f8f8", border: `1px solid ${m.linkedUserId ? "rgba(232,148,58,0.2)" : "#eee"}` }}>
                  <span style={{ fontSize: "24px" }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      {FAM_TYPES.find((t) => t.value === m.age_type)?.label}
                      {m.linkedUserId && <span style={{ color: ACCENT, marginLeft: "6px" }}>· Linked to app account</span>}
                    </div>
                  </div>
                  <span onClick={() => removeFamilyMember(m.id)} style={{ fontSize: "16px", color: "#ccc", cursor: "pointer" }}>×</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1.5px solid #e0e0e0", marginBottom: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Link someone on the app</div>
            <input value={famLinkSearch} onChange={(e) => setFamLinkSearch(e.target.value)} placeholder="Search app users to link as family..." style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "2px solid #e0e0e0", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
            {famLinkResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "140px", overflowY: "auto" }}>
                {famLinkResults.map((user) => {
                  const alreadyAdded = familyMembers.find((m) => m.linkedUserId === user.id);
                  return (
                    <div key={user.id} onClick={() => { if (!alreadyAdded) addFamilyMember(user, "adult"); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: alreadyAdded ? "#f0f0f0" : "#fafafa", cursor: alreadyAdded ? "default" : "pointer", opacity: alreadyAdded ? 0.5 : 1 }}>
                      <span style={{ fontSize: "18px" }}>{user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} /> : user.avatar}</span>
                      <div style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>{user.name}</div>
                      {alreadyAdded ? <span style={{ fontSize: "10px", color: "#999" }}>Already added</span> : <span style={{ fontSize: "12px", color: ACCENT, fontWeight: 600 }}>+ Link</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1.5px solid #e0e0e0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#4caf50", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Or add someone without an account</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input value={newFamName} onChange={(e) => setNewFamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newFamName.trim() && addFamilyMember(newFamName.trim())} placeholder="Name" style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "2px solid #e0e0e0", fontSize: "16px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
              <button onClick={() => newFamName.trim() && addFamilyMember(newFamName.trim())} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: ACCENT, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: newFamName.trim() ? 1 : 0.4 }}>+ Add</button>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {FAM_TYPES.map((t) => (
                <button key={t.value} onClick={() => setNewFamAge(t.value)} style={{ padding: "8px 14px", borderRadius: "20px", border: `1.5px solid ${newFamAge === t.value ? ACCENT : "#e0e0e0"}`, background: newFamAge === t.value ? "rgba(232,148,58,0.08)" : "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Invite by email ── */}
      {activeTab === "invite" && (
        <div className="fade-in">
          <p style={{ fontSize: "14px", color: "#777", margin: "0 0 12px", lineHeight: "1.5" }}>
            Know someone who should be on the app? Send them an invite — they&apos;ll automatically connect with you when they sign up.
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendInvite()} placeholder="friend@email.com" type="email" style={{ flex: 1, padding: "12px 14px", borderRadius: "12px", border: "2px solid #e0e0e0", fontSize: "14px", outline: "none", boxSizing: "border-box" }} onFocus={(e) => e.target.style.borderColor = ACCENT} onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} />
            <button onClick={sendInvite} style={{ padding: "12px 18px", borderRadius: "12px", border: "none", background: ACCENT, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: inviteEmail.includes("@") ? 1 : 0.4 }}>Send</button>
          </div>
          {inviteSent.length > 0 && (
            <div style={{ background: "rgba(33,150,243,0.05)", borderRadius: "12px", padding: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#1565c0", textTransform: "uppercase", marginBottom: "8px" }}>Invites sent</div>
              {inviteSent.map((email, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "4px 0" }}>
                  <span style={{ color: "#2196f3" }}>✉️</span>
                  <span style={{ color: "#555" }}>{email}</span>
                  <span style={{ fontSize: "10px", color: "#4caf50", fontWeight: 600, marginLeft: "auto" }}>✓ Sent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
