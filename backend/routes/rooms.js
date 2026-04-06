const express = require("express");
const { body, param, validationResult } = require("express-validator");

const RoomMeta = require("../models/RoomMeta");
const { authRequired, adminRequired } = require("../middleware/auth");

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
 * /api/rooms:
 *   get:
 *     summary: List all off-chain room metadata
 *     tags: [Rooms]
 *     responses:
 *       200: { description: Rooms }
 */
router.get("/", async (req, res, next) => {
  try {
    const rooms = await RoomMeta.find().sort({ roomId: 1 });
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/rooms/{roomId}:
 *   get:
 *     summary: Get off-chain metadata for a single room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Room }
 *       404: { description: Not found }
 */
router.get(
  "/:roomId",
  [param("roomId").isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const room = await RoomMeta.findOne({ roomId: Number(req.params.roomId) });
      if (!room) return res.status(404).json({ error: "Room metadata not found" });
      res.json({ room });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/rooms:
 *   post:
 *     summary: Create or upsert room metadata (admin only)
 *     tags: [Rooms]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/",
  authRequired,
  adminRequired,
  [
    body("roomId").isInt({ min: 1 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("amenities").optional().isArray(),
    body("images").optional().isArray(),
    body("maxGuests").optional().isInt({ min: 1, max: 20 }),
    body("sizeSqm").optional().isInt({ min: 1 }),
    body("bedType").optional().isString().trim().isLength({ max: 60 }),
  ],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const { roomId, description, amenities, images, maxGuests, sizeSqm, bedType } = req.body;
      const room = await RoomMeta.findOneAndUpdate(
        { roomId: Number(roomId) },
        { roomId: Number(roomId), description, amenities, images, maxGuests, sizeSqm, bedType },
        { upsert: true, new: true, runValidators: true }
      );
      res.status(201).json({ room });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/rooms/{roomId}:
 *   put:
 *     summary: Update room metadata (admin only)
 *     tags: [Rooms]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 */
router.put(
  "/:roomId",
  authRequired,
  adminRequired,
  [param("roomId").isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const room = await RoomMeta.findOneAndUpdate(
        { roomId: Number(req.params.roomId) },
        req.body,
        { new: true, runValidators: true }
      );
      if (!room) return res.status(404).json({ error: "Room metadata not found" });
      res.json({ room });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/rooms/{roomId}:
 *   delete:
 *     summary: Delete room metadata (admin only)
 *     tags: [Rooms]
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  "/:roomId",
  authRequired,
  adminRequired,
  [param("roomId").isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      if (v(req, res)) return;
      const room = await RoomMeta.findOneAndDelete({ roomId: Number(req.params.roomId) });
      if (!room) return res.status(404).json({ error: "Room metadata not found" });
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
