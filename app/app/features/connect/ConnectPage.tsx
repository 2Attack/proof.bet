"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { TopNav } from "../../components/TopNav";
import { getSound } from "../../lib/sound";
import { randHex } from "../../lib/mock-utils";
import { setAddress } from "../../lib/mock-store";
import { config } from "../../lib/config";
import type { Hex } from "viem";

// ---------- brand marks ----------
function IconMetaMask() {
  return (
    <svg viewBox="0 0 36 34" width="30" height="30" fill="none" aria-hidden="true">
      <path d="M33.4 1.2 19.9 11.1l2.5-5.9 11-4z" fill="#E2761B" stroke="#E2761B" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M2.6 1.2 16 11.2l-2.4-6-11-4zM28.6 24.1l-3.6 5.5 7.7 2.1 2.2-7.5-6.3-.1zM1.2 24.2l2.2 7.5 7.7-2.1-3.6-5.5-6.3.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M10.7 14.8 8.6 18l7.6.3-.3-8.2-5.2 4.8zM25.3 14.8l-5.3-4.9-.2 8.4 7.6-.3-2.1-3.2zM11.1 29.6l4.6-2.2-4-3.1-.6 5.3zM20.3 27.4l4.6 2.2-.6-5.3-4 3.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M24.9 29.6 20.3 27.4l.4 3 0 1.3 4.2-2.1zM11.1 29.6l4.2 2.1 0-1.3.3-3-4.5 2.2z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M15.4 22.3 11.5 21.1l2.7-1.3 1.2 2.5zM20.6 22.3l1.2-2.5 2.8 1.3-4 1.2z" fill="#233447" stroke="#233447" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M11.1 29.6l.7-5.5-4.3.1 3.6 5.4zM24.3 24.1l.6 5.5 3.7-5.4-4.3-.1zM27.4 18l-7.6.3.7 3.9 1.2-2.5 2.8 1.3 2.9-3zM11.5 21.1l2.7-1.3 1.2 2.5.8-3.9-7.6-.3 2.9 3z" fill="#CD6116" stroke="#CD6116" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.6 18l3.2 6.2-.1-3.1L8.6 18zM24.5 21.1l-.2 3.1 3.2-6.2-3 3zM16.2 18.3l-.8 3.9.9 4.9.2-6.4-.3-2.4zM19.8 18.3l-.3 2.4.2 6.4.9-4.9-.8-3.9z" fill="#E4751F" stroke="#E4751F" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M20.6 22.3l-.9 4.9.6.4 4-3.1.2-3.1-3.9.9zM11.5 21.1l.1 3.1 4 3.1.6-.4-.8-4.9-3.9-.9z" fill="#F6851B" stroke="#F6851B" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M20.7 31.7l0-1.3-.4-.3h-4.6l-.3.3 0 1.3-4.2-2.1 1.5 1.2 3 2.1h4.7l3-2.1 1.5-1.2-4.2 2.1z" fill="#C0AD9E" stroke="#C0AD9E" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M20.3 27.4l-.6-.4h-3.4l-.6.4-.3 3 .3-.3h4.6l.4.3-.4-3z" fill="#161616" stroke="#161616" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M34 11.7 35.1 6l-1.7-4.8L20.3 11l5 4.2 7 2.1 1.6-1.8-.7-.5 1.1-1-.8-.6 1.1-.8-.7-.9zM.9 6 2 11.7l-.7.5 1 .8-.8.6 1.1 1-.7.5L3.6 17l7-2.1 5-4.2L2.6 1.2.9 6z" fill="#763D16" stroke="#763D16" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M32.4 17.3l-7-2.1 2.1 3.2-3.2 6.2 4.2-.1h6.3l-2.4-7.2zM10.7 15.2l-7 2.1L1.2 24.2h6.3l4.2.1-3.2-6.2 2.2-3zM19.8 18.3l.5-8.4L22.4 5h-8.8l2.1 4.9.5 8.4.2 2.4 0 6.3h3.4l0-6.3.2-2.4z" fill="#F6851B" stroke="#F6851B" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconWalletConnect() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#3B99FC" />
      <path d="M11.8 15.4c4.5-4.4 11.9-4.4 16.4 0l.6.5c.2.2.2.6 0 .8l-1.9 1.8c-.1.1-.3.1-.4 0l-.8-.7c-3.2-3.1-8.3-3.1-11.4 0l-.8.8c-.1.1-.3.1-.4 0l-1.9-1.8c-.2-.2-.2-.6 0-.8l1-.6zm20.2 3.8 1.7 1.6c.2.2.2.6 0 .8l-7.6 7.4c-.2.2-.6.2-.8 0l-5.4-5.3c0-.1-.1-.1-.2 0l-5.4 5.3c-.2.2-.6.2-.8 0L5.9 21.6c-.2-.2-.2-.6 0-.8l1.7-1.6c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.2 0l5.4-5.3c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.2 0l5.4-5.3c.2-.2.6-.2.8 0z" fill="#fff" />
    </svg>
  );
}

