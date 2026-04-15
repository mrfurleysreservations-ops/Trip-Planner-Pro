"use client";

import StepHeader from "../components/step-header";
import { ACCENT } from "../constants";
import type { StepProps, InviterInfo, InviterFriend } from "../types";

interface StepFriendSuggestionsProps extends StepProps {
  inviter: InviterInfo;
  inviterFriends: InviterFriend[];
}

export default function StepFriendSuggestions({ data, onChange, inviter, inviterFriends }: StepFriendSuggestionsProps) {
  const connections = data.connections || [];

  const toggleFriend = (friend: InviterFriend) => {
    const exists = connections.find((c) => c.id === friend.id);
    if (exists) onChange({ connections: connections.filter((c) => c.id !== friend.id) });
    else onChange({ connections: [...connections, { id: friend.id, name: friend.name, avatar: friend.avatar || "🧑", avatar_url: friend.avatar_url, email: "", mutualFriends: 0 }] });
  };

  const suggestions = inviterFriends.filter((f) => !connections.find((c) => c.id === f.id));
  const alreadyAdded = inviterFriends.filter((f) => connections.find((c) => c.id === f.id));

  return (
    <div className="fade-in">
      <StepHeader step={5} total={7} title="People you might know" subtitle={`${inviter.avatar} ${inviter.name} invited you — here are people they travel with`} />

      {/* Inviter badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg, rgba(232,148,58,0.06), rgba(199,90,42,0.06))", border: "1px solid rgba(232,148,58,0.15)", marginBottom: "18px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(232,148,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", overflow: "hidden" }}>
          {inviter.avatar_url ? <img src={inviter.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : inviter.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{inviter.name}</div>
          <div style={{ fontSize: "11px", color: ACCENT }}>Invited you to Trip Planner Pro</div>
        </div>
        <div style={{ background: ACCENT, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "12px" }}>Friends</div>
      </div>

      {alreadyAdded.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4caf50", marginBottom: "6px", paddingLeft: "4px" }}>Already connected</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {alreadyAdded.map((f) => (
              <span key={f.id} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(76,175,80,0.08)", border: "1.5px solid rgba(76,175,80,0.2)", borderRadius: "20px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: "50%" }} /> : f.avatar} {f.name.split(" ")[0]} <span style={{ color: "#4caf50" }}>✓</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", paddingLeft: "4px" }}>Suggested for you</div>
          {suggestions.map((friend) => (
            <div key={friend.id} onClick={() => toggleFriend(friend)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid #eee", background: "#fff", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", overflow: "hidden" }}>
                {friend.avatar_url ? <img src={friend.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : friend.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{friend.name}</div>
                <div style={{ fontSize: "11px", color: "#999" }}>{friend.trips} trip{friend.trips !== 1 ? "s" : ""} with {inviter.name.split(" ")[0]}</div>
              </div>
              <button style={{ padding: "8px 16px", borderRadius: "20px", border: "none", background: ACCENT, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#999", fontSize: "13px" }}>
          You&apos;ve already added everyone — nice!
        </div>
      )}

    </div>
  );
}
