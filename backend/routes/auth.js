const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const { ethers } = require("ethers");

const User = require("../models/User");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

// ── SIWE (Sign-In With Ethereum) nonce store ──
// In-memory map of `address → { nonce, expiresAt }`. Nonces are single-use and
// expire after 5 minutes. For a multi-instance deployment this would move to
// Redis, but for a single-node coursework backend an in-memory map is fine.
const NONCE_TTL_MS = 5 * 60 * 1000;
const nonceStore = new Map();

function issueNonce(address) {
  const nonce = crypto.randomBytes(16).toString("hex");
  nonceStore.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

function consumeNonce(address) {
  const key = address.toLowerCase();
  const entry = nonceStore.get(key);
  if (!entry) return null;
  nonceStore.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry.nonce;
}

function buildSiweMessage({ address, nonce, domain }) {
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${ethers.getAddress(address)}\n\n` +
    `Sign in to HotelChain.\n\n` +
    `Nonce: ${nonce}`
  );
}

// Tight rate limit on credential-taking endpoints. Disabled in the test
// environment so Jest suites that exercise many login attempts in quick
// succession aren't throttled into false failures.
const authLimiter =
  process.env.NODE_ENV === "test"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many auth attempts, please try again in a minute." },
      });

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email || null,
      walletAddress: user.walletAddress || null,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function collectValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: "Validation failed", details: errors.array() });
    return true;
  }
  return false;
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               name: { type: string }
 *               walletAddress: { type: string }
 *     responses:
 *       201: { description: User created, returns JWT }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
router.post(
  "/register",
  authLimiter,
  [
    body("email").isEmail().withMessage("valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("password >= 6 chars"),
    body("name").isString().trim().isLength({ min: 1, max: 120 }).withMessage("name required"),
    body("walletAddress").optional().matches(/^0x[a-fA-F0-9]{40}$/).withMessage("invalid wallet address"),
  ],
  async (req, res, next) => {
    try {
      if (collectValidation(req, res)) return;

      const { email, password, name, walletAddress } = req.body;
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ error: "Email already registered" });

      const user = await User.create({ email, password, name, walletAddress });
      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Exchange credentials for a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Returns JWT }
 *       401: { description: Invalid credentials }
 */
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("valid email required").normalizeEmail(),
    body("password").isString().isLength({ min: 1 }).withMessage("password required"),
  ],
  async (req, res, next) => {
    try {
      if (collectValidation(req, res)) return;

      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await user.comparePassword(password);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     summary: Get the profile of the currently authenticated user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile }
 *       401: { description: Missing or invalid token }
 */
router.get("/profile", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/profile:
 *   patch:
 *     summary: Update the current user's editable profile fields
 *     description: |
 *       Currently only the display name is user-editable. The account's
 *       identity (email, wallet, role) is immutable via this endpoint.
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 120 }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Validation error }
 *       401: { description: Missing or invalid token }
 *       404: { description: User not found }
 */
router.patch(
  "/profile",
  authRequired,
  [body("name").optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage("name must be 1-120 chars")],
  async (req, res, next) => {
    try {
      if (collectValidation(req, res)) return;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Only fields listed here are writable via this endpoint. Silently
      // ignore anything else the client sent to keep the surface area tight.
      if (typeof req.body.name === "string") {
        user.name = req.body.name.trim();
      }
      await user.save();
      res.json({ user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/auth/nonce:
 *   post:
 *     summary: Request a single-use nonce for SIWE sign-in
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address]
 *             properties:
 *               address: { type: string, description: 0x-prefixed wallet address }
 *     responses:
 *       200: { description: Nonce + message to sign (valid 5 min) }
 *       400: { description: Invalid address }
 */
router.post(
  "/nonce",
  authLimiter,
  [body("address").matches(/^0x[a-fA-F0-9]{40}$/).withMessage("invalid wallet address")],
  (req, res) => {
    if (collectValidation(req, res)) return;
    const address = req.body.address;
    const nonce = issueNonce(address);
    const domain = req.hostname || "localhost";
    const message = buildSiweMessage({ address, nonce, domain });
    res.json({ nonce, message });
  }
);

/**
 * @openapi
 * /api/auth/siwe:
 *   post:
 *     summary: Verify a signed nonce and exchange it for a JWT
 *     description: |
 *       The client signs the exact message returned by `/api/auth/nonce` using
 *       `personal_sign` (MetaMask). The server recovers the signer address from
 *       the signature and, if it matches, issues a JWT. A User document is
 *       created on the first successful sign-in for that wallet.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message]
 *             properties:
 *               address:   { type: string }
 *               signature: { type: string }
 *               message:   { type: string }
 *               name:      { type: string, description: Optional display name for new wallet users }
 *     responses:
 *       200: { description: Returns JWT (new user auto-created on first sign-in) }
 *       400: { description: Missing or malformed input }
 *       401: { description: Signature did not match the expected address }
 */
router.post(
  "/siwe",
  authLimiter,
  [
    body("address").matches(/^0x[a-fA-F0-9]{40}$/).withMessage("invalid wallet address"),
    body("signature").matches(/^0x[a-fA-F0-9]+$/).withMessage("invalid signature"),
    body("message").isString().isLength({ min: 1, max: 2000 }).withMessage("message required"),
    body("name").optional().isString().trim().isLength({ max: 120 }),
  ],
  async (req, res, next) => {
    try {
      if (collectValidation(req, res)) return;
      const { address, signature, message, name } = req.body;

      // 1. The message must contain the pending nonce for this address and no
      //    other. Consuming the nonce here defends against replay.
      const expectedNonce = consumeNonce(address);
      if (!expectedNonce) {
        return res.status(401).json({ error: "No active nonce; request a new one" });
      }
      if (!message.includes(`Nonce: ${expectedNonce}`)) {
        return res.status(401).json({ error: "Message does not match the issued nonce" });
      }

      // 2. Cryptographically recover the signer from the signature.
      let recovered;
      try {
        recovered = ethers.verifyMessage(message, signature);
      } catch {
        return res.status(401).json({ error: "Malformed signature" });
      }
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return res.status(401).json({ error: "Signature does not match address" });
      }

      // 3. Find-or-create the User. Wallet-only accounts have no email/password.
      const walletLower = address.toLowerCase();
      let user = await User.findOne({ walletAddress: walletLower });
      if (!user) {
        user = await User.create({
          walletAddress: walletLower,
          name: (name || "").trim() || `guest-${walletLower.slice(2, 8)}`,
        });
      }

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
