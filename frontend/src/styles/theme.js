// ═══════════════════════════════════════════════════════════════
//  Centralized Theme — Dark mode with purple/indigo gradients
// ═══════════════════════════════════════════════════════════════

export const colors = {
  bg: "#09090b",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  textFaint: "#52525b",
  primary: "#7c3aed",
  primaryLight: "#a78bfa",
  indigo: "#6366f1",
  indigoLight: "#818cf8",
  green: "#10b981",
  greenLight: "#34d399",
  greenDark: "#14532d",
  orange: "#f97316",
  orangeLight: "#fb923c",
  red: "#ef4444",
  redLight: "#f87171",
  redDark: "#7f1d1d",
  blue: "#38bdf8",
  purpleBg: "#1e1b4b",
  purpleBorder: "#312e81",
};

export const gradients = {
  primary: "linear-gradient(135deg, #7c3aed, #6366f1)",
  logo: "linear-gradient(135deg, #a78bfa, #818cf8)",
  hero: "linear-gradient(135deg, #a78bfa, #818cf8, #6366f1)",
  nav: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
};

export const STATUS_COLORS = {
  Available:    { bg: "#0d3320", text: "#34d399", dot: "#10b981" },
  Booked:       { bg: "#3b1d0b", text: "#fb923c", dot: "#f97316" },
  Maintenance:  { bg: "#3b0b0b", text: "#f87171", dot: "#ef4444" },
  Confirmed:    { bg: "#1e1b4b", text: "#a78bfa", dot: "#8b5cf6" },
  "Checked In": { bg: "#0d3320", text: "#34d399", dot: "#10b981" },
  "Checked Out":{ bg: "#1a1a2e", text: "#94a3b8", dot: "#64748b" },
  Cancelled:    { bg: "#3b0b0b", text: "#f87171", dot: "#ef4444" },
};

export const styles = {
  app: { minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" },
  container: { maxWidth: 1280, margin: "0 auto", padding: "32px 24px" },
  card: { background: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: "hidden", transition: "all 0.3s" },
  statCard: { background: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, padding: 24 },
  badge: (label) => {
    const c = STATUS_COLORS[label] || { bg: colors.border, text: colors.textMuted, dot: "#71717a" };
    return { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: c.bg, color: c.text, fontSize: 12, fontWeight: 600 };
  },
  dot: (label) => {
    const c = STATUS_COLORS[label] || { dot: "#71717a" };
    return { width: 6, height: 6, borderRadius: "50%", background: c.dot };
  },
  btn: (variant = "primary") => {
    const variants = {
      primary:   { background: gradients.primary, color: "#fff" },
      secondary: { background: colors.border, color: colors.text },
      danger:    { background: colors.redDark, color: "#fca5a5" },
      success:   { background: colors.greenDark, color: "#86efac" },
      ghost:     { background: "transparent", color: colors.textMuted, border: `1px solid ${colors.border}` },
    };
    return { padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s", ...variants[variant] };
  },
  input: { width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
  select: { width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
  label: { display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: colors.textMuted },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: colors.card, borderRadius: 20, border: `1px solid ${colors.border}`, padding: 32, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: colors.textDim, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` },
  td: { padding: "14px 16px", borderBottom: `1px solid ${colors.border}10`, fontSize: 14 },
  navLink: (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? colors.border : "transparent", color: active ? "#fff" : colors.textMuted, cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }),
};
