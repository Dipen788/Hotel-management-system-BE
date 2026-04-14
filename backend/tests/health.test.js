const request = require("supertest");
const app = require("../server");

describe("System endpoints", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("hotel-dapp-backend");
  });

  it("GET /api/docs.json serves an OpenAPI spec", async () => {
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toMatch(/Hotel DApp/);
    // Every route file we registered should produce at least one path entry
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(3);
  });

  it("unknown route returns 404 via notFound handler", async () => {
    const res = await request(app).get("/api/this-does-not-exist");
    expect(res.status).toBe(404);
  });
});
