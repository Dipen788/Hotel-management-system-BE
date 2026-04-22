import { useState, useEffect } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { styles as themeStyles, colors } from "../../styles/theme";
import { formatDate, shortenAddress } from "../../utils/contract";
import { getRefundQuote } from "../../utils/contract";
import { receiptUrl } from "../../utils/api";
import StatusBadge from "../common/StatusBadge";
import Modal from "../common/Modal";
import ConfirmDialog from "../common/ConfirmDialog";

export default function BookingsPage({ bookings, rooms, onCancel, onCheckIn, onCheckOut, onSubmitReview }) {
  const { account, isOwner } = useWallet();
  const [view, setView] = useState(isOwner ? "all" : "mine");
  const [reviewBooking, setReviewBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundQuote, setRefundQuote] = useState(null);

  const mine = bookings.filter((b) => b.guest.toLowerCase() === (account || "").toLowerCase());
  const list = view === "mine" ? mine : bookings;

  const getRoom = (id) => rooms.find((r) => r.id === id);

  // When a cancel target is chosen, query on-chain refund amount for the graduated policy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelTarget) { setRefundQuote(null); return; }
      try {
        const quote = await getRefundQuote(cancelTarget.id);
        if (!cancelled) setRefundQuote(quote);
      } catch {
        if (!cancelled) setRefundQuote(null);
      }
    })();
    return () => { cancelled = true; };
  }, [cancelTarget]);

  function buildCancelMessage() {
    if (!cancelTarget) return "";
    const room = getRoom(cancelTarget.roomId);
    const roomLabel = room?.name || `Room ${cancelTarget.roomId}`;
    if (!refundQuote) {
      return `Cancel booking #${cancelTarget.id} for ${roomLabel}? A refund will be issued on-chain based on the cancellation policy.`;
    }
    return `Cancel booking #${cancelTarget.id} for ${roomLabel}? You will receive ${refundQuote.percent}% of the booking total (${refundQuote.refundEth} ETH) as a refund.`;
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Bookings</h1>
          <p style={{ color: colors.textDim, fontSize: 14 }}>
            {isOwner ? "Manage all hotel bookings" : "Your reservation history"}
          </p>
        </div>
        {isOwner && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={themeStyles.navLink(view === "all")} onClick={() => setView("all")}>All ({bookings.length})</button>
            <button style={themeStyles.navLink(view === "mine")} onClick={() => setView("mine")}>Mine ({mine.length})</button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ ...themeStyles.card, padding: "80px 24px", textAlign: "center", color: colors.textFaint }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\ud83d\udcc5"}</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No bookings yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            {view === "mine" ? "Head to the Rooms page and book your stay" : "Bookings will appear here"}
          </p>
        </div>
      ) : (
        <div style={{ ...themeStyles.card, padding: 0, overflow: "auto" }}>
          <table style={themeStyles.table}>
            <thead>
              <tr>
                <th style={themeStyles.th}>ID</th>
                <th style={themeStyles.th}>Room</th>
                {(isOwner && view === "all") && <th style={themeStyles.th}>Guest</th>}
                <th style={themeStyles.th}>Check-in</th>
                <th style={themeStyles.th}>Check-out</th>
                <th style={themeStyles.th}>Total</th>
                <th style={themeStyles.th}>Status</th>
                <th style={themeStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...list].reverse().map((b) => {
                const room = getRoom(b.roomId);
                const isGuest = b.guest.toLowerCase() === (account || "").toLowerCase();
                return (
                  <tr key={b.id}>
                    <td style={themeStyles.td}><span style={{ fontFamily: "monospace", color: colors.textDim }}>#{b.id}</span></td>
                    <td style={themeStyles.td}>
                      <div style={{ fontWeight: 600 }}>{room?.name || `Room ${b.roomId}`}</div>
                      <div style={{ fontSize: 11, color: colors.textDim }}>{room?.category}</div>
                    </td>
                    {(isOwner && view === "all") && (
                      <td style={{ ...themeStyles.td, fontFamily: "monospace", fontSize: 12 }}>{shortenAddress(b.guest)}</td>
                    )}
                    <td style={themeStyles.td}>{formatDate(b.checkIn)}</td>
                    <td style={themeStyles.td}>{formatDate(b.checkOut)}</td>
                    <td style={{ ...themeStyles.td, fontWeight: 700, color: colors.indigoLight }}>{b.totalPrice} ETH</td>
                    <td style={themeStyles.td}><StatusBadge label={b.statusLabel} /></td>
                    <td style={themeStyles.td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {isGuest && b.status === 0 && (
                          <button style={{ ...themeStyles.btn("danger"), padding: "6px 10px", fontSize: 12 }} onClick={() => setCancelTarget(b)}>
                            Cancel
                          </button>
                        )}
                        {isOwner && b.status === 0 && (
                          <button style={{ ...themeStyles.btn("primary"), padding: "6px 10px", fontSize: 12 }} onClick={() => onCheckIn(b.id)}>
                            Check In
                          </button>
                        )}
                        {isOwner && b.status === 1 && (
                          <button style={{ ...themeStyles.btn("success"), padding: "6px 10px", fontSize: 12 }} onClick={() => onCheckOut(b.id)}>
                            Check Out
                          </button>
                        )}
                        {isGuest && b.status === 2 && (
                          <button style={{ ...themeStyles.btn("primary"), padding: "6px 10px", fontSize: 12 }} onClick={() => setReviewBooking(b)}>
                            {"\u2605 Leave Review"}
                          </button>
                        )}
                        {/* PDF receipt: available for any non-cancelled booking */}
                        {b.status !== 3 && (
                          <a
                            href={receiptUrl(b.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF receipt"
                            style={{
                              ...themeStyles.btn("ghost"),
                              padding: "6px 10px", fontSize: 12,
                              textDecoration: "none",
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {"\ud83d\udcc4 PDF"}
                          </a>
                        )}
                        {b.status === 3 && (
                          <span style={{ fontSize: 12, color: colors.textFaint }}>{"\u2014"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          room={getRoom(reviewBooking.roomId)}
          onClose={() => setReviewBooking(null)}
          onSubmit={async (rating, comment) => {
            await onSubmitReview(reviewBooking.id, rating, comment);
            setReviewBooking(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel booking?"
        message={buildCancelMessage()}
        confirmLabel="Cancel booking"
        tone="danger"
        onConfirm={() => cancelTarget && onCancel(cancelTarget.id)}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────
function ReviewModal({ booking, room, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState(0);

  const disabled = comment.trim().length === 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (disabled) return;
    onSubmit(rating, comment.trim());
  }

  return (
    <Modal title="Leave a Review" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ padding: 16, borderRadius: 12, background: colors.bg, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{room?.name || `Room ${booking.roomId}`}</div>
          <div style={{ fontSize: 13, color: colors.textDim }}>Booking #{booking.id} {"\u2022"} {booking.totalPrice} ETH</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={themeStyles.label}>Your Rating</label>
          <div style={{ display: "flex", gap: 6, fontSize: 36, cursor: "pointer", userSelect: "none" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                style={{ color: (hover || rating) >= n ? "#fbbf24" : "#3f3f46", transition: "color 0.15s" }}
                role="button"
                aria-label={`Rate ${n} stars`}
              >
                {"\u2605"}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={themeStyles.label}>Your Comment</label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was your stay?"
            style={{ ...themeStyles.input, fontFamily: "inherit", resize: "vertical", minHeight: 100 }}
            maxLength={500}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" style={{ ...themeStyles.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            type="submit"
            style={{ ...themeStyles.btn("primary"), flex: 2, opacity: disabled ? 0.4 : 1 }}
            disabled={disabled}
          >
            Submit Review
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 11, color: colors.textFaint, textAlign: "center" }}>
          Your review is stored on-chain and cannot be edited.
        </p>
      </form>
    </Modal>
  );
}
