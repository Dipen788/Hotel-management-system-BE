const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * A user has TWO possible identities and can hold either or both:
 *
 *  1. Classic email + bcrypt-hashed password (optional)
 *  2. An Ethereum wallet address proven via SIWE-style signature (optional)
 *
 * At least one identity must be present. The pre-save validator below enforces
 * that invariant. `email` and `password` are stored only when the account was
 * created or extended with credentials.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    name: { type: String, trim: true },
    walletAddress: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["guest", "admin"], default: "guest" },
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  if (!this.email && !this.walletAddress) {
    return next(new Error("User must have an email or a wallet address"));
  }
  if (this.email && !this.password) {
    return next(new Error("Email users must have a password"));
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    email: this.email || null,
    name: this.name || null,
    walletAddress: this.walletAddress || null,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
