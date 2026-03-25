const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("HotelBooking", function () {
  // ── Fixture ──
  async function deployFixture() {
    const [owner, guest1, guest2, other] = await ethers.getSigners();
    const HotelBooking = await ethers.getContractFactory("HotelBooking");
    const hotel = await HotelBooking.deploy();
    await hotel.waitForDeployment();

    return { hotel, owner, guest1, guest2, other };
  }

  async function deployWithRoomsFixture() {
    const { hotel, owner, guest1, guest2, other } = await loadFixture(deployFixture);

    await hotel.createRoom("Standard Room", "Standard", ethers.parseEther("0.01"), "QmHash1");
    await hotel.createRoom("Deluxe Suite",  "Deluxe",   ethers.parseEther("0.025"), "QmHash2");
    await hotel.createRoom("Penthouse",     "Suite",    ethers.parseEther("0.05"),  "QmHash3");

    return { hotel, owner, guest1, guest2, other };
  }

  // Helper: full lifecycle (book → checkIn → checkOut)
  async function bookAndCheckOut(hotel, owner, guest, roomId, checkIn, checkOut, value) {
    await hotel.connect(guest).bookRoom(roomId, checkIn, checkOut, { value });
    const bookingId = await hotel.bookingCount();
    await hotel.connect(owner).checkIn(bookingId);
    await hotel.connect(owner).checkOut(bookingId);
    return bookingId;
  }

  // Produce timestamps relative to the current on-chain block time (not Date.now),
  // which avoids edge cases in hardhat's test chain where blockTime drifts.
  async function futureTimes(offsetDays, durationDays = 2) {
    const now = await time.latest();
    return [now + offsetDays * 86400, now + (offsetDays + durationDays) * 86400];
  }

  // ── Deployment ──
  describe("Deployment", function () {
    it("Should set the correct owner and emit OwnershipTransferred", async function () {
      const { hotel, owner } = await loadFixture(deployFixture);
      expect(await hotel.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero rooms and bookings", async function () {
      const { hotel } = await loadFixture(deployFixture);
      expect(await hotel.roomCount()).to.equal(0);
      expect(await hotel.bookingCount()).to.equal(0);
      expect(await hotel.totalRevenue()).to.equal(0);
      expect(await hotel.paused()).to.be.false;
    });
  });

  // ── Room Management ──
  describe("Room Management", function () {
    it("Should create a room", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.createRoom("Test Room", "Standard", ethers.parseEther("0.01"), "QmTestHash")
      )
        .to.emit(hotel, "RoomCreated")
        .withArgs(1, "Test Room", "Standard", ethers.parseEther("0.01"));

      expect(await hotel.roomCount()).to.equal(1);
      const room = await hotel.getRoom(1);
      expect(room.name).to.equal("Test Room");
      expect(room.isActive).to.be.true;
      expect(room.status).to.equal(0);
    });

    it("Should reject room creation from non-owner", async function () {
      const { hotel, guest1 } = await loadFixture(deployFixture);
      await expect(
        hotel.connect(guest1).createRoom("Room", "Standard", ethers.parseEther("0.01"), "Qm")
      ).to.be.revertedWithCustomError(hotel, "NotOwner");
    });

    it("Should reject room with empty name", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.createRoom("", "Standard", ethers.parseEther("0.01"), "Qm")
      ).to.be.revertedWithCustomError(hotel, "NameRequired");
    });

    it("Should reject room with zero price", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.createRoom("Room", "Standard", 0, "Qm")
      ).to.be.revertedWithCustomError(hotel, "PriceMustBePositive");
    });

    it("Should update a room", async function () {
      const { hotel } = await loadFixture(deployWithRoomsFixture);
      await hotel.updateRoom(1, "Updated Room", "Deluxe", ethers.parseEther("0.02"), 0, "QmNewHash");
      const room = await hotel.getRoom(1);
      expect(room.name).to.equal("Updated Room");
      expect(room.pricePerNight).to.equal(ethers.parseEther("0.02"));
    });

    it("Should deactivate a room", async function () {
      const { hotel } = await loadFixture(deployWithRoomsFixture);
      await expect(hotel.deactivateRoom(1)).to.emit(hotel, "RoomDeactivated").withArgs(1);
      const room = await hotel.getRoom(1);
      expect(room.isActive).to.be.false;
      expect(room.status).to.equal(2);
    });

    it("Should return all rooms", async function () {
      const { hotel } = await loadFixture(deployWithRoomsFixture);
      const allRooms = await hotel.getAllRooms();
      expect(allRooms.length).to.equal(3);
    });
  });

  // ── Booking ──
  describe("Booking", function () {
    it("Should book a room with correct payment", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const totalCost = ethers.parseEther("0.02");

      await expect(
        hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost })
      )
        .to.emit(hotel, "BookingCreated")
        .withArgs(1, 1, guest1.address, checkIn, checkOut, totalCost);

      const room = await hotel.getRoom(1);
      expect(room.status).to.equal(1);
    });

    it("Should reject booking with insufficient payment", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await expect(
        hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(hotel, "InsufficientPayment");
    });

    it("Should reject booking for overlapping dates", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const totalCost = ethers.parseEther("0.02");

      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });
      await expect(
        hotel.connect(guest2).bookRoom(1, checkIn, checkOut, { value: totalCost })
      ).to.be.revertedWithCustomError(hotel, "DatesOverlap");
    });

    it("Should refund excess payment", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 1);
      const price = ethers.parseEther("0.01");
      const overpayment = ethers.parseEther("0.05");

      const balanceBefore = await ethers.provider.getBalance(guest1.address);
      const tx = await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: overpayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(guest1.address);

      const actualSpent = balanceBefore - balanceAfter - gasUsed;
      expect(actualSpent).to.be.closeTo(price, ethers.parseEther("0.001"));
    });
  });

  // ── Cancellation (Graduated Refund Policy) ──
  describe("Graduated Cancellation Refunds", function () {
    it("Should refund 100% when cancelled > 7 days before check-in", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(10, 2); // 10 days out
      const totalCost = ethers.parseEther("0.02");

      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });
      const [refund, percent] = await hotel.getRefundAmount(1);
      expect(percent).to.equal(100);
      expect(refund).to.equal(totalCost);

      await expect(hotel.connect(guest1).cancelBooking(1))
        .to.emit(hotel, "BookingCancelled")
        .withArgs(1, guest1.address, totalCost);
    });

    it("Should refund 75% when cancelled 3–7 days before check-in", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(5, 2); // 5 days out
      const totalCost = ethers.parseEther("0.02");

      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });
      const [, percent] = await hotel.getRefundAmount(1);
      expect(percent).to.equal(75);

      const expectedRefund = (totalCost * 75n) / 100n;
      await expect(hotel.connect(guest1).cancelBooking(1))
        .to.emit(hotel, "BookingCancelled")
        .withArgs(1, guest1.address, expectedRefund);
    });

    it("Should refund 50% when cancelled 1–3 days before check-in", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(2, 2); // 2 days out
      const totalCost = ethers.parseEther("0.02");

      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });
      const [, percent] = await hotel.getRefundAmount(1);
      expect(percent).to.equal(50);

      const expectedRefund = (totalCost * 50n) / 100n;
      await expect(hotel.connect(guest1).cancelBooking(1))
        .to.emit(hotel, "BookingCancelled")
        .withArgs(1, guest1.address, expectedRefund);
    });

    it("Should refund 0% when cancelled < 24 h before check-in", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      const checkIn  = now + 3 * 86400;       // 3 days out (avoid past)
      const checkOut = now + 5 * 86400;
      const totalCost = ethers.parseEther("0.02");

      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });

      // Jump close to check-in (leave 12h)
      await time.increaseTo(checkIn - 12 * 3600);

      const [refund, percent] = await hotel.getRefundAmount(1);
      expect(percent).to.equal(0);
      expect(refund).to.equal(0);

      await expect(hotel.connect(guest1).cancelBooking(1))
        .to.emit(hotel, "BookingCancelled")
        .withArgs(1, guest1.address, 0);
    });

    it("Should reject cancellation after check-in time", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      const checkIn = now + 86400;
      const checkOut = now + 86400 * 3;
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      await time.increaseTo(checkIn + 10);
      await expect(
        hotel.connect(guest1).cancelBooking(1)
      ).to.be.revertedWithCustomError(hotel, "CannotCancelAfterCheckIn");
    });

    it("Should reject cancellation from unauthorized user", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(10, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      await expect(
        hotel.connect(guest2).cancelBooking(1)
      ).to.be.revertedWithCustomError(hotel, "NotAuthorized");
    });
  });

  // ── Check In / Check Out ──
  describe("Check In / Check Out", function () {
    it("Should check in a guest", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      await expect(hotel.checkIn(1))
        .to.emit(hotel, "CheckedIn")
        .withArgs(1, guest1.address);
    });

    it("Should check out a guest and free the room", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      await hotel.checkIn(1);
      await expect(hotel.checkOut(1)).to.emit(hotel, "CheckedOut").withArgs(1, guest1.address);

      const room = await hotel.getRoom(1);
      expect(room.status).to.equal(0);
    });
  });

  // ── Stats & Withdrawal ──
  describe("Stats & Withdrawal", function () {
    it("Should return correct stats", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      const stats = await hotel.getStats();
      expect(stats.totalRooms).to.equal(3);
      expect(stats.availableRooms).to.equal(2);
      expect(stats.bookedRooms).to.equal(1);
      expect(stats.totalBookings).to.equal(1);
    });

    it("Should withdraw funds", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      const contractBalance = await ethers.provider.getBalance(await hotel.getAddress());
      await expect(hotel.withdrawFunds())
        .to.emit(hotel, "FundsWithdrawn")
        .withArgs(owner.address, contractBalance);
    });

    it("Should reject withdrawal when no funds", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(hotel.withdrawFunds()).to.be.revertedWithCustomError(hotel, "NoFundsToWithdraw");
    });
  });

  // ── Ownership ──
  describe("Ownership", function () {
    it("Should transfer ownership and emit OwnershipTransferred", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployFixture);
      await expect(hotel.transferOwnership(guest1.address))
        .to.emit(hotel, "OwnershipTransferred")
        .withArgs(owner.address, guest1.address);
      expect(await hotel.owner()).to.equal(guest1.address);
    });

    it("Should reject transfer to zero address", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(hotel, "ZeroAddress");
    });
  });

  // ── Reviews ──
  describe("Reviews", function () {
    it("Should submit a review after checkout", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const bookingId = await bookAndCheckOut(hotel, owner, guest1, 1, checkIn, checkOut, ethers.parseEther("0.02"));

      await expect(hotel.connect(guest1).submitReview(bookingId, 5, "Excellent stay!"))
        .to.emit(hotel, "ReviewSubmitted")
        .withArgs(1, bookingId, 1, guest1.address, 5);
    });

    it("Should reject review from non-guest", async function () {
      const { hotel, owner, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const bookingId = await bookAndCheckOut(hotel, owner, guest1, 1, checkIn, checkOut, ethers.parseEther("0.02"));
      await expect(
        hotel.connect(guest2).submitReview(bookingId, 4, "Nice room")
      ).to.be.revertedWithCustomError(hotel, "OnlyGuestCanReview");
    });

    it("Should reject review before checkout", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });
      await expect(
        hotel.connect(guest1).submitReview(1, 4, "Good")
      ).to.be.revertedWithCustomError(hotel, "CanOnlyReviewAfterCheckout");
    });

    it("Should reject duplicate review", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const bookingId = await bookAndCheckOut(hotel, owner, guest1, 1, checkIn, checkOut, ethers.parseEther("0.02"));
      await hotel.connect(guest1).submitReview(bookingId, 5, "Great!");
      await expect(
        hotel.connect(guest1).submitReview(bookingId, 3, "Changed my mind")
      ).to.be.revertedWithCustomError(hotel, "AlreadyReviewed");
    });

    it("Should reject invalid rating", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const bookingId = await bookAndCheckOut(hotel, owner, guest1, 1, checkIn, checkOut, ethers.parseEther("0.02"));
      await expect(
        hotel.connect(guest1).submitReview(bookingId, 0, "Bad")
      ).to.be.revertedWithCustomError(hotel, "InvalidRating");
      await expect(
        hotel.connect(guest1).submitReview(bookingId, 6, "Too much")
      ).to.be.revertedWithCustomError(hotel, "InvalidRating");
    });

    it("Should return correct room average rating", async function () {
      const { hotel, owner, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      await bookAndCheckOut(hotel, owner, guest1, 1, now + 86400, now + 86400 * 3, ethers.parseEther("0.02"));
      await hotel.connect(guest1).submitReview(1, 4, "Good stay");

      await bookAndCheckOut(hotel, owner, guest2, 1, now + 86400 * 5, now + 86400 * 7, ethers.parseEther("0.02"));
      await hotel.connect(guest2).submitReview(2, 5, "Amazing!");

      const [avgRating, totalReviews] = await hotel.getRoomAverageRating(1);
      expect(totalReviews).to.equal(2);
      expect(avgRating).to.equal(450);
    });

    it("Should return all reviews for a room", async function () {
      const { hotel, owner, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      await bookAndCheckOut(hotel, owner, guest1, 1, now + 86400, now + 86400 * 3, ethers.parseEther("0.02"));
      await hotel.connect(guest1).submitReview(1, 3, "OK");
      await bookAndCheckOut(hotel, owner, guest2, 1, now + 86400 * 5, now + 86400 * 7, ethers.parseEther("0.02"));
      await hotel.connect(guest2).submitReview(2, 5, "Perfect!");

      const rr = await hotel.getRoomReviews(1);
      expect(rr.length).to.equal(2);
    });
  });

  // ── Date Overlap Prevention ──
  describe("Date Overlap Prevention", function () {
    it("Should allow booking for non-overlapping dates on same room", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, { value: ethers.parseEther("0.02") });
      await expect(
        hotel.connect(guest2).bookRoom(1, now + 86400 * 5, now + 86400 * 7, { value: ethers.parseEther("0.02") })
      ).to.emit(hotel, "BookingCreated");
    });

    it("Should reject booking for overlapping dates", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const now = await time.latest();
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 5, { value: ethers.parseEther("0.04") });
      await expect(
        hotel.connect(guest2).bookRoom(1, now + 86400 * 3, now + 86400 * 7, { value: ethers.parseEther("0.04") })
      ).to.be.revertedWithCustomError(hotel, "DatesOverlap");
    });

    it("Should allow rebooking after cancellation", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(10, 2);
      const totalCost = ethers.parseEther("0.02");
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost });
      await hotel.connect(guest1).cancelBooking(1);
      await expect(
        hotel.connect(guest2).bookRoom(1, checkIn, checkOut, { value: totalCost })
      ).to.emit(hotel, "BookingCreated");
    });
  });

  // ── Loyalty Points ──
  describe("Loyalty Points", function () {
    it("Should earn loyalty points on booking", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      const info = await hotel.getLoyaltyInfo(guest1.address);
      expect(info.points).to.equal(100);
      expect(info.totalBookingsCount).to.equal(1);
      expect(info.hasDiscount).to.be.false;
    });

    it("Should apply loyalty discount after threshold", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const price = ethers.parseEther("0.01");
      const now = await time.latest();

      for (let i = 0; i < 5; i++) {
        const roomId = (i % 3) + 1;
        const checkIn = now + 86400 * (i * 10 + 1);
        const checkOut = now + 86400 * (i * 10 + 3);
        const room = await hotel.getRoom(roomId);
        const cost = room.pricePerNight * 2n;
        await hotel.connect(guest1).bookRoom(roomId, checkIn, checkOut, { value: cost });
        const bookingId = await hotel.bookingCount();
        await hotel.connect(owner).checkIn(bookingId);
        await hotel.connect(owner).checkOut(bookingId);
      }

      const info = await hotel.getLoyaltyInfo(guest1.address);
      expect(info.points).to.equal(500);
      expect(info.hasDiscount).to.be.true;

      const nights = 2;
      const basePrice = price * BigInt(nights);
      const discount = (basePrice * 5n) / 100n;
      const discountedPrice = basePrice - discount;

      const [finalPrice, discountAmount] = await hotel.getDiscountedPrice(1, nights, guest1.address);
      expect(finalPrice).to.equal(discountedPrice);
      expect(discountAmount).to.equal(discount);

      await hotel.connect(guest1).bookRoom(1, now + 86400 * 60, now + 86400 * 62, { value: discountedPrice });
      const booking = await hotel.getBooking(await hotel.bookingCount());
      expect(booking.totalPrice).to.equal(discountedPrice);
    });
  });

  // ── Pausable ──
  describe("Pausable", function () {
    it("Should pause and unpause (owner only) with events", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      await expect(hotel.pause()).to.emit(hotel, "Paused").withArgs(owner.address);
      expect(await hotel.paused()).to.be.true;

      await expect(hotel.connect(guest1).unpause()).to.be.revertedWithCustomError(hotel, "NotOwner");
      await expect(hotel.unpause()).to.emit(hotel, "Unpaused").withArgs(owner.address);
      expect(await hotel.paused()).to.be.false;
    });

    it("Should block bookings while paused", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      await hotel.pause();
      const [checkIn, checkOut] = await futureTimes(1, 2);
      await expect(
        hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") })
      ).to.be.revertedWithCustomError(hotel, "ContractPaused");
    });

    it("Should block cancellations and reviews while paused", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(10, 2);
      await hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: ethers.parseEther("0.02") });

      await hotel.pause();
      await expect(
        hotel.connect(guest1).cancelBooking(1)
      ).to.be.revertedWithCustomError(hotel, "ContractPaused");

      // Reviews are also blocked. Must first unpause, run the lifecycle, then re-pause.
      await hotel.unpause();
      const bookingId = await bookAndCheckOut(
        hotel, owner, guest1, 2,
        checkIn, checkOut,
        ethers.parseEther("0.05")
      );
      await hotel.pause();
      await expect(
        hotel.connect(guest1).submitReview(bookingId, 5, "Great!")
      ).to.be.revertedWithCustomError(hotel, "ContractPaused");
    });

    it("Should reject pause when already paused / unpause when not paused", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(hotel.unpause()).to.be.revertedWithCustomError(hotel, "ContractNotPaused");
      await hotel.pause();
      await expect(hotel.pause()).to.be.revertedWithCustomError(hotel, "ContractPaused");
    });
  });

  // ── Multi-Room Booking ──
  describe("Multi-Room Booking", function () {
    it("Should book multiple rooms in one transaction", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const roomIds = [1, 2];
      const checkIns = [checkIn, checkIn];
      const checkOuts = [checkOut, checkOut];
      const r1 = await hotel.getRoom(1);
      const r2 = await hotel.getRoom(2);
      const totalCost = r1.pricePerNight * 2n + r2.pricePerNight * 2n;

      await expect(
        hotel.connect(guest1).bookMultipleRooms(roomIds, checkIns, checkOuts, { value: totalCost })
      ).to.emit(hotel, "BatchBookingCreated").withArgs(guest1.address, 2, totalCost);

      expect(await hotel.bookingCount()).to.equal(2);
      const guestBookings = await hotel.getGuestBookings(guest1.address);
      expect(guestBookings.length).to.equal(2);

      // Guest earned points for each booking
      const info = await hotel.getLoyaltyInfo(guest1.address);
      expect(info.points).to.equal(200);
    });

    it("Should refund excess on batch booking", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(1, 2);
      const r1 = await hotel.getRoom(1);
      const r2 = await hotel.getRoom(2);
      const expectedCost = r1.pricePerNight * 2n + r2.pricePerNight * 2n;
      const payment = ethers.parseEther("1.0"); // massive overpayment

      const before = await ethers.provider.getBalance(guest1.address);
      const tx = await hotel.connect(guest1).bookMultipleRooms([1, 2], [checkIn, checkIn], [checkOut, checkOut], { value: payment });
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(guest1.address);
      expect(before - after - gas).to.be.closeTo(expectedCost, ethers.parseEther("0.001"));
    });

    it("Should reject empty and mismatched batch", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      await expect(
        hotel.connect(guest1).bookMultipleRooms([], [], [], { value: 0 })
      ).to.be.revertedWithCustomError(hotel, "EmptyBatch");

      const [ci, co] = await futureTimes(1, 2);
      await expect(
        hotel.connect(guest1).bookMultipleRooms([1, 2], [ci], [co, co], { value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(hotel, "BatchLengthMismatch");
    });

    it("Should revert whole batch if any room invalid", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [ci, co] = await futureTimes(1, 2);
      // Room 99 doesn't exist → whole batch reverts, nothing committed
      await expect(
        hotel.connect(guest1).bookMultipleRooms([1, 99], [ci, ci], [co, co], { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(hotel, "RoomDoesNotExist");
      expect(await hotel.bookingCount()).to.equal(0);
    });
  });

  // ── Waitlist ──
  describe("Waitlist", function () {
    it("Should let a guest join the waitlist and emit event", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(5, 2);

      await expect(hotel.connect(guest1).joinWaitlist(1, checkIn, checkOut))
        .to.emit(hotel, "WaitlistJoined")
        .withArgs(1, 1, guest1.address, checkIn, checkOut);

      const roomList = await hotel.getRoomWaitlist(1);
      expect(roomList.length).to.equal(1);
      expect(roomList[0].guest).to.equal(guest1.address);
    });

    it("Should let the owner notify a waitlist entry", async function () {
      const { hotel, owner, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(5, 2);
      await hotel.connect(guest1).joinWaitlist(1, checkIn, checkOut);

      await expect(hotel.connect(owner).notifyWaitlist(1))
        .to.emit(hotel, "WaitlistNotified")
        .withArgs(1, 1, guest1.address);

      const entry = await hotel.waitlist(1);
      expect(entry.notified).to.be.true;
    });

    it("Should let a guest clear their own waitlist entry", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(5, 2);
      await hotel.connect(guest1).joinWaitlist(1, checkIn, checkOut);

      await expect(hotel.connect(guest1).clearWaitlist(1))
        .to.emit(hotel, "WaitlistCleared")
        .withArgs(1);

      const active = await hotel.getRoomWaitlist(1);
      expect(active.length).to.equal(0);
    });

    it("Should reject unauthorized clear and double-clear", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(deployWithRoomsFixture);
      const [checkIn, checkOut] = await futureTimes(5, 2);
      await hotel.connect(guest1).joinWaitlist(1, checkIn, checkOut);

      await expect(hotel.connect(guest2).clearWaitlist(1))
        .to.be.revertedWithCustomError(hotel, "NotAuthorized");

      await hotel.connect(guest1).clearWaitlist(1);
      await expect(hotel.connect(guest1).clearWaitlist(1))
        .to.be.revertedWithCustomError(hotel, "WaitlistAlreadyCleared");
    });
  });
});
