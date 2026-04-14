"use client";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  THEMES, AGE_TYPES, APPETITE_TYPES, ITEM_CATEGORIES, CAR_ZONES,
  PACKING_STYLES, ORGANIZATION_METHODS, FOLDING_METHODS, COMPARTMENT_SYSTEMS,
  CHECKLIST_LEVELS, PLANNING_TIMELINES, JUST_IN_CASE_LEVELS, VISUAL_PLANNING_STYLES,
  PACKING_STYLE_DEFAULTS,
} from "@/lib/constants";
import { ageIcon, catIcon } from "@/lib/utils";
import MemberSlider from "@/app/components/member-slider";
import AvatarPicker from "@/app/components/avatar-picker";
import type { FamilyWithRelations } from "./page";

interface PackingPreferences {
  packing_style?: string;
  organization_method?: string;
  folding_method?: string;
  compartment_system?: string;
  checklist_level?: string;
  planning_timeline?: string;
  just_in_case_level?: string;
  visual_planning?: string;
  reusable_templates?: boolean;
}

// Packing style — shown prominently
const STYLE_PREF = {
  key: "packing_style" as const,
  label: "Packing Style",
  options: PACKING_STYLES,
};

// Fine-tune groups — collapsed by default below style picker
const FINE_TUNE_GROUPS = [
  {
    label: "How You Pack",
    prefs: [
      { key: "organization_method" as const, label: "Organization Method", options: ORGANIZATION_METHODS },
      { key: "folding_method" as const, label: "Folding Method", options: FOLDING_METHODS },
      { key: "compartment_system" as const, label: "Compartment System", options: COMPARTMENT_SYSTEMS },
    ],
  },
  {
    label: "How Much You Plan",
    prefs: [
      { key: "checklist_level" as const, label: "Checklist Level", options: CHECKLIST_LEVELS },
      { key: "planning_timeline" as const, label: "Planning Timeline", options: PLANNING_TIMELINES },
      { key: "just_in_case_level" as const, label: '"Just in Case" Level', options: JUST_IN_CASE_LEVELS },
      { key: "visual_planning" as const, label: "Visual Planning", options: VISUAL_PLANNING_STYLES },
    ],
  },
];

interface ProfilePageProps {
  userId: string;
  initialFamilies: FamilyWithRelations[];
  userEmail: string;
  userName: string | null;
  avatarUrl: string | null;
  packingPreferences: Record<string, string> | null;
  onboardingCompleted: boolean;
}

