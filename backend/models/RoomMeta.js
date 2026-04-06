const mongoose = require("mongoose");

// Rich off-chain data for rooms. On-chain roomId is the link key.
// Lets us store long descriptions, multiple images, and amenities without gas cost.
const roomMetaSchema = new mongoose.Schema(
  {
    roomId: { type: Number, required: true, unique: true, index: true },
    description: { type: String, trim: true, default: "" },
    amenities: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    maxGuests: { type: Number, default: 2 },
    sizeSqm: { type: Number },
    bedType: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RoomMeta", roomMetaSchema);
