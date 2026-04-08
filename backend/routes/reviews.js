const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const ReviewCache = require("../models/ReviewCache");

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
 * /api/reviews:
 *   get:
 *     summary: List cached reviews (filterable)
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: room
 *         schema: { type: integer }
 *       - in: query
 *         name: wallet
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reviews }
 */
router.get(
  "/",
  [
    query("room").optional().isInt({ min: 1 }),
    query("wallet").optional().matches(/^0x[a-fA-F0-9]{40}$/),
  ],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const filter = {};
      if (req.query.room) filter.roomId = Number(req.query.room);
      if (req.query.wallet) filter.walletAddress = String(req.query.wallet).toLowerCase();
      const reviews = await ReviewCache.find(filter).sort({ reviewId: -1 });
      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/reviews/room/{roomId}:
 *   get:
 *     summary: Cached reviews for a room, with aggregate average
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reviews + average }
 */
router.get(
  "/room/:roomId",
  [param("roomId").isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const reviews = await ReviewCache.find({ roomId: Number(req.params.roomId) }).sort({ reviewId: -1 });
      const avg = reviews.length
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;
      res.json({ reviews, count: reviews.length, average: Number(avg.toFixed(2)) });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     summary: Mirror an on-chain review into the backend cache
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewId, bookingId, roomId, walletAddress, rating]
 *             properties:
 *               reviewId:         { type: integer }
 *               bookingId:        { type: integer }
 *               roomId:           { type: integer }
 *               walletAddress:    { type: string }
 *               rating:           { type: integer, minimum: 1, maximum: 5 }
 *               comment:          { type: string }
 *               onChainCreatedAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Created/updated }
 */
router.post(
  "/",
  [
    body("reviewId").isInt({ min: 1 }),
    body("bookingId").isInt({ min: 1 }),
    body("roomId").isInt({ min: 1 }),
    body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/),
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").optional().isString().trim().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const { reviewId, bookingId, roomId, walletAddress, rating, comment, onChainCreatedAt } = req.body;
      const doc = {
        reviewId: Number(reviewId),
        bookingId: Number(bookingId),
        roomId: Number(roomId),
        walletAddress: walletAddress.toLowerCase(),
        rating: Number(rating),
        comment,
      };
      // onChainCreatedAt accepts either a unix-seconds number or an ISO date string
      if (onChainCreatedAt !== undefined && onChainCreatedAt !== null) {
        const parsed = typeof onChainCreatedAt === "number"
          ? onChainCreatedAt
          : Math.floor(new Date(onChainCreatedAt).getTime() / 1000);
        if (Number.isFinite(parsed)) doc.onChainCreatedAt = parsed;
      }
      const review = await ReviewCache.findOneAndUpdate(
        { reviewId: doc.reviewId },
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
