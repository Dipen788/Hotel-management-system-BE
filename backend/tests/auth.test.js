const request = require("supertest");
const { ethers } = require("ethers");
const { installDb } = require("./setup");
const app = require("../server");

// Fixed-key wallet for deterministic SIWE test signatures. NEVER use for real
// funds — this key is public and in the test suite.
const TEST_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const TEST_WALLET = new ethers.Wallet(TEST_PRIVATE_KEY);

async function signedSiwePayload(wallet = TEST_WALLET) {
  const nonceRes = await request(app)
    .post("/api/auth/nonce")
    .send({ address: wallet.address });
  const { message } = nonceRes.body;
  const signature = await wallet.signMessage(message);
  return { address: wallet.address, message, signature };
}

describe("Auth routes", () => {
  installDb();

  describe("POST /api/auth/register", () => {
    it("creates a new user and returns a JWT", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "alice@example.com", password: "secret123", name: "Alice" });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe("alice@example.com");
      expect(res.body.user.role).toBe("guest");
      expect(res.body.user.password).toBeUndefined();
    });

    it("rejects weak password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "bob@example.com", password: "123", name: "Bob" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Validation/);
    });

    it("rejects invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "not-an-email", password: "secret123", name: "Zed" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid wallet address", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "c@c.com", password: "secret123", name: "Car", walletAddress: "nope" });
      expect(res.status).toBe(400);
    });

    it("prevents duplicate emails", async () => {
      await request(app).post("/api/auth/register")
        .send({ email: "dup@example.com", password: "secret123", name: "Dup" });
      const res = await request(app).post("/api/auth/register")
        .send({ email: "dup@example.com", password: "secret123", name: "Again" });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register")
        .send({ email: "eve@example.com", password: "secret123", name: "Eve" });
    });

    it("returns a token for valid credentials", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email: "eve@example.com", password: "secret123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it("rejects wrong password", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email: "eve@example.com", password: "wrong-pass" });
      expect(res.status).toBe(401);
    });

    it("rejects unknown user", async () => {
      const res = await request(app).post("/api/auth/login")
        .send({ email: "ghost@example.com", password: "whatever" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/profile", () => {
    it("returns 401 without a token", async () => {
      const res = await request(app).get("/api/auth/profile");
      expect(res.status).toBe(401);
    });

    it("returns the current user with a valid token", async () => {
      const reg = await request(app).post("/api/auth/register")
        .send({ email: "x@x.com", password: "secret123", name: "X" });
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${reg.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("x@x.com");
    });
  });

  describe("PATCH /api/auth/profile", () => {
    it("updates the display name for an authenticated user", async () => {
      const reg = await request(app).post("/api/auth/register")
        .send({ email: "patch@example.com", password: "secret123", name: "Old Name" });
      const res = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${reg.body.token}`)
        .send({ name: "New Name" });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("New Name");
    });

    it("rejects empty names with a validation error", async () => {
      const reg = await request(app).post("/api/auth/register")
        .send({ email: "bad-patch@example.com", password: "secret123", name: "Keep" });
      const res = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${reg.body.token}`)
        .send({ name: "" });
      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .patch("/api/auth/profile")
        .send({ name: "Anyone" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/nonce", () => {
    it("issues a nonce message containing the address and a fresh nonce", async () => {
      const res = await request(app)
        .post("/api/auth/nonce")
        .send({ address: TEST_WALLET.address });
      expect(res.status).toBe(200);
      expect(res.body.nonce).toMatch(/^[a-f0-9]{32}$/);
      expect(res.body.message).toContain(TEST_WALLET.address);
      expect(res.body.message).toContain(`Nonce: ${res.body.nonce}`);
    });

    it("rejects a malformed address", async () => {
      const res = await request(app)
        .post("/api/auth/nonce")
        .send({ address: "not-an-address" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/siwe", () => {
    it("creates a wallet-only user on first sign-in and returns a JWT", async () => {
      const payload = await signedSiwePayload();
      const res = await request(app).post("/api/auth/siwe").send(payload);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.walletAddress).toBe(TEST_WALLET.address.toLowerCase());
      expect(res.body.user.email).toBeNull();
      // Default stub name follows a guest-<prefix> convention
      expect(res.body.user.name).toMatch(/^guest-[a-f0-9]{6}$/);
    });

    it("returns the same user on a second sign-in (find-or-create)", async () => {
      const first = await request(app).post("/api/auth/siwe").send(await signedSiwePayload());
      const second = await request(app).post("/api/auth/siwe").send(await signedSiwePayload());
      expect(first.body.user.id).toBe(second.body.user.id);
    });

    it("rejects a replay of an already-consumed nonce", async () => {
      const payload = await signedSiwePayload();
      const first = await request(app).post("/api/auth/siwe").send(payload);
      expect(first.status).toBe(200);
      const replay = await request(app).post("/api/auth/siwe").send(payload);
      expect(replay.status).toBe(401);
      expect(replay.body.error).toMatch(/nonce/i);
    });

    it("rejects a signature that doesn't match the claimed address", async () => {
      const otherWallet = ethers.Wallet.createRandom();
      const { message } = (await request(app)
        .post("/api/auth/nonce")
        .send({ address: TEST_WALLET.address })).body;
      // Sign with the wrong wallet
      const signature = await otherWallet.signMessage(message);
      const res = await request(app).post("/api/auth/siwe").send({
        address: TEST_WALLET.address,
        message,
        signature,
      });
      expect(res.status).toBe(401);
    });

    it("rejects a tampered message (nonce in message doesn't match issued nonce)", async () => {
      const payload = await signedSiwePayload();
      // Tamper after the signature was generated
      const tampered = {
        ...payload,
        message: payload.message.replace(/Nonce: .+$/, "Nonce: deadbeefdeadbeefdeadbeefdeadbeef"),
      };
      const res = await request(app).post("/api/auth/siwe").send(tampered);
      expect(res.status).toBe(401);
    });

    it("rejects sign-in without a pre-issued nonce", async () => {
      // Construct a message ourselves without calling /nonce first
      const message = `localhost wants you to sign in with your Ethereum account:\n${TEST_WALLET.address}\n\nSign in to HotelChain.\n\nNonce: 00000000000000000000000000000000`;
      const signature = await TEST_WALLET.signMessage(message);
      const res = await request(app).post("/api/auth/siwe").send({
        address: TEST_WALLET.address,
        message,
        signature,
      });
      expect(res.status).toBe(401);
    });
  });
});
