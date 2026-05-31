"use client";

/**
 * Tracks whether the player explicitly disconnected their wallet.
 *
 * wagmi's automatic reconnect-on-mount is great for surviving refreshes and
 * hard navigations (the in-play / wallet balances stay populated), but it also
 * silently re-authorizes after an explicit "Disconnect", which makes the
 * disconnect button look broken. We split the difference: wagmi runs with
 * reconnectOnMount={false}, and ReconnectManager (see providers.tsx) reconnects
 * manually on mount UNLESS this flag is set. Disconnect sets it; connecting
 * clears it. Reconnect is silent (it only revives an already-authorized
 * connector), so no MetaMask popup on normal navigation.
 */

const KEY = "pb:wallet-disconnected";

export function markManuallyDisconnected(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // localStorage unavailable (SSR / privacy mode) — non-fatal
  }
}

export function clearManuallyDisconnected(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // non-fatal
  }
}

export function isManuallyDisconnected(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
