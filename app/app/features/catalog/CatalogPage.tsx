"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TopNav } from "../../components/TopNav";
import { useApp } from "../../lib/app-context";
import { Suspense } from "react";

function ArtLimbo() {
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[0.28, 0.52, 0.76].map((f, i) => (
        <line key={i} x1="0" x2="220" y1={130 * f} y2={130 * f} stroke="var(--line)" strokeWidth="1" />
      ))}
      <path d="M0 122 C70 120 120 96 160 44 C172 28 184 18 210 10" fill="none"
        stroke="var(--acc)" strokeWidth="2.4" strokeLinecap="round" />
      <defs>
        <linearGradient id="gcGradL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(95,227,192,0.18)" />
          <stop offset="100%" stopColor="rgba(95,227,192,0)" />
        </linearGradient>
      </defs>
      <path d="M0 122 C70 120 120 96 160 44 C172 28 184 18 210 10 L210 130 L0 130 Z"
        fill="url(#gcGradL)" opacity="0.5" />
      <circle cx="210" cy="10" r="5" fill="#eafff8" />
    </svg>
  );
}

function ArtPlinko() {
  const dots = [];
  for (let r = 1; r <= 5; r++) {
    for (let j = 0; j <= r; j++) {
      const x = 110 + (j - r / 2) * 26;
      const y = 22 + r * 15;
      dots.push(<circle key={`${r}-${j}`} cx={x} cy={y} r="2.4" fill="var(--ink-dim)" />);
    }
  }
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {dots}
      <path d="M110 12 L110 24 L123 38 L110 52 L123 66 L136 80 L149 94" fill="none"
        stroke="var(--acc-line)" strokeWidth="1.4" strokeDasharray="2 3" />
      <circle cx="149" cy="96" r="6" fill="#eafff8" />
      <circle cx="149" cy="96" r="11" fill="none" stroke="var(--acc)" strokeWidth="1.4" opacity="0.5" />
    </svg>
  );
}

function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useApp();
  const faucetOpenedRef = useRef(false);

  useEffect(() => {
    if (searchParams?.get("openFaucet") === "1" && address && !faucetOpenedRef.current) {
      faucetOpenedRef.current = true;
      // Clear the param first so back-nav doesn't re-trigger
      router.replace("/games");
      router.push("/faucet");
    }
  }, [searchParams, address, router]);

  return (
    <div className="catalog hp-screen">
      <div className="catalog-head">
        <div>
          <div className="eyebrow">Game catalog · all provably fair</div>
          <h1 className="catalog-h">Pick your game.</h1>
        </div>
        <p className="catalog-sub">
          Every outcome — every climb, every bounce — is re-derived from on-chain
          randomness. You can verify any round yourself. The library grows from here.
        </p>
      </div>

      <div className="catalog-grid">
        {/* Plinko — featured */}
        <Link href="/games/plinko" style={{ textDecoration: "none" }}>
          <div className="game-card featured">
            <div className="gc-visual" style={{ minHeight: 180 }}>
              <ArtPlinko />
              <div className="gc-badges">
                <span className="gc-pill new">New</span>
                <span className="gc-pill live"><span className="chip-dot" />Live</span>
              </div>
            </div>
            <div className="gc-body">
              <div className="gc-title serif">Plinko</div>
              <div className="gc-tag">Drop the ball. Ride the edges.</div>
              <div className="gc-foot">
                <span className="gc-fair"><span className="chip-dot" />provably fair</span>
                <span className="gc-edge mono">~1.9% edge</span>
                <span className="gc-play">Play →</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Limbo */}
        <Link href="/games/limbo" style={{ textDecoration: "none" }}>
          <div className="game-card">
            <div className="gc-visual">
              <ArtLimbo />
              <div className="gc-badges">
                <span className="gc-pill live"><span className="chip-dot" />Live</span>
              </div>
            </div>
            <div className="gc-body">
              <div className="gc-title serif">Limbo</div>
              <div className="gc-tag">Set a target. Beat the climb.</div>
              <div className="gc-foot">
                <span className="gc-fair"><span className="chip-dot" />provably fair</span>
                <span className="gc-edge mono">2% edge</span>
                <span className="gc-play">Play →</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Coming soon */}
        {[
          { id: "crash", name: "Crash", tag: "Cash out before the bust." },
          { id: "dice", name: "Dice", tag: "Roll over or under your line." },
          { id: "mines", name: "Mines", tag: "Find the gems, dodge the bombs." },
        ].map((g) => (
          <div key={g.id} className="game-card soon">
            <div className="gc-visual" style={{ minHeight: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                coming soon
              </span>
              <div className="gc-badges">
                <span className="gc-pill soon">Soon</span>
              </div>
            </div>
            <div className="gc-body">
              <div className="gc-title serif">{g.name}</div>
              <div className="gc-tag">{g.tag}</div>
              <div className="gc-foot">
                <span className="gc-fair"><span className="chip-dot" />provably fair</span>
                <span className="gc-edge mono">2% edge</span>
                <span className="gc-play" style={{ color: "var(--ink-dim)" }}>Coming soon</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CatalogPage() {
  return (
    <div className="hp-screen">
      <TopNav />
      <Suspense fallback={null}>
        <CatalogContent />
      </Suspense>
    </div>
  );
}
