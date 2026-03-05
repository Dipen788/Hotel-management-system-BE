// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HotelBooking
 * @author CN6035 - Hotel DApp Project
 * @notice Decentralized hotel room management and booking system
 * @dev Handles room CRUD, bookings, payments, and refunds on-chain
 */
contract HotelBooking {
    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────
    enum RoomStatus { Available, Booked, Maintenance }
    enum BookingStatus { Confirmed, CheckedIn, CheckedOut, Cancelled }

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────
    struct Room {
        uint256 id;
        string name;
        string category;       // e.g. "Standard", "Deluxe", "Suite"
        uint256 pricePerNight;  // in wei
        bool isActive;
        RoomStatus status;
        string imageHash;      // IPFS hash for room image
    }

    struct Booking {
        uint256 id;
        uint256 roomId;
        address guest;
        uint256 checkIn;       // Unix timestamp
        uint256 checkOut;      // Unix timestamp
        uint256 totalPrice;    // Total paid in wei
        BookingStatus status;
        uint256 createdAt;
    }

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────
    address public owner;
    uint256 public roomCount;
    uint256 public bookingCount;
    uint256 public totalRevenue;

    mapping(uint256 => Room) public rooms;
    mapping(uint256 => Booking) public bookings;
    mapping(address => uint256[]) public guestBookings;
    mapping(uint256 => uint256[]) public roomBookings;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event RoomCreated(uint256 indexed roomId, string name, string category, uint256 pricePerNight);
    event RoomUpdated(uint256 indexed roomId, string name, uint256 pricePerNight, RoomStatus status);
    event RoomDeactivated(uint256 indexed roomId);
    event BookingCreated(
        uint256 indexed bookingId,
        uint256 indexed roomId,
        address indexed guest,
        uint256 checkIn,
        uint256 checkOut,
        uint256 totalPrice
    );
    event BookingCancelled(uint256 indexed bookingId, address indexed guest, uint256 refundAmount);
    event CheckedIn(uint256 indexed bookingId, address indexed guest);
    event CheckedOut(uint256 indexed bookingId, address indexed guest);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "HotelBooking: caller is not the owner");
        _;
    }

    modifier roomExists(uint256 _roomId) {
        require(_roomId > 0 && _roomId <= roomCount, "HotelBooking: room does not exist");
        _;
    }

    modifier bookingExists(uint256 _bookingId) {
        require(_bookingId > 0 && _bookingId <= bookingCount, "HotelBooking: booking does not exist");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Room Management (Admin)
    // ──────────────────────────────────────────────

    /**
     * @notice Create a new hotel room
     * @param _name Room display name
     * @param _category Room category (Standard, Deluxe, Suite)
     * @param _pricePerNight Nightly rate in wei
     * @param _imageHash IPFS image hash
     */
    function createRoom(
        string memory _name,
        string memory _category,
        uint256 _pricePerNight,
        string memory _imageHash
    ) external onlyOwner {
        require(bytes(_name).length > 0, "HotelBooking: name required");
        require(_pricePerNight > 0, "HotelBooking: price must be > 0");

        roomCount++;
        rooms[roomCount] = Room({
            id: roomCount,
            name: _name,
            category: _category,
            pricePerNight: _pricePerNight,
            isActive: true,
            status: RoomStatus.Available,
            imageHash: _imageHash
        });

        emit RoomCreated(roomCount, _name, _category, _pricePerNight);
    }

    /**
     * @notice Update room details
     */
    function updateRoom(
        uint256 _roomId,
        string memory _name,
        string memory _category,
        uint256 _pricePerNight,
        RoomStatus _status,
        string memory _imageHash
    ) external onlyOwner roomExists(_roomId) {
        require(bytes(_name).length > 0, "HotelBooking: name required");
        require(_pricePerNight > 0, "HotelBooking: price must be > 0");

        Room storage room = rooms[_roomId];
        room.name = _name;
        room.category = _category;
        room.pricePerNight = _pricePerNight;
        room.status = _status;
        room.imageHash = _imageHash;

        emit RoomUpdated(_roomId, _name, _pricePerNight, _status);
    }

    /**
     * @notice Deactivate a room (soft delete)
     */
    function deactivateRoom(uint256 _roomId) external onlyOwner roomExists(_roomId) {
        rooms[_roomId].isActive = false;
        rooms[_roomId].status = RoomStatus.Maintenance;
        emit RoomDeactivated(_roomId);
    }

    // ──────────────────────────────────────────────
    //  Booking Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Book a room by paying the total cost
     * @param _roomId ID of the room to book
     * @param _checkIn Check-in timestamp
     * @param _checkOut Check-out timestamp
     */
    function bookRoom(
        uint256 _roomId,
        uint256 _checkIn,
        uint256 _checkOut
    ) external payable roomExists(_roomId) {
        Room storage room = rooms[_roomId];

        require(room.isActive, "HotelBooking: room is not active");
        require(room.status == RoomStatus.Available, "HotelBooking: room is not available");
        require(_checkIn >= block.timestamp, "HotelBooking: check-in must be in the future");
        require(_checkOut > _checkIn, "HotelBooking: check-out must be after check-in");

        // Calculate nights (rounded up)
        uint256 nights = (_checkOut - _checkIn + 86399) / 86400;
        require(nights > 0, "HotelBooking: must book at least 1 night");

        uint256 totalCost = nights * room.pricePerNight;
        require(msg.value >= totalCost, "HotelBooking: insufficient payment");

        bookingCount++;
        bookings[bookingCount] = Booking({
            id: bookingCount,
            roomId: _roomId,
            guest: msg.sender,
            checkIn: _checkIn,
            checkOut: _checkOut,
            totalPrice: totalCost,
            status: BookingStatus.Confirmed,
            createdAt: block.timestamp
        });

        room.status = RoomStatus.Booked;
        guestBookings[msg.sender].push(bookingCount);
        roomBookings[_roomId].push(bookingCount);
        totalRevenue += totalCost;

        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit BookingCreated(bookingCount, _roomId, msg.sender, _checkIn, _checkOut, totalCost);
    }

    /**
     * @notice Cancel a booking and receive a refund (before check-in only)
     * @param _bookingId ID of the booking to cancel
     */
    function cancelBooking(uint256 _bookingId) external bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];

        require(booking.guest == msg.sender || msg.sender == owner, "HotelBooking: not authorized");
        require(booking.status == BookingStatus.Confirmed, "HotelBooking: cannot cancel this booking");
        require(block.timestamp < booking.checkIn, "HotelBooking: cannot cancel after check-in time");

        booking.status = BookingStatus.Cancelled;
        rooms[booking.roomId].status = RoomStatus.Available;

        // 90% refund policy — 10% cancellation fee
        uint256 refundAmount = (booking.totalPrice * 90) / 100;
        totalRevenue -= refundAmount;

        payable(booking.guest).transfer(refundAmount);

        emit BookingCancelled(_bookingId, booking.guest, refundAmount);
    }

    /**
     * @notice Mark guest as checked in (admin only)
     */
    function checkIn(uint256 _bookingId) external onlyOwner bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        require(booking.status == BookingStatus.Confirmed, "HotelBooking: invalid booking status");

        booking.status = BookingStatus.CheckedIn;
        emit CheckedIn(_bookingId, booking.guest);
    }

    /**
     * @notice Mark guest as checked out and free the room (admin only)
     */
    function checkOut(uint256 _bookingId) external onlyOwner bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        require(booking.status == BookingStatus.CheckedIn, "HotelBooking: guest not checked in");

        booking.status = BookingStatus.CheckedOut;
        rooms[booking.roomId].status = RoomStatus.Available;

        emit CheckedOut(_bookingId, booking.guest);
    }

    // ──────────────────────────────────────────────
    //  Withdrawal
    // ──────────────────────────────────────────────

    /**
     * @notice Withdraw contract balance (admin only)
     */
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "HotelBooking: no funds to withdraw");

        payable(owner).transfer(balance);
        emit FundsWithdrawn(owner, balance);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    function getRoom(uint256 _roomId) external view roomExists(_roomId) returns (Room memory) {
        return rooms[_roomId];
    }

    function getBooking(uint256 _bookingId) external view bookingExists(_bookingId) returns (Booking memory) {
        return bookings[_bookingId];
    }

    function getGuestBookings(address _guest) external view returns (uint256[] memory) {
        return guestBookings[_guest];
    }

    function getRoomBookings(uint256 _roomId) external view returns (uint256[] memory) {
        return roomBookings[_roomId];
    }

    /**
     * @notice Get all active rooms
     */
    function getAllRooms() external view returns (Room[] memory) {
        Room[] memory allRooms = new Room[](roomCount);
        for (uint256 i = 1; i <= roomCount; i++) {
            allRooms[i - 1] = rooms[i];
        }
        return allRooms;
    }

    /**
     * @notice Get all bookings
     */
    function getAllBookings() external view returns (Booking[] memory) {
        Booking[] memory allBookings = new Booking[](bookingCount);
        for (uint256 i = 1; i <= bookingCount; i++) {
            allBookings[i - 1] = bookings[i];
        }
        return allBookings;
    }

    /**
     * @notice Get counts for dashboard stats
     */
    function getStats() external view returns (
        uint256 totalRooms,
        uint256 availableRooms,
        uint256 bookedRooms,
        uint256 totalBookings,
        uint256 revenue
    ) {
        totalRooms = roomCount;
        totalBookings = bookingCount;
        revenue = totalRevenue;

        for (uint256 i = 1; i <= roomCount; i++) {
            if (rooms[i].isActive && rooms[i].status == RoomStatus.Available) {
                availableRooms++;
            } else if (rooms[i].status == RoomStatus.Booked) {
                bookedRooms++;
            }
        }
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "HotelBooking: zero address");
        owner = _newOwner;
    }

    receive() external payable {}
}
