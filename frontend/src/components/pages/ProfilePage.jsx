import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import { useToast } from "../../contexts/ToastContext";
import { shortenAddress } from "../../utils/contract";
import { styles as themeStyles, colors, gradients } from "../../styles/theme";

/**
 * Account page — register, log in, or view the current off-chain profile.
 * Works independently of MetaMask: you can register first and connect a
 * wallet later, or connect first and then register to link the wallet to
 * a server profile for booking confirmation emails.
 */
export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'

  if (isAuthenticated) {
    return <ProfileView user={user} onLogout={logout} />;
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Account</h1>
        <p style={{ color: colors.textDim, fontSize: 14 }}>
          Off-chain identity for booking emails and PDF receipts
        </p>
      </div>

      <div style={{ ...themeStyles.card, padding: 20, marginBottom: 16 }}>
        <WalletSignInButton />
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          margin: "16px 0 8px", color: colors.textFaint, fontSize: 11,
        }}>
          <div style={{ flex: 1, height: 1, background: colors.border }} />
          <span>or use email</span>
          <div style={{ flex: 1, height: 1, background: colors.border }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
        <button style={themeStyles.navLink(mode === "login")} onClick={() => setMode("login")}>Log in</button>
        <button style={themeStyles.navLink(mode === "register")} onClick={() => setMode("register")}>Register</button>
      </div>

      <div style={{ ...themeStyles.card, padding: 24 }}>
        {mode === "login" ? <LoginForm /> : <RegisterForm />}
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: colors.textFaint, textAlign: "center" }}>
        Credentials are stored in the backend with bcrypt-hashed passwords and a JWT token in this browser's localStorage.
      </p>
    </div>
  );
}

/**
 * One-tap MetaMask sign-in. Opens MetaMask (if not already connected), asks the
 * user to sign a server-issued nonce, then exchanges the signature for a JWT.
 * No email or password is ever collected.
 */
function WalletSignInButton() {
  const { loginWithWallet } = useAuth();
  const { account, connectWallet } = useWallet();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      // If the wallet isn't connected yet, do that first so the user sees the
      // connect prompt before the sign prompt. `connectWallet` returns the
      // resolved address so we don't read stale closure state.
      let addr = account;
      if (!addr && connectWallet) {
        const connected = await connectWallet();
        addr = connected || account;
      }
      // `loginWithWallet` falls back to `eth_requestAccounts` when no address
      // is passed, so a missing `addr` here is non-fatal.
      await loginWithWallet({ address: addr || undefined });
      showToast("Signed in with wallet");
    } catch (err) {
      // Log the full error so the dev console shows what went wrong when the
      // toast message is generic (e.g. a backend 4xx with a short detail).
      // eslint-disable-next-line no-console
      console.error("[SIWE] sign-in failed", err);
      showToast(err.message || "Wallet sign-in failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        ...themeStyles.btn("primary"),
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 18 }}>{"\ud83e\udd8a"}</span>
      <span>{busy ? "Check MetaMask\u2026" : "Sign in with MetaMask"}</span>
    </button>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      showToast("Signed in");
    } catch (err) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={themeStyles.label}>Email</label>
        <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={themeStyles.input} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={themeStyles.label}>Password</label>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={themeStyles.input} />
      </div>
      <button type="submit" style={{ ...themeStyles.btn("primary"), width: "100%", opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const { account } = useWallet();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkWallet, setLinkWallet] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        walletAddress: linkWallet && account ? account : undefined,
      });
      showToast("Account created");
    } catch (err) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={themeStyles.label}>Full name</label>
        <input type="text" required autoFocus value={name} onChange={(e) => setName(e.target.value)} style={themeStyles.input} maxLength={100} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={themeStyles.label}>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={themeStyles.input} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={themeStyles.label}>Password</label>
        <input
          type="password" required minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)}
          style={themeStyles.input}
          placeholder="At least 8 characters"
        />
      </div>

      {account ? (
        <label style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 13,
          padding: 12, borderRadius: 10, background: colors.bg,
          border: `1px solid ${colors.border}`, marginBottom: 20, cursor: "pointer",
        }}>
          <input type="checkbox" checked={linkWallet} onChange={(e) => setLinkWallet(e.target.checked)} />
          <span>
            Link wallet <code style={{ fontSize: 11, fontFamily: "monospace", color: colors.indigoLight }}>{account}</code>
          </span>
        </label>
      ) : (
        <p style={{ fontSize: 11, color: colors.textFaint, marginBottom: 20 }}>
          Connect a wallet first to link it to this account.
        </p>
      )}

      <button type="submit" style={{ ...themeStyles.btn("primary"), width: "100%", opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
        {submitting ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}

function ProfileView({ user, onLogout }) {
  const { account, isOwner, disconnectWallet } = useWallet();

  // When logging out of a wallet-only (SIWE) session, also disconnect the
  // wallet — the auth identity IS the wallet, so leaving it connected after
  // "Log out" is confusing (exactly the state the UI showed earlier).
  function handleLogout() {
    const isWalletOnly = !user.email && !!user.walletAddress;
    onLogout();
    if (isWalletOnly && account) disconnectWallet();
  }

  // Classify the account so downstream rows/rows render without clutter.
  const hasEmail = !!user.email;
  const hasLinkedWallet = !!user.walletAddress;
  const accountType = hasEmail && hasLinkedWallet
    ? "Email + wallet"
    : hasEmail
      ? "Email session"
      : "Wallet session";

  const linkedLower = user.walletAddress?.toLowerCase();
  const connectedLower = account?.toLowerCase();
  const walletsMatch = !!linkedLower && !!connectedLower && linkedLower === connectedLower;

  // On-chain admin iff (a) the wallet tied to this off-chain account is
  // currently connected and (b) that wallet is the contract owner. We refuse
  // to call someone "Admin" based on a wallet they haven't proven control of
  // in the current session, even if their linked address matches the owner.
  const onChainAdmin = walletsMatch && isOwner;

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 560, margin: "0 auto" }}>
      <div style={{
        ...themeStyles.card, padding: 24, marginBottom: 20,
        background: gradients.primary, border: "none", color: "#fff",
      }}>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{accountType}</div>

        <EditableName
          currentName={user.name}
          fallback={hasLinkedWallet ? shortenAddress(user.walletAddress) : (user.email || "Guest")}
        />

        <div style={{
          fontSize: 13, opacity: 0.9, marginTop: 4,
          fontFamily: hasEmail ? "inherit" : "monospace", wordBreak: "break-all",
        }}>
          {user.email || user.walletAddress}
        </div>
      </div>

      <div style={{ ...themeStyles.card, padding: 20, marginBottom: 16 }}>
        <Row label="Account type" value={accountType} />
        {hasLinkedWallet && (
          <Row
            label="On-chain role"
            value={onChainAdmin ? "Admin (contract owner)" : "Guest"}
          />
        )}
        <Row label="User ID" value={user.id} mono />

        <WalletRows
          user={user}
          connectedAccount={account}
          walletsMatch={walletsMatch}
        />
      </div>

      <button type="button" style={{ ...themeStyles.btn("danger"), width: "100%" }} onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}

