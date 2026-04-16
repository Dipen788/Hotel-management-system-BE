const request = require("supertest");
const { installDb } = require("./setup");
const app = require("../server");
const User = require("../models/User");

async function getAdminToken() {
  // Register a user, then promote them to admin directly in the DB
  const { body } = await request(app).post("/api/auth/register").send({
    email: "admin@example.com", password: "secret123", name: "Admin",
  });
  await User.updateOne({ email: "admin@example.com" }, { role: "admin" });

  // Re-login now that we're admin so the JWT carries role=admin
  const login = await request(app).post("/api/auth/login")
    .send({ email: "admin@example.com", password: "secret123" });
  return login.body.token;
}

async function getGuestToken() {
  const { body } = await request(app).post("/api/auth/register").send({
    email: "guest@example.com", password: "secret123", name: "Guest",
  });
  return body.token;
}

describe("Rooms routes", () => {
  installDb();

  it("GET /api/rooms returns empty list initially", async () => {
    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });

  it("POST /api/rooms requires auth", async () => {
    const res = await request(app).post("/api/rooms").send({ roomId: 1 });
    expect(res.status).toBe(401);
  });

  it("POST /api/rooms rejects non-admin", async () => {
    const token = await getGuestToken();
    const res = await request(app).post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({ roomId: 1, description: "nice" });
    expect(res.status).toBe(403);
  });

  it("POST /api/rooms allows admin to upsert", async () => {
    const token = await getAdminToken();
    const res = await request(app).post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomId: 1,
        description: "Lovely",
        amenities: ["Wi-Fi", "Breakfast"],
        maxGuests: 2,
        bedType: "King",
      });
    expect(res.status).toBe(201);
    expect(res.body.room.description).toBe("Lovely");
    expect(res.body.room.amenities).toEqual(["Wi-Fi", "Breakfast"]);
  });

  it("POST /api/rooms validates input", async () => {
    const token = await getAdminToken();
    const res = await request(app).post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({ roomId: -1 });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/rooms/:id only for admin", async () => {
    const token = await getAdminToken();
    await request(app).post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({ roomId: 1 });

    const res = await request(app).delete("/api/rooms/1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});
