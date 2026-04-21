"use client";
import { CAR_LOCATIONS, CarLocation } from "@/lib/constants";

/**
 * CarViz — 5-zone car visualizer for the trip Gear tab.
 *
 * Converted from /mockups/gear-tab.html to accessible React. Each zone is a
 * tappable region (button role) with a count bubble and zone label. Selection
 * is controlled by the parent via `selectedZone`/`onSelectZone`. Counts are
 * bin totals at each zone (bins, not items — items are rolled into the bin
 * rows below the car).
 *
 * Accessibility:
 *   • Each zone is a <g role="button" tabIndex={0}> with aria-pressed + label
 *   • Enter/Space toggles selection
 *   • Selecting the same zone twice clears the filter (handled in parent)
 */

export interface CarVizProps {
  /** Bin count per zone — missing keys render as 0. */
  counts: Partial<Record<CarLocation, number>>;
  /** Currently selected zone, or null when unfiltered. */
  selectedZone: CarLocation | null;
  /** Fired when a zone is tapped. Parent decides toggle vs switch semantics. */
  onSelectZone: (zone: CarLocation) => void;
}

const ZONE_STROKE: Record<CarLocation, string> = {
  frunk: "#4a7bc8",
  cabin: "#9b59b6",
  trunk: "#e65100",
  roofbox: "#0097a7",
  tow_hitch: "#c8503a",
};

// Tinted fills match the mockup's "rgba(<stroke>, 0.1 | 0.18 selected)" values.
const ZONE_FILL: Record<CarLocation, string> = {
  frunk: "rgba(74,123,200,0.1)",
  cabin: "rgba(155,89,182,0.1)",
  trunk: "rgba(230,81,0,0.1)",
  roofbox: "rgba(0,151,167,0.18)",
  tow_hitch: "rgba(200,80,58,0.1)",
};

const ZONE_FILL_SELECTED: Record<CarLocation, string> = {
  frunk: "rgba(74,123,200,0.22)",
  cabin: "rgba(155,89,182,0.22)",
  trunk: "rgba(230,81,0,0.22)",
  roofbox: "rgba(0,151,167,0.28)",
  tow_hitch: "rgba(200,80,58,0.22)",
};

const ZONE_LABEL: Record<CarLocation, string> = {
  frunk: "Frunk",
  cabin: "Cabin",
  trunk: "Trunk",
  roofbox: "Roofbox",
  tow_hitch: "Tow hitch",
};

