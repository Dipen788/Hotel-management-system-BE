/**
 * Fail-fast environment validation. Require variables that the app cannot
 * safely run without. Missing optional variables only warn.
 */
module.exports = function validateEnv() {
  const required = ["JWT_SECRET"];
  const recommended = ["MONGODB_URI", "PORT", "CORS_ORIGIN"];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[env] FATAL: missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const missingRecommended = recommended.filter((k) => !process.env[k]);
  if (missingRecommended.length) {
    console.warn(`[env] warning: recommended env vars missing: ${missingRecommended.join(", ")}`);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16) {
    console.warn("[env] warning: JWT_SECRET is shorter than 16 chars — use a long, random value in production");
  }
};
