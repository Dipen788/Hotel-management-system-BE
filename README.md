# HotelChain DApp

A hybrid hotel-booking decentralised application built for **CN6035 — Mobile & Distributed Systems** at the University of East London.

Smart contracts manage the immutable parts (inventory, reservations, payments, reviews), while an off-chain Node/Mongo service handles the parts that don't belong on a public ledger (guest email, booking PDFs, rich room metadata).

---

## Architecture

```
 ┌─────────────┐       ┌──────────────┐        ┌────────────┐
 │  React SPA  │──────▶│   MetaMask   │───────▶│  Ganache   │
 │  (port 3000)│  JSON │  (wallet)    │  RPC   │ (port 7545)│
 └─────┬───────┘  RPC  └──────────────┘        └──────┬─────┘
       │ REST                                         │ events
       ▼                                              ▼
 ┌──────────────┐     read     ┌───────────────────────────┐
 │ Express API  │◀────────────▶│   Chain Listener (ethers) │
 │  (port 5000) │              │   mirrors events to Mongo │
 └─────┬────────┘              └───────────────────────────┘
       │ Mongoose
       ▼
 ┌──────────────┐
 │   MongoDB    │
 │  (port 27017)│
 └──────────────┘
```

**On-chain (HotelBooking.sol)** — Solidity 0.8.24
- Rooms: `createRoom`, `updateRoom`, `deactivateRoom`
- Bookings: `bookRoom`, `bookMultipleRooms`, `cancelBooking`, `checkIn`, `checkOut`
- Reviews: `submitReview`, `getRoomAverageRating`
- Loyalty points + graduated cancellation refunds (100% / 75% / 50% / 0%)
- Emergency `pause` / `unpause` (Pausable pattern)
- Waitlist: `joinWaitlist`, `notifyWaitlist`
- Custom errors (gas-efficient) + NatSpec comments
- `OwnershipTransferred` event

**Off-chain (Express / MongoDB)**
- JWT authentication (bcrypt-hashed passwords)
- Guest profile + booking metadata (name, email, phone, special requests)
- PDF receipt streaming (pdfkit)
- Chain event listener → auto-syncs bookings, reviews, cancellations
- Email confirmation via Nodemailer (Ethereal fallback in dev)
- Hardened with helmet, rate-limit, express-validator, morgan
- Swagger/OpenAPI UI at `/api/docs`

**Frontend (React 18)**
- MetaMask-gated app with auto-switch to Ganache (chain 1337)
- Guest and admin dashboards, search/filter/sort, confirm dialogs
- JWT auth UI for off-chain profile
- WCAG-aware modals (Escape/Enter, focus rings, ARIA)
- Occupancy chart (pure SVG, no extra deps)
- Loyalty tier badge with progress bar

---

## Repository layout

```
hotel-dapp/
├── contracts/            Solidity sources
│   └── HotelBooking.sol
├── test/                 Hardhat / Chai tests (50 tests)
├── scripts/deploy.js     Deploys contract, writes ABI + address
├── backend/              Express API + Mongo + chain listener
│   ├── server.js
│   ├── routes/           auth, rooms, bookings, reviews, receipts
│   ├── services/         chainListener, mailer
│   ├── models/           Mongoose schemas
│   ├── middleware/
│   ├── config/           env validation, swagger
│   └── tests/            Jest + supertest
├── frontend/             React SPA (CRA)
│   └── src/
│       ├── components/
│       ├── contexts/     Auth, Wallet, Toast
│       ├── hooks/        useContract
│       └── utils/        contract.js, api.js, contractData.json
├── docker-compose.yml
└── hardhat.config.js
```

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB 6+ (or run the included compose file)
- [Ganache](https://trufflesuite.com/ganache/) on port 7545, chainId 1337
- MetaMask browser extension

### One-time install

```bash
# Smart contract + tests
npm install

# Backend API
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### Run locally

```bash
# 1. Start Ganache (GUI or `ganache --port 7545 --chain.chainId 1337`)

# 2. Compile + deploy contract (writes frontend/src/utils/contractData.json)
npx hardhat run scripts/deploy.js --network ganache

# 3. Start backend (separate terminal)
cd backend
cp .env.example .env   # then edit JWT_SECRET etc.
npm run dev

# 4. Start frontend (separate terminal)
cd frontend
npm start              # opens http://localhost:3000
```

### Docker (one command)

```bash
docker-compose up --build
# → Mongo on :27017, Express on :5000, React on :3000
```

Note: Ganache is intentionally **not** dockerised — run it via the GUI so students can inspect state transitions visually.

---

## Testing

```bash
# Smart contract — 50 tests
npx hardhat test

# Backend — Jest + supertest + mongodb-memory-server
cd backend && npm test     # Linux/mac
cd backend && npm run test:win   # Windows CMD

# Frontend production build
cd frontend && npm run build
```

---

## API docs

Interactive Swagger UI: http://localhost:5000/api/docs
Raw OpenAPI JSON: http://localhost:5000/api/docs.json

---

## Environment variables

Backend (`backend/.env`):

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hotel-dapp
JWT_SECRET=replace-me-with-a-long-random-string
CORS_ORIGIN=http://localhost:3000

# Optional — enables auto-sync from chain
ENABLE_CHAIN_LISTENER=true
CHAIN_RPC_URL=http://localhost:7545

# Optional — sends booking confirmation emails
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=HotelChain <no-reply@hotelchain.local>
```

Frontend (`frontend/.env`):

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_EXPLORER_BASE=   # leave blank for local Ganache
```

---

## Key design decisions

- **Hybrid on/off-chain split.** Blockchain for value transfer + auditability; Mongo for PII (email, phone, name) so we don't dox guests on a public ledger.
- **Custom errors instead of require strings.** Roughly 30% cheaper on reverts and avoids string-matching brittleness in tests.
- **Graduated cancellation refunds.** Mirrors real-world hotel policies (>7 days = 100%, 3–7 = 75%, 1–3 = 50%, <24h = 0%) rather than a single flat rate.
- **Pausable pattern.** Admin can freeze all state-changing calls during an incident response window.
- **Chain listener, not frontend push.** The backend subscribes to `BookingCreated`, `ReviewSubmitted`, `BookingCancelled` events directly — so the off-chain cache stays consistent even if a user closes their tab before the UI's follow-up POST fires.
- **Minimal frontend dependencies.** No `date-fns`, no charting library — kept as vanilla React + pure SVG to show competence with the platform primitives.

---

## Acknowledgements

Built as coursework for **CN6035** at UEL. Not for production use without a security audit.
