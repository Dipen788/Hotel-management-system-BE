const mongoose = require("mongoose");

/**
 * Connect to MongoDB.
 *
 * Priority:
 *   1. `MONGODB_URI` (or legacy `MONGO_URI`) if set — connect to that.
 *   2. Default `mongodb://127.0.0.1:27017/hotel-dapp`.
 *   3. If (1) or (2) fails AND we're in development, spin up an ephemeral
 *      `mongodb-memory-server` so features that need persistence (SIWE users,
 *      booking metadata, review cache) work without the user installing Mongo.
 *      In production we re-throw so orchestration can fail fast.
 *
 * The in-memory fallback DB is deliberately ephemeral: stop the backend and
 * it's gone. Fine for a coursework demo; obviously not for production.
 */
async function connectDB() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/hotel-dapp";

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[db] connected to ${uri}`);
    return;
  } catch (primaryErr) {
    if (process.env.NODE_ENV === "production") throw primaryErr;

    console.warn(
      `[db] primary connection failed (${primaryErr.message}); falling back to in-memory MongoDB`
    );
    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mem = await MongoMemoryServer.create();
      const memUri = mem.getUri();
      await mongoose.connect(memUri);
      console.log(`[db] connected to in-memory MongoDB at ${memUri}`);
      console.log("[db] ⚠  data is ephemeral — restart the server and it's gone");
    } catch (fallbackErr) {
      console.error(
        "[db] in-memory fallback failed:",
        fallbackErr.message,
        "\nInstall MongoDB or set MONGODB_URI to enable persistence."
      );
      throw fallbackErr;
    }
  }
}

module.exports = connectDB;
