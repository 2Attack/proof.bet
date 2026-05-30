"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "../../components/TopNav";
import { randHex } from "../../lib/mock-utils";
import { setAddress } from "../../lib/mock-store";
import type { Hex } from "viem";

const WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    meta: "browser extension",
    tint: "#5FE3C0",
    secondary: "#1a3631",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    meta: "scan to pair",
    tint: "#3a6f64",
    secondary: "#1a2f2b",
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    meta: "browser extension",
    tint: "#2c4f48",
    secondary: "#152421",
  },
] as const;

export function ConnectPage() {
  const router = useRouter();
  const [wrongNet, setWrongNet] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const connect = (id: string) => {
    setConnecting(id);
    setTimeout(() => {
      // Generate a mock wallet address
      const addr = randHex(20) as Hex;
      setAddress(addr);
      setConnecting(null);
      // After connect: go to catalog with faucet drawer open
      router.push("/games?openFaucet=1");
    }, 900);
  };

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage">
        <div className="glass connect-card">
          <div className="connect-head">
            <div className="serif" style={{ fontSize: 24 }}>
              Connect a wallet
            </div>
            <div className="sub" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
              non-custodial · we never touch your keys
            </div>
          </div>

          {wrongNet ? (
            <div className="net-banner wrong">
              <span>⚠</span>
              <span className="grow">
                Wrong network — you may be on Ethereum Mainnet.
              </span>
              <button
                className="seed-reroll"
                style={{ color: "var(--loss)" }}
                onClick={() => setWrongNet(false)}
              >
                Switch to Sepolia
              </button>
            </div>
          ) : (
            <div className="net-banner ok">
              <span>✓</span>
              <span className="grow">Connected to Sepolia testnet.</span>
              <span className="mono" style={{ fontSize: 11 }}>
                chainId 11155111
              </span>
            </div>
          )}

          <div className="wallet-list">
            {WALLETS.map((w) => (
              <button
                key={w.id}
                className="wallet-opt"
                disabled={wrongNet || connecting !== null}
                onClick={() => connect(w.id)}
              >
                <span
                  className="wallet-icon"
                  style={{
                    background: `linear-gradient(150deg, ${w.tint}, ${w.secondary})`,
                  }}
                >
                  {w.name[0]}
                </span>
                <span>
                  <span className="wallet-name">{w.name}</span>
                  <span className="wallet-meta">{w.meta}</span>
                </span>
                <span className="wallet-go">
                  {connecting === w.id ? "connecting…" : "→"}
                </span>
              </button>
            ))}
          </div>

          <p
            className="wallet-meta"
            style={{ textAlign: "center", marginTop: 18, lineHeight: 1.6, color: "var(--ink-dim)", fontSize: 12 }}
          >
            Testnet only. You bet play-money Proofs (PRF).<br />
            tETH only pays gas — no real funds are ever at risk.
          </p>
        </div>
      </div>
    </div>
  );
}
