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

import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { config as appConfig } from "./config";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(appConfig.rpcUrl || undefined),
  },
  connectors: [injected({ target: "metaMask" })],
  ssr: true,
});