// ─── Member Detail Card: inline editable card for a family member ───
function MemberDetailCard({ member, familyId, familyName, accent, onUpdate, onClose }: {
  member: { id: string; name: string; age_type: string | null; appetite: string | null; avatar_url: string | null; bio: string | null };
  familyId: string;
  familyName: string;
  accent: string;
  onUpdate: (field: string, value: string) => void;
  onClose: () => void;
}) {
  const [localName, setLocalName] = useState(member.name);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(member.avatar_url || "");
  const [localBio, setLocalBio] = useState(member.bio || "");

  const isNonAdult = member.age_type === "baby" || member.age_type === "toddler" || member.age_type === "child";

  return (
    <div className="card-glass fade-in" style={{ marginTop: "12px", padding: "20px", borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <AvatarPicker
            currentUrl={localAvatarUrl || null}
            fallbackEmoji={ageIcon(member.age_type || "adult")}
            size={56}
            storagePath={`members/${member.id}`}
            onUploaded={(url) => {
              setLocalAvatarUrl(url);
              onUpdate("avatar_url", url);
            }}
          />
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "18px" }}>{member.name}</div>
            <div style={{ fontSize: "12px", color: "#999" }}>{familyName}</div>
            {isNonAdult && <span style={{ fontSize: "10px", background: "rgba(232,148,58,0.12)", color: accent, padding: "2px 8px", borderRadius: "10px", fontWeight: 600, marginTop: "4px", display: "inline-block" }}>Managed by you</span>}
          </div>
        </div>
        <button onClick={onClose} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Close</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#999", display: "block", marginBottom: "4px" }}>Name</label>
          <input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => { if (localName.trim() && localName !== member.name) onUpdate("name", localName.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="input-modern"
          />
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#999", display: "block", marginBottom: "4px" }}>Age Type</label>
            <select value={member.age_type || "adult"} onChange={(e) => onUpdate("age_type", e.target.value)} className="input-modern" style={{ fontSize: "13px" }}>
              {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
            </select>
          </div>
          {member.age_type !== "baby" && (
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#999", display: "block", marginBottom: "4px" }}>Appetite</label>
              <select value={member.appetite || "normal"} onChange={(e) => onUpdate("appetite", e.target.value)} className="input-modern" style={{ fontSize: "13px" }}>
                {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#999", display: "block", marginBottom: "4px" }}>Bio / Notes</label>
          <textarea
            value={localBio}
            onChange={(e) => setLocalBio(e.target.value)}
            onBlur={() => { const v = localBio.trim() || null; if (v !== (member.bio || null)) onUpdate("bio", v || ""); }}
            className="input-modern"
            rows={2}
            placeholder="Allergies, preferences, notes..."
            style={{ resize: "vertical" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({ userId, initialFamilies, userEmail, userName, avatarUrl, packingPreferences, onboardingCompleted }: ProfilePageProps) {
  const [families, setFamilies] = useState<FamilyWithRelations[]>(initialFamilies);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newMemName, setNewMemName] = useState("");
  const [newMemAge, setNewMemAge] = useState("adult");
  const [newMemApp, setNewMemApp] = useState("normal");

  // ─── User profile editing state ───
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState(userName || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(avatarUrl || "");
  const [displayName, setDisplayName] = useState(userName);
  const [displayAvatar, setDisplayAvatar] = useState(avatarUrl);

  // ─── Member detail view state ───
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // ─── Change password state ───
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // ─── Packing preferences state ───
  const [packingPrefs, setPackingPrefs] = useState<PackingPreferences>((packingPreferences as PackingPreferences) ?? {});
  const [packingExpanded, setPackingExpanded] = useState(false);
  const [editingPrefKey, setEditingPrefKey] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [fineTuneExpanded, setFineTuneExpanded] = useState(false);

  // ─── Delete account state ───
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmPw, setDeleteConfirmPw] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const th = THEMES.home;

  // ─── Save a single packing preference ───
  const savePackingPref = async (key: string, value: string | boolean) => {
    const updated = { ...packingPrefs, [key]: value };
    setPackingPrefs(updated);
    setEditingPrefKey(null);
    await supabase.from("user_profiles").update({ packing_preferences: updated }).eq("id", userId);
  };

  // ─── Change packing style and apply all defaults ───
  const handleStyleChange = async (newStyle: string) => {
    const defaults = PACKING_STYLE_DEFAULTS[newStyle] || {};
    const updated: PackingPreferences = {
      ...packingPrefs,
      packing_style: newStyle,
      ...defaults,
    };
    setPackingPrefs(updated);
    setEditingPrefKey(null);
    await supabase.from("user_profiles").update({ packing_preferences: updated }).eq("id", userId);
  };

  // ─── Save user profile ───
  const saveProfile = async () => {
    const updates: { full_name?: string; avatar_url?: string | null } = {};
    const trimmedName = editFullName.trim();
    const trimmedUrl = editAvatarUrl.trim() || null;
    if (trimmedName !== (displayName || "")) updates.full_name = trimmedName;
    if (trimmedUrl !== displayAvatar) updates.avatar_url = trimmedUrl;
    if (Object.keys(updates).length > 0) {
      await supabase.from("user_profiles").update(updates).eq("id", userId);
      if (updates.full_name !== undefined) setDisplayName(updates.full_name);
      if (updates.avatar_url !== undefined) setDisplayAvatar(updates.avatar_url);
    }
    setEditingProfile(false);
  };

  // ─── Find a member across all families by ID ───
  const findMemberWithFamily = (memId: string) => {
    for (const f of families) {
      const m = (f.family_members || []).find((x) => x.id === memId);
      if (m) return { member: m, familyId: f.id, familyName: f.name };
    }
    return null;
  };

  const selectedMemberData = selectedMemberId ? findMemberWithFamily(selectedMemberId) : null;

  const addFamily = async () => {
    const name = newName.trim() || "New Family";
    const { data } = await supabase.from("families").insert({ owner_id: userId, name }).select("*, family_members(*), inventory_bins(*, inventory_items:inventory_items(*))").single();
    if (data) { setFamilies((f) => [...f, data as FamilyWithRelations]); setEditId(data.id); setNewName(""); }
  };

  const updateFamily = async (id: string, field: string, value: string) => {
    await supabase.from("families").update({ [field]: value }).eq("id", id);
    setFamilies((f) => f.map((x) => x.id === id ? { ...x, [field]: value } : x));
  };

  const deleteFamily = async (id: string) => {
    await supabase.from("families").delete().eq("id", id);
    setFamilies((f) => f.filter((x) => x.id !== id));
    if (editId === id) setEditId(null);
  };

  const addMember = async (famId: string) => {
    if (!newMemName.trim()) return;
    const { data } = await supabase.from("family_members").insert({
      family_id: famId, name: newMemName.trim(), age_type: newMemAge, appetite: newMemApp,
    }).select().single();
    if (data) {
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: [...(x.family_members || []), data] } : x));
      setNewMemName("");
    }
  };

  const deleteMember = async (famId: string, memId: string) => {
    await supabase.from("family_members").delete().eq("id", memId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: (x.family_members || []).filter((m) => m.id !== memId) } : x));
  };

  const updateMember = async (famId: string, memId: string, field: string, value: string) => {
    const { error } = await supabase.from("family_members").update({ [field]: value }).eq("id", memId);
    if (error) {
      console.error(`Failed to update ${field} for member ${memId}:`, error);
      return;
    }
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, family_members: (x.family_members || []).map((m) => m.id === memId ? { ...m, [field]: value } : m) } : x));
  };

  const addBin = async (famId: string) => {
    const { data } = await supabase.from("inventory_bins").insert({ family_id: famId, name: "New Bin" }).select("*, inventory_items:inventory_items(*)").single();
    if (data) {
      const binWithItems = { ...data, inventory_items: data.inventory_items || [] };
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: [...(x.inventory_bins || []), binWithItems] } : x) as FamilyWithRelations[]);
    }
  };

  const updateBin = async (famId: string, binId: string, field: string, value: string) => {
    await supabase.from("inventory_bins").update({ [field]: value }).eq("id", binId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, [field]: value } : b) } : x));
  };

  const deleteBin = async (famId: string, binId: string) => {
    await supabase.from("inventory_bins").delete().eq("id", binId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).filter((b) => b.id !== binId) } : x));
  };

  const addBinItem = async (famId: string, binId: string) => {
    const { data } = await supabase.from("inventory_items").insert({ family_id: famId, bin_id: binId, name: "" }).select().single();
    if (data) {
      setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: [...(b.inventory_items || []), data] } : b) } : x));
    }
  };

  const updateBinItem = async (famId: string, binId: string, itemId: string, field: string, value: string | boolean | number) => {
    await supabase.from("inventory_items").update({ [field]: value }).eq("id", itemId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: (b.inventory_items || []).map((i) => i.id === itemId ? { ...i, [field]: value } : i) } : b) } : x));
  };

  const deleteBinItem = async (famId: string, binId: string, itemId: string) => {
    await supabase.from("inventory_items").delete().eq("id", itemId);
    setFamilies((f) => f.map((x) => x.id === famId ? { ...x, inventory_bins: (x.inventory_bins || []).map((b) => b.id === binId ? { ...b, inventory_items: (b.inventory_items || []).filter((i) => i.id !== itemId) } : b) } : x));
  };

  const editFam = editId ? families.find((f) => f.id === editId) : null;

  return (
    <div style={{ color: th.text }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        {/* Profile card */}
        <div className="card-glass" style={{ padding: "24px", marginBottom: "24px" }}>
          {editingProfile ? (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <AvatarPicker
                  currentUrl={displayAvatar}
                  fallbackEmoji="👤"
                  size={80}
                  storagePath={`user-profiles/${userId}`}
                  onUploaded={async (url) => {
                    const { error } = await supabase.from("user_profiles").update({ avatar_url: url }).eq("id", userId);
                    if (error) { console.error("Failed to save profile avatar:", error); return; }
                    setDisplayAvatar(url);
                    setEditAvatarUrl(url);
                  }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#999" }}>Display Name</label>
                  <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="input-modern" style={{ fontSize: "16px", fontWeight: 600 }} placeholder="Your name" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => { setEditingProfile(false); setEditFullName(displayName || ""); setEditAvatarUrl(displayAvatar || ""); }} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Cancel</button>
                <button onClick={saveProfile} className="btn btn-sm" style={{ background: th.accent }}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <AvatarPicker
                currentUrl={displayAvatar}
                fallbackEmoji="👤"
                size={80}
                storagePath={`user-profiles/${userId}`}
                onUploaded={async (url) => {
                  const { error } = await supabase.from("user_profiles").update({ avatar_url: url }).eq("id", userId);
                  if (error) { console.error("Failed to save profile avatar:", error); return; }
                  setDisplayAvatar(url);
                  setEditAvatarUrl(url);
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px" }}>{displayName || "No name set"}</div>
                <div style={{ fontSize: "14px", color: "#777", marginTop: "4px" }}>{userEmail}</div>
              </div>
              <button onClick={() => setEditingProfile(true)} className="btn btn-sm" style={{ background: th.accent }}>Edit</button>
            </div>
          )}
        </div>

        {/* Change Password section */}
        <div className="card-glass" style={{ padding: 0, marginBottom: "24px", overflow: "hidden" }}>
          <div
            onClick={() => { setShowChangePassword(!showChangePassword); setPwError(""); setPwSuccess(""); }}
            style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: "15px", fontWeight: 600 }}>🔒 Change Password</span>
            <span style={{ fontSize: "18px", color: "#999", transform: showChangePassword ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
          </div>
          {showChangePassword && (
            <div className="fade-in" style={{ padding: "0 20px 20px", borderTop: "1px solid #eee", paddingTop: "16px", marginTop: "0" }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>Current Password</label>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="input-modern" />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>New Password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input-modern" minLength={6} placeholder="Min 6 characters" />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="input-modern" minLength={6} />
              </div>

              {pwError && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(225,70,70,0.08)", border: "1px solid rgba(225,70,70,0.2)", color: "#c0392b", fontSize: "13px", marginBottom: "12px" }}>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(124,179,66,0.08)", border: "1px solid rgba(124,179,66,0.2)", color: "#2e7d32", fontSize: "13px", marginBottom: "12px" }}>
                  {pwSuccess}
                </div>
              )}

              <button
                className="btn"
                disabled={pwLoading}
                style={{ background: th.accent, opacity: pwLoading ? 0.6 : 1 }}
                onClick={async () => {
                  setPwError("");
                  setPwSuccess("");
                  if (newPw !== confirmPw) { setPwError("Passwords don't match"); return; }
                  if (newPw.length < 6) { setPwError("Password must be at least 6 characters"); return; }
                  setPwLoading(true);
                  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPw });
                  if (signInErr) { setPwError("Current password is incorrect"); setPwLoading(false); return; }
                  const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
                  if (updateErr) { setPwError(updateErr.message); setPwLoading(false); return; }
                  setPwSuccess("Password updated!");
                  setCurrentPw(""); setNewPw(""); setConfirmPw("");
                  setPwLoading(false);
                  setTimeout(() => { setShowChangePassword(false); setPwSuccess(""); }, 2000);
                }}
              >
                {pwLoading ? "..." : "Update Password"}
              </button>
            </div>
          )}
        </div>

        {/* ─── Packing Preferences ─── */}
        <div className="card-glass" style={{ padding: 0, marginBottom: "24px", overflow: "hidden" }}>
          <div
            onClick={() => { setPackingExpanded(!packingExpanded); if (packingExpanded) { setEditingPrefKey(null); setSetupMode(false); } }}
            style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: "15px", fontWeight: 600 }}>🧳 Packing Preferences</span>
            <span style={{ fontSize: "18px", color: "#999", transform: packingExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
          </div>
          {packingExpanded && (
            <div className="fade-in" style={{ padding: "0 20px 20px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
              {/* Empty state — no preferences set yet */}
              {!packingPreferences && !setupMode ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <p style={{ fontSize: "14px", color: "#777", margin: "0 0 14px" }}>Set your packing style to personalize your trip packing experience</p>
                  <button onClick={() => setSetupMode(true)} className="btn" style={{ background: th.accent }}>Set Up Now</button>
                </div>
              ) : (
                <>
                  {/* ─── Packing Style (prominent) ─── */}
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: th.accent, marginBottom: "10px" }}>Packing Style</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {STYLE_PREF.options.map((opt) => {
                        const isActive = packingPrefs.packing_style === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleStyleChange(opt.value)}
                            style={{
                              padding: "10px 18px", borderRadius: "24px", border: `2px solid ${isActive ? th.accent : "#ddd"}`,
                              background: isActive ? th.accent : "#fff", color: isActive ? "#fff" : th.text,
                              fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                              display: "flex", alignItems: "center", gap: "6px",
                            }}
                          >
                            <span>{"icon" in opt ? `${(opt as { icon?: string }).icon} ` : ""}{opt.label}</span>
                            {"description" in opt && (
                              <span style={{ fontSize: "10px", fontWeight: 400, opacity: isActive ? 0.85 : 0.55, lineHeight: "1.3" }}>
                                {(opt as { description?: string }).description}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ─── Fine-tune disclosure ─── */}
                  <div
                    onClick={() => setFineTuneExpanded(!fineTuneExpanded)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "10px 10px", borderRadius: "10px", marginBottom: fineTuneExpanded ? "12px" : "18px", background: "rgba(232,148,58,0.04)", transition: "background 0.15s" }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: th.text }}>Fine-tune preferences</span>
                    <span style={{ fontSize: "18px", color: "#999", transform: fineTuneExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                  </div>

                  {fineTuneExpanded && (
                    <div className="fade-in">
                      {FINE_TUNE_GROUPS.map((group) => (
                        <div key={group.label} style={{ marginBottom: "18px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: th.accent, marginBottom: "10px" }}>{group.label}</div>
                          {group.prefs.map((pref) => {
                            const currentVal = packingPrefs[pref.key as keyof PackingPreferences] as string | undefined;
                            const selected = pref.options.find((o) => o.value === currentVal);
                            const isEditing = editingPrefKey === pref.key || setupMode;

                            return (
                              <div key={pref.key} style={{ marginBottom: "8px" }}>
                                <div
                                  onClick={() => { if (!setupMode) setEditingPrefKey(editingPrefKey === pref.key ? null : pref.key); }}
                                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "8px 10px", borderRadius: "10px", background: isEditing ? "rgba(232,148,58,0.06)" : "transparent", transition: "background 0.15s" }}
                                >
                                  <span style={{ fontSize: "13px", fontWeight: 600, color: th.text }}>{pref.label}</span>
                                  {selected ? (
                                    <span style={{ fontSize: "13px", color: th.muted }}>
                                      {"icon" in selected ? `${(selected as { icon?: string }).icon} ` : ""}{selected.label}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>Not set</span>
                                  )}
                                </div>
                                {isEditing && (
                                  <div className="fade-in" style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 10px 4px" }}>
                                    {pref.options.map((opt) => {
                                      const isActive = currentVal === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          onClick={() => savePackingPref(pref.key, opt.value)}
                                          style={{
                                            padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${isActive ? th.accent : "#ddd"}`,
                                            background: isActive ? th.accent : "#fff", color: isActive ? "#fff" : th.text,
                                            fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", maxWidth: "180px",
                                          }}
                                        >
                                          <span>{"icon" in opt ? `${(opt as { icon?: string }).icon} ` : ""}{opt.label}</span>
                                          {"description" in opt && (
                                            <span style={{ fontSize: "10px", fontWeight: 400, opacity: isActive ? 0.85 : 0.55, lineHeight: "1.3" }}>
                                              {(opt as { description?: string }).description}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shortcuts group */}
                  <div style={{ marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: th.accent, marginBottom: "10px" }}>Shortcuts</div>
                    <div
                      onClick={() => savePackingPref("reusable_templates", !packingPrefs.reusable_templates)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "8px 10px", borderRadius: "10px" }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 600, color: th.text }}>Reusable Templates</span>
                      <div style={{
                        width: "44px", height: "24px", borderRadius: "12px", position: "relative",
                        background: packingPrefs.reusable_templates ? th.accent : "#ddd", transition: "background 0.2s", flexShrink: 0,
                      }}>
                        <div style={{
                          width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
                          position: "absolute", top: "2px", left: packingPrefs.reusable_templates ? "22px" : "2px",
                          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </div>
                    </div>
                  </div>

                  {setupMode && (
                    <div style={{ textAlign: "right", marginTop: "8px" }}>
                      <button onClick={() => setSetupMode(false)} className="btn btn-sm" style={{ background: th.accent }}>Done</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {!editFam ? (
          <div>
            {/* Section 2 — Family Members slider */}
            <div style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 800, margin: 0 }}>👨‍👩‍👧‍👦 Family Members</h3>
                <button onClick={() => { if (families.length > 0) setEditId(families[0].id); }} className="btn btn-sm" style={{ background: th.accent }}>+ Add</button>
              </div>
              {families.flatMap((f) => f.family_members || []).length === 0 ? (
                <p style={{ fontSize: "13px", color: "#aaa" }}>No members yet — create a family below to add members</p>
              ) : (
                <>
                  <MemberSlider
                    members={families.flatMap((f) => (f.family_members || []).map((m) => ({ id: m.id, name: m.name, age_type: m.age_type || "adult", avatar_url: m.avatar_url || (m.name === displayName ? displayAvatar : null) }))).filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)}
                    selectedName={selectedMemberData?.member.name ?? null}
                    onSelect={(name) => {
                      if (!name) { setSelectedMemberId(null); return; }
                      const mem = families.flatMap((f) => f.family_members || []).find((m) => m.name === name);
                      setSelectedMemberId(mem ? mem.id : null);
                    }}
                  />

                  {/* Member detail card */}
                  {selectedMemberData && (
                    <MemberDetailCard
                      member={{
                        ...selectedMemberData.member,
                        avatar_url: selectedMemberData.member.avatar_url || (selectedMemberData.member.name === displayName ? displayAvatar ?? null : null),
                      }}
                      familyId={selectedMemberData.familyId}
                      familyName={selectedMemberData.familyName}
                      accent={th.accent}
                      onUpdate={(field, value) => updateMember(selectedMemberData.familyId, selectedMemberData.member.id, field, value)}
                      onClose={() => setSelectedMemberId(null)}
                    />
                  )}
                </>
              )}
            </div>

            {/* Section 3 — Your Families list */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 800, margin: 0 }}>🏠 Your Families</h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFamily()} placeholder="Family name" className="input-modern" style={{ width: "180px" }} />
                <button onClick={addFamily} className="btn btn-sm" style={{ background: th.accent }}>+ New Family</button>
              </div>
            </div>

            {families.length === 0 && <div className="card-glass" style={{ padding: "32px", textAlign: "center", opacity: 0.5 }}>No family profiles yet.</div>}

            {families.map((f) => (
              <div key={f.id} className="card-glass slide-in" style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setEditId(f.id)}>
                <div>
                  <div style={{ fontWeight: 700 }}>🏠 {f.name}</div>
                  <div style={{ fontSize: "12px", opacity: 0.5 }}>
                    {(f.family_members || []).length} members · {(f.inventory_bins || []).length} bins
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={(e) => { e.stopPropagation(); deleteFamily(f.id); }} className="btn btn-sm" style={{ background: "#e74c3c" }}>Delete</button>
                  <span style={{ opacity: 0.3 }}>Edit →</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fade-in">
            <button onClick={() => setEditId(null)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a", marginBottom: "16px" }}>← All Profiles</button>

            {/* Family Name */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, opacity: 0.5, display: "block", marginBottom: "6px" }}>Family Name</label>
              <input value={editFam.name} onChange={(e) => updateFamily(editFam.id, "name", e.target.value)} className="input-modern" style={{ fontSize: "18px", fontWeight: 700 }} />
            </div>

            {/* Members */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "12px" }}>👨‍👩‍👧‍👦 Members</h3>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                <input placeholder="Name" value={newMemName} onChange={(e) => setNewMemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember(editFam.id)} className="input-modern" style={{ flex: "1 1 100px", minWidth: "80px" }} />
                <select value={newMemAge} onChange={(e) => setNewMemAge(e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                </select>
                <select value={newMemApp} onChange={(e) => setNewMemApp(e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                  {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <button onClick={() => addMember(editFam.id)} className="btn btn-sm" style={{ background: th.accent }}>+</button>
              </div>
              {(editFam.family_members || []).map((m) => (
                <div key={m.id} className="card-glass" style={{ padding: "8px 12px", marginBottom: "4px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{ageIcon(m.age_type || "adult")} {m.name}</span>
                  <select value={m.age_type || "adult"} onChange={(e) => updateMember(editFam.id, m.id, "age_type", e.target.value)} className="input-modern" style={{ width: "auto", padding: "3px 6px", fontSize: "11px" }}>
                    {AGE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                  </select>
                  {m.age_type !== "baby" && (
                    <select value={m.appetite || "normal"} onChange={(e) => updateMember(editFam.id, m.id, "appetite", e.target.value)} className="input-modern" style={{ width: "auto", padding: "3px 6px", fontSize: "11px" }}>
                      {APPETITE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  )}
                  <span onClick={() => deleteMember(editFam.id, m.id)} style={{ cursor: "pointer", opacity: 0.3, fontSize: "11px", marginLeft: "auto" }}>✕</span>
                </div>
              ))}
            </div>

            {/* Car Snack Prefs */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, marginBottom: "12px" }}>🚗 Car Snack Preferences</h3>
              <textarea value={editFam.car_snack_pref || ""} onChange={(e) => updateFamily(editFam.id, "car_snack_pref", e.target.value)} placeholder="Goldfish, juice boxes, trail mix..." className="input-modern" rows={3} style={{ resize: "vertical" }} />
            </div>

            {/* Inventory Bins */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 700, margin: 0 }}>📦 Inventory Bins</h3>
                <button onClick={() => addBin(editFam.id)} className="btn btn-sm" style={{ background: th.accent }}>+ Bin</button>
              </div>

              {(editFam.inventory_bins || []).map((bin) => (
                <div key={bin.id} className="card-glass" style={{ marginBottom: "10px", borderLeft: `3px solid ${th.accent}` }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <input value={bin.name} onChange={(e) => updateBin(editFam.id, bin.id, "name", e.target.value)} className="input-modern" style={{ flex: "1 1 150px", fontWeight: 600 }} />
                    <select value={bin.zone || "none"} onChange={(e) => updateBin(editFam.id, bin.id, "zone", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "12px" }}>
                      {CAR_ZONES.map((z) => <option key={z.value} value={z.value}>🚗 {z.label}</option>)}
                    </select>
                    <button onClick={() => deleteBin(editFam.id, bin.id)} className="btn btn-sm" style={{ background: "#e74c3c" }}>✕</button>
                  </div>

                  {(bin.inventory_items || []).map((item) => (
                    <div key={item.id} style={{ display: "flex", gap: "4px", marginBottom: "3px", alignItems: "center", flexWrap: "wrap", background: "#fafafa", borderRadius: "8px", padding: "5px 8px" }}>
                      <input value={item.name} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "name", e.target.value)} placeholder="Item name" className="input-modern" style={{ flex: "1 1 100px", minWidth: "70px", padding: "5px 8px", fontSize: "12px" }} />
                      <select value={item.category || "gear"} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "category", e.target.value)} className="input-modern" style={{ width: "auto", fontSize: "11px", padding: "3px" }}>
                        {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                      </select>
                      <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "2px", opacity: 0.6 }}>
                        <input type="checkbox" checked={item.is_consumable || false} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "is_consumable", e.target.checked)} /> Consumable
                      </label>
                      {item.is_consumable && (
                        <input type="number" min="1" value={item.qty_needed || 1} onChange={(e) => updateBinItem(editFam.id, bin.id, item.id, "qty_needed", parseInt(e.target.value) || 1)} className="input-modern" style={{ width: "45px", fontSize: "11px", padding: "3px" }} />
                      )}
                      <span onClick={() => deleteBinItem(editFam.id, bin.id, item.id)} style={{ cursor: "pointer", opacity: 0.3, fontSize: "11px" }}>✕</span>
                    </div>
                  ))}
                  <button onClick={() => addBinItem(editFam.id, bin.id)} className="btn btn-sm" style={{ background: "#f0f0f0", color: th.text, marginTop: "4px", fontSize: "11px" }}>+ Item</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Delete Account (Danger Zone) ─── */}
        <div className="card-glass" style={{ padding: 0, marginTop: "40px", overflow: "hidden", border: "1px solid rgba(231,76,60,0.25)" }}>
          <div
            onClick={() => { setShowDeleteAccount(!showDeleteAccount); setDeleteError(""); setDeleteConfirmPw(""); setDeleteConfirmText(""); }}
            style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#c0392b" }}>⚠️ Delete Account</span>
            <span style={{ fontSize: "18px", color: "#999", transform: showDeleteAccount ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
          </div>
          {showDeleteAccount && (
            <div className="fade-in" style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(231,76,60,0.15)", paddingTop: "16px" }}>
              <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.15)", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", color: "#c0392b", margin: 0, lineHeight: 1.5 }}>
                  This will permanently delete your account and all associated data — trips, families, packing lists, everything. This action cannot be undone.
                </p>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>Enter your password</label>
                <input type="password" value={deleteConfirmPw} onChange={(e) => setDeleteConfirmPw(e.target.value)} className="input-modern" placeholder="Current password" />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#777", display: "block", marginBottom: "6px" }}>
                  Type <strong style={{ color: "#c0392b" }}>DELETE</strong> to confirm
                </label>
                <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="input-modern" placeholder="DELETE" />
              </div>

              {deleteError && (
                <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(225,70,70,0.08)", border: "1px solid rgba(225,70,70,0.2)", color: "#c0392b", fontSize: "13px", marginBottom: "12px" }}>
                  {deleteError}
                </div>
              )}

              <button
                className="btn"
                disabled={deleteLoading || deleteConfirmText !== "DELETE" || !deleteConfirmPw}
                style={{
                  background: deleteConfirmText === "DELETE" && deleteConfirmPw ? "#e74c3c" : "#ccc",
                  opacity: deleteLoading ? 0.6 : 1,
                  cursor: deleteConfirmText === "DELETE" && deleteConfirmPw && !deleteLoading ? "pointer" : "not-allowed",
                }}
                onClick={async () => {
                  if (deleteConfirmText !== "DELETE" || !deleteConfirmPw) return;
                  setDeleteError("");
                  setDeleteLoading(true);
                  try {
                    // Verify password client-side first (same pattern as change password)
                    const { error: signInErr } = await supabase.auth.signInWithPassword({
                      email: userEmail,
                      password: deleteConfirmPw,
                    });
                    if (signInErr) {
                      setDeleteError("Incorrect password");
                      setDeleteLoading(false);
                      return;
                    }
                    // Password verified — call server to delete via admin API
                    const res = await fetch("/api/delete-account", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      setDeleteError(data.error || "Failed to delete account");
                      setDeleteLoading(false);
                      return;
                    }
                    router.push("/auth/login");
                    router.refresh();
                  } catch {
                    setDeleteError("Something went wrong. Please try again.");
                    setDeleteLoading(false);
                  }
                }}
              >
                {deleteLoading ? "Deleting..." : "Permanently Delete My Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
