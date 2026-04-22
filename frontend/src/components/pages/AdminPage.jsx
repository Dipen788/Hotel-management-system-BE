import { useState } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { styles as themeStyles, colors, gradients } from "../../styles/theme";
import { CONTRACT_ADDRESS } from "../../utils/contract";
import Modal from "../common/Modal";

export default function AdminPage({ stats, rooms, bookings, onCreateRoom, onWithdraw }) {
  const { isOwner, account } = useWallet();
  const [createOpen, setCreateOpen] = useState(false);

  if (!isOwner) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px", animation: "fadeIn 0.4s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{"\ud83d\udd12"}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Admin Access Only</h2>
        <p style={{ color: colors.textDim, fontSize: 14 }}>Connect with the contract owner wallet to access this page.</p>
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => b.status === 0 || b.status === 1).length;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin Panel</h1>
        <p style={{ color: colors.textDim, fontSize: 14 }}>Manage rooms, check guests in/out, withdraw revenue</p>
      </div>

      {/* Revenue Card */}
      <div style={{
        ...themeStyles.card, padding: 24, marginBottom: 24,
        background: gradients.primary, border: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500, marginBottom: 4 }}>Contract Balance</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{stats.revenue} ETH</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4, fontFamily: "monospace" }}>
              {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
            </div>
          </div>
          <button
            style={{
              padding: "12px 24px", borderRadius: 12, border: "none",
              background: "#fff", color: colors.primary, cursor: "pointer",
              fontSize: 14, fontWeight: 700,
              opacity: parseFloat(stats.revenue) > 0 ? 1 : 0.5,
            }}
            disabled={parseFloat(stats.revenue) <= 0}
            onClick={onWithdraw}
          >
            Withdraw Funds
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Rooms", value: stats.totalRooms },
          { label: "Active Bookings", value: activeBookings },
          { label: "Total Bookings", value: stats.totalBookings },
          { label: "Total Reviews", value: stats.totalReviews },
        ].map((s) => (
          <div key={s.label} style={{ ...themeStyles.statCard, padding: 16 }}>
            <div style={{ fontSize: 12, color: colors.textDim }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.indigoLight, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Occupancy chart */}
      {rooms.length > 0 && (
        <div style={{ ...themeStyles.card, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Bookings per Room</h3>
          <OccupancyChart rooms={rooms} bookings={bookings} />
        </div>
      )}

      {/* Room Management */}
      <div style={{ ...themeStyles.card, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Room Management</h3>
          <button style={themeStyles.btn("primary")} onClick={() => setCreateOpen(true)}>
            {"+ Create Room"}
          </button>
        </div>

        {rooms.length === 0 ? (
          <p style={{ color: colors.textFaint, fontSize: 14 }}>No rooms yet. Create your first room to get started.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={themeStyles.table}>
              <thead>
                <tr>
                  <th style={themeStyles.th}>ID</th>
                  <th style={themeStyles.th}>Name</th>
                  <th style={themeStyles.th}>Category</th>
                  <th style={themeStyles.th}>Price</th>
                  <th style={themeStyles.th}>Status</th>
                  <th style={themeStyles.th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id}>
                    <td style={themeStyles.td}><span style={{ fontFamily: "monospace", color: colors.textDim }}>#{r.id}</span></td>
                    <td style={{ ...themeStyles.td, fontWeight: 600 }}>{r.name}</td>
                    <td style={themeStyles.td}>{r.category}</td>
                    <td style={{ ...themeStyles.td, fontWeight: 700, color: colors.indigoLight }}>{r.pricePerNight} ETH</td>
                    <td style={themeStyles.td}>{r.statusLabel}</td>
                    <td style={themeStyles.td}>
                      {r.isActive ? (
                        <span style={{ color: colors.greenLight, fontSize: 13, fontWeight: 600 }}>{"\u2713 Active"}</span>
                      ) : (
                        <span style={{ color: colors.redLight, fontSize: 13, fontWeight: 600 }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Owner Info */}
      <div style={{ ...themeStyles.card, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textMuted, marginBottom: 8 }}>Owner Wallet</h3>
        <code style={{ fontSize: 12, color: colors.indigoLight, fontFamily: "monospace", wordBreak: "break-all" }}>{account}</code>
      </div>

      {createOpen && (
        <CreateRoomModal
          onClose={() => setCreateOpen(false)}
          onSubmit={async (name, category, price) => {
            await onCreateRoom(name, category, price);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Occupancy Chart (pure SVG, no extra deps) ─────────────────────────────
function OccupancyChart({ rooms, bookings }) {
  // Count non-cancelled bookings per room
  const counts = rooms.map((r) => ({
    room: r,
    count: bookings.filter((b) => b.roomId === r.id && b.status !== 3).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  const barHeight = 26;
  const gap = 10;
  const padLeft = 150;
  const padRight = 60;
  const width = 720;
  const chartHeight = counts.length * (barHeight + gap) + 20;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${chartHeight}`} width="100%" style={{ minWidth: 500 }} aria-label="Bookings per room">
        {counts.map((c, i) => {
          const y = 10 + i * (barHeight + gap);
          const barWidth = ((width - padLeft - padRight) * c.count) / max;
          return (
            <g key={c.room.id}>
              <text
                x={padLeft - 10} y={y + barHeight / 2 + 4}
                textAnchor="end" fontSize="12" fill={colors.textDim}
                style={{ fontFamily: "inherit" }}
              >
                {c.room.name.length > 20 ? c.room.name.slice(0, 19) + "\u2026" : c.room.name}
              </text>
              <rect
                x={padLeft} y={y}
                width={Math.max(barWidth, 2)} height={barHeight}
                rx={6}
                fill={c.count > 0 ? colors.primary : colors.border}
                opacity={c.count > 0 ? 0.85 : 0.4}
              />
              <text
                x={padLeft + Math.max(barWidth, 2) + 8} y={y + barHeight / 2 + 4}
                fontSize="12" fill={colors.text} fontWeight="600"
                style={{ fontFamily: "inherit" }}
              >
                {c.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Create Room Modal ──
function CreateRoomModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Standard");
  const [price, setPrice] = useState("");

  const valid = name.trim().length > 0 && parseFloat(price) > 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(name.trim(), category, price);
  }

  return (
    <Modal title="Create New Room" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={themeStyles.label}>Room Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ocean View Suite 501"
            style={themeStyles.input}
            autoFocus
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={themeStyles.label}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={themeStyles.select}>
            <option value="Standard">Standard</option>
            <option value="Deluxe">Deluxe</option>
            <option value="Suite">Suite</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={themeStyles.label}>Price per Night (ETH)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.05"
            style={themeStyles.input}
            required
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" style={{ ...themeStyles.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            type="submit"
            style={{ ...themeStyles.btn("primary"), flex: 2, opacity: valid ? 1 : 0.4 }}
            disabled={!valid}
          >
            Create on-chain
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 11, color: colors.textFaint, textAlign: "center" }}>
          Creates a new room in the smart contract. Requires an on-chain transaction.
        </p>
      </form>
    </Modal>
  );
}
