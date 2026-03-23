// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HotelBooking
 * @author CN6035 - Hotel DApp Project
 * @notice Decentralized hotel room management and booking system with
 *         pausability, graduated cancellation refunds, loyalty points,
 *         on-chain reviews, waitlist, and multi-room bookings.
 * @dev All state-changing operations that handle guest funds are guarded
 *      by the {whenNotPaused} modifier. Custom errors are used throughout
 *      to minimise runtime gas cost. The contract is deliberately self-
 *      contained — it does not depend on OpenZeppelin — to keep the audit
 *      surface small and easy to reason about for an educational project.
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
        string category;        // e.g. "Standard", "Deluxe", "Suite"
        uint256 pricePerNight;  // in wei
        bool isActive;
        RoomStatus status;
        string imageHash;       // IPFS hash for room image
    }

    struct Booking {
        uint256 id;
        uint256 roomId;
        address guest;
        uint256 checkIn;        // Unix timestamp
        uint256 checkOut;       // Unix timestamp
        uint256 totalPrice;     // Total paid in wei
        BookingStatus status;
        uint256 createdAt;
    }

    struct Review {
        uint256 id;
        uint256 bookingId;
        uint256 roomId;
        address guest;
        uint8 rating;           // 1-5
        string comment;
        uint256 createdAt;
    }

    struct WaitlistEntry {
        uint256 id;
        uint256 roomId;
        address guest;
        uint256 checkIn;
        uint256 checkOut;
        bool notified;
        bool cleared;
        uint256 createdAt;
    }

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────
    address public owner;
    bool public paused;

    uint256 public roomCount;
    uint256 public bookingCount;
    uint256 public totalRevenue;

    mapping(uint256 => Room) public rooms;
    mapping(uint256 => Booking) public bookings;
    mapping(address => uint256[]) public guestBookings;
    mapping(uint256 => uint256[]) public roomBookings;

    // ── Review State ──
    uint256 public reviewCount;
    mapping(uint256 => Review) public reviews;
    mapping(uint256 => uint256[]) public roomReviews;      // roomId => reviewIds
    mapping(uint256 => bool) public bookingReviewed;        // bookingId => reviewed?
    mapping(uint256 => uint256) public roomTotalRating;     // roomId => sum of ratings
    mapping(uint256 => uint256) public roomReviewCount;     // roomId => number of reviews

    // ── Loyalty State ──
    mapping(address => uint256) public loyaltyPoints;
    mapping(address => uint256) public totalBookingsByGuest;
    uint256 public constant POINTS_PER_BOOKING = 100;
    uint256 public constant LOYALTY_DISCOUNT_THRESHOLD = 500; // 5 bookings to qualify
    uint256 public constant LOYALTY_DISCOUNT_PERCENT = 5;     // 5% discount

    // ── Cancellation refund tiers (percent of totalPrice returned) ──
    uint256 public constant REFUND_FULL = 100;       // > 7 days before check-in
    uint256 public constant REFUND_HIGH = 75;        // 3–7 days
    uint256 public constant REFUND_MED  = 50;        // 1–3 days
    uint256 public constant REFUND_NONE = 0;         // < 24 h (no refund)

    // ── Waitlist State ──
    uint256 public waitlistCount;
    mapping(uint256 => WaitlistEntry) public waitlist;
    mapping(uint256 => uint256[]) public roomWaitlist;  // roomId => entryIds
    mapping(address => uint256[]) public guestWaitlist; // guest => entryIds

    // ──────────────────────────────────────────────
    //  Custom Errors (gas-efficient replacements for require strings)
    // ──────────────────────────────────────────────
    error NotOwner();
    error ZeroAddress();
    error RoomDoesNotExist();
    error BookingDoesNotExist();
    error WaitlistEntryDoesNotExist();
    error NameRequired();
    error PriceMustBePositive();
    error RoomInactive();
    error RoomUnderMaintenance();
    error CheckInMustBeFuture();
    error CheckOutMustBeAfterCheckIn();
    error DatesOverlap();
    error MustBookAtLeastOneNight();
    error InsufficientPayment();
    error NotAuthorized();
    error CannotCancel();              // booking not in Confirmed state
    error CannotCancelAfterCheckIn();
    error InvalidBookingStatus();
    error NotCheckedIn();
    error OnlyGuestCanReview();
    error CanOnlyReviewAfterCheckout();
    error AlreadyReviewed();
    error InvalidRating();
    error CommentRequired();
    error ReviewDoesNotExist();
    error NoFundsToWithdraw();
    error ContractPaused();
    error ContractNotPaused();
    error EmptyBatch();
    error BatchLengthMismatch();
    error WaitlistAlreadyCleared();
    error NotOnWaitlist();

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
    event ReviewSubmitted(
        uint256 indexed reviewId,
        uint256 indexed bookingId,
        uint256 indexed roomId,
        address guest,
        uint8 rating
    );
    event LoyaltyPointsEarned(address indexed guest, uint256 points, uint256 totalPoints);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed admin);
    event Unpaused(address indexed admin);
    event WaitlistJoined(
        uint256 indexed entryId,
        uint256 indexed roomId,
        address indexed guest,
        uint256 checkIn,
        uint256 checkOut
    );
    event WaitlistNotified(uint256 indexed entryId, uint256 indexed roomId, address indexed guest);
    event WaitlistCleared(uint256 indexed entryId);
    event BatchBookingCreated(address indexed guest, uint256 count, uint256 totalPaid);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier roomExists(uint256 _roomId) {
        if (_roomId == 0 || _roomId > roomCount) revert RoomDoesNotExist();
        _;
    }

    modifier bookingExists(uint256 _bookingId) {
        if (_bookingId == 0 || _bookingId > bookingCount) revert BookingDoesNotExist();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Pause Controls (Admin)
    // ──────────────────────────────────────────────

    /// @notice Pause all guest-facing state-changing operations
    /// @dev    Only the owner may pause. While paused, bookings, cancellations,
    ///         check-ins and reviews are blocked; admin operations remain available.
    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Resume normal operations
    function unpause() external onlyOwner whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Room Management (Admin)
    // ──────────────────────────────────────────────

    /**
     * @notice Create a new hotel room
     * @param _name Room display name
     * @param _category Room category (Standard, Deluxe, Suite)
     * @param _pricePerNight Nightly rate in wei
     * @param _imageHash IPFS image hash (optional)
     */
    function createRoom(
        string memory _name,
        string memory _category,
        uint256 _pricePerNight,
        string memory _imageHash
    ) external onlyOwner {
        if (bytes(_name).length == 0) revert NameRequired();
        if (_pricePerNight == 0) revert PriceMustBePositive();

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

    /// @notice Update an existing room's metadata and status
    /// @param _roomId The room ID to update
    /// @param _name Updated display name
    /// @param _category Updated category
    /// @param _pricePerNight Updated nightly price in wei
    /// @param _status Updated {RoomStatus}
    /// @param _imageHash Updated IPFS hash
    function updateRoom(
        uint256 _roomId,
        string memory _name,
        string memory _category,
        uint256 _pricePerNight,
        RoomStatus _status,
        string memory _imageHash
    ) external onlyOwner roomExists(_roomId) {
        if (bytes(_name).length == 0) revert NameRequired();
        if (_pricePerNight == 0) revert PriceMustBePositive();

        Room storage room = rooms[_roomId];
        room.name = _name;
        room.category = _category;
        room.pricePerNight = _pricePerNight;
        room.status = _status;
        room.imageHash = _imageHash;

        emit RoomUpdated(_roomId, _name, _pricePerNight, _status);
    }

    /// @notice Deactivate a room (soft delete). Room is marked Maintenance.
    function deactivateRoom(uint256 _roomId) external onlyOwner roomExists(_roomId) {
        rooms[_roomId].isActive = false;
        rooms[_roomId].status = RoomStatus.Maintenance;
        emit RoomDeactivated(_roomId);
    }

    // ──────────────────────────────────────────────
    //  Booking Functions
    // ──────────────────────────────────────────────

    /**
     * @dev Check if a new booking's dates overlap with any active booking for the room
     */
    function _hasDateOverlap(
        uint256 _roomId,
        uint256 _checkIn,
        uint256 _checkOut
    ) internal view returns (bool) {
        uint256[] storage bookingIds = roomBookings[_roomId];
        for (uint256 i = 0; i < bookingIds.length; i++) {
            Booking storage existing = bookings[bookingIds[i]];
            if (
                existing.status == BookingStatus.Confirmed ||
                existing.status == BookingStatus.CheckedIn
            ) {
                if (existing.checkIn < _checkOut && existing.checkOut > _checkIn) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @dev Check if a room has any remaining active bookings
     */
    function _hasActiveBookings(uint256 _roomId) internal view returns (bool) {
        uint256[] storage bookingIds = roomBookings[_roomId];
        for (uint256 i = 0; i < bookingIds.length; i++) {
            BookingStatus s = bookings[bookingIds[i]].status;
            if (s == BookingStatus.Confirmed || s == BookingStatus.CheckedIn) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Core book-room implementation used by {bookRoom} and {bookMultipleRooms}.
     *      Handles validation, loyalty discount, state updates and event emission,
     *      BUT does NOT refund excess — the caller is responsible for refunding
     *      overpayment outside of the loop.
     * @return cost The charged price (after any loyalty discount)
     */
    function _createBooking(
        address _guest,
        uint256 _roomId,
        uint256 _checkIn,
        uint256 _checkOut,
        uint256 _paymentForThisRoom
    ) internal returns (uint256 cost) {
        if (_roomId == 0 || _roomId > roomCount) revert RoomDoesNotExist();

        Room storage room = rooms[_roomId];
        if (!room.isActive) revert RoomInactive();
        if (room.status == RoomStatus.Maintenance) revert RoomUnderMaintenance();
        if (_checkIn < block.timestamp) revert CheckInMustBeFuture();
        if (_checkOut <= _checkIn) revert CheckOutMustBeAfterCheckIn();
        if (_hasDateOverlap(_roomId, _checkIn, _checkOut)) revert DatesOverlap();

        uint256 nights = (_checkOut - _checkIn + 86399) / 86400;
        if (nights == 0) revert MustBookAtLeastOneNight();

        cost = nights * room.pricePerNight;

        // Apply loyalty discount if eligible
        if (loyaltyPoints[_guest] >= LOYALTY_DISCOUNT_THRESHOLD) {
            cost = cost - (cost * LOYALTY_DISCOUNT_PERCENT) / 100;
        }

        if (_paymentForThisRoom < cost) revert InsufficientPayment();

        bookingCount++;
        bookings[bookingCount] = Booking({
            id: bookingCount,
            roomId: _roomId,
            guest: _guest,
            checkIn: _checkIn,
            checkOut: _checkOut,
            totalPrice: cost,
            status: BookingStatus.Confirmed,
            createdAt: block.timestamp
        });

        room.status = RoomStatus.Booked;
        guestBookings[_guest].push(bookingCount);
        roomBookings[_roomId].push(bookingCount);
        totalRevenue += cost;

        loyaltyPoints[_guest] += POINTS_PER_BOOKING;
        totalBookingsByGuest[_guest]++;
        emit LoyaltyPointsEarned(_guest, POINTS_PER_BOOKING, loyaltyPoints[_guest]);

        emit BookingCreated(bookingCount, _roomId, _guest, _checkIn, _checkOut, cost);
    }

    /// @notice Book a single room for a date range by paying >= total cost in wei
    /// @param _roomId The ID of the room to book
    /// @param _checkIn Unix timestamp of the check-in date
    /// @param _checkOut Unix timestamp of the check-out date (must be > _checkIn)
    function bookRoom(
        uint256 _roomId,
        uint256 _checkIn,
        uint256 _checkOut
    ) external payable whenNotPaused {
        uint256 cost = _createBooking(msg.sender, _roomId, _checkIn, _checkOut, msg.value);

        // Refund excess payment
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }

    /**
     * @notice Book multiple rooms in a single transaction (family / group booking)
     * @dev All arrays must be the same length. Each room is booked independently
     *      and `msg.value` must cover the SUM of all costs. Any excess is refunded.
     *      If ANY room in the batch fails validation, the whole call reverts.
     * @param _roomIds Rooms to book
     * @param _checkIns Check-in timestamps (one per room)
     * @param _checkOuts Check-out timestamps (one per room)
     */
    function bookMultipleRooms(
        uint256[] calldata _roomIds,
        uint256[] calldata _checkIns,
        uint256[] calldata _checkOuts
    ) external payable whenNotPaused {
        uint256 n = _roomIds.length;
        if (n == 0) revert EmptyBatch();
        if (_checkIns.length != n || _checkOuts.length != n) revert BatchLengthMismatch();

        uint256 running = msg.value;
        uint256 totalCost;

        for (uint256 i = 0; i < n; i++) {
            uint256 c = _createBooking(msg.sender, _roomIds[i], _checkIns[i], _checkOuts[i], running);
            running -= c;
            totalCost += c;
        }

        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit BatchBookingCreated(msg.sender, n, totalCost);
    }

    /**
     * @notice Compute the refund amount for a booking given a current timestamp.
     * @dev Graduated policy:
     *      - > 7 days before check-in  → 100% refund
     *      - 3–7 days before check-in  → 75%
     *      - 1–3 days before check-in  → 50%
     *      - < 24 hours                → 0% (forfeit)
     * @param _bookingId The booking to quote
     * @return refund The amount (in wei) the guest would receive if they cancelled now
     * @return percent The refund tier applied (0, 50, 75 or 100)
     */
    function getRefundAmount(uint256 _bookingId)
        public
        view
        bookingExists(_bookingId)
        returns (uint256 refund, uint256 percent)
    {
        Booking storage b = bookings[_bookingId];
        if (b.checkIn <= block.timestamp) {
            // check-in already passed → no refund quote
            return (0, 0);
        }
        uint256 secondsUntil = b.checkIn - block.timestamp;

        if (secondsUntil > 7 days) {
            percent = REFUND_FULL;
        } else if (secondsUntil > 3 days) {
            percent = REFUND_HIGH;
        } else if (secondsUntil > 1 days) {
            percent = REFUND_MED;
        } else {
            percent = REFUND_NONE;
        }
        refund = (b.totalPrice * percent) / 100;
    }

    /// @notice Cancel a booking and receive a graduated refund
    /// @dev    See {getRefundAmount} for the refund tier policy
    /// @param  _bookingId The booking to cancel
    function cancelBooking(uint256 _bookingId)
        external
        whenNotPaused
        bookingExists(_bookingId)
    {
        Booking storage booking = bookings[_bookingId];

        if (booking.guest != msg.sender && msg.sender != owner) revert NotAuthorized();
        if (booking.status != BookingStatus.Confirmed) revert CannotCancel();
        if (block.timestamp >= booking.checkIn) revert CannotCancelAfterCheckIn();

        booking.status = BookingStatus.Cancelled;

        if (!_hasActiveBookings(booking.roomId)) {
            rooms[booking.roomId].status = RoomStatus.Available;
        }

        (uint256 refundAmount, ) = getRefundAmount(_bookingId);
        if (refundAmount > 0) {
            totalRevenue -= refundAmount;
            payable(booking.guest).transfer(refundAmount);
        }

        emit BookingCancelled(_bookingId, booking.guest, refundAmount);
    }

    /// @notice Admin marks a guest as checked-in for the given booking
    function checkIn(uint256 _bookingId) external onlyOwner whenNotPaused bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        if (booking.status != BookingStatus.Confirmed) revert InvalidBookingStatus();

        booking.status = BookingStatus.CheckedIn;
        emit CheckedIn(_bookingId, booking.guest);
    }

    /// @notice Admin marks a guest as checked-out. If no other active bookings
    ///         remain on the room, its status is set back to Available.
    function checkOut(uint256 _bookingId) external onlyOwner bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        if (booking.status != BookingStatus.CheckedIn) revert NotCheckedIn();

        booking.status = BookingStatus.CheckedOut;

        if (!_hasActiveBookings(booking.roomId)) {
            rooms[booking.roomId].status = RoomStatus.Available;
        }

        emit CheckedOut(_bookingId, booking.guest);
    }

    // ──────────────────────────────────────────────
    //  Review Functions
    // ──────────────────────────────────────────────

    /// @notice Submit a review for a stay that has been fully checked out.
    /// @param _bookingId The booking being reviewed
    /// @param _rating Integer rating from 1 to 5
    /// @param _comment Free-text review content (required, non-empty)
    function submitReview(
        uint256 _bookingId,
        uint8 _rating,
        string memory _comment
    ) external whenNotPaused bookingExists(_bookingId) {
        Booking storage booking = bookings[_bookingId];

        if (msg.sender != booking.guest) revert OnlyGuestCanReview();
        if (booking.status != BookingStatus.CheckedOut) revert CanOnlyReviewAfterCheckout();
        if (bookingReviewed[_bookingId]) revert AlreadyReviewed();
        if (_rating < 1 || _rating > 5) revert InvalidRating();
        if (bytes(_comment).length == 0) revert CommentRequired();

        reviewCount++;
        reviews[reviewCount] = Review({
            id: reviewCount,
            bookingId: _bookingId,
            roomId: booking.roomId,
            guest: msg.sender,
            rating: _rating,
            comment: _comment,
            createdAt: block.timestamp
        });

        bookingReviewed[_bookingId] = true;
        roomReviews[booking.roomId].push(reviewCount);
        roomTotalRating[booking.roomId] += _rating;
        roomReviewCount[booking.roomId]++;

        emit ReviewSubmitted(reviewCount, _bookingId, booking.roomId, msg.sender, _rating);
    }

    /// @notice Get a single review by ID
    function getReview(uint256 _reviewId) external view returns (Review memory) {
        if (_reviewId == 0 || _reviewId > reviewCount) revert ReviewDoesNotExist();
        return reviews[_reviewId];
    }

    /// @notice Get all reviews for a specific room
    function getRoomReviews(uint256 _roomId) external view roomExists(_roomId) returns (Review[] memory) {
        uint256[] storage ids = roomReviews[_roomId];
        Review[] memory result = new Review[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = reviews[ids[i]];
        }
        return result;
    }

    /// @notice Average rating for a room, scaled by 100 (e.g. 450 = 4.50 stars)
    /// @return avgRating Average * 100
    /// @return totalReviews Number of reviews aggregated
    function getRoomAverageRating(uint256 _roomId) external view roomExists(_roomId) returns (
        uint256 avgRating,
        uint256 totalReviews
    ) {
        totalReviews = roomReviewCount[_roomId];
        if (totalReviews > 0) {
            avgRating = (roomTotalRating[_roomId] * 100) / totalReviews;
        }
    }

    // ──────────────────────────────────────────────
    //  Loyalty Functions
    // ──────────────────────────────────────────────

    /// @notice Get a guest's current loyalty state
    /// @return points Running loyalty point total
    /// @return totalBookingsCount Lifetime bookings by this guest
    /// @return hasDiscount True if guest has crossed the discount threshold
    function getLoyaltyInfo(address _guest) external view returns (
        uint256 points,
        uint256 totalBookingsCount,
        bool hasDiscount
    ) {
        points = loyaltyPoints[_guest];
        totalBookingsCount = totalBookingsByGuest[_guest];
        hasDiscount = points >= LOYALTY_DISCOUNT_THRESHOLD;
    }

    /// @notice Quote the price for a hypothetical stay, including loyalty discount
    /// @return finalPrice Total the guest would pay in wei
    /// @return discount Discount amount in wei (0 if not eligible)
    function getDiscountedPrice(
        uint256 _roomId,
        uint256 _nights,
        address _guest
    ) external view roomExists(_roomId) returns (uint256 finalPrice, uint256 discount) {
        uint256 basePrice = _nights * rooms[_roomId].pricePerNight;
        if (loyaltyPoints[_guest] >= LOYALTY_DISCOUNT_THRESHOLD) {
            discount = (basePrice * LOYALTY_DISCOUNT_PERCENT) / 100;
            finalPrice = basePrice - discount;
        } else {
            finalPrice = basePrice;
        }
    }

    // ──────────────────────────────────────────────
    //  Waitlist
    // ──────────────────────────────────────────────

    /// @notice Join the waitlist for a room over a given date range.
    /// @dev    Useful when the desired dates already overlap an existing booking.
    ///         Off-chain listeners can watch {WaitlistJoined} and offer the guest
    ///         the slot if a cancellation occurs.
    function joinWaitlist(
        uint256 _roomId,
        uint256 _checkIn,
        uint256 _checkOut
    ) external whenNotPaused roomExists(_roomId) {
        if (_checkIn < block.timestamp) revert CheckInMustBeFuture();
        if (_checkOut <= _checkIn) revert CheckOutMustBeAfterCheckIn();

        waitlistCount++;
        waitlist[waitlistCount] = WaitlistEntry({
            id: waitlistCount,
            roomId: _roomId,
            guest: msg.sender,
            checkIn: _checkIn,
            checkOut: _checkOut,
            notified: false,
            cleared: false,
            createdAt: block.timestamp
        });
        roomWaitlist[_roomId].push(waitlistCount);
        guestWaitlist[msg.sender].push(waitlistCount);

        emit WaitlistJoined(waitlistCount, _roomId, msg.sender, _checkIn, _checkOut);
    }

    /// @notice Admin hook: flag a waitlist entry as notified (off-chain email/push sent)
    function notifyWaitlist(uint256 _entryId) external onlyOwner {
        if (_entryId == 0 || _entryId > waitlistCount) revert WaitlistEntryDoesNotExist();
        WaitlistEntry storage e = waitlist[_entryId];
        if (e.cleared) revert WaitlistAlreadyCleared();
        e.notified = true;
        emit WaitlistNotified(_entryId, e.roomId, e.guest);
    }

    /// @notice Clear (delete) a waitlist entry. Callable by the guest or owner.
    function clearWaitlist(uint256 _entryId) external {
        if (_entryId == 0 || _entryId > waitlistCount) revert WaitlistEntryDoesNotExist();
        WaitlistEntry storage e = waitlist[_entryId];
        if (msg.sender != e.guest && msg.sender != owner) revert NotAuthorized();
        if (e.cleared) revert WaitlistAlreadyCleared();
        e.cleared = true;
        emit WaitlistCleared(_entryId);
    }

    /// @notice Read all active waitlist entries (not cleared) for a room.
    function getRoomWaitlist(uint256 _roomId)
        external
        view
        roomExists(_roomId)
        returns (WaitlistEntry[] memory)
    {
        uint256[] storage ids = roomWaitlist[_roomId];
        uint256 active;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!waitlist[ids[i]].cleared) active++;
        }
        WaitlistEntry[] memory result = new WaitlistEntry[](active);
        uint256 k;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!waitlist[ids[i]].cleared) {
                result[k++] = waitlist[ids[i]];
            }
        }
        return result;
    }

    /// @notice Fetch IDs of every waitlist entry a guest has joined.
    function getGuestWaitlist(address _guest) external view returns (uint256[] memory) {
        return guestWaitlist[_guest];
    }

    // ──────────────────────────────────────────────
    //  Withdrawal
    // ──────────────────────────────────────────────

    /// @notice Withdraw the entire contract balance to the owner
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        payable(owner).transfer(balance);
        emit FundsWithdrawn(owner, balance);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Get a single room by ID
    function getRoom(uint256 _roomId) external view roomExists(_roomId) returns (Room memory) {
        return rooms[_roomId];
    }

    /// @notice Get a single booking by ID
    function getBooking(uint256 _bookingId) external view bookingExists(_bookingId) returns (Booking memory) {
        return bookings[_bookingId];
    }

    /// @notice All booking IDs that a given guest has ever created
    function getGuestBookings(address _guest) external view returns (uint256[] memory) {
        return guestBookings[_guest];
    }

    /// @notice All booking IDs associated with a given room
    function getRoomBookings(uint256 _roomId) external view returns (uint256[] memory) {
        return roomBookings[_roomId];
    }

    /// @notice Retrieve all rooms (used by the dashboard)
    function getAllRooms() external view returns (Room[] memory) {
        Room[] memory allRooms = new Room[](roomCount);
        for (uint256 i = 1; i <= roomCount; i++) {
            allRooms[i - 1] = rooms[i];
        }
        return allRooms;
    }

    /// @notice Retrieve all bookings (used by the admin dashboard)
    function getAllBookings() external view returns (Booking[] memory) {
        Booking[] memory allBookings = new Booking[](bookingCount);
        for (uint256 i = 1; i <= bookingCount; i++) {
            allBookings[i - 1] = bookings[i];
        }
        return allBookings;
    }

    /// @notice Aggregate stats used by the frontend dashboard.
    /// @return totalRooms Total created rooms
    /// @return availableRooms Rooms currently Available
    /// @return bookedRooms Rooms currently Booked
    /// @return totalBookings Lifetime booking count
    /// @return revenue Net revenue recorded on-chain (in wei)
    /// @return totalReviewsCount Lifetime reviews submitted
    /// @return averageRatingx100 Average rating across all reviews scaled by 100
    function getStats() external view returns (
        uint256 totalRooms,
        uint256 availableRooms,
        uint256 bookedRooms,
        uint256 totalBookings,
        uint256 revenue,
        uint256 totalReviewsCount,
        uint256 averageRatingx100
    ) {
        totalRooms = roomCount;
        totalBookings = bookingCount;
        revenue = totalRevenue;
        totalReviewsCount = reviewCount;

        uint256 ratingSum;
        for (uint256 i = 1; i <= roomCount; i++) {
            if (rooms[i].isActive && rooms[i].status == RoomStatus.Available) {
                availableRooms++;
            } else if (rooms[i].status == RoomStatus.Booked) {
                bookedRooms++;
            }
            ratingSum += roomTotalRating[i];
        }

        if (reviewCount > 0) {
            averageRatingx100 = (ratingSum * 100) / reviewCount;
        }
    }

    /// @notice Transfer contract ownership to a new address
    /// @param _newOwner The incoming owner (must be non-zero)
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = _newOwner;
        emit OwnershipTransferred(previous, _newOwner);
    }

    receive() external payable {}
}
