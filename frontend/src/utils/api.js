// ═══════════════════════════════════════════════════════════════
//  Backend REST client — talks to Express/MongoDB for off-chain data.
//  The smart contract remains the source of truth for state transitions
//  (rooms, bookings, payments, reviews). This layer stores rich metadata
//  that doesn't belong on a public blockchain.
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "hotel_dapp_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Health ──
export const ping = () => request("/health");

// ── Auth ──
export const register = (payload) => request("/auth/register", { method: "POST", body: payload });
export const login = (payload) => request("/auth/login", { method: "POST", body: payload });
export const getProfile = () => request("/auth/profile", { auth: true });
export const updateProfile = (payload) =>
  request("/auth/profile", { method: "PATCH", body: payload, auth: true });

// SIWE (Sign-In With Ethereum): two-step wallet login. Client asks for a nonce,
// signs the returned message with MetaMask, and returns the signature for the
// server to verify and issue a JWT.
export const getSiweNonce = (address) =>
  request("/auth/nonce", { method: "POST", body: { address } });
export const siweLogin = ({ address, signature, message, name }) =>
  request("/auth/siwe", { method: "POST", body: { address, signature, message, name } });

// ── Rooms (off-chain metadata) ──
export const getRoomsMeta = () => request("/rooms");
export const getRoomMeta = (roomId) => request(`/rooms/${roomId}`);
export const upsertRoomMeta = (payload) => request("/rooms", { method: "POST", body: payload, auth: true });
export const updateRoomMeta = (roomId, payload) => request(`/rooms/${roomId}`, { method: "PUT", body: payload, auth: true });

// ── Bookings (off-chain metadata, called AFTER on-chain tx confirms) ──
export const getBookingsMeta = (wallet) =>
  request(`/bookings${wallet ? `?wallet=${wallet}` : ""}`);
export const getBookingMeta = (bookingId) => request(`/bookings/${bookingId}`);
export const saveBookingMeta = (payload) => request("/bookings", { method: "POST", body: payload });
export const getGuestProfile = (wallet) => request(`/bookings/profile/${wallet}`);

// ── Reviews (off-chain cache) ──
export const getReviewsMeta = (roomId) =>
  request(`/reviews${roomId !== undefined ? `?room=${roomId}` : ""}`);
export const getRoomReviewsMeta = (roomId) => request(`/reviews/room/${roomId}`);
export const mirrorReview = (payload) => request("/reviews", { method: "POST", body: payload });

// ── Receipts (PDF) ──
// Returns the absolute URL to a booking's PDF receipt. The browser downloads
// the streaming response directly from the backend (no JSON parsing).
export const receiptUrl = (bookingId) => `${API_BASE}/receipts/${bookingId}.pdf`;

// ── Helper: merge on-chain rooms with off-chain metadata ──
export function mergeRoomsWithMeta(onChainRooms, metaList) {
  const metaMap = {};
  for (const m of metaList) metaMap[m.roomId] = m;
  return onChainRooms.map((r) => ({
    ...r,
    description: metaMap[r.id]?.description || "",
    amenities: metaMap[r.id]?.amenities || [],
    images: metaMap[r.id]?.images || [],
    maxGuests: metaMap[r.id]?.maxGuests,
    bedType: metaMap[r.id]?.bedType,
  }));
}