function IconCoinbase() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0052FF" />
      <path d="M20 8a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm-3.3 8.4c0-.9.7-1.6 1.6-1.6h3.4c.9 0 1.6.7 1.6 1.6v7.2c0 .9-.7 1.6-1.6 1.6h-3.4c-.9 0-1.6-.7-1.6-1.6v-7.2z" fill="#fff" />
    </svg>
  );
}

interface WalletOption {
  id: string;
  name: string;
  meta: string;
}

const SOON_WALLETS: WalletOption[] = [
  { id: "walletconnect", name: "WalletConnect", meta: "scan to pair" },
  { id: "coinbase", name: "Coinbase Wallet", meta: "browser extension" },
];

const WALLET_ICONS: Record<string, () => React.ReactElement> = {
  walletconnect: IconWalletConnect,
  coinbase: IconCoinbase,
};

export function ConnectPage() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);

  // --- Live wallet state (inert in mock mode) ---
  // `useAccount().chainId` reflects the WALLET's chain (useChainId would just
  // echo the single configured chain). Undefined until connected.
  const { isConnected, chainId: walletChainId } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const [mockWrongNet, setMockWrongNet] = useState(true);

  // Live: gate only once connected — don't disable the connect button before
  // there's a wallet to read a chain from.
  const wrongNet = config.isMock
    ? mockWrongNet
    : isConnected && walletChainId !== sepolia.id;

  // Live: once connected on Sepolia, advance to the catalog.
  useEffect(() => {
    if (!config.isMock && isConnected && walletChainId === sepolia.id) {
      router.push("/games?openFaucet=1");
    }
  }, [isConnected, walletChainId, router]);

  const switchToSepolia = () => {
    getSound().ui();
    if (config.isMock) {
      setMockWrongNet(false);
    } else {
      switchChain({ chainId: sepolia.id });
    }
  };

  const connect = () => {
    getSound().unlock();
    getSound().ui();
    setConnecting(true);
    if (config.isMock) {
      setTimeout(() => {
        // Generate a mock wallet address
        const addr = randHex(20) as Hex;
        setAddress(addr);
        setConnecting(false);
        // After connect: go to catalog with faucet drawer open
        router.push("/games?openFaucet=1");
      }, 900);
      return;
    }
    // Live: only the injected (browser-extension) connector is configured.
    const connector =
      connectors.find((c) => c.type === "injected") ?? connectors[0];
    if (!connector) {
      setConnecting(false);
      return;
    }
    wagmiConnect({ connector });
  };

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage">
        <div className="glass connect-card">
          <div className="connect-head">
            <div className="serif">Connect a wallet</div>
            <div className="sub">non-custodial · we never touch your keys</div>
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
                onClick={switchToSepolia}
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

          <button
            className="wallet-primary"
            disabled={wrongNet || connecting}
            onClick={connect}
          >
            <span className="wallet-primary-icon">
              <IconMetaMask />
            </span>
            <span className="wallet-primary-body">
              <span className="wallet-name">MetaMask</span>
              <span className="wallet-meta">browser extension · recommended</span>
            </span>
            <span className="wallet-primary-go">
              {connecting ? "connecting…" : "Connect →"}
            </span>
          </button>

          <div className="wallet-divider">
            <span>more wallets soon</span>
          </div>

          <div className="wallet-list">
            {SOON_WALLETS.map((w) => {
              const Icon = WALLET_ICONS[w.id];
              return (
                <div key={w.id} className="wallet-opt is-soon" aria-disabled="true">
                  <span className="wallet-icon">{Icon ? <Icon /> : null}</span>
                  <span className="wallet-opt-body">
                    <span className="wallet-name">{w.name}</span>
                    <span className="wallet-meta">{w.meta}</span>
                  </span>
                  <span className="wallet-soon">Soon</span>
                </div>
              );
            })}
          </div>

          <p
            className="wallet-meta"
            style={{ textAlign: "center", marginTop: 18, lineHeight: 1.6 }}
          >
            Testnet only. You bet play-money Proofs (PRF).<br />
            tETH only pays gas — no real funds are ever at risk.
          </p>
        </div>
      </div>
    </div>
  );
}
