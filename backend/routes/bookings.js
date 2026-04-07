const express = require("express");
const { body, param, validationResult } = require("express-validator");

const BookingMeta = require("../models/BookingMeta");
const GuestProfile = require("../models/GuestProfile");

const router = express.Router();

function v(req, res) {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    res.status(400).json({ error: "Validation failed", details: e.array() });
    return true;
  }
  return false;
}

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     summary: List booking metadata (optionally filtered by wallet)
 *     tags: [Bookings]
 *     parameters:
 *       - in: query
 *         name: wallet
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bookings array }
 */
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.wallet) filter.walletAddress = String(req.query.wallet).toLowerCase();
    const bookings = await BookingMeta.find(filter).sort({ bookingId: -1 });
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/bookings/{bookingId}:
 *   get:
 *     summary: Get a single booking's off-chain metadata
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Booking metadata }
 *       404: { description: Not found }
 */
router.get(
  "/:bookingId",
  [param("bookingId").isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const booking = await BookingMeta.findOne({ bookingId: Number(req.params.bookingId) });
      if (!booking) return res.status(404).json({ error: "Booking metadata not found" });
      res.json({ booking });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     summary: Save off-chain guest metadata for an existing on-chain booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, walletAddress]
 *             properties:
 *               bookingId:      { type: integer }
 *               walletAddress:  { type: string }
 *               guestName:      { type: string }
 *               guestEmail:     { type: string, format: email }
 *               guestPhone:     { type: string }
 *               numGuests:      { type: integer }
 *               specialRequests:{ type: string }
 *               txHash:         { type: string }
 *     responses:
 *       201: { description: Created/updated }
 */
router.post(
  "/",
  [
    body("bookingId").isInt({ min: 1 }),
    body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/).withMessage("invalid wallet address"),
    body("guestEmail").optional().isEmail().withMessage("invalid email").normalizeEmail(),
    body("numGuests").optional().isInt({ min: 1, max: 20 }),
    body("guestName").optional().isString().trim().isLength({ max: 120 }),
    body("guestPhone").optional().isString().trim().isLength({ max: 40 }),
    body("specialRequests").optional().isString().trim().isLength({ max: 500 }),
    body("txHash").optional().matches(/^0x[a-fA-F0-9]{64}$/),
  ],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const {
        bookingId, walletAddress, guestName, guestEmail,
        guestPhone, numGuests, specialRequests, txHash,
      } = req.body;

      const booking = await BookingMeta.findOneAndUpdate(
        { bookingId: Number(bookingId) },
        {
          bookingId: Number(bookingId),
          walletAddress: walletAddress.toLowerCase(),
          guestName, guestEmail, guestPhone, numGuests, specialRequests, txHash,
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (guestName || guestEmail || guestPhone) {
        await GuestProfile.findOneAndUpdate(
          { walletAddress: walletAddress.toLowerCase() },
          {
            walletAddress: walletAddress.toLowerCase(),
            ...(guestName && { fullName: guestName }),
            ...(guestEmail && { email: guestEmail }),
            ...(guestPhone && { phone: guestPhone }),
          },
          { upsert: true, new: true }
        );
      }

      res.status(201).json({ booking });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/bookings/profile/{wallet}:
 *   get:
 *     summary: Look up a guest profile by wallet address
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Profile }
 *       404: { description: Not found }
 */
router.get(
  "/profile/:wallet",
  [param("wallet").matches(/^0x[a-fA-F0-9]{40}$/).withMessage("invalid wallet address")],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const profile = await GuestProfile.findOne({ walletAddress: req.params.wallet.toLowerCase() });
      if (!profile) return res.status(404).json({ error: "No profile on file" });
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
