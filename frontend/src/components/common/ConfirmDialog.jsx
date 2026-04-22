import { styles as themeStyles, colors } from "../../styles/theme";
import Modal from "./Modal";

/**
 * Reusable confirmation dialog for destructive actions.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={confirmOpen}
 *     title="Cancel Booking?"
 *     message="You will receive a refund according to the cancellation policy."
 *     confirmLabel="Cancel Booking"
 *     tone="danger"
 *     onConfirm={() => ...}
 *     onClose={() => setConfirmOpen(false)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  function handleConfirm() {
    onConfirm?.();
    onClose?.();
  }

  return (
    <Modal title={title} onClose={onClose}>
      {typeof message === "string" ? (
        <p style={{ color: colors.textDim, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
      ) : (
        <div style={{ marginBottom: 24 }}>{message}</div>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" style={{ ...themeStyles.btn("ghost"), flex: 1 }} onClick={onClose} autoFocus>
          {cancelLabel}
        </button>
        <button type="button" style={{ ...themeStyles.btn(tone), flex: 1 }} onClick={handleConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
