export default function TripLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        paddingBottom: 56,
      }}
    >
      {/* Sticky top row placeholder — matches tab-layout-standard Row 1 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #e5e5e5",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Shimmer w={40} h={40} r={20} />
        <Shimmer w={140} h={20} r={6} />
        <div style={{ flex: 1 }} />
        <Shimmer w={80} h={28} r={14} />
      </div>

      {/* Body — 3 generic card placeholders */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card-glass"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <Shimmer w="60%" h={16} r={6} />
            <Shimmer w="40%" h={12} r={6} />
            <Shimmer w="90%" h={12} r={6} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tp-shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
      `}</style>
    </div>
  );
}

function Shimmer({
  w,
  h,
  r = 4,
}: {
  w: number | string;
  h: number;
  r?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background:
          "linear-gradient(90deg, #e8e8e8 0px, #f2f2f2 40px, #e8e8e8 80px)",
        backgroundSize: "200px 100%",
        animation: "tp-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
