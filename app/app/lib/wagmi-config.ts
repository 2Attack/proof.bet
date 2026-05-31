/**
 * wagmi configuration — Sepolia only.
 * Uses a MetaMask-targeted injected() connector to avoid optional peer dep
 * issues with WalletConnect and Coinbase SDK in the current workspace.
 * Targeting "metaMask" (instead of the generic injected provider) gives the
 * connector a proper display name — `connector.name === "MetaMask"` — which
 * the wallet menu shows, instead of the generic "Injected". The design only
 * offers MetaMask, so locking the target is intentional.
 * The mock Connect page handles wallet selection UI independently.
 */

import { createConfig, fallback, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { config as appConfig } from "./config";

// Keyless public Sepolia endpoint used as a fallback: when the primary (Infura)
// rate-limits with 429, viem's fallback transport transparently retries the next
// provider instead of surfacing the error as a failed read.
const SEPOLIA_FALLBACK_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// `batch: true` coalesces JSON-RPC requests fired in the same tick into a single
// HTTP request — fewer round-trips, fewer rate-limit hits.
const HTTP_OPTS = { batch: true } as const;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      http(appConfig.rpcUrl || undefined, HTTP_OPTS),
      http(SEPOLIA_FALLBACK_RPC, HTTP_OPTS),
    ]),
  },
  connectors: [injected({ target: "metaMask" })],
  // Coalesce the per-refresh balance/bankroll/nonce reads into ONE multicall
  // eth_call (Sepolia has multicall3), and slow viem's watcher/poll cadence from
  // the aggressive 4s default — together these sharply cut requests/min and keep
  // the free Infura tier under its limit.
  batch: { multicall: true },
  pollingInterval: 3_000,
  ssr: true,
});
