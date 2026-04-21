import { useState, useEffect, useCallback } from "react";
import {
  getAllRooms,
  getAllBookings,
  getStats,
  createRoom as contractCreateRoom,
  bookRoom as contractBookRoom,
  cancelBooking as contractCancelBooking,
  checkInGuest,
  checkOutGuest,
  deactivateRoom as contractDeactivateRoom,
  withdrawFunds as contractWithdrawFunds,
  submitReview as contractSubmitReview,
  getRoomReviews as contractGetRoomReviews,
  getRoomAverageRating as contractGetRoomAverageRating,
  getLoyaltyInfo as contractGetLoyaltyInfo,
  getDiscountedPrice as contractGetDiscountedPrice,
} from "../utils/contract";
import { saveBookingMeta, mirrorReview } from "../utils/api";
import { useToast } from "../contexts/ToastContext";
import { useWallet } from "../contexts/WalletContext";

export default function useContract() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({ totalRooms: 0, availableRooms: 0, bookedRooms: 0, totalBookings: 0, revenue: "0", totalReviews: 0, averageRating: 0 });
  const [loyaltyInfo, setLoyaltyInfo] = useState({ points: 0, totalBookings: 0, hasDiscount: false });
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [txMessage, setTxMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState(null);
  const { showToast } = useToast();
  const { account, refreshBalance } = useWallet();

  // ── Load all data from blockchain ──
  const loadData = useCallback(async () => {
    try {
      const [roomsData, bookingsData, statsData] = await Promise.all([
        getAllRooms(),
        getAllBookings(),
        getStats(),
      ]);
      setRooms(roomsData);
      setBookings(bookingsData);
      setStats(statsData);

      if (account) {
        try {
          const loyalty = await contractGetLoyaltyInfo(account);
          setLoyaltyInfo(loyalty);
        } catch {
          // contract may not support this yet
        }
      }
    } catch (err) {
      showToast("Failed to load blockchain data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [account, showToast]);

  useEffect(() => {
    if (account) {
      loadData();
    }
  }, [account, loadData]);

  // ── Transaction wrapper ──
  const execTx = useCallback(async (fn, pendingMsg, successMsg) => {
    setTxPending(true);
    setTxMessage(pendingMsg);
    try {
      const tx = await fn();
      setLastTxHash(tx.hash);
      setTxMessage("Transaction confirmed!");
      showToast(successMsg);
      await loadData();
      if (refreshBalance) refreshBalance();
    } catch (err) {
      const msg = err.reason || err.message || "Transaction failed";
      showToast(msg, "error");
    } finally {
      setTxPending(false);
      setTxMessage("");
    }
  }, [showToast, loadData, refreshBalance]);

  // ── Room Actions ──
  const createRoom = useCallback(async (name, category, priceInEth) => {
    await execTx(
      () => contractCreateRoom(name, category, priceInEth, ""),
      "Creating room on-chain...",
      `Room "${name}" created successfully!`
    );
  }, [execTx]);

  const deactivateRoom = useCallback(async (roomId) => {
    await execTx(
      () => contractDeactivateRoom(roomId),
      "Deactivating room...",
      "Room deactivated"
    );
  }, [execTx]);

  // ── Booking Actions ──
  // `guestMeta` is optional off-chain detail (name/email/phone/etc.) that is
  // stored in the backend after the on-chain tx confirms. Backend is best-effort;
  // a failure there does not roll back the on-chain booking.
  const bookRoomAction = useCallback(async (roomId, checkIn, checkOut, totalCostEth, guestMeta) => {
    setTxPending(true);
    setTxMessage("Booking room on-chain...");
    try {
      const tx = await contractBookRoom(roomId, checkIn, checkOut, totalCostEth);
      setLastTxHash(tx.hash);
      setTxMessage("Transaction confirmed!");
      showToast("Room booked successfully!");
      await loadData();
      if (refreshBalance) refreshBalance();

      // Best-effort off-chain metadata sync
      if (guestMeta && account) {
        try {
          const bookings = await getAllBookings();
          const mine = bookings.filter((b) => b.guest.toLowerCase() === account.toLowerCase());
          const latest = mine[mine.length - 1];
          if (latest) {
            await saveBookingMeta({
              bookingId: latest.id,
              walletAddress: account,
              txHash: tx.hash,
              ...guestMeta,
            });
          }
        } catch {
          // backend optional — never block on this
        }
      }
    } catch (err) {
      const msg = err.reason || err.message || "Transaction failed";
      showToast(msg, "error");
    } finally {
      setTxPending(false);
      setTxMessage("");
    }
  }, [showToast, loadData, refreshBalance, account]);

  const cancelBookingAction = useCallback(async (bookingId) => {
    await execTx(
      () => contractCancelBooking(bookingId),
      "Cancelling booking...",
      "Booking cancelled. 90% refund sent!"
    );
  }, [execTx]);

  const checkIn = useCallback(async (bookingId) => {
    await execTx(
      () => checkInGuest(bookingId),
      "Checking in guest...",
      "Guest checked in!"
    );
  }, [execTx]);

  const checkOut = useCallback(async (bookingId) => {
    await execTx(
      () => checkOutGuest(bookingId),
      "Checking out guest...",
      "Guest checked out. Room is now available!"
    );
  }, [execTx]);

  // ── Admin Actions ──
  const withdrawFunds = useCallback(async () => {
    await execTx(
      () => contractWithdrawFunds(),
      "Withdrawing funds...",
      "Funds withdrawn to owner wallet!"
    );
  }, [execTx]);

  // ── Review Actions ──
  // Submits on-chain, then mirrors to backend cache (best-effort).
  const submitReview = useCallback(async (bookingId, rating, comment) => {
    setTxPending(true);
    setTxMessage("Submitting review on-chain...");
    try {
      const tx = await contractSubmitReview(bookingId, rating, comment);
      setLastTxHash(tx.hash);
      setTxMessage("Transaction confirmed!");
      showToast("Review submitted!");
      await loadData();
      if (refreshBalance) refreshBalance();

      // Backend mirror (optional)
      if (account) {
        try {
          const booking = bookings.find((b) => b.id === bookingId);
          if (booking) {
            await mirrorReview({
              reviewId: Date.now(), // backend upserts; real id resolved from on-chain events if needed
              bookingId,
              roomId: booking.roomId,
              walletAddress: account,
              rating,
              comment,
              onChainCreatedAt: Math.floor(Date.now() / 1000),
            });
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      const msg = err.reason || err.message || "Transaction failed";
      showToast(msg, "error");
    } finally {
      setTxPending(false);
      setTxMessage("");
    }
  }, [showToast, loadData, refreshBalance, account, bookings]);

  const getRoomReviews = useCallback(async (roomId) => {
    try {
      return await contractGetRoomReviews(roomId);
    } catch {
      return [];
    }
  }, []);

  const getRoomRating = useCallback(async (roomId) => {
    try {
      return await contractGetRoomAverageRating(roomId);
    } catch {
      return { avgRating: 0, totalReviews: 0 };
    }
  }, []);

  const getDiscountedPrice = useCallback(async (roomId, nights) => {
    if (!account) return null;
    try {
      return await contractGetDiscountedPrice(roomId, nights, account);
    } catch {
      return null;
    }
  }, [account]);

  return {
    rooms, bookings, stats, loyaltyInfo,
    loading, txPending, txMessage, lastTxHash,
    loadData,
    createRoom, deactivateRoom,
    bookRoom: bookRoomAction, cancelBooking: cancelBookingAction,
    checkIn, checkOut,
    withdrawFunds,
    submitReview, getRoomReviews, getRoomRating, getDiscountedPrice,
  };
}
