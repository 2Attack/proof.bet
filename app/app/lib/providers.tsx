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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Serve cached reads for 8s instead of refiring on every render,
            // and don't refetch the whole balance set on tab focus — both were
            // major sources of RPC churn that tripped Infura's 429 limit.
            staleTime: 8_000,
            refetchOnWindowFocus: false,
            // Back off on failures (incl. 429) instead of retrying immediately.
            retry: 2,
            retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
          },
        },
      }),
  );
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <ReconnectManager />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
