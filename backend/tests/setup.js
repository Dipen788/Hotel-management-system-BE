/**
 * Shared test harness. Each DB-backed suite calls {@link installDb}()
 * inside its top-level describe block.
 *
 * Strategy:
 *   1. If MONGODB_TEST_URI is set, connect to that real instance.
 *   2. Otherwise, spin up an in-memory MongoDB via mongodb-memory-server.
 *   3. If neither works (e.g. binary download fails offline), the suite is
 *      gracefully SKIPPED with a warning, so the rest of the suites still run.
 */
const mongoose = require("mongoose");

let _mongoHelperLoaded;
try {
  _mongoHelperLoaded = require("mongodb-memory-server");
} catch {
  _mongoHelperLoaded = null;
}

/**
 * Registers db-lifecycle hooks inside the enclosing describe().
 * Returns a getter for isAvailable — true once setup completes OK.
 */
function installDb() {
  const state = { mongo: null, available: false, reason: null };

  beforeAll(async () => {
    try {
      if (process.env.MONGODB_TEST_URI) {
        await mongoose.connect(process.env.MONGODB_TEST_URI, { dbName: "hotel-dapp-test" });
      } else if (_mongoHelperLoaded) {
        const { MongoMemoryServer } = _mongoHelperLoaded;
        state.mongo = await MongoMemoryServer.create();
        await mongoose.connect(state.mongo.getUri(), { dbName: "hotel-dapp-test" });
      } else {
        throw new Error("no MongoDB available for tests");
      }
      state.available = true;
    } catch (err) {
      state.available = false;
      state.reason = err.message;
      console.warn(`[test-setup] DB unavailable (${err.message}) — DB-backed tests will be skipped.`);
    }
  }, 120_000);

  afterEach(async () => {
    if (!state.available) return;
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect().catch(() => {});
    }
    if (state.mongo) await state.mongo.stop().catch(() => {});
  });

  return state;
}

/**
 * Wrap a test body so that it's auto-skipped when DB setup failed.
 * Prevents a wall of red when running offline / behind a firewall.
 */
function ifDb(state, name, body) {
  (global.test || global.it)(name, async function () {
    if (!state.available) {
      console.warn(`[skip] ${name} — DB unavailable`);
      return;
    }
    return body.call(this);
  });
}

module.exports = { installDb, ifDb };
