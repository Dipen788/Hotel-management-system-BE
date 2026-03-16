import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  HOTEL DAPP — Decentralized Hotel Management System
//  CN6035 Mobile & Distributed Systems — University of East London
//  Stack: React + Ethers.js + Solidity (Hardhat/Ganache)
// ═══════════════════════════════════════════════════════════════

// ── Mock ethers for demo (replace with real ethers.js import in production) ──
const ethers = {
  formatEther: (wei) => (Number(wei) / 1e18).toFixed(4),
  parseEther: (eth) => BigInt(Math.floor(Number(eth) * 1e18)),
};

// ── Demo Data ──
const DEMO_ROOMS = [
  { id: 1, name: "Ocean View Standard", category: "Standard", pricePerNight: "0.0100", isActive: true, status: 0, statusLabel: "Available", imageHash: "" },
  { id: 2, name: "Garden Deluxe Suite", category: "Deluxe", pricePerNight: "0.0250", isActive: true, status: 0, statusLabel: "Available", imageHash: "" },
  { id: 3, name: "Penthouse Royal Suite", category: "Suite", pricePerNight: "0.0500", isActive: true, status: 0, statusLabel: "Available", imageHash: "" },
  { id: 4, name: "City View Standard", category: "Standard", pricePerNight: "0.0120", isActive: true, status: 0, statusLabel: "Available", imageHash: "" },
  { id: 5, name: "Lakeside Deluxe", category: "Deluxe", pricePerNight: "0.0300", isActive: true, status: 1, statusLabel: "Booked", imageHash: "" },
];

