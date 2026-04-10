/**
 * Chain event listener — subscribes to on-chain HotelBooking events and
 * mirrors them into the MongoDB cache. Proves the hybrid architecture works:
 * the frontend can go offline and the backend will still converge with chain state.
 *
 * Enabled by setting ENABLE_CHAIN_LISTENER=true. Reads the deployed
 * contract address + ABI from frontend/src/utils/contractData.json (the
 * single source of truth updated by scripts/deploy.js).
 */
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

const BookingMeta = require("../models/BookingMeta");
const ReviewCache = require("../models/ReviewCache");
const { sendBookingConfirmation } = require("./mailer");

function loadContractData() {
  const candidates = [
    path.join(__dirname, "..", "..", "frontend", "src", "utils", "contractData.json"),
    path.join(__dirname, "..", "contractData.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  throw new Error("contractData.json not found — deploy the contract first");
}

async function startChainListener() {
  const { address, abi } = loadContractData();
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:7545";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(address, abi, provider);

  console.log(`[chain] listener attached to ${address} via ${rpcUrl}`);

  // ── BookingCreated ─────────────────────────────
  contract.on(
    "BookingCreated",
    async (bookingId, roomId, guest, checkIn, checkOut, totalPrice, evt) => {
      try {
        const bId = Number(bookingId);
        await BookingMeta.findOneAndUpdate(
          { bookingId: bId },
          {
            bookingId: bId,
            walletAddress: String(guest).toLowerCase(),
            txHash: evt?.log?.transactionHash,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[chain] BookingCreated #${bId} → DB upserted`);

        // If we already have a guestEmail on file (posted by frontend), send a mail
        const meta = await BookingMeta.findOne({ bookingId: bId });
        if (meta && meta.guestEmail) {
          const checkInDate = new Date(Number(checkIn) * 1000).toDateString();
          const checkOutDate = new Date(Number(checkOut) * 1000).toDateString();
          await sendBookingConfirmation({
            to: meta.guestEmail,
            guestName: meta.guestName,
            roomName: `Room #${Number(roomId)}`,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalEth: ethers.formatEther(totalPrice),
            txHash: evt?.log?.transactionHash,
          });
        }
      } catch (err) {
        console.warn("[chain] BookingCreated handler error:", err.message);
      }
    }
  );

  // ── ReviewSubmitted ─────────────────────────────
  contract.on(
    "ReviewSubmitted",
    async (reviewId, bookingId, roomId, guest, rating, evt) => {
      try {
        const rId = Number(reviewId);
        // Fetch the full on-chain review struct to capture the comment text
        let comment = "";
        try {
          const review = await contract.getReview(rId);
          comment = review.comment;
        } catch {}

        await ReviewCache.findOneAndUpdate(
          { reviewId: rId },
          {
            reviewId: rId,
            bookingId: Number(bookingId),
            roomId: Number(roomId),
            walletAddress: String(guest).toLowerCase(),
            rating: Number(rating),
            comment,
            onChainCreatedAt: Math.floor(Date.now() / 1000),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[chain] ReviewSubmitted #${rId} → DB upserted`);
      } catch (err) {
        console.warn("[chain] ReviewSubmitted handler error:", err.message);
      }
    }
  );

  // ── BookingCancelled — record it on the metadata row ─────────────
  contract.on("BookingCancelled", async (bookingId, guest, refundAmount, evt) => {
    try {
      const bId = Number(bookingId);
      await BookingMeta.findOneAndUpdate(
        { bookingId: bId },
        { $set: { cancelledAt: new Date(), refundWei: refundAmount.toString() } },
        { upsert: true }
      );
      console.log(`[chain] BookingCancelled #${bId} recorded`);
    } catch (err) {
      console.warn("[chain] BookingCancelled handler error:", err.message);
    }
  });

  return contract;
}

module.exports = { startChainListener };
