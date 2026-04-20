import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getOwner, getBalance, connectWallet as contractConnect, getConnectedAccount } from "../utils/contract";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { GANACHE_CHAIN_ID } from "../utils/constants";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isOwner, setIsOwner] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const { showToast } = useToast();
  const { user: authUser, logout: authLogout } = useAuth();

  // Mirror auth state into a ref so event-handler effects (which can't depend
  // on `authUser` without re-subscribing to window.ethereum on every auth
  // change) can still read the freshest value. The rule these handlers enforce:
  // if the current auth session is a wallet-only (SIWE) session, then losing
  // or changing the wallet invalidates that session.
  const authRef = useRef({ user: null, logout: () => {} });
  useEffect(() => { authRef.current = { user: authUser, logout: authLogout }; }, [authUser, authLogout]);

  // A session is "bound to the wallet" iff it has no email — i.e. it was
  // established via SIWE. Email sessions are independent of any connected
  // wallet and must NOT be terminated when the wallet goes away.
  function isWalletSession(u) {
    return !!u && !u.email && !!u.walletAddress;
  }

  const refreshBalance = useCallback(async (addr) => {
    try {
      const bal = await getBalance(addr);
      setBalance(bal);
    } catch {
      // silently fail
    }
  }, []);

  const checkOwner = useCallback(async (addr) => {
    try {
      const ownerAddr = await getOwner();
      setIsOwner(ownerAddr.toLowerCase() === addr.toLowerCase());
    } catch {
      setIsOwner(false);
    }
  }, []);

  const switchToGanache = useCallback(async () => {
    const chainHex = "0x" + GANACHE_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    } catch (switchErr) {
      // Chain not added yet — add it
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chainHex,
            chainName: "Ganache Local",
            rpcUrls: ["http://127.0.0.1:7545"],
            nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
          }],
        });
      } else {
        throw switchErr;
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      showToast("MetaMask not detected. Please install MetaMask.", "error");
      return;
    }
    setConnecting(true);
    try {
      // Auto-switch to Ganache before connecting
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      const chainNum = parseInt(chain, 16);
      if (chainNum !== GANACHE_CHAIN_ID) {
        showToast("Switching to Ganache network...");
        await switchToGanache();
      }

      const addr = await contractConnect();
      setAccount(addr);
      await refreshBalance(addr);
      await checkOwner(addr);

      const newChain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(newChain, 16));
      showToast("Wallet connected successfully!");
      // Return the freshly-connected address so callers don't have to wait for
      // a re-render to read the updated `account` state (stale-closure fix).
      return addr;
    } catch (err) {
      showToast(err.message || "Failed to connect wallet", "error");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [showToast, refreshBalance, checkOwner, switchToGanache]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setBalance("0");
    setIsOwner(false);
    // If the current auth session was established via the wallet, drop it —
    // the user is signalling they want to fully sign out of this identity.
    if (isWalletSession(authRef.current.user)) {
      authRef.current.logout();
    }
    showToast("Wallet disconnected");
  }, [showToast]);

  // Auto-connect if already authorized, and auto-switch to Ganache
  useEffect(() => {
    (async () => {
      try {
        const existing = await getConnectedAccount();
        if (existing) {
          const chain = await window.ethereum.request({ method: "eth_chainId" });
          const chainNum = parseInt(chain, 16);
          if (chainNum !== GANACHE_CHAIN_ID) {
            await switchToGanache();
          }
          setAccount(existing);
          await refreshBalance(existing);
          await checkOwner(existing);
          const newChain = await window.ethereum.request({ method: "eth_chainId" });
          setChainId(parseInt(newChain, 16));
        }
      } catch {
        // no wallet connected or user rejected network switch
      }
    })();
  }, [refreshBalance, checkOwner, switchToGanache]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      // If a JWT was just written to localStorage but the auth ref hasn't
      // propagated yet (React's useEffect tick gap), we are mid-SIWE-sign-in
      // and MUST NOT log the user back out. MetaMask occasionally re-emits
      // accountsChanged right after personal_sign resolves.
      const midSignIn =
        !!localStorage.getItem("hotel_dapp_token") && !authRef.current.user;

      if (accounts.length === 0) {
        setAccount(null);
        setBalance("0");
        setIsOwner(false);
        // Wallet-only auth session ends when the wallet is no longer available.
        if (isWalletSession(authRef.current.user)) {
          authRef.current.logout();
          showToast("Wallet disconnected \u2014 signed out");
        }
        return;
      }

      const addr = accounts[0];
      setAccount(addr);
      await refreshBalance(addr);
      await checkOwner(addr);

      if (midSignIn) {
        // Don't touch auth during the sign-in microtask window.
        return;
      }

      // Switching to a different wallet invalidates a SIWE session tied to
      // the previous wallet — the old JWT no longer represents who's at the
      // keyboard. Email sessions survive because they don't depend on which
      // wallet (if any) is connected.
      const authed = authRef.current.user;
      if (isWalletSession(authed) && authed.walletAddress.toLowerCase() !== addr.toLowerCase()) {
        authRef.current.logout();
        showToast(`Switched to ${addr.slice(0, 6)}\u2026 \u2014 signed out of previous wallet session`);
      } else {
        showToast("Account changed: " + addr.slice(0, 6) + "...");
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const newChain = parseInt(chainIdHex, 16);
      setChainId(newChain);
      if (newChain !== GANACHE_CHAIN_ID) {
        showToast(
          `Switched to chain ${newChain}. Expected Ganache (${GANACHE_CHAIN_ID}).`,
          "error"
        );
      } else {
        showToast("Network changed \u2014 reconnected to Ganache");
      }
      // NOTE: we used to call `window.location.reload()` here to force a fresh
      // provider/contract bind. It turned out to race with the auth hydration
      // path (token in localStorage + GET /api/auth/profile on mount), and a
      // mid-flight SIWE sign-in could have its `setUser(...)` effect wiped by
      // the reload before React committed it. React state is the source of
      // truth for everything we render, so let chainId change propagate
      // through context and rely on downstream hooks (useContract) to re-read.
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshBalance, checkOwner, showToast]);

  return (
    <WalletContext.Provider value={{
      account, balance, isOwner, chainId, connecting,
      connectWallet, disconnectWallet, refreshBalance: () => account && refreshBalance(account),
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
