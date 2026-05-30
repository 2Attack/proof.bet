"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../../components/Logo";
import { Btn } from "../../components/Btn";

function useInView(offset = 0.9) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setInView(true); return; }
    let done = false;
    const reveal = () => { if (!done) { done = true; setInView(true); } };
    const check = () => {
      if (done) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * offset && r.bottom > 0) reveal();
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
    const t = setTimeout(check, 80);
    const failsafe = setTimeout(reveal, 2000);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      clearTimeout(t);
      clearTimeout(failsafe);
    };
  }, [offset]);
  return [ref, inView] as const;
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal${inView ? " in" : ""}${className ? " " + className : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 14 14" width="9" height="9" fill="none" aria-hidden="true">
      <path d="M2.5 7.4 5.4 10.2 11.3 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRUST = [
  "Powered by Chainlink VRF",
  "Open-source contracts",
  "Non-custodial",
  "2% stated edge",
];

function TrustBar() {
  return (
    <Reveal className="trust-bar">
      {TRUST.map((t, i) => (
        <span className="trust-item" key={i}>
          <span className="trust-tick">
            <IconCheck />
          </span>
          {t}
        </span>
      ))}
    </Reveal>
  );
}

function ArtLimbo() {
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[0.28, 0.52, 0.76].map((f, i) => (
        <line key={i} x1="0" x2="220" y1={130 * f} y2={130 * f} stroke="var(--line)" strokeWidth="1" />
      ))}
      <path d="M0 122 C70 120 120 96 160 44 C172 28 184 18 210 10" fill="none"
        stroke="var(--acc)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M0 122 C70 120 120 96 160 44 C172 28 184 18 210 10 L210 130 L0 130 Z"
        fill="url(#gcGrad)" opacity="0.5" />
      <defs>
        <linearGradient id="gcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(95,227,192,0.18)" />
          <stop offset="100%" stopColor="rgba(95,227,192,0)" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="10" r="5" fill="#eafff8" />
      <circle cx="210" cy="10" r="10" fill="none" stroke="var(--acc-line)" strokeWidth="1.5" />
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
    </svg>
  );
}

function LandingHero() {
  return (
    <div className="landing-hero">
      <div className="landing-copy">
        <h1 className="landing-h1">
          Every&nbsp;bet,<br />
          <em style={{ fontFamily: "var(--serif)" }}>with&nbsp;proof.</em>
        </h1>
        <p className="landing-sub">
          A provably-fair casino where every outcome is re-derived from on-chain
          randomness — in your own browser. The math is open. The edge is stated.
        </p>
        <div className="landing-cta">
          <Link href="/connect" className="btn btn-accent" style={{ textDecoration: "none" }}>
            Connect &amp; play
          </Link>
          <Link href="/verify" className="btn btn-ghost" style={{ textDecoration: "none" }}>
            Audit a round →
          </Link>
        </div>
        <div className="live-strip" style={{ marginTop: 32 }}>
          <div className="live-stat">
            <div className="ls-v mono">
              <span className="live-dot" />
              1,284
            </div>
            <div className="ls-k">playing now</div>
          </div>
          <div className="live-stat">
            <div className="ls-v mono">Ξ 3,902</div>
            <div className="ls-k">wagered today</div>
          </div>
          <div className="live-stat">
            <div className="ls-v mono acc">2%</div>
            <div className="ls-k">house edge · stated</div>
          </div>
        </div>
      </div>

      <div className="landing-board">
        <div className="board-glow" />
        <div
          style={{
            background: "var(--surf-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            padding: 24,
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 4 }}
          >
            Limbo · provably fair
          </div>
          <div
            className="result-number result-win"
            style={{ fontSize: 72, lineHeight: 1 }}
          >
            4.21<span className="x">×</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="result-verdict verdict-win" style={{ fontSize: 14 }}>Beat 2.00×.</span>
            <span
              className="mono"
              style={{ fontSize: 16, color: "var(--acc)", fontWeight: 600 }}
            >
              +210.00 PRF
            </span>
          </div>
          <ArtLimbo />
        </div>
      </div>
    </div>
  );
}

