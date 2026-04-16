const request = require("supertest");
const { installDb } = require("./setup");
const app = require("../server");

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

describe("Bookings routes", () => {
  installDb();

  it("POST /api/bookings upserts booking metadata", async () => {
    const res = await request(app).post("/api/bookings").send({
      bookingId: 1,
      walletAddress: wallet,
      guestName: "Alice",
      guestEmail: "alice@example.com",
      guestPhone: "+441234567890",
      numGuests: 2,
      specialRequests: "Quiet room please",
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.bookingId).toBe(1);
    expect(res.body.booking.walletAddress).toBe(wallet);
  });

  it("POST /api/bookings rejects invalid wallet", async () => {
    const res = await request(app).post("/api/bookings").send({
      bookingId: 1, walletAddress: "not-a-wallet", guestName: "A",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/bookings rejects invalid email", async () => {
    const res = await request(app).post("/api/bookings").send({
      bookingId: 1, walletAddress: wallet, guestEmail: "nope",
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/bookings filters by wallet (case-insensitive)", async () => {
    await request(app).post("/api/bookings").send({ bookingId: 1, walletAddress: wallet });
    await request(app).post("/api/bookings").send({
      bookingId: 2,
      walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    });

    const res = await request(app).get(`/api/bookings?wallet=${wallet.toUpperCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].bookingId).toBe(1);
  });

  it("GET /api/bookings/:id returns single booking", async () => {
    await request(app).post("/api/bookings").send({ bookingId: 42, walletAddress: wallet });
    const res = await request(app).get("/api/bookings/42");
    expect(res.status).toBe(200);
    expect(res.body.booking.bookingId).toBe(42);
  });

  it("GET /api/bookings/:id returns 404 for missing", async () => {
    const res = await request(app).get("/api/bookings/999");
    expect(res.status).toBe(404);
  });

  it("upsert creates a guest profile when contact info is provided", async () => {
    await request(app).post("/api/bookings").send({
      bookingId: 1, walletAddress: wallet,
      guestName: "Al", guestEmail: "al@a.com", guestPhone: "+1",
    });

    const res = await request(app).get(`/api/bookings/profile/${wallet}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBe("Al");
    expect(res.body.profile.email).toBe("al@a.com");
  });
});