const DEMO_BOOKINGS = [
  { id: 1, roomId: 5, guest: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", checkIn: Math.floor(Date.now()/1000) + 86400, checkOut: Math.floor(Date.now()/1000) + 86400*3, totalPrice: "0.0600", status: 0, statusLabel: "Confirmed", createdAt: Math.floor(Date.now()/1000) - 3600 },
];

// ── Utility Functions ──
const shortenAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
const formatDate = (ts) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const formatDateTime = (ts) => new Date(ts * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const calcNights = (checkIn, checkOut) => Math.max(1, Math.ceil((checkOut - checkIn) / 86400));
const calcCost = (price, nights) => (parseFloat(price) * nights).toFixed(4);

const ROOM_IMAGES = {
  Standard: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop",
  Deluxe: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop",
  Suite: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&h=400&fit=crop",
};

const STATUS_COLORS = {
  Available: { bg: "#0d3320", text: "#34d399", dot: "#10b981" },
  Booked: { bg: "#3b1d0b", text: "#fb923c", dot: "#f97316" },
  Maintenance: { bg: "#3b0b0b", text: "#f87171", dot: "#ef4444" },
  Confirmed: { bg: "#1e1b4b", text: "#a78bfa", dot: "#8b5cf6" },
  "Checked In": { bg: "#0d3320", text: "#34d399", dot: "#10b981" },
  "Checked Out": { bg: "#1a1a2e", text: "#94a3b8", dot: "#64748b" },
  Cancelled: { bg: "#3b0b0b", text: "#f87171", dot: "#ef4444" },
};

// ═══════════════════════════════════════════════════════════════
//  MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function HotelDApp() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isOwner, setIsOwner] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [rooms, setRooms] = useState(DEMO_ROOMS);
  const [bookings, setBookings] = useState(DEMO_BOOKINGS);
  const [stats, setStats] = useState({ totalRooms: 5, availableRooms: 4, bookedRooms: 1, totalBookings: 1, revenue: "0.0600" });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Simulated wallet connect ──
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setAccount(accounts[0]);
        const bal = await window.ethereum.request({ method: "eth_getBalance", params: [accounts[0], "latest"] });
        setBalance((parseInt(bal, 16) / 1e18).toFixed(4));
        setIsOwner(true); // For demo: first connected account is owner
        showToast("Wallet connected successfully!");
      } else {
        // Demo mode
        const demoAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        setAccount(demoAddr);
        setBalance("99.9500");
        setIsOwner(true);
        showToast("Connected in demo mode (no MetaMask detected)");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance("0");
    setIsOwner(false);
    showToast("Wallet disconnected");
  };

  // ── Room CRUD (demo) ──
  const handleCreateRoom = (roomData) => {
    const newRoom = {
      id: rooms.length + 1,
      ...roomData,
      isActive: true,
      status: 0,
      statusLabel: "Available",
      imageHash: "",
    };
    setRooms([...rooms, newRoom]);
    setStats(s => ({ ...s, totalRooms: s.totalRooms + 1, availableRooms: s.availableRooms + 1 }));
    setTxHash("0x" + Math.random().toString(16).slice(2, 66));
    showToast(`Room "${roomData.name}" created on-chain!`);
  };

  const handleBookRoom = (roomId, checkIn, checkOut) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.status !== 0) return showToast("Room not available", "error");
    const nights = calcNights(checkIn, checkOut);
    const totalPrice = calcCost(room.pricePerNight, nights);

    const newBooking = {
      id: bookings.length + 1,
      roomId,
      guest: account,
      checkIn,
      checkOut,
      totalPrice,
      status: 0,
      statusLabel: "Confirmed",
      createdAt: Math.floor(Date.now() / 1000),
    };

    setBookings([...bookings, newBooking]);
    setRooms(rooms.map(r => r.id === roomId ? { ...r, status: 1, statusLabel: "Booked" } : r));
    setStats(s => ({
      ...s,
      availableRooms: s.availableRooms - 1,
      bookedRooms: s.bookedRooms + 1,
      totalBookings: s.totalBookings + 1,
      revenue: (parseFloat(s.revenue) + parseFloat(totalPrice)).toFixed(4),
    }));
    setTxHash("0x" + Math.random().toString(16).slice(2, 66));
    showToast(`Room booked! ${nights} night(s) for ${totalPrice} ETH`);
  };

  const handleCancelBooking = (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    const refund = (parseFloat(booking.totalPrice) * 0.9).toFixed(4);
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 3, statusLabel: "Cancelled" } : b));
    setRooms(rooms.map(r => r.id === booking.roomId ? { ...r, status: 0, statusLabel: "Available" } : r));
    setStats(s => ({
      ...s,
      availableRooms: s.availableRooms + 1,
      bookedRooms: s.bookedRooms - 1,
      revenue: (parseFloat(s.revenue) - parseFloat(refund)).toFixed(4),
    }));
    showToast(`Booking cancelled. Refund: ${refund} ETH (90%)`);
  };

  const handleCheckIn = (bookingId) => {
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 1, statusLabel: "Checked In" } : b));
    showToast("Guest checked in!");
  };

  const handleCheckOut = (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 2, statusLabel: "Checked Out" } : b));
    if (booking) {
      setRooms(rooms.map(r => r.id === booking.roomId ? { ...r, status: 0, statusLabel: "Available" } : r));
      setStats(s => ({ ...s, availableRooms: s.availableRooms + 1, bookedRooms: s.bookedRooms - 1 }));
    }
    showToast("Guest checked out. Room now available!");
  };

  const handleDeactivateRoom = (roomId) => {
    setRooms(rooms.map(r => r.id === roomId ? { ...r, isActive: false, status: 2, statusLabel: "Maintenance" } : r));
    showToast("Room deactivated");
  };

  // ═══ STYLES ═══
  const styles = {
    app: { minHeight: "100vh", background: "#09090b", color: "#e4e4e7", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" },
    nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)", borderBottom: "1px solid #27272a", position: "sticky", top: 0, zIndex: 50 },
    logo: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" },
    logoIcon: { width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff" },
    logoText: { fontSize: 22, fontWeight: 700, background: "linear-gradient(135deg, #a78bfa, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    navLinks: { display: "flex", gap: 8 },
    navLink: (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "#27272a" : "transparent", color: active ? "#fff" : "#a1a1aa", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }),
    walletBtn: { padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" },
    walletInfo: { display: "flex", alignItems: "center", gap: 12, background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: "8px 16px" },
    container: { maxWidth: 1280, margin: "0 auto", padding: "32px 24px" },
    grid: (cols) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20 }),
    card: { background: "#18181b", borderRadius: 16, border: "1px solid #27272a", overflow: "hidden", transition: "all 0.3s" },
    statCard: { background: "#18181b", borderRadius: 16, border: "1px solid #27272a", padding: 24 },
    badge: (label) => {
      const c = STATUS_COLORS[label] || { bg: "#27272a", text: "#a1a1aa", dot: "#71717a" };
      return { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: c.bg, color: c.text, fontSize: 12, fontWeight: 600 };
    },
    dot: (label) => {
      const c = STATUS_COLORS[label] || { dot: "#71717a" };
      return { width: 6, height: 6, borderRadius: "50%", background: c.dot };
    },
    btn: (variant = "primary") => {
      const variants = {
        primary: { background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff" },
        secondary: { background: "#27272a", color: "#e4e4e7" },
        danger: { background: "#7f1d1d", color: "#fca5a5" },
        success: { background: "#14532d", color: "#86efac" },
        ghost: { background: "transparent", color: "#a1a1aa", border: "1px solid #27272a" },
      };
      return { padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s", ...variants[variant] };
    },
    input: { width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #27272a", background: "#09090b", color: "#e4e4e7", fontSize: 14, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #27272a", background: "#09090b", color: "#e4e4e7", fontSize: 14, outline: "none", boxSizing: "border-box" },
    label: { display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: "#a1a1aa" },
    toastContainer: { position: "fixed", top: 20, right: 20, zIndex: 1000 },
    toast: (type) => ({
      padding: "14px 20px",
      borderRadius: 12,
      background: type === "error" ? "#7f1d1d" : "#14532d",
      color: type === "error" ? "#fca5a5" : "#86efac",
      fontSize: 14,
      fontWeight: 500,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      border: `1px solid ${type === "error" ? "#991b1b" : "#166534"}`,
      animation: "slideIn 0.3s ease",
    }),
    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    modal: { background: "#18181b", borderRadius: 20, border: "1px solid #27272a", padding: 32, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" },
    txLink: { fontSize: 12, color: "#818cf8", textDecoration: "none", wordBreak: "break-all" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #27272a" },
    td: { padding: "14px 16px", borderBottom: "1px solid #27272a10", fontSize: 14 },
  };

  // ═══ RENDER ═══
  return (
    <div style={styles.app}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #09090b; } ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        button:hover { filter: brightness(1.1); transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={styles.toastContainer}>
          <div style={styles.toast(toast.type)}>{toast.type === "error" ? "✕ " : "✓ "}{toast.msg}</div>
        </div>
      )}

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.logo} onClick={() => setPage("dashboard")}>
          <div style={styles.logoIcon}>H</div>
          <span style={styles.logoText}>HotelChain DApp</span>
        </div>

        <div style={styles.navLinks}>
          {["dashboard", "rooms", "bookings", ...(isOwner ? ["admin"] : [])].map(p => (
            <button key={p} style={styles.navLink(page === p)} onClick={() => setPage(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div>
          {account ? (
            <div style={styles.walletInfo}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{shortenAddress(account)}</div>
                <div style={{ fontSize: 11, color: "#71717a" }}>{balance} ETH</div>
              </div>
              <button style={{ ...styles.btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={disconnectWallet}>
                Disconnect
              </button>
            </div>
          ) : (
            <button style={styles.walletBtn} onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div style={styles.container}>
        {!account && <ConnectPrompt onConnect={connectWallet} />}
        {account && page === "dashboard" && <Dashboard stats={stats} rooms={rooms} bookings={bookings} styles={styles} txHash={txHash} isOwner={isOwner} />}
        {account && page === "rooms" && <RoomsPage rooms={rooms} account={account} isOwner={isOwner} onBook={handleBookRoom} onDeactivate={handleDeactivateRoom} styles={styles} showToast={showToast} />}
        {account && page === "bookings" && <BookingsPage bookings={bookings} rooms={rooms} account={account} isOwner={isOwner} onCancel={handleCancelBooking} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} styles={styles} />}
        {account && page === "admin" && isOwner && <AdminPage rooms={rooms} bookings={bookings} stats={stats} onCreate={handleCreateRoom} onDeactivate={handleDeactivateRoom} styles={styles} showToast={showToast} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CONNECT PROMPT
// ═══════════════════════════════════════════════════════════════
function ConnectPrompt({ onConnect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", animation: "fadeIn 0.5s ease" }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg, #7c3aed, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 24 }}>
        🏨
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, background: "linear-gradient(135deg, #a78bfa, #818cf8, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        HotelChain DApp
      </h1>
      <p style={{ fontSize: 16, color: "#71717a", maxWidth: 480, marginBottom: 32, lineHeight: 1.6 }}>
        A decentralized hotel management system built on Ethereum. Book rooms, manage bookings, and handle payments — all on-chain with full transparency.
      </p>
      <button onClick={onConnect} style={{ padding: "14px 40px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", boxShadow: "0 4px 24px rgba(124,58,237,0.3)" }}>
        Connect MetaMask
      </button>
      <p style={{ marginTop: 16, fontSize: 13, color: "#52525b" }}>
        Supports Ganache local network • Hardhat localhost • Ethereum testnets
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ stats, rooms, bookings, styles, txHash, isOwner }) {
  const statItems = [
    { label: "Total Rooms", value: stats.totalRooms, icon: "🏠", color: "#818cf8" },
    { label: "Available", value: stats.availableRooms, icon: "✓", color: "#34d399" },
    { label: "Booked", value: stats.bookedRooms, icon: "📋", color: "#fb923c" },
    { label: "Total Bookings", value: stats.totalBookings, icon: "📊", color: "#a78bfa" },
    { label: "Revenue (ETH)", value: stats.revenue, icon: "💎", color: "#38bdf8" },
  ];

  const recentBookings = [...bookings].reverse().slice(0, 5);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#71717a", fontSize: 14 }}>
          {isOwner ? "Admin overview — manage your hotel on-chain" : "Welcome to HotelChain DApp"}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {statItems.map(s => (
          <div key={s.label} style={{ ...styles.statCard, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.color, opacity: 0.05 }} />
            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ position: "absolute", top: 16, right: 16, fontSize: 20 }}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Network Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={styles.card}>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Network Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Network", value: "Ganache (Local)" },
                { label: "Chain ID", value: "1337" },
                { label: "Contract", value: "0x5FbD...0aa3" },
                { label: "Block Explorer", value: "localhost:7545" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#71717a" }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h3>
            {recentBookings.length === 0 ? (
              <p style={{ fontSize: 13, color: "#52525b" }}>No bookings yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recentBookings.map(b => {
                  const room = rooms.find(r => r.id === b.roomId);
                  return (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "#09090b" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{room?.name || `Room #${b.roomId}`}</div>
                        <div style={{ fontSize: 11, color: "#71717a" }}>{shortenAddress(b.guest)}</div>
                      </div>
                      <div style={styles.badge(b.statusLabel)}>
                        <div style={styles.dot(b.statusLabel)} />
                        {b.statusLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Last TX */}
      {txHash && (
        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "#1e1b4b", border: "1px solid #312e81", fontSize: 12, color: "#a78bfa" }}>
          Last Tx: <span style={{ fontFamily: "monospace" }}>{txHash}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOMS PAGE
// ═══════════════════════════════════════════════════════════════
function RoomsPage({ rooms, account, isOwner, onBook, onDeactivate, styles, showToast }) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const filteredRooms = rooms.filter(r => {
    if (filter === "available") return r.status === 0 && r.isActive;
    if (filter === "booked") return r.status === 1;
    return r.isActive;
  });

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Rooms</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>Browse and book available rooms</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "available", "booked"].map(f => (
            <button key={f} style={styles.navLink(filter === f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {filteredRooms.map(room => (
          <div key={room.id} style={{ ...styles.card, cursor: "pointer" }} onClick={() => { setSelectedRoom(room); if (room.status === 0) setBookingModal(true); }}>
            <div style={{ height: 200, background: `url(${ROOM_IMAGES[room.category] || ROOM_IMAGES.Standard}) center/cover`, position: "relative" }}>
              <div style={{ position: "absolute", top: 12, left: 12, ...styles.badge(room.statusLabel) }}>
                <div style={styles.dot(room.statusLabel)} />
                {room.statusLabel}
              </div>
              <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(0,0,0,0.6)", color: "#e4e4e7", fontSize: 12, fontWeight: 600 }}>
                {room.category}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{room.name}</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#818cf8" }}>{room.pricePerNight}</span>
                  <span style={{ fontSize: 13, color: "#71717a", marginLeft: 4 }}>ETH / night</span>
                </div>
                {room.status === 0 && room.isActive && (
                  <button style={styles.btn("primary")} onClick={(e) => { e.stopPropagation(); setSelectedRoom(room); setBookingModal(true); }}>
                    Book Now
                  </button>
                )}
              </div>
              {isOwner && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #27272a", display: "flex", gap: 8 }}>
                  <button style={{ ...styles.btn("danger"), padding: "6px 12px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onDeactivate(room.id); }}>
                    Deactivate
                  </button>
                  <span style={{ fontSize: 11, color: "#52525b", alignSelf: "center" }}>ID: {room.id}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {bookingModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          styles={styles}
          onClose={() => setBookingModal(false)}
          onBook={(checkIn, checkOut) => {
            onBook(selectedRoom.id, checkIn, checkOut);
            setBookingModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Booking Modal ──
function BookingModal({ room, styles, onClose, onBook }) {
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const checkInTs = checkInDate ? Math.floor(new Date(checkInDate).getTime() / 1000) : 0;
  const checkOutTs = checkOutDate ? Math.floor(new Date(checkOutDate).getTime() / 1000) : 0;
  const nights = checkInTs && checkOutTs && checkOutTs > checkInTs ? calcNights(checkInTs, checkOutTs) : 0;
  const totalCost = nights > 0 ? calcCost(room.pricePerNight, nights) : "0.0000";

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Book Room</h2>
          <button style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 20 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 16, borderRadius: 12, background: "#09090b", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{room.name}</div>
          <div style={{ fontSize: 13, color: "#71717a" }}>{room.category} • {room.pricePerNight} ETH/night</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={styles.label}>Check-in Date</label>
            <input type="date" min={today} value={checkInDate} onChange={e => setCheckInDate(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Check-out Date</label>
            <input type="date" min={checkInDate || today} value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} style={styles.input} />
          </div>
        </div>

        {nights > 0 && (
          <div style={{ padding: 16, borderRadius: 12, background: "#1e1b4b", border: "1px solid #312e81", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#a78bfa" }}>{room.pricePerNight} ETH × {nights} night{nights > 1 ? "s" : ""}</span>
              <span style={{ fontSize: 13, color: "#a78bfa" }}>{totalCost} ETH</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #312e81" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#818cf8" }}>{totalCost} ETH</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ ...styles.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.btn("primary"), flex: 2, opacity: nights > 0 ? 1 : 0.4 }}
            disabled={nights <= 0}
            onClick={() => onBook(checkInTs, checkOutTs)}
          >
            Confirm & Pay {nights > 0 ? `${totalCost} ETH` : ""}
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 11, color: "#52525b", textAlign: "center" }}>
          Payment is processed on-chain via smart contract. 90% refund on cancellation.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BOOKINGS PAGE
// ═══════════════════════════════════════════════════════════════
function BookingsPage({ bookings, rooms, account, isOwner, onCancel, onCheckIn, onCheckOut, styles }) {
  const [filter, setFilter] = useState("all");

  const myBookings = isOwner ? bookings : bookings.filter(b => b.guest.toLowerCase() === account.toLowerCase());
  const filtered = myBookings.filter(b => {
    if (filter === "active") return b.status === 0 || b.status === 1;
    if (filter === "past") return b.status === 2 || b.status === 3;
    return true;
  });

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>{isOwner ? "All Bookings" : "My Bookings"}</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>{filtered.length} booking(s) found</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "active", "past"].map(f => (
            <button key={f} style={styles.navLink(filter === f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#52525b" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No bookings found</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Book a room to get started</p>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Room</th>
                  {isOwner && <th style={styles.th}>Guest</th>}
                  <th style={styles.th}>Check-in</th>
                  <th style={styles.th}>Check-out</th>
                  <th style={styles.th}>Total (ETH)</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const room = rooms.find(r => r.id === b.roomId);
                  return (
                    <tr key={b.id}>
                      <td style={styles.td}>#{b.id}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{room?.name || `Room #${b.roomId}`}</td>
                      {isOwner && <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>{shortenAddress(b.guest)}</td>}
                      <td style={styles.td}>{formatDate(b.checkIn)}</td>
                      <td style={styles.td}>{formatDate(b.checkOut)}</td>
                      <td style={{ ...styles.td, fontWeight: 700, color: "#818cf8" }}>{b.totalPrice}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(b.statusLabel)}>
                          <span style={styles.dot(b.statusLabel)} />
                          {b.statusLabel}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {b.status === 0 && (
                            <>
                              {isOwner && <button style={{ ...styles.btn("success"), padding: "4px 10px", fontSize: 12 }} onClick={() => onCheckIn(b.id)}>Check In</button>}
                              <button style={{ ...styles.btn("danger"), padding: "4px 10px", fontSize: 12 }} onClick={() => onCancel(b.id)}>Cancel</button>
                            </>
                          )}
                          {b.status === 1 && isOwner && (
                            <button style={{ ...styles.btn("secondary"), padding: "4px 10px", fontSize: 12 }} onClick={() => onCheckOut(b.id)}>Check Out</button>
                          )}
                          {(b.status === 2 || b.status === 3) && (
                            <span style={{ fontSize: 12, color: "#52525b" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN PAGE
// ═══════════════════════════════════════════════════════════════
function AdminPage({ rooms, bookings, stats, onCreate, onDeactivate, styles, showToast }) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin Panel</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>Manage rooms, bookings, and revenue</p>
        </div>
        <button style={styles.btn("primary")} onClick={() => setShowCreateModal(true)}>
          + Create Room
        </button>
      </div>

      {/* Admin Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ ...styles.statCard, borderLeft: "3px solid #818cf8" }}>
          <div style={{ fontSize: 12, color: "#71717a", marginBottom: 4 }}>Contract Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#818cf8" }}>{stats.revenue} ETH</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "3px solid #34d399" }}>
          <div style={{ fontSize: 12, color: "#71717a", marginBottom: 4 }}>Active Bookings</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#34d399" }}>
            {bookings.filter(b => b.status === 0 || b.status === 1).length}
          </div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "3px solid #fb923c" }}>
          <div style={{ fontSize: 12, color: "#71717a", marginBottom: 4 }}>Cancellations</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fb923c" }}>
            {bookings.filter(b => b.status === 3).length}
          </div>
        </div>
      </div>

      {/* Room Management Table */}
      <div style={styles.card}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #27272a" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Room Inventory</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Room Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Price (ETH)</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id}>
                  <td style={styles.td}>#{room.id}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{room.name}</td>
                  <td style={styles.td}>{room.category}</td>
                  <td style={{ ...styles.td, fontWeight: 700, color: "#818cf8" }}>{room.pricePerNight}</td>
                  <td style={styles.td}>
                    <span style={styles.badge(room.statusLabel)}>
                      <span style={styles.dot(room.statusLabel)} />
                      {room.statusLabel}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: room.isActive ? "#34d399" : "#f87171" }}>
                      {room.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {room.isActive && (
                      <button style={{ ...styles.btn("danger"), padding: "4px 10px", fontSize: 12 }} onClick={() => onDeactivate(room.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw */}
      <div style={{ marginTop: 16 }}>
        <button style={{ ...styles.btn("success"), width: "100%" }} onClick={() => showToast("Funds withdrawn to owner wallet!")}>
          Withdraw All Funds ({stats.revenue} ETH)
        </button>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          styles={styles}
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => { onCreate(data); setShowCreateModal(false); }}
        />
      )}
    </div>
  );
}

// ── Create Room Modal ──
function CreateRoomModal({ styles, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Standard");
  const [price, setPrice] = useState("");

  const handleSubmit = () => {
    if (!name || !price || parseFloat(price) <= 0) return;
    onCreate({ name, category, pricePerNight: parseFloat(price).toFixed(4) });
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Create New Room</h2>
          <button style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 20 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={styles.label}>Room Name</label>
            <input style={styles.input} placeholder="e.g. Mountain View Deluxe" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Category</label>
            <select style={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Standard">Standard</option>
              <option value="Deluxe">Deluxe</option>
              <option value="Suite">Suite</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Price per Night (ETH)</label>
            <input style={styles.input} type="number" step="0.001" min="0.001" placeholder="0.01" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button style={{ ...styles.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...styles.btn("primary"), flex: 2, opacity: name && price ? 1 : 0.4 }} disabled={!name || !price} onClick={handleSubmit}>
            Create Room (Tx)
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 11, color: "#52525b", textAlign: "center" }}>
          This will send a transaction to the HotelBooking smart contract
        </p>
      </div>
    </div>
  );
}
