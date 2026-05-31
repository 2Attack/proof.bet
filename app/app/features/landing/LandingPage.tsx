"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Logo } from "../../components/Logo";
import { LangMenu } from "../../components/TopNav";
import { ClimbChart } from "../../components/ClimbChart";
import { useSpringValue, useClimb } from "../../lib/spring";
import { getSound } from "../../lib/sound";

// ---------- premium motion utilities ----------
// reveal-on-scroll: scroll-listener based (IO is unreliable in some embeds) +
// a failsafe timeout so content is NEVER left stuck hidden.
function useInView(offset = 0.9) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setInView(true);
      return;
    }
    let done = false;
    const reveal = () => {
      if (!done) {
        done = true;
        setInView(true);
      }
    };
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

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

function Reveal({ children, className = "", delay = 0 }: RevealProps) {
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

// ---------- small formatters ----------
const commas = (n: number): string => Math.round(n).toLocaleString("en-US");
const fmt = (n: number, d = 2): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- social + check glyphs ----------
function IconX() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.97 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
function IconDiscord() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 14 14" width="9" height="9" fill="none" aria-hidden="true">
      <path d="M2.5 7.4 5.4 10.2 11.3 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- game-card art ----------
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
  const dots: React.ReactNode[] = [];
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

function ArtDice() {
  const pip = (x: number, y: number) => <circle cx={x} cy={y} r="3.4" fill="var(--ink-mut)" />;
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="58" y="34" width="62" height="62" rx="13" fill="var(--surf-3)" stroke="var(--line-2)" strokeWidth="1.4" transform="rotate(-9 89 65)" />
      <g transform="rotate(-9 89 65)">{pip(74, 50)}{pip(89, 65)}{pip(104, 80)}</g>
      <rect x="112" y="46" width="54" height="54" rx="12" fill="var(--surf-2)" stroke="var(--acc-line)" strokeWidth="1.4" transform="rotate(7 139 73)" />
      <g transform="rotate(7 139 73)"><circle cx="126" cy="60" r="3.2" fill="var(--acc)" /><circle cx="152" cy="86" r="3.2" fill="var(--acc)" /></g>
    </svg>
  );
}

function ArtCrash() {
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[0.4, 0.7].map((f, i) => (
        <line key={i} x1="0" x2="220" y1={130 * f} y2={130 * f} stroke="var(--line)" strokeWidth="1" />
      ))}
      <path d="M0 118 C40 110 80 80 120 36 L132 22" fill="none" stroke="var(--acc)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M132 22 L150 70 L168 50 L210 116" fill="none" stroke="var(--loss)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 5" opacity="0.85" />
      <circle cx="132" cy="22" r="5" fill="var(--loss)" />
    </svg>
  );
}

