import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getToken, setToken,
  login as apiLogin, register as apiRegister, getProfile as apiGetProfile,
  updateProfile as apiUpdateProfile,
  getSiweNonce, siweLogin,
} from "../utils/api";

/**
 * Off-chain identity. Backed by the Express API's JWT flow.
 * Separate from the on-chain wallet — a guest can connect MetaMask without
 * registering, but registering unlocks server-side features like booking
 * confirmation emails and PDF receipts.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount: if a token exists, try to hydrate the profile
  useEffect(() => {
    let aborted = false;
    (async () => {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      try {
        const { user } = await apiGetProfile();
        if (!aborted) setUser(user);
      } catch {
        // Token is invalid/expired — clear it silently
        setToken(null);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setError(null);
    const { token, user } = await apiLogin({ email, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async ({ email, password, name, walletAddress }) => {
    setError(null);
    const { token, user } = await apiRegister({ email, password, name, walletAddress });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  /**
   * Sign in with MetaMask. Two-step SIWE flow:
   *   1. Ask the backend for a nonce message for this wallet.
   *   2. Ask MetaMask (via `personal_sign`) to sign that exact message.
   *   3. POST the signature; the backend verifies, finds-or-creates a User,
   *      and returns a JWT.
   * On first use for a given wallet a stub profile is created server-side.
   */
  const loginWithWallet = useCallback(async ({ address, name } = {}) => {
    setError(null);
    if (!window.ethereum) {
      throw new Error("MetaMask not detected. Install it or connect your wallet first.");
    }

    let walletAddress = address;
    if (!walletAddress) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts?.[0];
    }
    if (!walletAddress) throw new Error("No wallet account available");

    const { message } = await getSiweNonce(walletAddress);

    // `personal_sign` is the canonical "sign-in" signature that prefixes the
    // message with "\x19Ethereum Signed Message:\n..." so ethers can verify it.
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, walletAddress],
    });

    const { token, user } = await siweLogin({
      address: walletAddress,
      signature,
      message,
      name: name || undefined,
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Update a mutable profile field (currently only the display name).
  // Returns the updated user.
  const updateName = useCallback(async (name) => {
    const { user } = await apiUpdateProfile({ name });
    setUser(user);
    return user;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { user } = await apiGetProfile();
      setUser(user);
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      isAuthenticated: !!user,
      login, register, loginWithWallet, logout, refreshProfile, updateName,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
