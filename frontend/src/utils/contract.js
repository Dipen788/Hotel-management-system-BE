import { ethers } from "ethers";
import contractData from "./contractData.json";

const CONTRACT_ADDRESS = contractData.address;
const CONTRACT_ABI = contractData.abi;

// ── Provider & Signer ──

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to use this DApp.");
  }
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getContract(withSigner = false) {
  const provider = await getProvider();
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// ── Wallet Connection ──

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts[0];
}

export async function getConnectedAccount() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  return accounts.length > 0 ? accounts[0] : null;
}

export async function getBalance(address) {
  const provider = await getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// ── Room Functions ──

export async function getAllRooms() {
  const contract = await getContract();
  const rooms = await contract.getAllRooms();
  return rooms.map(parseRoom);
}

export async function createRoom(name, category, priceInEth, imageHash) {
  const contract = await getContract(true);
  const priceInWei = ethers.parseEther(priceInEth.toString());
  const tx = await contract.createRoom(name, category, priceInWei, imageHash);
  await tx.wait();
  return tx;
}

export async function updateRoom(roomId, name, category, priceInEth, status, imageHash) {
  const contract = await getContract(true);
  const priceInWei = ethers.parseEther(priceInEth.toString());
  const tx = await contract.updateRoom(roomId, name, category, priceInWei, status, imageHash);
  await tx.wait();
  return tx;
}

export async function deactivateRoom(roomId) {
  const contract = await getContract(true);
  const tx = await contract.deactivateRoom(roomId);
  await tx.wait();
  return tx;
}

// ── Booking Functions ──

export async function bookRoom(roomId, checkIn, checkOut, totalCostEth) {
  const contract = await getContract(true);
  const value = ethers.parseEther(totalCostEth.toString());
  const tx = await contract.bookRoom(roomId, checkIn, checkOut, { value });
  await tx.wait();
  return tx;
}

export async function cancelBooking(bookingId) {
  const contract = await getContract(true);
  const tx = await contract.cancelBooking(bookingId);
  await tx.wait();
  return tx;
}

export async function checkInGuest(bookingId) {
  const contract = await getContract(true);
  const tx = await contract.checkIn(bookingId);
  await tx.wait();
  return tx;
}

export async function checkOutGuest(bookingId) {
  const contract = await getContract(true);
  const tx = await contract.checkOut(bookingId);
  await tx.wait();
  return tx;
}

export async function getAllBookings() {
  const contract = await getContract();
  const bookings = await contract.getAllBookings();
  return bookings.map(parseBooking);
}

export async function getGuestBookings(address) {
  const contract = await getContract();
  const bookingIds = await contract.getGuestBookings(address);
  const bookingPromises = bookingIds.map((id) => contract.getBooking(id));
  const bookings = await Promise.all(bookingPromises);
  return bookings.map(parseBooking);
}

// ── Stats ──

export async function getStats() {
  const contract = await getContract();
  const stats = await contract.getStats();
  return {
    totalRooms: Number(stats.totalRooms),
    availableRooms: Number(stats.availableRooms),
    bookedRooms: Number(stats.bookedRooms),
    totalBookings: Number(stats.totalBookings),
    revenue: ethers.formatEther(stats.revenue),
  };
}

export async function getOwner() {
  const contract = await getContract();
  return contract.owner();
}

export async function withdrawFunds() {
  const contract = await getContract(true);
  const tx = await contract.withdrawFunds();
  await tx.wait();
  return tx;
}

// ── Parsers ──

function parseRoom(room) {
  return {
    id: Number(room.id),
    name: room.name,
    category: room.category,
    pricePerNight: ethers.formatEther(room.pricePerNight),
    pricePerNightWei: room.pricePerNight.toString(),
    isActive: room.isActive,
    status: Number(room.status),
    statusLabel: ["Available", "Booked", "Maintenance"][Number(room.status)],
    imageHash: room.imageHash,
  };
}

function parseBooking(booking) {
  return {
    id: Number(booking.id),
    roomId: Number(booking.roomId),
    guest: booking.guest,
    checkIn: Number(booking.checkIn),
    checkOut: Number(booking.checkOut),
    totalPrice: ethers.formatEther(booking.totalPrice),
    status: Number(booking.status),
    statusLabel: ["Confirmed", "Checked In", "Checked Out", "Cancelled"][Number(booking.status)],
    createdAt: Number(booking.createdAt),
  };
}

// ── Helpers ──

export function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function calculateNights(checkIn, checkOut) {
  return Math.ceil((checkOut - checkIn) / 86400);
}

export function calculateTotalCost(pricePerNight, nights) {
  return (parseFloat(pricePerNight) * nights).toFixed(6);
}

export { CONTRACT_ADDRESS, CONTRACT_ABI };