/**
 * Renders the wallet section of the profile depending on which combination of
 * linked / connected wallets the user currently has. Keeps ProfileView tidy.
 */
function WalletRows({ user, connectedAccount, walletsMatch }) {
  const hasEmail = !!user.email;
  const hasLinked = !!user.walletAddress;

  // Wallet-native SIWE user: one row, no mismatch ever possible.
  if (!hasEmail && hasLinked) {
    return (
      <Row
        label="Wallet"
        value={<WalletValue addr={user.walletAddress} connected={walletsMatch} />}
      />
    );
  }

  // Email user with no linked wallet: hide wallet section entirely.
  if (hasEmail && !hasLinked) return null;

  // Email user, linked wallet present.
  if (hasEmail && hasLinked) {
    if (!connectedAccount) {
      return (
        <>
          <Row label="Linked wallet" value={<WalletValue addr={user.walletAddress} />} />
          <div style={{ marginTop: 10, fontSize: 11, color: colors.textFaint }}>
            Connect your wallet to use on-chain features.
          </div>
        </>
      );
    }
    if (walletsMatch) {
      return (
        <Row label="Wallet" value={<WalletValue addr={user.walletAddress} connected />} />
      );
    }
    // Mismatch — show both and warn.
    return (
      <>
        <Row label="Linked wallet" value={<WalletValue addr={user.walletAddress} />} />
        <Row label="Connected wallet" value={<WalletValue addr={connectedAccount} />} />
        <p style={{
          marginTop: 12, padding: 12, borderRadius: 10,
          background: "#422006", color: "#fbbf24", fontSize: 12,
        }}>
          Connected wallet does not match the wallet linked to this account.
        </p>
      </>
    );
  }

  return null;
}

function WalletValue({ addr, connected }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "monospace" }}>{addr}</span>
      {connected && (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
          background: "#14532d", color: "#86efac", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          connected
        </span>
      )}
    </span>
  );
}

/**
 * Click-to-edit display name. Shows the name (or a shortened-address fallback
 * hint) next to a pencil icon. Clicking swaps in an input + Save/Cancel. Saves
 * call AuthContext.updateName which PATCHes /api/auth/profile.
 */
function EditableName({ currentName, fallback }) {
  const { updateName } = useAuth();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName || "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e?.preventDefault?.();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      setDraft(currentName || "");
      return;
    }
    setSaving(true);
    try {
      await updateName(trimmed);
      showToast("Name updated");
      setEditing(false);
    } catch (err) {
      showToast(err.message || "Could not update name", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(currentName || "");
    setEditing(false);
  }

  function handleKey(e) {
    if (e.key === "Escape") handleCancel();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          maxLength={120}
          placeholder="Your display name"
          style={{
            flex: 1, fontSize: 20, fontWeight: 700,
            padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(0,0,0,0.15)", color: "#fff",
          }}
        />
        <button
          type="submit" disabled={saving}
          style={{
            fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, border: "none",
            background: "#fff", color: colors.primary, cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "\u2026" : "Save"}
        </button>
        <button
          type="button" onClick={handleCancel} disabled={saving}
          style={{
            fontSize: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)",
            background: "transparent", color: "#fff", cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>
        {currentName || (
          <span style={{ opacity: 0.7, fontStyle: "italic" }}>{fallback}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setDraft(currentName || ""); setEditing(true); }}
        aria-label="Edit name"
        title="Edit display name"
        style={{
          background: "rgba(255,255,255,0.18)", border: "none", color: "#fff",
          borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 12,
        }}
      >
        {"\u270E"} Edit
      </button>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
      <span style={{ color: colors.textDim }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", color: colors.text, wordBreak: "break-all", maxWidth: "65%", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
