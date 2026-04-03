const mongoose = require("mongoose");

// Off-chain personal details linked to an on-chain wallet.
// Keeps PII out of the blockchain while preserving trustless booking/payment.
const guestProfileSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    preferences: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GuestProfile", guestProfileSchema);
