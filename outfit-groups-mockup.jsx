import { useState, useCallback } from "react";

const MOCK_TRIP = {
  name: "Scottsdale Bachelor Party",
  days: [
    {
      date: "Fri, May 15",
      label: "Day 1",
      events: [
        { id: "e1", time: "9:00 AM", title: "Breakfast at Hotel", type: "dining", dressCode: "casual", location: "Resort Patio" },
        { id: "e2", time: "10:30 AM", title: "Golf at TPC", type: "activity", dressCode: "active", location: "TPC Scottsdale" },
        { id: "e3", time: "2:00 PM", title: "Pool & Cabana", type: "activity", dressCode: "swimwear", location: "Resort Pool" },
        { id: "e4", time: "5:00 PM", title: "Happy Hour", type: "dining", dressCode: "smart_casual", location: "Rooftop Bar" },
        { id: "e5", time: "7:30 PM", title: "Steakhouse Dinner", type: "dining", dressCode: "smart_casual", location: "Steak 44" },
        { id: "e6", time: "10:00 PM", title: "Old Town Bars", type: "nightlife", dressCode: "smart_casual", location: "Old Town" },
      ],
    },
    {
      date: "Sat, May 16",
      label: "Day 2",
      events: [
        { id: "e7", time: "8:00 AM", title: "Morning Hike", type: "outdoors", dressCode: "active", location: "Camelback Mtn" },
        { id: "e8", time: "11:00 AM", title: "Brunch", type: "dining", dressCode: "casual", location: "Hash Kitchen" },
        { id: "e9", time: "1:00 PM", title: "Spa Afternoon", type: "activity", dressCode: "casual", location: "Resort Spa" },
        { id: "e10", time: "4:00 PM", title: "Topgolf", type: "activity", dressCode: "casual", location: "Topgolf Scottsdale" },
        { id: "e11", time: "7:00 PM", title: "Sushi Dinner", type: "dining", dressCode: "smart_casual", location: "Nobu" },
        { id: "e12", time: "9:30 PM", title: "Club Night", type: "nightlife", dressCode: "smart_casual", location: "Maya Day+Night" },
      ],
    },
    {
      date: "Sun, May 17",
      label: "Day 3",
      events: [
        { id: "e13", time: "9:00 AM", title: "Farewell Breakfast", type: "dining", dressCode: "casual", location: "The Henry" },
        { id: "e14", time: "11:00 AM", title: "Checkout & Depart", type: "travel", dressCode: "casual", location: "Resort" },
      ],
    },
  ],
};

