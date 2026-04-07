const mongoose = require("mongoose");

// Off-chain booking metadata keyed by on-chain bookingId.
// Stores guest personal details that don't belong on a public blockchain.
const bookingMetaSchema = new mongoose.Schema(
  {
    bookingId: { type: Number, required: true, unique: true, index: true },
    walletAddress: { type: String, required: true, lowercase: true, trim: true, index: true },
    guestName: { type: String, trim: true },
    guestEmail: { type: String, lowercase: true, trim: true },
    guestPhone: { type: String, trim: true },
    numGuests: { type: Number, default: 1 },
    specialRequests: { type: String, trim: true },
    txHash: { type: String, trim: true },
    cancelledAt: { type: Date },
    refundWei: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BookingMeta", bookingMetaSchema);
