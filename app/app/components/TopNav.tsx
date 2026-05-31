"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useAccount, useDisconnect } from "wagmi";
import { useApp } from "../lib/app-context";
import { reset as resetStore } from "../lib/mock-store";
import { markManuallyDisconnected } from "../lib/wallet-session";
import { fmtChipsFp, fmtGas } from "../features/economy/hooks";

const LANGS = [
  { id: "en", code: "EN", label: "English" },
  { id: "ru", code: "RU", label: "Русский" },
  { id: "ua", code: "UA", label: "Українська" },
] as const;

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <circle
        cx="8"
        cy="8"
        r="6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M1.6 8h12.8M8 1.6c1.9 2 1.9 10.8 0 12.8M8 1.6c-1.9 2-1.9 10.8 0 12.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function LangMenu() {
  const [lang, setLang] = useState("en");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const pillRef = useRef<HTMLButtonElement>(null);
  // The dropdown is portaled to <body>, so it is NOT a descendant of pillRef.
  // Without this ref the document mousedown handler below would treat clicks on
  // the menu items as "outside" and close the menu before the click lands —
  // unmounting the button so its onClick never fires.
  const ddRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const el = pillRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: Math.round(r.bottom + 8),
      right: Math.round(window.innerWidth - r.right),
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pillRef.current?.contains(t) && !ddRef.current?.contains(t))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const cur = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  return (
    <div className="acct-menu" style={{ marginLeft: 0 }}>
      <button
        ref={pillRef}
        className={`glass-pill acct-pill lang-pill${open ? " open" : ""}`}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Language"
      >
        <span className="lang-globe">
          <GlobeIcon />
        </span>
        <span className="lang-cur mono">{cur.code}</span>
        <svg
          className="acct-caret"
          viewBox="0 0 12 8"
          width="11"
          height="8"
          aria-hidden="true"
        >
          <path
            d="M1 1.5 6 6.5 11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={ddRef}
          className="acct-dropdown lang-dropdown"
          role="menu"
          style={{ top: pos.top, right: pos.right, position: "fixed", zIndex: 80 }}
        >
          <div className="cur-dd-head">Language</div>
          <div className="cur-list">
            {LANGS.map((l) => (
              <button
                key={l.id}
                className={`cur-opt${l.id === lang ? " sel" : ""}`}
                role="menuitemradio"
                aria-checked={l.id === lang}
                onClick={() => { setLang(l.id); setOpen(false); }}
              >
                <span className="lang-code mono">{l.code}</span>
                <span className="cur-meta">
                  <span className="cur-name">{l.label}</span>
                </span>
                {l.id === lang && <span className="cur-check">✓</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function WalletMenu() {
  const { walletPRF, inPlay, tEth, address, isMock } = useApp();
  const { connector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const router = useRouter();
  // Live: the active connector's display name ("MetaMask"). Mock has no wagmi
  // connector — the design only offers MetaMask, so mirror that label.
  const walletName = connector?.name ?? (isMock ? "MetaMask" : "Wallet");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const pillRef = useRef<HTMLButtonElement>(null);
  // Portaled to <body> — see ddRef note in LangMenu. Clicks on Deposit/Withdraw
  // must not be swallowed by the outside-click handler.
  const ddRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const el = pillRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pillRef.current?.contains(t) && !ddRef.current?.contains(t))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const short = address ? address.slice(0, 6) + "…" + address.slice(-4) : "";
  // blockie-style conic avatar derived from the address (design makeAccount)
  const h1 = address ? parseInt(address.slice(2, 6), 16) % 360 : 180;
  const h2 = address
    ? (h1 + 70 + (parseInt(address.slice(6, 8), 16) % 110)) % 360
    : (h1 + 80) % 360;
  const rot = address ? parseInt(address.slice(8, 10), 16) : 45;
  const ava = `conic-gradient(from ${rot}deg at 35% 30%, hsl(${h1} 72% 56%), hsl(${h2} 64% 46%), hsl(${h1} 72% 56%))`;

  const total = walletPRF + inPlay;

  const act = (fn: () => void) => { setOpen(false); fn(); };

  const disconnect = () => {
    // Mark the session as explicitly disconnected so ReconnectManager won't
    // silently reconnect on the next page load (that auto-reconnect is what
    // made disconnect look broken). The flag is cleared again when the player
    // reconnects from the Connect screen. Mock: no wagmi connection, so the
    // disconnect call is a no-op and resetStore clears the in-memory wallet.
    markManuallyDisconnected();
    void disconnectAsync().catch(() => {});
    resetStore();
    setOpen(false);
    router.push("/");
  };

  return (
    <div className="acct-menu" style={{ marginLeft: 0 }}>
      <button
        ref={pillRef}
        className={`glass-pill acct-pill wallet-pill${open ? " open" : ""}`}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Wallet & Proofs"
      >
        <span className="acct-ava" style={{ background: ava }} />
        <span className="chips-pill-v mono">{fmtChipsFp(total)}</span>
        <span className="chips-pill-u mono">PRF</span>
        <svg className="acct-caret" viewBox="0 0 12 8" width="11" height="8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={ddRef}
          className="acct-dropdown wallet-dropdown"
          role="menu"
          style={{ top: pos.top, right: pos.right, position: "fixed", zIndex: 80 }}
        >
          <div className="ad-head">
            <span className="acct-ava ad-ava-lg" style={{ background: ava }} />
            <div className="ad-id">
              <div className="ad-wallet">{walletName}</div>
              <button
                className="ad-addr mono"
                onClick={() => {
                  try { navigator.clipboard.writeText(address ?? ""); } catch {}
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                title="Copy address"
              >
                {copied ? "address copied ✓" : short}
              </button>
            </div>
          </div>

          <div className="wallet-chips">
            <div className="cur-dd-head">Your Proofs</div>
            <div className="chips-rows">
              <div className="chips-row">
                <span className="chips-row-k"><span className="chip-token" />In play</span>
                <span className="chips-row-v mono">{fmtChipsFp(inPlay)}</span>
              </div>
              <div className="chips-row">
                <span className="chips-row-k"><span className="chip-token dim" />Wallet</span>
                <span className="chips-row-v mono">{fmtChipsFp(walletPRF)}</span>
              </div>
            </div>
            <div className="chips-acts">
              {walletPRF > 0n ? (
                <button className="chips-act" onClick={() => act(() => router.push("/deposit"))}>Deposit</button>
              ) : (
                <button className="chips-act" onClick={() => act(() => router.push("/faucet"))}>Faucet</button>
              )}
              <button
                className="chips-act primary"
                disabled={inPlay <= 0n}
                onClick={() => inPlay > 0n && act(() => router.push("/withdraw"))}
              >
                Withdraw all
              </button>
            </div>
          </div>

          <div className="ad-rows">
            <div className="ad-row">
              <span className="ad-k">Network</span>
              <span className="ad-v mono"><span className="chip-dot" />Sepolia</span>
            </div>
            <div className="ad-row">
              <span className="ad-k">Gas</span>
              <span className="ad-v mono">{fmtGas(tEth)} tETH</span>
            </div>
          </div>

          <button className="ad-disconnect" onClick={disconnect} role="menuitem">
            Disconnect
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function ConnectingPill() {
  // Header-shaped placeholder shown while wagmi restores the session, so the
  // right cluster doesn't flash between "Connect & play" and the account pill
  // on load. Reuses the reduced-motion-aware spinner.
  return (
    <span
      className="glass-pill hp-connecting"
      role="status"
      aria-live="polite"
      aria-label="Checking wallet"
    >
      <i className="hp-spin" aria-hidden="true" />
      <span className="mono" style={{ fontSize: 12 }}>
        Connecting…
      </span>
    </span>
  );
}

interface TopNavProps {
  active?: "games" | "verify" | "states";
}

export function TopNav(_props: TopNavProps) {
  const { address, verifyRound, resolving } = useApp();
  const pathname = usePathname();

  const isGames = pathname?.startsWith("/games") || pathname === "/games";
  // "Audit" lights only on the auditor screen; per-round /verify/[txHash] is the
  // separate accent "Verify ↗" link (matches the design TopBar).
  const isVerify = pathname === "/verify";
  const isStates = pathname === "/states";

  return (
    <header className="hp-topbar">
      <Link href={address ? "/games" : "/"} style={{ textDecoration: "none" }}>
        <Logo size="header" />
      </Link>
      <nav className="hp-nav">
        <Link
          href="/games"
          className={`hp-nav-link${isGames ? " active" : ""}`}
          style={{ textDecoration: "none" }}
        >
          Games
        </Link>
        <Link
          href="/verify"
          className={`hp-nav-link${isVerify ? " active" : ""}`}
          style={{ textDecoration: "none" }}
        >
          Audit
        </Link>
        <Link
          href="/states"
          className={`hp-nav-link${isStates ? " active" : ""}`}
          style={{ textDecoration: "none" }}
        >
          States
        </Link>
        {verifyRound && (
          <Link
            href={`/verify/${verifyRound.txHash}`}
            className="hp-nav-link"
            style={{ textDecoration: "none", color: "var(--acc)" }}
          >
            Verify ↗
          </Link>
        )}
        {resolving ? (
          <ConnectingPill />
        ) : address ? (
          <WalletMenu />
        ) : (
          <Link
            href="/connect"
            className="btn btn-accent"
            style={{ textDecoration: "none", padding: "10px 18px", fontSize: 12 }}
          >
            Connect & play
          </Link>
        )}
      </nav>
    </header>
  );
}