function GamesSection() {
  return (
    <section className="landing-games">
      <div className="lg-head">
        <h2 className="lg-title serif">The games</h2>
        <span className="kicker">all provably fair · the library grows</span>
      </div>
      <div className="lg-grid">
        <Link href="/games/plinko" style={{ textDecoration: "none" }}>
          <div className="game-card featured" style={{ cursor: "pointer" }}>
            <div className="gc-visual" style={{ minHeight: 130 }}>
              <ArtPlinko />
              <div className="gc-badges">
                <span className="gc-pill new">New</span>
                <span className="gc-pill live">
                  <span className="chip-dot" />Live
                </span>
              </div>
            </div>
            <div className="gc-body">
              <div className="gc-title serif">Plinko</div>
              <div className="gc-tag">Drop the ball. Ride the edges.</div>
              <div className="gc-foot">
                <span className="gc-fair">
                  <span className="chip-dot" />provably fair
                </span>
                <span className="gc-edge mono">~1.9% edge</span>
                <span className="gc-play">Play →</span>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/games/limbo" style={{ textDecoration: "none" }}>
          <div className="game-card" style={{ cursor: "pointer" }}>
            <div className="gc-visual" style={{ minHeight: 130 }}>
              <ArtLimbo />
              <div className="gc-badges">
                <span className="gc-pill live">
                  <span className="chip-dot" />Live
                </span>
              </div>
            </div>
            <div className="gc-body">
              <div className="gc-title serif">Limbo</div>
              <div className="gc-tag">Set a target. Beat the climb.</div>
              <div className="gc-foot">
                <span className="gc-fair">
                  <span className="chip-dot" />provably fair
                </span>
                <span className="gc-edge mono">2% edge</span>
                <span className="gc-play">Play →</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <Reveal className="closing-cta">
      <div className="cc-glow" aria-hidden="true" />
      <h2 className="cc-h">
        <span className="serif">Ready to bet</span> with proof?
      </h2>
      <p className="cc-sub">
        No sign-up, no deposit forms. Connect a wallet, play a round, and verify
        the outcome yourself.
      </p>
      <div className="cc-actions">
        <Link href="/connect" className="btn btn-accent" style={{ textDecoration: "none" }}>
          Connect &amp; play
        </Link>
        <Link href="/verify" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          Audit a round →
        </Link>
      </div>
    </Reveal>
  );
}

function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="sf-top">
        <div className="sf-brand">
          <Logo size="header" />
          <p className="sf-manifesto serif">
            The house always wins.<br />
            <em>Now you can prove it.</em>
          </p>
        </div>
        <div className="sf-cols">
          <div className="sf-col">
            <div className="sf-h">Games</div>
            <Link href="/games/limbo" className="sf-link" style={{ textDecoration: "none" }}>Limbo</Link>
            <Link href="/games/plinko" className="sf-link" style={{ textDecoration: "none" }}>Plinko</Link>
            <Link href="/games" className="sf-link" style={{ textDecoration: "none" }}>All games</Link>
          </div>
          <div className="sf-col">
            <div className="sf-h">Provably fair</div>
            <Link href="/verify" className="sf-link" style={{ textDecoration: "none" }}>Round auditor</Link>
            <a className="sf-link" href="#">How it works</a>
          </div>
          <div className="sf-col">
            <div className="sf-h">Company</div>
            <a className="sf-link" href="#">About</a>
            <a className="sf-link" href="#">Responsible play</a>
            <a className="sf-link" href="#">Terms</a>
          </div>
        </div>
      </div>
      <div className="sf-bottom">
        <span className="sf-tech mono">
          <span className="vrf-badge">Chainlink VRF</span>
          Built on Sepolia · chainId 11155111
        </span>
        <span className="kicker">v0.9 · testnet · play money only</span>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="landing hp-screen">
      {/* Landing top bar */}
      <div className="landing-topbar">
        <div className="landing-topbar-inner">
          <Logo size="header" />
          <nav className="landing-topnav">
            <Link href="/connect" className="btn btn-accent" style={{ textDecoration: "none" }}>
              Connect &amp; play
            </Link>
          </nav>
        </div>
      </div>

      <LandingHero />
      <TrustBar />
      <GamesSection />
      <ClosingCTA />
      <SiteFooter />
    </div>
  );
}
