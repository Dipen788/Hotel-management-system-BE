import { gradients } from "../../styles/theme";

/**
 * Landing / gated screen shown on Dashboard, Rooms, Bookings when the user
 * has no wallet connected. We intentionally don't connect the wallet from
 * here — connecting + signing happens together on /profile via the "Sign in
 * with MetaMask" button, so we just route the user there.
 */
export default function ConnectPrompt({ onSignIn }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "70vh", textAlign: "center", animation: "fadeIn 0.5s ease",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, background: gradients.primary,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, marginBottom: 24,
      }}>
        {"\ud83c\udfe8"}
      </div>
      <h1 style={{
        fontSize: 36, fontWeight: 800, marginBottom: 12,
        background: gradients.hero, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        HotelChain DApp
      </h1>
      <p style={{ fontSize: 16, color: "#71717a", maxWidth: 480, marginBottom: 32, lineHeight: 1.6 }}>
        A decentralized hotel management system built on Ethereum. Book rooms, manage bookings,
        and handle payments {"\u2014"} all on-chain with full transparency.
      </p>
      <button
        onClick={onSignIn}
        style={{
          padding: "14px 40px", borderRadius: 14, border: "none",
          background: gradients.primary, color: "#fff",
          fontSize: 16, fontWeight: 700, cursor: "pointer",
          transition: "all 0.3s", boxShadow: "0 4px 24px rgba(124,58,237,0.3)",
        }}
      >
        Sign in
      </button>
      <p style={{ marginTop: 16, fontSize: 13, color: "#52525b" }}>
        Supports Ganache local network {"\u2022"} Hardhat localhost {"\u2022"} Ethereum testnets
      </p>
    </div>
  );
}
