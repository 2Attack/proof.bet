import type { NextConfig } from "next";

const OPTIONAL_WAGMI_PEER_DEPS = [
  "@base-org/account",
  "@coinbase/wallet-sdk",
  "@metamask/connect-evm",
  "@safe-global/safe-apps-provider",
  "@safe-global/safe-apps-sdk",
  "@walletconnect/ethereum-provider",
  "porto",
  "porto/internal",
  "accounts",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@proofbet/shared"],
  webpack(config) {
    // Map .js imports to .ts files — required because @proofbet/shared uses
    // ESM-style .js extensions in its internal TypeScript imports.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };

    // Stub out optional wagmi peer dependencies that aren't installed.
    // These connectors (WalletConnect, Coinbase, Safe, Porto, etc.) use
    // optional packages. We use injected() only in the current setup.
    const aliases: Record<string, false> = {};
    for (const pkg of OPTIONAL_WAGMI_PEER_DEPS) {
      aliases[pkg] = false;
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      ...aliases,
    };

    return config;
  },
};

export default nextConfig;
