import { useEffect } from "react";
import { styles as themeStyles } from "../../styles/theme";

/**
 * Accessible modal: closes on backdrop click, Esc key, or close button.
 * Locks body scroll while open.
 */
export default function Modal({ children, onClose, title }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div style={themeStyles.modalOverlay} onClick={onClose} role="presentation">
      <div
        style={themeStyles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button
            type="button"
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 20 }}
            onClick={onClose}
          >
            {"\u2715"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
