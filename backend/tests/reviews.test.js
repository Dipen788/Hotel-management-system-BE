const request = require("supertest");
const { installDb } = require("./setup");
const app = require("../server");

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

describe("Reviews routes", () => {
  installDb();

  it("POST /api/reviews mirrors a review", async () => {
    const res = await request(app).post("/api/reviews").send({
      reviewId: 1, bookingId: 1, roomId: 1,
      walletAddress: wallet, rating: 5, comment: "Great!",
    });
    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
  });

  it("rejects rating outside 1-5", async () => {
    const res = await request(app).post("/api/reviews").send({
      reviewId: 1, bookingId: 1, roomId: 1,
      walletAddress: wallet, rating: 7, comment: "No",
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid wallet", async () => {
    const res = await request(app).post("/api/reviews").send({
      reviewId: 1, bookingId: 1, roomId: 1,
      walletAddress: "bad", rating: 4, comment: "x",
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/reviews/room/:roomId returns aggregate average", async () => {
    await request(app).post("/api/reviews").send({
      reviewId: 1, bookingId: 1, roomId: 7, walletAddress: wallet, rating: 4, comment: "Ok",
    });
    await request(app).post("/api/reviews").send({
      reviewId: 2, bookingId: 2, roomId: 7, walletAddress: wallet, rating: 5, comment: "Wow",
    });
    const res = await request(app).get("/api/reviews/room/7");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.average).toBe(4.5);
  });
});
