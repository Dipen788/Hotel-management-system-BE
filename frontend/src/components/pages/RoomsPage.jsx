import { useState, useEffect, useMemo } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { styles as themeStyles, colors } from "../../styles/theme";
import { ROOM_IMAGES } from "../../utils/constants";
import { calculateNights, calculateTotalCost, shortenAddress } from "../../utils/contract";
import StatusBadge from "../common/StatusBadge";
import Modal from "../common/Modal";
import ConfirmDialog from "../common/ConfirmDialog";

export default function RoomsPage({ rooms, onBook, onDeactivate, getRoomReviews, getRoomRating }) {
  const { isOwner } = useWallet();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [ratings, setRatings] = useState({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  // Load ratings for all rooms
  useEffect(() => {
    (async () => {
      const ratingMap = {};
      for (const room of rooms) {
        try {
          const rating = await getRoomRating(room.id);
          if (rating.totalReviews > 0) {
            ratingMap[room.id] = rating;
          }
        } catch { /* ignore */ }
      }
      setRatings(ratingMap);
    })();
  }, [rooms, getRoomRating]);

  const categories = useMemo(() => {
    const set = new Set(rooms.map((r) => r.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = rooms.filter((r) => {
      if (filter === "available") return r.status === 0 && r.isActive;
      if (filter === "booked") return r.status === 1;
      return r.isActive;
    });

    if (category !== "all") list = list.filter((r) => r.category === category);

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || (r.category || "").toLowerCase().includes(q));

    const withRating = (r) => ratings[r.id]?.avgRating || 0;

    switch (sort) {
      case "price-asc": list = [...list].sort((a, b) => parseFloat(a.pricePerNight) - parseFloat(b.pricePerNight)); break;
      case "price-desc": list = [...list].sort((a, b) => parseFloat(b.pricePerNight) - parseFloat(a.pricePerNight)); break;
      case "rating": list = [...list].sort((a, b) => withRating(b) - withRating(a)); break;
      default: break;
    }

    return list;
  }, [rooms, filter, category, search, sort, ratings]);

  const openReviews = async (room) => {
    const reviews = await getRoomReviews(room.id);
    setReviewModal({ room, reviews });
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Rooms</h1>
          <p style={{ color: colors.textDim, fontSize: 14 }}>Browse and book available rooms</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["all", "available", "booked"].map((f) => (
            <button key={f} style={themeStyles.navLink(filter === f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr",
        gap: 12,
        marginBottom: 24,
      }}>
        <input
          type="search"
          placeholder="Search rooms by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={themeStyles.input}
          aria-label="Search rooms"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={themeStyles.input} aria-label="Filter by category">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={themeStyles.input} aria-label="Sort rooms">
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Highest rated</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {filteredRooms.map((room) => {
          const rating = ratings[room.id];
          return (
            <div key={room.id} style={{ ...themeStyles.card, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ height: 200, background: `url(${ROOM_IMAGES[room.category] || ROOM_IMAGES.Standard}) center/cover`, position: "relative" }}>
                <div style={{ position: "absolute", top: 12, left: 12 }}>
                  <StatusBadge label={room.statusLabel} />
                </div>
                <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(0,0,0,0.6)", color: colors.text, fontSize: 12, fontWeight: 600 }}>
                  {room.category}
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{room.name}</h3>

                {rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ color: "#fbbf24", fontSize: 14 }}>
                      {"\u2605".repeat(Math.round(rating.avgRating / 100))}
                      {"\u2606".repeat(5 - Math.round(rating.avgRating / 100))}
                    </span>
                    <span style={{ fontSize: 12, color: colors.textDim, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); openReviews(room); }}>
                      ({rating.totalReviews} review{rating.totalReviews !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 800, color: colors.indigoLight }}>{room.pricePerNight}</span>
                    <span style={{ fontSize: 13, color: colors.textDim, marginLeft: 4 }}>ETH / night</span>
                  </div>
                  {room.status === 0 && room.isActive && (
                    <button style={themeStyles.btn("primary")} onClick={(e) => { e.stopPropagation(); setSelectedRoom(room); setBookingModal(true); }}>
                      Book Now
                    </button>
                  )}
                </div>
                {isOwner && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      style={{ ...themeStyles.btn("danger"), padding: "6px 12px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(room); }}
                    >
                      Deactivate
                    </button>
                    <span style={{ fontSize: 11, color: colors.textFaint }}>ID: {room.id}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: colors.textFaint }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\ud83c\udfe8"}</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No rooms match your filters</p>
          <button style={{ ...themeStyles.btn("ghost"), marginTop: 16 }} onClick={() => { setSearch(""); setCategory("all"); setFilter("all"); }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Booking Modal */}
      {bookingModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => setBookingModal(false)}
          onBook={(checkIn, checkOut, totalCost, guestMeta) => {
            onBook(selectedRoom.id, checkIn, checkOut, totalCost, guestMeta);
            setBookingModal(false);
          }}
        />
      )}

      {/* Reviews Modal */}
      {reviewModal && (
        <Modal title={`Reviews - ${reviewModal.room.name}`} onClose={() => setReviewModal(null)}>
          {reviewModal.reviews.length === 0 ? (
            <p style={{ color: colors.textDim, fontSize: 14 }}>No reviews yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviewModal.reviews.map((r) => (
                <div key={r.id} style={{ padding: 16, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#fbbf24" }}>{"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}</span>
                    <span style={{ fontSize: 12, color: colors.textDim, fontFamily: "monospace" }}>{shortenAddress(r.guest)}</span>
                  </div>
                  <p style={{ fontSize: 14, color: colors.text, lineHeight: 1.5 }}>{r.comment}</p>
                  <p style={{ fontSize: 11, color: colors.textFaint, marginTop: 8 }}>
                    {new Date(r.createdAt * 1000).toLocaleDateString("en-GB")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Deactivate room?"
        message={confirmDeactivate ? `Guests will no longer see "${confirmDeactivate.name}" in bookings. Existing reservations are unaffected.` : ""}
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => confirmDeactivate && onDeactivate(confirmDeactivate.id)}
        onClose={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}

// ── Booking Modal ──────────────────────────────────────────────────────────
// Collects on-chain booking details (dates) plus optional off-chain guest
// metadata. Submitting the form kicks off contract tx; metadata is mirrored
// to the backend by useContract after the tx confirms.
function BookingModal({ room, onClose, onBook }) {
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [numGuests, setNumGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const checkInTs = checkInDate ? Math.floor(new Date(checkInDate + "T14:00:00").getTime() / 1000) : 0;
  const checkOutTs = checkOutDate ? Math.floor(new Date(checkOutDate + "T11:00:00").getTime() / 1000) : 0;
  const nights = checkInTs && checkOutTs && checkOutTs > checkInTs ? calculateNights(checkInTs, checkOutTs) : 0;
  const totalCost = nights > 0 ? calculateTotalCost(room.pricePerNight, nights) : "0.000000";

  const emailValid = !guestEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  const canSubmit = nights > 0 && emailValid;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const guestMeta = (guestName || guestEmail || guestPhone || specialRequests)
      ? {
          guestName: guestName || undefined,
          guestEmail: guestEmail || undefined,
          guestPhone: guestPhone || undefined,
          numGuests: Number(numGuests) || undefined,
          specialRequests: specialRequests || undefined,
        }
      : undefined;
    onBook(checkInTs, checkOutTs, totalCost, guestMeta);
  }

  return (
    <Modal title="Book Room" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ padding: 16, borderRadius: 12, background: colors.bg, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{room.name}</div>
          <div style={{ fontSize: 13, color: colors.textDim }}>{room.category} {"\u2022"} {room.pricePerNight} ETH/night</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={themeStyles.label}>Check-in Date</label>
            <input type="date" min={today} value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} style={themeStyles.input} required />
          </div>
          <div>
            <label style={themeStyles.label}>Check-out Date</label>
            <input type="date" min={checkInDate || today} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} style={themeStyles.input} required />
          </div>
        </div>

        <fieldset style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <legend style={{ padding: "0 8px", fontSize: 12, color: colors.textDim, fontWeight: 600 }}>
            Guest details (optional, off-chain)
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={themeStyles.label}>Full name</label>
              <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} style={themeStyles.input} maxLength={100} placeholder="Jane Doe" />
            </div>
            <div>
              <label style={themeStyles.label}>Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                style={{ ...themeStyles.input, borderColor: emailValid ? undefined : "#ef4444" }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={themeStyles.label}>Phone</label>
              <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} style={themeStyles.input} maxLength={40} placeholder="+44 ..." />
            </div>
            <div>
              <label style={themeStyles.label}>Guests</label>
              <input type="number" min={1} max={10} value={numGuests} onChange={(e) => setNumGuests(e.target.value)} style={themeStyles.input} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={themeStyles.label}>Special requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              style={{ ...themeStyles.input, minHeight: 60, resize: "vertical" }}
              maxLength={500}
              placeholder="Late arrival, dietary requirements, etc."
            />
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: colors.textFaint }}>
            Stored off-chain in the backend for booking confirmation emails. Never sent to the blockchain.
          </p>
        </fieldset>

        {nights > 0 && (
          <div style={{ padding: 16, borderRadius: 12, background: colors.purpleBg, border: `1px solid ${colors.purpleBorder}`, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: colors.primaryLight }}>{room.pricePerNight} ETH {"\u00d7"} {nights} night{nights > 1 ? "s" : ""}</span>
              <span style={{ fontSize: 13, color: colors.primaryLight }}>{totalCost} ETH</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${colors.purpleBorder}` }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: colors.indigoLight }}>{totalCost} ETH</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" style={{ ...themeStyles.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            type="submit"
            style={{ ...themeStyles.btn("primary"), flex: 2, opacity: canSubmit ? 1 : 0.4 }}
            disabled={!canSubmit}
          >
            Confirm & Pay {nights > 0 ? `${totalCost} ETH` : ""}
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 11, color: colors.textFaint, textAlign: "center" }}>
          Payment is processed on-chain via smart contract. Refund amount depends on cancellation timing.
        </p>
      </form>
    </Modal>
  );
}