const DRESS_CODE_COLORS = {
  casual: { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32", label: "Casual" },
  smart_casual: { bg: "#E3F2FD", border: "#42A5F5", text: "#1565C0", label: "Smart Casual" },
  active: { bg: "#FFF3E0", border: "#FFA726", text: "#E65100", label: "Active" },
  swimwear: { bg: "#E0F7FA", border: "#26C6DA", text: "#00838F", label: "Swimwear" },
  formal: { bg: "#F3E5F5", border: "#AB47BC", text: "#6A1B9A", label: "Formal" },
};

const EVENT_TYPE_ICONS = {
  dining: "🍽️",
  activity: "🎯",
  outdoors: "🥾",
  nightlife: "🌙",
  travel: "✈️",
};

function autoGroup(events) {
  const groups = [];
  let current = null;
  for (const ev of events) {
    if (!current || current.dressCode !== ev.dressCode) {
      current = { id: `g-${ev.id}`, dressCode: ev.dressCode, eventIds: [ev.id] };
      groups.push(current);
    } else {
      current.eventIds.push(ev.id);
    }
  }
  return groups;
}

function groupLabel(group, events) {
  const evs = events.filter((e) => group.eventIds.includes(e.id));
  const dc = DRESS_CODE_COLORS[group.dressCode] || DRESS_CODE_COLORS.casual;
  if (evs.length === 1) return evs[0].title;
  const first = evs[0].time;
  const last = evs[evs.length - 1].time;
  return `${first} – ${last} · ${dc.label}`;
}

export default function OutfitGroupsMockup() {
  const [activeDay, setActiveDay] = useState(0);
  const [groupsByDay, setGroupsByDay] = useState(() =>
    MOCK_TRIP.days.map((d) => autoGroup(d.events))
  );
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [mergeSource, setMergeSource] = useState(null);
  const [view, setView] = useState("group"); // "group" | "summary"
  const [outfitNames, setOutfitNames] = useState({});

  const day = MOCK_TRIP.days[activeDay];
  const groups = groupsByDay[activeDay];
  const eventsById = Object.fromEntries(day.events.map((e) => [e.id, e]));

  const totalEvents = MOCK_TRIP.days.reduce((s, d) => s + d.events.length, 0);
  const totalGroups = groupsByDay.reduce((s, g) => s + g.length, 0);

  const updateGroups = useCallback(
    (dayIdx, newGroups) => {
      setGroupsByDay((prev) => {
        const copy = [...prev];
        copy[dayIdx] = newGroups;
        return copy;
      });
    },
    []
  );

  const handleMerge = (targetGroupId) => {
    if (!mergeSource || mergeSource === targetGroupId) {
      setMergeSource(null);
      return;
    }
    const srcIdx = groups.findIndex((g) => g.id === mergeSource);
    const tgtIdx = groups.findIndex((g) => g.id === targetGroupId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const minIdx = Math.min(srcIdx, tgtIdx);
    const maxIdx = Math.max(srcIdx, tgtIdx);

    const merged = { ...groups[minIdx], eventIds: [] };
    for (let i = minIdx; i <= maxIdx; i++) {
      merged.eventIds.push(...groups[i].eventIds);
    }
    merged.dressCode = groups[minIdx].dressCode;

    const newGroups = [
      ...groups.slice(0, minIdx),
      merged,
      ...groups.slice(maxIdx + 1),
    ];
    updateGroups(activeDay, newGroups);
    setMergeSource(null);
    setSelectedGroup(merged.id);
  };

  const handleSplit = (groupId, eventId) => {
    const gIdx = groups.findIndex((g) => g.id === groupId);
    if (gIdx === -1) return;
    const group = groups[gIdx];
    const eIdx = group.eventIds.indexOf(eventId);
    if (eIdx <= 0) return;

    const before = { ...group, eventIds: group.eventIds.slice(0, eIdx), id: `g-split-${Date.now()}-a` };
    const after = {
      ...group,
      eventIds: group.eventIds.slice(eIdx),
      id: `g-split-${Date.now()}-b`,
      dressCode: eventsById[eventId].dressCode,
    };
    const newGroups = [...groups.slice(0, gIdx), before, after, ...groups.slice(gIdx + 1)];
    updateGroups(activeDay, newGroups);
    setSelectedGroup(null);
  };

  const handleReset = () => {
    updateGroups(activeDay, autoGroup(day.events));
    setSelectedGroup(null);
    setMergeSource(null);
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 520, margin: "0 auto", padding: "20px 16px", background: "#0f0f0f", minHeight: "100vh", color: "#e0e0e0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#888", marginBottom: 4 }}>Packing · Outfit Planner</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>{MOCK_TRIP.name}</h1>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            background: "linear-gradient(135deg, #1a3a2a, #0d2618)",
            border: "1px solid #2d5a3d",
            borderRadius: 10,
            padding: "10px 14px",
            flex: 1,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#66BB6A" }}>{totalGroups}</div>
            <div style={{ fontSize: 11, color: "#999" }}>outfit changes</div>
          </div>
          <div style={{ fontSize: 18, color: "#555" }}>←</div>
          <div style={{
            background: "linear-gradient(135deg, #2a1a1a, #1a0d0d)",
            border: "1px solid #5a2d2d",
            borderRadius: 10,
            padding: "10px 14px",
            flex: 1,
            opacity: 0.6,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#ef5350", textDecoration: "line-through" }}>{totalEvents}</div>
            <div style={{ fontSize: 11, color: "#999" }}>without grouping</div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#1a1a1a", borderRadius: 10, padding: 3 }}>
        {["group", "summary"].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: "8px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: view === v ? "#2a2a2a" : "transparent",
            color: view === v ? "#fff" : "#666",
            transition: "all 0.2s",
          }}>
            {v === "group" ? "Group Events" : "Trip Summary"}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {view === "summary" && (
        <div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
            All outfit changes across your trip. {totalEvents} events grouped into {totalGroups} outfits.
          </div>
          {MOCK_TRIP.days.map((d, di) => (
            <div key={di} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#2a2a2a", borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>{d.label}</span>
                {d.date}
                <span style={{ color: "#666", fontWeight: 400, fontSize: 12 }}>· {groupsByDay[di].length} outfits</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {groupsByDay[di].map((g, gi) => {
                  const dc = DRESS_CODE_COLORS[g.dressCode] || DRESS_CODE_COLORS.casual;
                  const evs = d.events.filter((e) => g.eventIds.includes(e.id));
                  return (
                    <div key={g.id} style={{
                      background: "#1a1a1a",
                      border: `1px solid ${dc.border}40`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      minWidth: 140,
                      flex: 1,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: dc.text, marginBottom: 4 }}>
                        {outfitNames[g.id] || `Outfit ${gi + 1}`}
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>
                        <span style={{ background: `${dc.border}30`, color: dc.text, borderRadius: 4, padding: "1px 5px", fontSize: 9 }}>{dc.label}</span>
                      </div>
                      {evs.map((ev) => (
                        <div key={ev.id} style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
                          {EVENT_TYPE_ICONS[ev.type] || "📍"} {ev.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grouping View */}
      {view === "group" && (
        <>
          {/* Day Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {MOCK_TRIP.days.map((d, i) => (
              <button key={i} onClick={() => { setActiveDay(i); setSelectedGroup(null); setMergeSource(null); }} style={{
                flex: 1, padding: "10px 0", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: activeDay === i ? "#2a2a2a" : "#151515",
                color: activeDay === i ? "#fff" : "#666",
                borderBottom: activeDay === i ? "2px solid #66BB6A" : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                <div>{d.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, color: activeDay === i ? "#888" : "#555" }}>
                  {groupsByDay[i].length} outfits
                </div>
              </button>
            ))}
          </div>

          {/* Instructions */}
          <div style={{
            background: "#1a1f1a",
            border: "1px solid #2d3d2d",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#8faa8f",
            lineHeight: 1.5,
          }}>
            {mergeSource
              ? "👆 Now tap another group to merge them (all groups in between will combine)"
              : "Tap a group to select it, then use Merge or Split to adjust. Events with the same dress code are auto-grouped."}
          </div>

          {/* Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((group, gi) => {
              const dc = DRESS_CODE_COLORS[group.dressCode] || DRESS_CODE_COLORS.casual;
              const evs = group.eventIds.map((id) => eventsById[id]).filter(Boolean);
              const isSelected = selectedGroup === group.id;
              const isMergeSource = mergeSource === group.id;
              const isMergeTarget = mergeSource && mergeSource !== group.id;

              return (
                <div key={group.id}>
                  <div
                    onClick={() => {
                      if (mergeSource) {
                        handleMerge(group.id);
                      } else {
                        setSelectedGroup(isSelected ? null : group.id);
                      }
                    }}
                    style={{
                      background: isMergeSource
                        ? "#1a2a1a"
                        : isSelected
                        ? "#1a1a2a"
                        : "#141414",
                      border: `1.5px solid ${
                        isMergeSource ? "#66BB6A" : isMergeTarget ? "#66BB6A50" : isSelected ? "#5c6bc0" : "#252525"
                      }`,
                      borderRadius: 14,
                      padding: 14,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative",
                      ...(isMergeTarget ? { boxShadow: "0 0 0 1px #66BB6A30" } : {}),
                    }}
                  >
                    {/* Group header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${dc.border}25`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800, color: dc.text,
                        }}>
                          {gi + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                            {outfitNames[group.id] || `Outfit ${gi + 1}`}
                          </div>
                          <div style={{ fontSize: 10, color: "#666" }}>{evs.length} event{evs.length > 1 ? "s" : ""} · no change needed</div>
                        </div>
                      </div>
                      <span style={{
                        background: `${dc.border}20`,
                        color: dc.text,
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        border: `1px solid ${dc.border}40`,
                      }}>
                        {dc.label}
                      </span>
                    </div>

                    {/* Events in group */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {evs.map((ev, ei) => {
                        const evDc = DRESS_CODE_COLORS[ev.dressCode] || DRESS_CODE_COLORS.casual;
                        const isDifferentDressCode = ev.dressCode !== group.dressCode;
                        return (
                          <div key={ev.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 10px",
                            background: isDifferentDressCode ? "#1a1515" : "#1a1a1a",
                            borderRadius: 8,
                            borderLeft: `3px solid ${evDc.border}`,
                          }}>
                            <div style={{ fontSize: 11, color: "#666", minWidth: 58, fontVariantNumeric: "tabular-nums" }}>{ev.time}</div>
                            <div style={{ fontSize: 14, width: 20, textAlign: "center" }}>{EVENT_TYPE_ICONS[ev.type] || "📍"}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>{ev.title}</div>
                              <div style={{ fontSize: 10, color: "#666" }}>{ev.location}</div>
                            </div>
                            {isDifferentDressCode && (
                              <span style={{
                                fontSize: 9, background: `${evDc.border}20`, color: evDc.text,
                                borderRadius: 4, padding: "2px 5px",
                              }}>
                                {evDc.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    {isSelected && !mergeSource && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid #252525" }}>
                        <button onClick={(e) => { e.stopPropagation(); setMergeSource(group.id); setSelectedGroup(null); }} style={{
                          flex: 1, padding: "8px 0", border: "1px solid #2d5a3d", borderRadius: 8,
                          background: "#1a2a1a", color: "#66BB6A", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>
                          Merge with…
                        </button>
                        {evs.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); handleSplit(group.id, evs[Math.ceil(evs.length / 2)].id); }} style={{
                            flex: 1, padding: "8px 0", border: "1px solid #3d2d2d", borderRadius: 8,
                            background: "#2a1a1a", color: "#ef9a9a", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>
                            Split group
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Change indicator between groups */}
                  {gi < groups.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
                      <div style={{ height: 16, width: 1, background: "#333" }} />
                      <span style={{ fontSize: 9, color: "#555", margin: "0 8px", whiteSpace: "nowrap" }}>👔 change clothes</span>
                      <div style={{ height: 16, width: 1, background: "#333" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reset */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleReset} style={{
              flex: 1, padding: "10px 0", border: "1px solid #333", borderRadius: 10,
              background: "#1a1a1a", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              Reset to auto-groups
            </button>
            {mergeSource && (
              <button onClick={() => setMergeSource(null)} style={{
                flex: 1, padding: "10px 0", border: "1px solid #5a3d2d", borderRadius: 10,
                background: "#2a1a0a", color: "#FFA726", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                Cancel merge
              </button>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 24,
        padding: "14px 16px",
        background: "#141414",
        borderRadius: 12,
        border: "1px solid #252525",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6 }}>How it works</div>
        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>
          Events with the same dress code are auto-grouped — no outfit change needed between them.
          Tap a group to <span style={{ color: "#66BB6A" }}>merge</span> it with another or <span style={{ color: "#ef9a9a" }}>split</span> it apart.
          Each group = one outfit to plan. Fewer groups = less packing.
        </div>
      </div>
    </div>
  );
}