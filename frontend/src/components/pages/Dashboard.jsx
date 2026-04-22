import { useWallet } from "../../contexts/WalletContext";
import { formatDate, shortenAddress, CONTRACT_ADDRESS } from "../../utils/contract";
import { styles as themeStyles, colors } from "../../styles/theme";
import StatusBadge from "../common/StatusBadge";
import CopyableAddress from "../common/CopyableAddress";

// Placeholder explorer URL. Ganache has no public explorer, so we fall back to
// an RPC URL tooltip. When deployed to a real network, override via env.
function explorerUrl(hash) {
  if (!hash) return null;
  const base = process.env.REACT_APP_EXPLORER_BASE;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}

function addressExplorerUrl(addr) {
  if (!addr) return null;
  const base = process.env.REACT_APP_EXPLORER_BASE;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/address/${addr}`;
}

export default function Dashboard({ stats, rooms, bookings, lastTxHash }) {
  const { isOwner, account } = useWallet();

  const statItems = [
    { label: "Total Rooms", value: stats.totalRooms, icon: "\ud83c\udfe0", color: "#818cf8" },
    { label: "Available", value: stats.availableRooms, icon: "\u2713", color: "#34d399" },
    { label: "Booked", value: stats.bookedRooms, icon: "\ud83d\udccb", color: "#fb923c" },
    { label: "Total Bookings", value: stats.totalBookings, icon: "\ud83d\udcca", color: "#a78bfa" },
    { label: "Revenue (ETH)", value: stats.revenue, icon: "\ud83d\udc8e", color: "#38bdf8" },
  ];

  if (stats.totalReviews > 0) {
    statItems.push({
      label: "Avg Rating",
      value: (stats.averageRating / 100).toFixed(1) + " \u2605",
      icon: "\u2b50",
      color: "#fbbf24",
    });
  }

  // Scope recent activity to the current user when not admin.
  const scoped = isOwner
    ? bookings
    : bookings.filter((b) => b.guest.toLowerCase() === (account || "").toLowerCase());
  const recentBookings = [...scoped].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: colors.textDim, fontSize: 14 }}>
          {isOwner ? "Admin overview \u2014 manage your hotel on-chain" : "Welcome to HotelChain DApp"}
        </p>
      </div>

      <div className="responsive-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {statItems.map((s) => (
          <div key={s.label} style={{ ...themeStyles.statCard, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.color, opacity: 0.05 }} />
            <div style={{ fontSize: 13, color: colors.textDim, marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ position: "absolute", top: 16, right: 16, fontSize: 20 }}>{s.icon}</div>
          </div>
        ))}
      </div>

      <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={themeStyles.card}>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Network Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: colors.textDim }}>Network</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Ganache (Local)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: colors.textDim }}>Chain ID</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>1337</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: colors.textDim }}>Contract</span>
                <CopyableAddress value={CONTRACT_ADDRESS} explorerUrl={addressExplorerUrl(CONTRACT_ADDRESS)} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: colors.textDim }}>Your wallet</span>
                <CopyableAddress value={account} explorerUrl={addressExplorerUrl(account)} />
              </div>
            </div>
          </div>
        </div>

        <div style={themeStyles.card}>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              {isOwner ? "Recent Activity" : "Your Recent Bookings"}
            </h3>
            {recentBookings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: colors.textFaint }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{"\ud83d\udcdd"}</div>
                <p style={{ fontSize: 13 }}>No bookings yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recentBookings.map((b) => {
                  const room = rooms.find((r) => r.id === b.roomId);
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 12px", borderRadius: 8, background: colors.bg,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {room?.name || `Room #${b.roomId}`}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textDim, display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{formatDate(b.checkIn)}</span>
                          <span>{"\u2192"}</span>
                          <span>{formatDate(b.checkOut)}</span>
                          {isOwner && (
                            <span style={{ marginLeft: 6, fontFamily: "monospace" }}>{shortenAddress(b.guest)}</span>
                          )}
                        </div>
                      </div>
                      <StatusBadge label={b.statusLabel} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {lastTxHash && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 10,
          background: colors.purpleBg, border: `1px solid ${colors.purpleBorder}`,
          fontSize: 12, color: colors.primaryLight,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span>Last transaction:</span>
          <CopyableAddress value={lastTxHash} explorerUrl={explorerUrl(lastTxHash)} />
        </div>
      )}
    </div>
  );
}
