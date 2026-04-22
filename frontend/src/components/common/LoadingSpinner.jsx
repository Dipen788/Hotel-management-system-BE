import { colors, gradients } from "../../styles/theme";

export function Spinner({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `3px solid ${colors.border}`,
      borderTopColor: colors.primaryLight,
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

export function PageLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
      <Spinner size={40} />
      <p style={{ color: colors.textDim, fontSize: 14 }}>Loading data from blockchain...</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: "hidden",
    }}>
      <div style={{ height: 200, background: `linear-gradient(90deg, ${colors.border} 25%, #333 50%, ${colors.border} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div style={{ padding: 20 }}>
        <div style={{ height: 20, width: "60%", borderRadius: 6, background: colors.border, marginBottom: 12, animation: "pulse 1.5s infinite" }} />
        <div style={{ height: 14, width: "40%", borderRadius: 6, background: colors.border, animation: "pulse 1.5s infinite" }} />
      </div>
    </div>
  );
}

export function TransactionOverlay({ message }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, gap: 20,
    }}>
      <Spinner size={48} />
      <p style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{message || "Processing transaction..."}</p>
      <p style={{ color: colors.textDim, fontSize: 13 }}>Please confirm in MetaMask</p>
    </div>
  );
}
