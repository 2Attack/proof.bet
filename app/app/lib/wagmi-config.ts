/**
 * wagmi configuration — Sepolia only.
 * Uses only injected() connector to avoid optional peer dep issues
 * with WalletConnect and Coinbase SDK in the current workspace.
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
  connectors: [injected()],
  ssr: true,
});
