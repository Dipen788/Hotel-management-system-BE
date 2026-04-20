# Hotel DApp — Backend

Express + MongoDB service providing off-chain storage for the Hotel DApp.

## Responsibility split

| Concern | Layer |
|--------|-------|
| Room CRUD, booking + payment, cancellation + refund, check-in/out, reviews, loyalty points | **On-chain** (HotelBooking.sol) |
| Guest personal details (name, email, phone) | **Off-chain** (BookingMeta, GuestProfile) |
| Room descriptions, multiple images, amenities | **Off-chain** (RoomMeta) |
| User authentication | **Off-chain** (User + JWT) |
| Fast review search/filtering | **Off-chain cache** (ReviewCache — contract is source of truth) |

## Run locally

```bash
# 1. Ensure MongoDB is running on localhost:27017
# 2. Copy env template
cp .env.example .env
# 3. Install
npm install
# 4. Start
npm run dev   # nodemon
# or
npm start
```

## Endpoints

### Auth
- `POST /api/auth/register` — { email, password, name, walletAddress? }
- `POST /api/auth/login` — { email, password }
- `GET  /api/auth/profile` — Bearer token required

### Rooms
- `GET  /api/rooms`
- `GET  /api/rooms/:roomId`
- `POST /api/rooms` — admin only
- `PUT  /api/rooms/:roomId` — admin only
- `DELETE /api/rooms/:roomId` — admin only

### Bookings
- `GET  /api/bookings?wallet=0x...`
- `GET  /api/bookings/:bookingId`
- `POST /api/bookings` — after on-chain success
- `GET  /api/bookings/profile/:wallet`

### Reviews
- `GET  /api/reviews?room=1`
- `GET  /api/reviews/room/:roomId`
- `POST /api/reviews` — mirror on-chain review

### Health
- `GET  /api/health`
