/**
 * PDF receipt generation.
 *
 * Pulls booking metadata from Mongo and looks up the authoritative on-chain
 * booking via JSON-RPC, then streams back a PDF. The receipt deliberately
 * contains the tx hash so the guest can independently verify against Etherscan
 * or any other block explorer.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { ethers } = require("ethers");

const BookingMeta = require("../models/BookingMeta");

const router = express.Router();

function loadContractData() {
  const candidates = [
    path.join(__dirname, "..", "..", "frontend", "src", "utils", "contractData.json"),
    path.join(__dirname, "..", "contractData.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return null;
}

/**
 * @openapi
 * /api/receipts/{bookingId}.pdf:
 *   get:
 *     summary: Download a PDF receipt for the given booking
 *     tags: [Receipts]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF document
 *         content: { application/pdf: {} }
 *       404: { description: Not found }
 */
router.get("/:bookingId.pdf", async (req, res, next) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      return res.status(400).json({ error: "invalid bookingId" });
    }

    const meta = await BookingMeta.findOne({ bookingId }).catch(() => null);

    // Fetch authoritative data from chain
    let onChain;
    const cd = loadContractData();
    if (cd) {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:7545");
        const contract = new ethers.Contract(cd.address, cd.abi, provider);
        onChain = await contract.getBooking(bookingId);
      } catch (err) {
        console.warn("[receipts] chain read failed:", err.message);
      }
    }

    if (!meta && !onChain) {
      return res.status(404).json({ error: "Booking not found on-chain or in DB" });
    }

    const statuses = ["Confirmed", "Checked In", "Checked Out", "Cancelled"];

    // ── Stream PDF ──
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="booking-${bookingId}-receipt.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor("#111").text("Hotel DApp — Booking Receipt", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#666").text(`Generated ${new Date().toUTCString()}`);
    doc.moveDown();

    doc.fillColor("#111").fontSize(14).text(`Booking #${bookingId}`, { underline: true });
    doc.moveDown(0.3);

    const rows = [];
    if (onChain) {
      rows.push(["Room ID", String(Number(onChain.roomId))]);
      rows.push(["Guest Wallet", onChain.guest]);
      rows.push(["Check-in", new Date(Number(onChain.checkIn) * 1000).toUTCString()]);
      rows.push(["Check-out", new Date(Number(onChain.checkOut) * 1000).toUTCString()]);
      rows.push(["Total paid", `${ethers.formatEther(onChain.totalPrice)} ETH`]);
      rows.push(["Status", statuses[Number(onChain.status)] || "Unknown"]);
      rows.push(["Booked at", new Date(Number(onChain.createdAt) * 1000).toUTCString()]);
    }
    if (meta) {
      if (meta.guestName)  rows.push(["Guest name", meta.guestName]);
      if (meta.guestEmail) rows.push(["Guest email", meta.guestEmail]);
      if (meta.guestPhone) rows.push(["Guest phone", meta.guestPhone]);
      if (meta.numGuests)  rows.push(["Occupants", String(meta.numGuests)]);
      if (meta.specialRequests) rows.push(["Special requests", meta.specialRequests]);
      if (meta.txHash)     rows.push(["Transaction hash", meta.txHash]);
    }

    doc.fontSize(11);
    for (const [k, v] of rows) {
      doc.fillColor("#666").text(k, { continued: true, width: 160 });
      doc.fillColor("#111").text(`  ${v}`);
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor("#888").text(
      "This receipt is generated from blockchain data. Verify the transaction hash " +
      "independently on a block explorer to confirm the booking's authenticity.",
      { align: "left" }
    );

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
