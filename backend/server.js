require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { swaggerSpec } = require("./config/swagger");
const validateEnv = require("./config/validateEnv");

const authRoutes = require("./routes/auth");
const roomsRoutes = require("./routes/rooms");
const bookingsRoutes = require("./routes/bookings");
const reviewsRoutes = require("./routes/reviews");
const receiptsRoutes = require("./routes/receipts");

// ── Fail fast if required env missing (skipped under NODE_ENV=test) ──
if (process.env.NODE_ENV !== "test") {
  validateEnv();
}

const app = express();
const PORT = process.env.PORT || 5000;

// ── Core security & logging middleware ──
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Health check ──
/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Liveness probe
 *     tags: [System]
 *     responses:
 *       200: { description: ok }
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "hotel-dapp-backend", time: new Date().toISOString() });
});

// ── Swagger docs ──
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));

// ── Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/receipts", receiptsRoutes);

// ── Error handling ──
app.use(notFound);
app.use(errorHandler);

// ── Start (unless under test) ──
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[server] Hotel DApp backend listening on port ${PORT}`);
    console.log(`[docs]   Swagger UI → http://localhost:${PORT}/api/docs`);
  });

  (async function connectWithRetry() {
    try {
      await connectDB();
    } catch (err) {
      console.warn("[db] connection failed (will retry in 10s):", err.message);
      setTimeout(connectWithRetry, 10000);
    }
  })();

  // Optional on-chain event listener (disabled by default — set ENABLE_CHAIN_LISTENER=true)
  if (process.env.ENABLE_CHAIN_LISTENER === "true") {
    const { startChainListener } = require("./services/chainListener");
    startChainListener().catch((err) =>
      console.warn("[chain] listener failed to start:", err.message)
    );
  }
}

module.exports = app;
