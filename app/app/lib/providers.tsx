"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useReconnect } from "wagmi";
import { wagmiConfig } from "./wagmi-config";
import { useState, useEffect, useRef } from "react";
import { isManuallyDisconnected } from "./wallet-session";

/**
 * Reconnects the wallet on mount — but only if the player didn't explicitly
 * disconnect. This replaces wagmi's built-in reconnectOnMount (disabled below)
 * so that an explicit Disconnect sticks across reloads, while normal refreshes
 * and hard navigations silently restore the session (keeping balances live and
 * NOT popping a MetaMask dialog — reconnect only revives an authorized
 * connector).
 */
function ReconnectManager() {
  const { reconnect } = useReconnect();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!isManuallyDisconnected()) reconnect();
  }, [reconnect]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <ReconnectManager />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
