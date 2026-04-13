const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Hotel DApp Backend API",
      version: "1.0.0",
      description:
        "REST API for the Hotel DApp hybrid on-chain/off-chain system. " +
        "The backend stores user profiles, booking metadata, and review caches; " +
        "the authoritative source of truth is the on-chain HotelBooking smart contract.",
    },
    servers: [{ url: "/", description: "Current host" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    tags: [
      { name: "Auth", description: "User registration, login, profile" },
      { name: "Rooms", description: "Room metadata (off-chain supplement to on-chain rooms)" },
      { name: "Bookings", description: "Off-chain booking metadata and guest profiles" },
      { name: "Reviews", description: "Cached copies of on-chain reviews" },
      { name: "Receipts", description: "Downloadable PDF receipts for completed bookings" },
      { name: "System", description: "Health and meta endpoints" },
    ],
  },
  apis: [
    path.join(__dirname, "..", "routes", "*.js"),
    path.join(__dirname, "..", "server.js"),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