function ArtMines() {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = 64 + (i % 3) * 32;
    const cy = 33 + Math.floor(i / 3) * 32;
    cells.push(<rect key={i} x={cx} y={cy} width="26" height="26" rx="6" fill="var(--surf-3)" stroke="var(--line)" strokeWidth="1" />);
  }
  return (
    <svg viewBox="0 0 220 130" className="gc-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {cells}
      <path d="M110 44 l7 9 -7 9 -7 -9 z" fill="var(--acc)" />
      <circle cx="142" cy="78" r="7" fill="var(--loss)" />
      <path d="M142 67 v-5 M142 89 v5 M131 78 h-5 M153 78 h5" stroke="var(--loss)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------- hero stats — spring count-up on first view, then drift ----------
function HeroStats() {
  const [ref, inView] = useInView();
  // spring-driven count-ups (no linear tweens) — honor reduced-motion via the hook
  const players = useSpringValue(inView ? 1284 : 0, "slow", { from: 0 });
  const wagered = useSpringValue(inView ? 3902 : 0, "slow", { from: 0 });
  const settled = Math.round(players) >= 1284;
  const [drift, setDrift] = useState(0);
  useEffect(() => {
    if (!settled) return;
    const iv = setInterval(
      () =>
        setDrift((d) => {
          const next = d + Math.round((Math.random() - 0.42) * 9);
          return Math.max(-40, Math.min(60, next));
        }),
      2600
    );
    return () => clearInterval(iv);
  }, [settled]);
  const playersNow = Math.max(0, Math.round(players) + (settled ? drift : 0));
  return (
    <div className="live-strip" ref={ref}>
      <div className="live-stat">
        <div className="ls-v mono">
          <span className="live-dot" />
          {commas(playersNow)}
        </div>
        <div className="ls-k">playing now</div>
      </div>
      <div className="live-stat">
        <div className="ls-v mono">Ξ {commas(wagered)}</div>
        <div className="ls-k">wagered today</div>
      </div>
      <div className="live-stat">
        <div className="ls-v mono acc">2%</div>
        <div className="ls-k">house edge · stated</div>
      </div>
    </div>
  );
}

// ---------- thin trust strip ----------
const TRUST = [
  "Powered by Chainlink VRF",
  "Open-source contracts",
  "Non-custodial",
  "2% stated edge",
] as const;

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

// ---------- landing demo (decorative, looping money-shot) ----------
// Cosmetic marketing widget only — NOT a real game outcome. Uses a lightweight
// mock round generator + the spring `useClimb` for the number reveal. No audio.
interface DemoRound {
  id: number;
  target: number;
  crash: number;
  stake: number;
  payout: number;
  win: boolean;
}

// heavy-tailed crash like a real crash game; capped for display
function landingCrash(): number {
  const u = Math.random();
  let c = 0.99 / (1 - u * 0.986);
  c = Math.min(c, 64);
  return Math.max(1.0, Math.round(c * 100) / 100);
}
function landingRound(): DemoRound {
  // bias targets low (square of random) so wins/losses both show
  const target = Math.round((1.25 + Math.random() * Math.random() * 6.5) * 100) / 100;
  const crash = landingCrash();
  const stake = Math.round((0.05 + Math.random() * 1.4) * 100) / 100;
  const win = crash >= target;
  return {
    id: Date.now() + Math.random(),
    target,
    crash,
    stake,
    payout: win ? Math.round(stake * target * 100) / 100 : 0,
    win,
  };
}

interface RecentDemo {
  crash: number;
  win: boolean;
}

// Deterministic seeds for the FIRST render — identical on server & client so
// hydration matches. Randomness only kicks in client-side via the loop/effects.
const DEMO_ROUND_SEED: DemoRound = {
  id: 0,
  target: 2.0,
  crash: 3.13,
  stake: 0.25,
  payout: 0.5,
  win: true,
};
const DEMO_RECENT_SEED: RecentDemo[] = [
  { crash: 2.44, win: true },
  { crash: 1.28, win: false },
  { crash: 2.93, win: true },
  { crash: 1.31, win: false },
  { crash: 4.49, win: true },
];

function LandingDemo() {
  const [round, setRound] = useState<DemoRound>(DEMO_ROUND_SEED);
  const [playing, setPlaying] = useState(true);
  const [settled, setSettled] = useState(false);
  const [recent, setRecent] = useState<RecentDemo[]>(DEMO_RECENT_SEED);
  const aliveRef = useRef(true);
  useEffect(() => () => {
    aliveRef.current = false;
  }, []);

  // spring-driven climb 1.00 → crash (the money-shot), gentle marketing config
  const [climbVal, done] = useClimb(1.0, round.crash, playing, {
    stiffness: 30,
    damping: 13,
    mass: 1.18,
  });

  // when the climb settles, mark settled, then loop into a new round
  useEffect(() => {
    if (!playing || !done) return;
    const t = setTimeout(() => {
      if (!aliveRef.current) return;
      setSettled(true);
      setPlaying(false);
      setRecent((r) => [{ crash: round.crash, win: round.win }, ...r].slice(0, 6));
      const next = setTimeout(() => {
        if (!aliveRef.current) return;
        setRound(landingRound());
        setSettled(false);
        setPlaying(true);
      }, 2100);
      timersRef.current.push(next);
    }, 420);
    timersRef.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, playing]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const val = settled ? round.crash : climbVal;
  const win = round.crash >= round.target;
  const crossing = (playing && val >= round.target) || (settled && win);
  const numClass =
    "result-number" +
    (settled ? (win ? " result-win" : " result-loss") : crossing ? " result-win" : "");
  const settleAnim = settled ? (win ? " is-win" : " is-loss") : "";

  return (
    <div className={`stage live${settleAnim}`}>
      <div className="stage-eyebrow eyebrow">Limbo · provably fair</div>

      <ClimbChart
        playing={playing}
        settled={settled}
        val={val}
        target={round.target}
        crash={round.crash}
        win={win}
      />

      <div className="stage-content">
        <div className="stage-numwrap">
          <div className={numClass} aria-live="polite">
            {fmt(val)}
            <span className="x">×</span>
          </div>
          <div className="result-caption">
            {playing && (
              <span className="climb-live">
                <span className="climb-pulse" />
                climbing…
              </span>
            )}
            {settled && win && (
              <>
                <span className="result-verdict verdict-win">Beat {fmt(round.target)}×.</span>
                <span className="payout-flash">+{fmt(round.payout)} PRF</span>
              </>
            )}
            {settled && !win && (
              <>
                <span className="result-verdict verdict-loss">
                  Fell short of {fmt(round.target)}×.
                </span>
                <span style={{ color: "var(--ink-dim)" }}>−{fmt(round.stake)} PRF</span>
              </>
            )}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="recent">
          {recent.map((r, i) => (
            <span key={i} className={`recent-pill ${r.win ? "win" : "loss"}`}>
              {fmt(r.crash)}×
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- live, self-prepending bets feed (decorative) ----------
const LIVE_NAMES = [
  "0x8f…21a", "degenace", "luna.eth", "0x4c…9b2", "satoshi_jr", "vrf_maxi",
  "0x71…0e4", "moonboi", "feltqueen", "0x2a…ff1", "blockchad", "edge.eth",
  "0x9d…3c7", "keccak_k", "nonce404", "0xb3…7a0",
] as const;

interface LiveBet {
  id: number;
  who: string;
  target: number;
  crash: number;
  stake: number;
  win: boolean;
  payout: number;
}

function mkLiveBet(): LiveBet {
  const who = LIVE_NAMES[Math.floor(Math.random() * LIVE_NAMES.length)];
  const stake = Math.round((0.05 + Math.random() * 1.6) * 100) / 100;
  const win = Math.random() < 0.58;
  let target: number;
  let crash: number;
  if (win) {
    const big = Math.random() < 0.18;
    target = Math.round((big ? 4 + Math.random() * 9 : 1.3 + Math.random() * 2.4) * 100) / 100;
    crash = Math.round((target + 0.05 + Math.random() * target * 0.6) * 100) / 100;
  } else {
    target = Math.round((1.4 + Math.random() * 4) * 100) / 100;
    crash = Math.round((1.0 + Math.random() * (target - 1.02)) * 100) / 100;
  }
  return {
    id: Date.now() + Math.random(),
    who,
    target,
    crash,
    stake,
    win,
    payout: win ? Math.round(stake * target * 100) / 100 : 0,
  };
}

// Deterministic first-render rows — identical on server & client (hydration-safe).
const LIVE_BETS_SEED: LiveBet[] = [
  { id: 1, who: "luna.eth", target: 2.0, crash: 3.41, stake: 0.5, win: true, payout: 1.0 },
  { id: 2, who: "0x4c…9b2", target: 1.8, crash: 1.32, stake: 0.25, win: false, payout: 0 },
  { id: 3, who: "vrf_maxi", target: 1.5, crash: 2.18, stake: 0.9, win: true, payout: 1.35 },
  { id: 4, who: "0x71…0e4", target: 2.4, crash: 1.07, stake: 0.15, win: false, payout: 0 },
  { id: 5, who: "edge.eth", target: 1.6, crash: 2.05, stake: 0.6, win: true, payout: 0.96 },
];

function LiveBets() {
  const [bets, setBets] = useState<LiveBet[]>(LIVE_BETS_SEED);
  useEffect(() => {
    const iv = setInterval(() => setBets((b) => [mkLiveBet(), ...b].slice(0, 5)), 1500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="live-feed" role="list" aria-label="Recent bets, live">
      {bets.map((b) => (
        <div key={b.id} className={`bet-row ${b.win ? "win" : "loss"}`} role="listitem">
          <span className="br-who mono">{b.who}</span>
          <span className="br-target mono">{fmt(b.target)}×</span>
          <span className="br-stake mono">
            {fmt(b.stake)} <i>PRF</i>
          </span>
          <span className={`br-result mono ${b.win ? "win" : "loss"}`}>
            {b.win ? `+${fmt(b.payout)}` : `−${fmt(b.stake)}`}
          </span>
        </div>
      ))}
    </div>
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
          <Link
            href="/connect"
            className="btn btn-accent"
            style={{ textDecoration: "none" }}
            onClick={() => {
              getSound().unlock();
              getSound().ui();
            }}
          >
            Connect &amp; play
          </Link>
          <Link
            href="/verify"
            className="btn btn-ghost"
            style={{ textDecoration: "none" }}
            onClick={() => getSound().ui()}
          >
            Audit a round →
          </Link>
        </div>
        <HeroStats />
      </div>

      <div className="landing-board">
        <div className="board-glow" />
        <LandingDemo />
      </div>
    </div>
  );
}

// Live card with the same 3D pointer-tilt + hover sound as the catalog cards.
interface LiveGameCardProps {
  href: string;
  className: string;
  children: React.ReactNode;
}

function LiveGameCard({ href, className, children }: LiveGameCardProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const onMove = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = 5;
    el.style.transform = `perspective(820px) translateY(-4px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };
  return (
    <Link
      href={href}
      className={className}
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerEnter={() => getSound().ui()}
      onClick={() => getSound().ui()}
      style={{ textDecoration: "none" }}
    >
      {children}
    </Link>
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
        <LiveGameCard href="/games/plinko" className="game-card featured">
          <div className="gc-visual">
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
        </LiveGameCard>
        <LiveGameCard href="/games/limbo" className="game-card">
          <div className="gc-visual">
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
        </LiveGameCard>
        {SOON_GAMES.map((g) => {
          const Art = g.art;
          return (
            <div className="game-card soon" key={g.name} aria-disabled="true">
              <div className="gc-visual">
                <Art />
                <div className="gc-badges">
                  <span className="gc-pill soon">Soon</span>
                </div>
              </div>
              <div className="gc-body">
                <div className="gc-title serif">{g.name}</div>
                <div className="gc-tag">{g.tag}</div>
                <div className="gc-foot">
                  <span className="gc-fair">
                    <span className="chip-dot" />provably fair
                  </span>
                  <span className="gc-edge mono">{g.edge}</span>
                  <span className="gc-play">Coming soon</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const SOON_GAMES = [
  { name: "Crash", tag: "Cash out before the bust.", edge: "2% edge", art: ArtCrash },
  { name: "Dice", tag: "Roll over or under your line.", edge: "2% edge", art: ArtDice },
  { name: "Mines", tag: "Find the gems, dodge the bombs.", edge: "2% edge", art: ArtMines },
];

// ---------- how-it-works — illustrated player journey ----------
function HowArtConnect() {
  return (
    <svg viewBox="0 0 220 130" className="hs-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <line x1="46" y1="65" x2="96" y2="65" stroke="var(--acc)" strokeWidth="1.6" strokeDasharray="3 4" />
      <circle cx="46" cy="65" r="8" fill="none" stroke="var(--acc)" strokeWidth="1.6" />
      <circle cx="46" cy="65" r="2.8" fill="var(--acc)" />
      <rect x="96" y="40" width="82" height="50" rx="11" fill="var(--surf-3)" stroke="var(--line-2)" strokeWidth="1.4" />
      <rect x="108" y="54" width="22" height="15" rx="3" fill="var(--acc-glow)" stroke="var(--acc-line)" strokeWidth="1.2" />
      <circle cx="164" cy="65" r="4" fill="var(--acc)" />
    </svg>
  );
}
function HowArtPick() {
  return (
    <svg viewBox="0 0 220 130" className="hs-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="48" y="38" width="34" height="54" rx="8" fill="var(--surf-3)" stroke="var(--line)" strokeWidth="1.2" />
      <rect x="93" y="34" width="34" height="62" rx="8" fill="var(--surf-2)" stroke="var(--acc-line)" strokeWidth="1.7" />
      <rect x="138" y="38" width="34" height="54" rx="8" fill="var(--surf-3)" stroke="var(--line)" strokeWidth="1.2" />
      <circle cx="65" cy="65" r="5" fill="var(--ink-dim)" />
      <circle cx="155" cy="65" r="5" fill="var(--ink-dim)" />
      <path d="M102 64 l5 6 9 -12" fill="none" stroke="var(--acc)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HowArtBet() {
  return (
    <svg viewBox="0 0 220 130" className="hs-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx="78" cy="65" r="23" fill="var(--surf-3)" stroke="var(--acc-line)" strokeWidth="1.6" />
      <circle cx="78" cy="65" r="13" fill="none" stroke="var(--acc)" strokeWidth="1.4" strokeDasharray="3 4" />
      <line x1="118" y1="65" x2="180" y2="65" stroke="var(--line-2)" strokeWidth="3" strokeLinecap="round" />
      <line x1="118" y1="65" x2="158" y2="65" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="158" cy="65" r="6.5" fill="#eafff8" />
    </svg>
  );
}
function HowArtCash() {
  return (
    <svg viewBox="0 0 220 130" className="hs-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M40 98 C76 94 92 64 128 34" fill="none" stroke="var(--acc)" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="128" cy="34" r="5" fill="#eafff8" />
      <circle cx="166" cy="86" r="17" fill="var(--acc-glow)" stroke="var(--acc-line)" strokeWidth="1.4" />
      <path d="M158 86 l6 6 10 -12" fill="none" stroke="var(--acc)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface HowStep {
  n: string;
  art: () => React.ReactElement;
  t: string;
  m: string;
}

const HOW_STEPS: HowStep[] = [
  {
    n: "01",
    art: HowArtConnect,
    t: "Connect a wallet",
    m: "Link any Web3 wallet — MetaMask, Coinbase or WalletConnect. We never hold your funds or your keys.",
  },
  {
    n: "02",
    art: HowArtPick,
    t: "Pick a game",
    m: "Choose Limbo, Plinko or anything in the room. Set your stake and how risky you want to play.",
  },
  {
    n: "03",
    art: HowArtBet,
    t: "Place your bet",
    m: "One tap, one signature. The round runs on-chain and the result lands in a couple of seconds.",
  },
  {
    n: "04",
    art: HowArtCash,
    t: "Cash out — and check",
    m: "Winnings hit your wallet straight away. Want proof it was fair? Re-check any round yourself, anytime.",
  },
];

function HowItWorks() {
  const [gridRef, gridIn] = useInView();
  return (
    <div className="landing-how">
      <Reveal className="lg-head">
        <h2 className="lg-title serif">How it works</h2>
        <span className="kicker">no trust required — only math</span>
      </Reveal>
      <div className={`how-grid${gridIn ? " in" : ""}`} ref={gridRef}>
        {HOW_STEPS.map((s) => {
          const Art = s.art;
          return (
            <div className="how-step" key={s.n}>
              <div className="hs-visual">
                <Art />
                <span className="hs-num mono">{s.n}</span>
              </div>
              <div className="hs-body">
                <div className="hs-title serif">{s.t}</div>
                <div className="hs-text">{s.m}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="how-foot">
        <span className="kicker">every round carries its own receipt</span>
        <Link
          href="/verify"
          className="how-cta"
          style={{ textDecoration: "none" }}
          onClick={() => getSound().ui()}
        >
          Audit any round <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
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
        <Link
          href="/connect"
          className="btn btn-accent"
          style={{ textDecoration: "none" }}
          onClick={() => {
            getSound().unlock();
            getSound().ui();
          }}
        >
          Connect &amp; play
        </Link>
        <Link
          href="/verify"
          className="btn btn-ghost"
          style={{ textDecoration: "none" }}
          onClick={() => getSound().ui()}
        >
          Audit a round →
        </Link>
      </div>
    </Reveal>
  );
}

function LandingFooter() {
  const noop = (e: React.MouseEvent) => e.preventDefault();
  return (
    <footer className="site-foot">
      <div className="sf-top">
        <div className="sf-brand">
          <Logo size="header" />
          <p className="sf-manifesto serif">
            The house always wins.<br />
            <em>Now you can prove it.</em>
          </p>
          <div className="sf-social">
            <a className="sf-ico" href="#" onClick={noop} aria-label="Discord">
              <IconDiscord />
            </a>
            <a className="sf-ico" href="#" onClick={noop} aria-label="X">
              <IconX />
            </a>
            <a className="sf-ico" href="#" onClick={noop} aria-label="GitHub">
              <IconGitHub />
            </a>
          </div>
        </div>
        <div className="sf-cols">
          <div className="sf-col">
            <div className="sf-h">Games</div>
            <Link href="/games/limbo" className="sf-link" style={{ textDecoration: "none" }}>
              Limbo
            </Link>
            <Link href="/games/plinko" className="sf-link" style={{ textDecoration: "none" }}>
              Plinko
            </Link>
            <Link href="/games" className="sf-link" style={{ textDecoration: "none" }}>
              All games
            </Link>
          </div>
          <div className="sf-col">
            <div className="sf-h">Provably fair</div>
            <Link href="/verify" className="sf-link" style={{ textDecoration: "none" }}>
              Round auditor
            </Link>
            <a className="sf-link" href="#" onClick={noop}>
              How it works
            </a>
            <a className="sf-link" href="#" onClick={noop}>
              Smart contract ↗
            </a>
          </div>
          <div className="sf-col">
            <div className="sf-h">Company</div>
            <a className="sf-link" href="#" onClick={noop}>
              About
            </a>
            <a className="sf-link" href="#" onClick={noop}>
              Responsible play
            </a>
            <a className="sf-link" href="#" onClick={noop}>
              Terms
            </a>
          </div>
          <div className="sf-col">
            <div className="sf-h">Community</div>
            <a className="sf-link" href="#" onClick={noop}>
              Discord
            </a>
            <a className="sf-link" href="#" onClick={noop}>
              X / Twitter
            </a>
            <a className="sf-link" href="#" onClick={noop}>
              GitHub
            </a>
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
            <LangMenu />
            <Link
              href="/connect"
              className="btn btn-accent"
              style={{ textDecoration: "none" }}
              onClick={() => {
                getSound().unlock();
                getSound().ui();
              }}
            >
              Connect &amp; play
            </Link>
          </nav>
        </div>
      </div>

      <LandingHero />

      <TrustBar />

      <GamesSection />

      <div className="landing-live">
        <Reveal className="lg-head">
          <h2 className="lg-title serif">Last rounds</h2>
          <span className="live-tag">
            <span className="live-dot" />live
          </span>
        </Reveal>
        <LiveBets />
      </div>

      <HowItWorks />

      <ClosingCTA />

      <LandingFooter />
    </div>
  );
}
