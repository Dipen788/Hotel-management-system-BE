const mongoose = require("mongoose");

// Off-chain mirror of on-chain reviews for fast queries / search / display.
// The on-chain contract is always the source of truth; this is a cache only.
const reviewCacheSchema = new mongoose.Schema(
  {
    reviewId: { type: Number, required: true, unique: true, index: true },
    bookingId: { type: Number, required: true, index: true },
    roomId: { type: Number, required: true, index: true },
    walletAddress: { type: String, required: true, lowercase: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    onChainCreatedAt: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReviewCache", reviewCacheSchema);
