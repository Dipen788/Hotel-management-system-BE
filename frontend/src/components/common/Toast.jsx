import { colors } from "../../styles/theme";

export default function Toast({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed", top: 20, right: 20, zIndex: 1000,
        display: "flex", flexDirection: "column", gap: 8,
        maxHeight: "calc(100vh - 40px)", overflowY: "auto", overflowX: "hidden",
        paddingRight: 2,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === "error" ? "alert" : "status"}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            background: t.type === "error" ? colors.redDark : colors.greenDark,
            color: t.type === "error" ? "#fca5a5" : "#86efac",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            border: `1px solid ${t.type === "error" ? "#991b1b" : "#166534"}`,
            animation: "slideIn 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 400,
            flexShrink: 0,
          }}
        >
          <span>{t.type === "error" ? "\u2715" : "\u2713"}</span>
          <span style={{ flex: 1 }}>{t.msg}</span>
          <button
            onClick={() => onRemove(t.id)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}
          >
            {"\u00d7"}
          </button>
        </div>
      ))}
    </div>
  );
}