export default function CarViz({ counts, selectedZone, onSelectZone }: CarVizProps) {
  const getCount = (z: CarLocation) => counts[z] ?? 0;

  // Shared zone-rendering helper to keep tap target, stroke, fill, and
  // keyboard handling consistent across all five zones.
  const zoneProps = (zone: CarLocation) => {
    const active = selectedZone === zone;
    const count = getCount(zone);
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-pressed": active,
      "aria-label": `${ZONE_LABEL[zone]} — ${count} ${count === 1 ? "bin" : "bins"}${active ? " (selected)" : ""}`,
      onClick: () => onSelectZone(zone),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectZone(zone);
        }
      },
      style: { cursor: "pointer", outline: "none" } as React.CSSProperties,
    };
  };

  const zoneStyle = (zone: CarLocation) => {
    const active = selectedZone === zone;
    return {
      fill: active ? ZONE_FILL_SELECTED[zone] : ZONE_FILL[zone],
      stroke: active ? ZONE_STROKE[zone] : ZONE_STROKE[zone] + "80",
      strokeWidth: active ? 2.5 : 1.5,
      strokeDasharray: active ? "0" : "3,3",
      transition: "fill 0.15s, stroke-width 0.15s",
    };
  };

  return (
    <svg
      viewBox="0 0 220 360"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 200, height: "auto", display: "block" }}
      aria-label="Car storage zones"
    >
      {/* Shadow */}
      <ellipse cx={110} cy={348} rx={96} ry={6} fill="rgba(0,0,0,0.08)" />

      {/* ROOFBOX — above the car */}
      <g {...zoneProps("roofbox")}>
        <rect x={60} y={8} width={100} height={20} rx={8} {...zoneStyle("roofbox")} />
        <text
          x={96}
          y={22}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={ZONE_STROKE.roofbox}
          fontFamily="'DM Sans', sans-serif"
        >
          ROOFBOX
        </text>
        <circle cx={150} cy={18} r={9} fill={ZONE_STROKE.roofbox} />
        <text
          x={150}
          y={22}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
          pointerEvents="none"
        >
          {getCount("roofbox")}
        </text>
      </g>

      {/* TOW HITCH — below the car */}
      <g {...zoneProps("tow_hitch")}>
        <rect x={88} y={318} width={44} height={22} rx={5} {...zoneStyle("tow_hitch")} />
        <text
          x={110}
          y={332}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill={ZONE_STROKE.tow_hitch}
          fontFamily="'DM Sans', sans-serif"
        >
          TOW
        </text>
        <circle cx={132} cy={329} r={7} fill={ZONE_STROKE.tow_hitch} />
        <text
          x={132}
          y={332}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
          pointerEvents="none"
        >
          {getCount("tow_hitch")}
        </text>
      </g>

      {/* Wheels */}
      <rect x={10} y={70} width={14} height={38} rx={5} fill="#2a2a2a" />
      <rect x={196} y={70} width={14} height={38} rx={5} fill="#2a2a2a" />
      <rect x={10} y={250} width={14} height={38} rx={5} fill="#2a2a2a" />
      <rect x={196} y={250} width={14} height={38} rx={5} fill="#2a2a2a" />

      {/* Car body shell */}
      <rect
        x={24}
        y={38}
        width={172}
        height={278}
        rx={32}
        fill="#fafafa"
        stroke="#c8d0c0"
        strokeWidth={2}
      />

      {/* FRUNK */}
      <g {...zoneProps("frunk")}>
        <path
          d="M 36 50 Q 36 44 42 44 L 178 44 Q 184 44 184 50 L 184 96 L 36 96 Z"
          {...zoneStyle("frunk")}
        />
        <text
          x={110}
          y={72}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={ZONE_STROKE.frunk}
          fontFamily="'DM Sans', sans-serif"
        >
          FRUNK
        </text>
        <circle cx={110} cy={84} r={9} fill={ZONE_STROKE.frunk} />
        <text
          x={110}
          y={88}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
          pointerEvents="none"
        >
          {getCount("frunk")}
        </text>
      </g>

      {/* Headlights */}
      <circle cx={54} cy={52} r={3.5} fill="#ffeb99" stroke="#d4b400" strokeWidth={1} />
      <circle cx={166} cy={52} r={3.5} fill="#ffeb99" stroke="#d4b400" strokeWidth={1} />

      {/* Windshield */}
      <path
        d="M 40 100 L 180 100 L 170 122 L 50 122 Z"
        fill="rgba(150,170,180,0.3)"
        stroke="#b8c4c8"
        strokeWidth={1}
      />

      {/* CABIN */}
      <g {...zoneProps("cabin")}>
        <rect x={36} y={126} width={148} height={96} rx={4} {...zoneStyle("cabin")} />
        <text
          x={110}
          y={168}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={ZONE_STROKE.cabin}
          fontFamily="'DM Sans', sans-serif"
        >
          CABIN
        </text>
        <circle cx={110} cy={182} r={9} fill={ZONE_STROKE.cabin} />
        <text
          x={110}
          y={186}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
          pointerEvents="none"
        >
          {getCount("cabin")}
        </text>
        {/* Seat outlines hint — decorative, not part of the hit target. */}
        <rect
          x={50}
          y={136}
          width={36}
          height={28}
          rx={4}
          fill="none"
          stroke="#d4c8dc"
          strokeWidth={1}
          opacity={0.6}
          pointerEvents="none"
        />
        <rect
          x={134}
          y={136}
          width={36}
          height={28}
          rx={4}
          fill="none"
          stroke="#d4c8dc"
          strokeWidth={1}
          opacity={0.6}
          pointerEvents="none"
        />
      </g>

      {/* Rear window */}
      <path
        d="M 50 226 L 170 226 L 180 248 L 40 248 Z"
        fill="rgba(150,170,180,0.3)"
        stroke="#b8c4c8"
        strokeWidth={1}
      />

      {/* TRUNK */}
      <g {...zoneProps("trunk")}>
        <path
          d="M 36 252 L 184 252 L 184 308 Q 184 314 178 314 L 42 314 Q 36 314 36 308 Z"
          {...zoneStyle("trunk")}
        />
        <text
          x={110}
          y={278}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={ZONE_STROKE.trunk}
          fontFamily="'DM Sans', sans-serif"
        >
          TRUNK
        </text>
        <circle cx={110} cy={292} r={10} fill={ZONE_STROKE.trunk} />
        <text
          x={110}
          y={296}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
          pointerEvents="none"
        >
          {getCount("trunk")}
        </text>
      </g>

      {/* Taillights */}
      <rect x={40} y={308} width={10} height={4} rx={1.5} fill="#c8503a" />
      <rect x={170} y={308} width={10} height={4} rx={1.5} fill="#c8503a" />
    </svg>
  );
}

/**
 * Public legend helper — the list of (dot, count, label) rows shown under the
 * car. Exported so the gear view can render it in a separate flex row without
 * re-deriving zone colors.
 */
export function CarVizLegend({
  counts,
  selectedZone,
  onSelectZone,
}: CarVizProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        justifyContent: "center",
        marginTop: 10,
      }}
    >
      {CAR_LOCATIONS.map((loc) => {
        const active = selectedZone === loc.value;
        const count = counts[loc.value] ?? 0;
        return (
          <button
            key={loc.value}
            onClick={() => onSelectZone(loc.value)}
            aria-pressed={active}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              background: active ? loc.color : "#fff",
              color: active ? "#fff" : "#1a1a1a",
              border: `1.5px solid ${active ? loc.color : "rgba(0,0,0,0.1)"}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: active ? "rgba(255,255,255,0.85)" : loc.color,
              }}
            />
            <b style={{ fontWeight: 700 }}>{count}</b>
            <span>{loc.label}</span>
          </button>
        );
      })}
    </div>
  );
}
