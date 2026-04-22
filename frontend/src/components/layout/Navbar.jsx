import { useState } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";
import { shortenAddress } from "../../utils/contract";
import { colors, gradients, styles as themeStyles } from "../../styles/theme";

export default function Navbar({ page, setPage, loyaltyInfo }) {
  const { account, balance, isOwner, disconnectWallet } = useWallet();
  const { isAuthenticated, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const pages = [
    "dashboard",
    "rooms",
    "bookings",
    ...(isOwner ? ["admin"] : []),
    "profile",
  ];

  // Loyalty tier progression: 0-2 bookings -> Silver, 3 -> Gold w/ discount
  const tierProgress = Math.min(1, (loyaltyInfo?.totalBookings || 0) / 3);

  function go(p) {
    setPage(p);
    setMenuOpen(false);
  }

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 32px", background: gradients.nav,
      borderBottom: `1px solid ${colors.border}`, position: "sticky", top: 0, zIndex: 50,
      flexWrap: "wrap", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => go("dashboard")}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: gradients.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: "#fff",
        }}>
          H
        </div>
        <span style={{ fontSize: 22, fontWeight: 700, background: gradients.logo, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          HotelChain DApp
        </span>
      </div>

      {/* Mobile hamburger */}
      <button
        aria-label="Toggle menu"
        className="navbar-hamburger"
        onClick={() => setMenuOpen((o) => !o)}
        style={{
          display: "none",
          background: "none", border: `1px solid ${colors.border}`, borderRadius: 10,
          color: colors.text, padding: "8px 12px", cursor: "pointer", fontSize: 18,
        }}
      >
        {menuOpen ? "\u2715" : "\u2630"}
      </button>

      <div
        className={`navbar-links${menuOpen ? " open" : ""}`}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        {pages.map((p) => (
          <button key={p} style={themeStyles.navLink(page === p)} onClick={() => go(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {isAuthenticated ? (
          <div style={{
            padding: "6px 10px", borderRadius: 10, background: colors.card,
            border: `1px solid ${colors.border}`, fontSize: 12, color: colors.textDim,
          }}>
            {"\ud83d\udc64 "}{user?.name || user?.email}
          </div>
        ) : (
          // Shortcut that drops the user on /profile where they can sign in
          // with MetaMask or email. Lives in the navbar so they don't have to
          // hunt for the "Profile" tab just to authenticate.
          <button
            type="button"
            onClick={() => go("profile")}
            style={{
              padding: "8px 14px", borderRadius: 10,
              border: `1px solid ${colors.border}`, background: colors.card,
              color: colors.text, cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s",
            }}
          >
            Sign in
          </button>
        )}
        {account && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 12, padding: "8px 16px",
          }}>
            {(loyaltyInfo?.points > 0 || loyaltyInfo?.totalBookings > 0) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <div style={{
                  padding: "4px 8px", borderRadius: 8,
                  background: loyaltyInfo.hasDiscount ? "#14532d" : colors.purpleBg,
                  color: loyaltyInfo.hasDiscount ? "#86efac" : colors.primaryLight,
                  fontSize: 11, fontWeight: 600,
                }}>
                  {loyaltyInfo.hasDiscount ? "Gold" : "Silver"} {"\u00b7"} {loyaltyInfo.points} pts
                </div>
                {!loyaltyInfo.hasDiscount && (
                  <div
                    title={`${loyaltyInfo.totalBookings}/3 bookings to Gold`}
                    style={{ width: 90, height: 4, borderRadius: 2, background: colors.border, overflow: "hidden" }}
                  >
                    <div style={{ width: `${tierProgress * 100}%`, height: "100%", background: gradients.primary, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
            )}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.green }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{shortenAddress(account)}</div>
              <div style={{ fontSize: 11, color: colors.textDim }}>{parseFloat(balance).toFixed(4)} ETH</div>
            </div>
            <button style={{ ...themeStyles.btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
