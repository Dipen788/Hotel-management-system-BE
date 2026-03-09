const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
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
    const { hotel, owner, guest1, guest2, other } = await loadFixture(
      deployFixture
    );

    await hotel.createRoom(
      "Standard Room",
      "Standard",
      ethers.parseEther("0.01"),
      "QmHash1"
    );
    await hotel.createRoom(
      "Deluxe Suite",
      "Deluxe",
      ethers.parseEther("0.025"),
      "QmHash2"
    );
    await hotel.createRoom(
      "Penthouse",
      "Suite",
      ethers.parseEther("0.05"),
      "QmHash3"
    );

    return { hotel, owner, guest1, guest2, other };
  }

  // ── Deployment ──
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { hotel, owner } = await loadFixture(deployFixture);
      expect(await hotel.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero rooms and bookings", async function () {
      const { hotel } = await loadFixture(deployFixture);
      expect(await hotel.roomCount()).to.equal(0);
      expect(await hotel.bookingCount()).to.equal(0);
      expect(await hotel.totalRevenue()).to.equal(0);
    });
  });

  // ── Room Management ──
  describe("Room Management", function () {
    it("Should create a room", async function () {
      const { hotel } = await loadFixture(deployFixture);

      await expect(
        hotel.createRoom(
          "Test Room",
          "Standard",
          ethers.parseEther("0.01"),
          "QmTestHash"
        )
      )
        .to.emit(hotel, "RoomCreated")
        .withArgs(1, "Test Room", "Standard", ethers.parseEther("0.01"));

      expect(await hotel.roomCount()).to.equal(1);

      const room = await hotel.getRoom(1);
      expect(room.name).to.equal("Test Room");
      expect(room.category).to.equal("Standard");
      expect(room.isActive).to.be.true;
      expect(room.status).to.equal(0); // Available
    });

    it("Should reject room creation from non-owner", async function () {
      const { hotel, guest1 } = await loadFixture(deployFixture);
      await expect(
        hotel
          .connect(guest1)
          .createRoom("Room", "Standard", ethers.parseEther("0.01"), "Qm")
      ).to.be.revertedWith("HotelBooking: caller is not the owner");
    });

    it("Should reject room with empty name", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.createRoom("", "Standard", ethers.parseEther("0.01"), "Qm")
      ).to.be.revertedWith("HotelBooking: name required");
    });

    it("Should reject room with zero price", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.createRoom("Room", "Standard", 0, "Qm")
      ).to.be.revertedWith("HotelBooking: price must be > 0");
    });

    it("Should update a room", async function () {
      const { hotel } = await loadFixture(deployWithRoomsFixture);

      await hotel.updateRoom(
        1,
        "Updated Room",
        "Deluxe",
        ethers.parseEther("0.02"),
        0,
        "QmNewHash"
      );

      const room = await hotel.getRoom(1);
      expect(room.name).to.equal("Updated Room");
      expect(room.category).to.equal("Deluxe");
      expect(room.pricePerNight).to.equal(ethers.parseEther("0.02"));
    });

    it("Should deactivate a room", async function () {
      const { hotel } = await loadFixture(deployWithRoomsFixture);

      await expect(hotel.deactivateRoom(1))
        .to.emit(hotel, "RoomDeactivated")
        .withArgs(1);

      const room = await hotel.getRoom(1);
      expect(room.isActive).to.be.false;
      expect(room.status).to.equal(2); // Maintenance
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

      const now = Math.floor(Date.now() / 1000);
      const checkIn = now + 86400; // tomorrow
      const checkOut = now + 86400 * 3; // 3 days later
      const nights = 2;
      const price = ethers.parseEther("0.01");
      const totalCost = price * BigInt(nights);

      await expect(
        hotel.connect(guest1).bookRoom(1, checkIn, checkOut, { value: totalCost })
      )
        .to.emit(hotel, "BookingCreated")
        .withArgs(1, 1, guest1.address, checkIn, checkOut, totalCost);

      expect(await hotel.bookingCount()).to.equal(1);

      const booking = await hotel.getBooking(1);
      expect(booking.guest).to.equal(guest1.address);
      expect(booking.status).to.equal(0); // Confirmed

      const room = await hotel.getRoom(1);
      expect(room.status).to.equal(1); // Booked
    });

    it("Should reject booking with insufficient payment", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);
      const now = Math.floor(Date.now() / 1000);

      await expect(
        hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWith("HotelBooking: insufficient payment");
    });

    it("Should reject booking for unavailable room", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(
        deployWithRoomsFixture
      );

      const now = Math.floor(Date.now() / 1000);
      const checkIn = now + 86400;
      const checkOut = now + 86400 * 3;
      const totalCost = ethers.parseEther("0.02");

      // First booking
      await hotel
        .connect(guest1)
        .bookRoom(1, checkIn, checkOut, { value: totalCost });

      // Second booking should fail
      await expect(
        hotel
          .connect(guest2)
          .bookRoom(1, checkIn, checkOut, { value: totalCost })
      ).to.be.revertedWith("HotelBooking: room is not available");
    });

    it("Should refund excess payment", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);

      const now = Math.floor(Date.now() / 1000);
      const checkIn = now + 86400;
      const checkOut = now + 86400 * 2; // 1 night
      const price = ethers.parseEther("0.01");
      const overpayment = ethers.parseEther("0.05");

      const balanceBefore = await ethers.provider.getBalance(guest1.address);

      const tx = await hotel
        .connect(guest1)
        .bookRoom(1, checkIn, checkOut, { value: overpayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(guest1.address);

      // Guest should have paid only 0.01 ETH + gas, not 0.05
      const actualSpent = balanceBefore - balanceAfter - gasUsed;
      expect(actualSpent).to.be.closeTo(price, ethers.parseEther("0.001"));
    });
  });

  // ── Cancellation ──
  describe("Cancellation", function () {
    it("Should cancel a booking and refund 90%", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);

      const now = Math.floor(Date.now() / 1000);
      const checkIn = now + 86400 * 7; // 1 week from now
      const checkOut = now + 86400 * 9;
      const totalCost = ethers.parseEther("0.02");

      await hotel
        .connect(guest1)
        .bookRoom(1, checkIn, checkOut, { value: totalCost });

      const refundExpected = (totalCost * 90n) / 100n;

      await expect(hotel.connect(guest1).cancelBooking(1))
        .to.emit(hotel, "BookingCancelled")
        .withArgs(1, guest1.address, refundExpected);

      const booking = await hotel.getBooking(1);
      expect(booking.status).to.equal(3); // Cancelled

      const room = await hotel.getRoom(1);
      expect(room.status).to.equal(0); // Available again
    });

    it("Should reject cancellation from unauthorized user", async function () {
      const { hotel, guest1, guest2 } = await loadFixture(
        deployWithRoomsFixture
      );

      const now = Math.floor(Date.now() / 1000);
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
        value: ethers.parseEther("0.02"),
      });

      await expect(
        hotel.connect(guest2).cancelBooking(1)
      ).to.be.revertedWith("HotelBooking: not authorized");
    });
  });

  // ── Check In / Check Out ──
  describe("Check In / Check Out", function () {
    it("Should check in a guest", async function () {
      const { hotel, owner, guest1 } = await loadFixture(
        deployWithRoomsFixture
      );

      const now = Math.floor(Date.now() / 1000);
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
        value: ethers.parseEther("0.02"),
      });

      await expect(hotel.checkIn(1))
        .to.emit(hotel, "CheckedIn")
        .withArgs(1, guest1.address);

      const booking = await hotel.getBooking(1);
      expect(booking.status).to.equal(1); // CheckedIn
    });

    it("Should check out a guest and free the room", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);

      const now = Math.floor(Date.now() / 1000);
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
        value: ethers.parseEther("0.02"),
      });

      await hotel.checkIn(1);
      await expect(hotel.checkOut(1))
        .to.emit(hotel, "CheckedOut")
        .withArgs(1, guest1.address);

      const room = await hotel.getRoom(1);
      expect(room.status).to.equal(0); // Available
    });
  });

  // ── Stats & Withdrawal ──
  describe("Stats & Withdrawal", function () {
    it("Should return correct stats", async function () {
      const { hotel, guest1 } = await loadFixture(deployWithRoomsFixture);

      const now = Math.floor(Date.now() / 1000);
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
        value: ethers.parseEther("0.02"),
      });

      const stats = await hotel.getStats();
      expect(stats.totalRooms).to.equal(3);
      expect(stats.availableRooms).to.equal(2);
      expect(stats.bookedRooms).to.equal(1);
      expect(stats.totalBookings).to.equal(1);
    });

    it("Should withdraw funds", async function () {
      const { hotel, owner, guest1 } = await loadFixture(
        deployWithRoomsFixture
      );

      const now = Math.floor(Date.now() / 1000);
      await hotel.connect(guest1).bookRoom(1, now + 86400, now + 86400 * 3, {
        value: ethers.parseEther("0.02"),
      });

      const contractBalance = await ethers.provider.getBalance(
        await hotel.getAddress()
      );

      await expect(hotel.withdrawFunds())
        .to.emit(hotel, "FundsWithdrawn")
        .withArgs(owner.address, contractBalance);
    });

    it("Should reject withdrawal when no funds", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(hotel.withdrawFunds()).to.be.revertedWith(
        "HotelBooking: no funds to withdraw"
      );
    });
  });

  // ── Ownership ──
  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const { hotel, guest1 } = await loadFixture(deployFixture);
      await hotel.transferOwnership(guest1.address);
      expect(await hotel.owner()).to.equal(guest1.address);
    });

    it("Should reject transfer to zero address", async function () {
      const { hotel } = await loadFixture(deployFixture);
      await expect(
        hotel.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("HotelBooking: zero address");
    });
  });
});
