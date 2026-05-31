// ============================================================
// HOUSEPROOF — landing, connect, pending, auditor, errors, nudge
// ============================================================
const { useState: useStateSc, useEffect: useEffectSc, useRef: useRefSc } = React;

// ---------- premium motion utilities ----------
// reveal-on-scroll: scroll-listener based (IO is unreliable in some embeds) +
// a failsafe timeout so content is NEVER left stuck hidden.
function useInView({ offset = 0.9 } = {}) {
  const ref = useRefSc(null);
  const [inView, setInView] = useStateSc(false);
  useEffectSc(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setInView(true); return; }
    let done = false;
    const reveal = () => { if (!done) { done = true; setInView(true); cleanup(); } };
    const check = () => {
      if (done) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh * offset && r.bottom > 0) reveal();
    };
    const cleanup = () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      clearTimeout(failsafe);
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    const t = setTimeout(check, 80);
    const failsafe = setTimeout(reveal, 2000);
    return () => { cleanup(); clearTimeout(t); };
  }, []);
  return [ref, inView];
}
function Reveal({ children, className = '', delay = 0, as = 'div', style = {}, ...rest }) {
  const [ref, inView] = useInView();
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal${inView ? ' in' : ''}${className ? ' ' + className : ''}`}
      style={{ transitionDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
// count-up toward a target with easeOutCubic; starts when `start` is true.
// rAF for smoothness + a timeout backstop so the final value always shows
// even when rAF is throttled (background tab / unfocused embed).
function useCountUp(target, { start = true, duration = 1500 } = {}) {
  const [val, setVal] = useStateSc(0);
  const rafRef = useRefSc(0);
  useEffectSc(() => {
    if (!start) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    let t0 = null, done = false;
    const finish = () => { if (!done) { done = true; setVal(target); } };
    const tick = (t) => {
      if (done) return;
      if (t0 == null) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else finish();
    };
    rafRef.current = requestAnimationFrame(tick);
    const backstop = setTimeout(finish, duration + 500);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(backstop); };
  }, [start, target, duration]);
  return val;
}
const commas = (n) => Math.round(n).toLocaleString('en-US');

// social glyphs
function IconX() { return (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.97 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>); }
function IconGitHub() { return (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>); }
function IconDiscord() { return (<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>); }
function IconCheck() { return (<svg viewBox="0 0 14 14" width="9" height="9" fill="none" aria-hidden="true"><path d="M2.5 7.4 5.4 10.2 11.3 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>); }

// hero stats — count up on first view, then "playing now" drifts to feel live
function HeroStats() {
  const [ref, inView] = useInView();
  const players = useCountUp(1284, { start: inView });
  const wagered = useCountUp(3902, { start: inView });
  const settled = Math.round(players) >= 1284;
  const [drift, setDrift] = useStateSc(0);
  useEffectSc(() => {
    if (!settled) return;
    const iv = setInterval(() => setDrift((d) => {
      const next = d + Math.round((Math.random() - 0.42) * 9);
      return Math.max(-40, Math.min(60, next));
    }), 2600);
    return () => clearInterval(iv);
  }, [settled]);
  const playersNow = Math.max(0, Math.round(players) + (settled ? drift : 0));
  return (
    <div className="live-strip" ref={ref}>
      <div className="live-stat">
        <div className="ls-v mono"><span className="live-dot" />{commas(playersNow)}</div>
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

// thin trust strip — the proof-first signals a normal casino can't show
const TRUST = ['Powered by Chainlink VRF', 'Open-source contracts', 'Non-custodial', '2% stated edge'];
function TrustBar() {
  return (
    <Reveal className="trust-bar">
      {TRUST.map((t, i) => (
        <span className="trust-item" key={i}><span className="trust-tick"><IconCheck /></span>{t}</span>
      ))}
    </Reveal>
  );
}

// closing conversion band before the footer
function ClosingCTA({ onEnter }) {
  return (
    <Reveal className="closing-cta">
      <div className="cc-glow" aria-hidden="true" />
      <h2 className="cc-h"><span className="serif">Ready to bet</span> with proof?</h2>
      <p className="cc-sub">No sign-up, no deposit forms. Connect a wallet, play a round, and verify the outcome yourself.</p>
      <div className="cc-actions">
        <Btn kind="accent" onClick={() => onEnter()}>Connect &amp; play</Btn>
        <Btn kind="ghost" onClick={() => onEnter('auditor')}>Audit a round →</Btn>
      </div>
    </Reveal>
  );
}

// rich site footer
function LandingFooter({ onEnter }) {
  const noop = (e) => e.preventDefault();
  return (
    <footer className="site-foot">
      <div className="sf-top">
        <div className="sf-brand">
          <div className="brand-wordmark" data-size="header"><span className="wm-word">proof<span className="wm-tld">.bet</span></span></div>
          <p className="sf-manifesto serif">The house always wins.<br /><em>Now you can prove it.</em></p>
          <div className="sf-social">
            <a className="sf-ico" href="#" onClick={noop} aria-label="Discord"><IconDiscord /></a>
            <a className="sf-ico" href="#" onClick={noop} aria-label="X"><IconX /></a>
            <a className="sf-ico" href="#" onClick={noop} aria-label="GitHub"><IconGitHub /></a>
          </div>
        </div>
        <div className="sf-cols">
          <div className="sf-col">
            <div className="sf-h">Games</div>
            <button className="sf-link" onClick={() => onEnter()}>Limbo</button>
            <button className="sf-link" onClick={() => onEnter()}>Plinko</button>
            <button className="sf-link" onClick={() => onEnter()}>All games</button>
          </div>
          <div className="sf-col">
            <div className="sf-h">Provably fair</div>
            <button className="sf-link" onClick={() => onEnter('auditor')}>Round auditor</button>
            <a className="sf-link" href="#" onClick={noop}>How it works</a>
            <a className="sf-link" href="#" onClick={noop}>Smart contract ↗</a>
          </div>
          <div className="sf-col">
            <div className="sf-h">Company</div>
            <a className="sf-link" href="#" onClick={noop}>About</a>
            <a className="sf-link" href="#" onClick={noop}>Responsible play</a>
            <a className="sf-link" href="#" onClick={noop}>Terms</a>
          </div>
          <div className="sf-col">
            <div className="sf-h">Community</div>
            <a className="sf-link" href="#" onClick={noop}>Discord</a>
            <a className="sf-link" href="#" onClick={noop}>X / Twitter</a>
            <a className="sf-link" href="#" onClick={noop}>GitHub</a>
          </div>
        </div>
      </div>
      <div className="sf-bottom">
        <span className="sf-tech mono"><span className="vrf-badge">Chainlink VRF</span>Built on Sepolia · chainId 11155111 · 0x71C…3F2a</span>
        <span className="kicker">v0.9 · testnet · play money only</span>
      </div>
    </footer>
  );
}

// ---------- LANDING DEMO HELPERS ----------
// heavy-tailed crash like a real crash game; capped for display
function landingCrash() {
  const u = Math.random();
  let c = 0.99 / (1 - u * 0.986);
  c = Math.min(c, 64);
  return Math.max(1.0, Math.round(c * 100) / 100);
}
function landingRound() {
  // bias targets low (square of random) so wins/losses both show
  const target = Math.round((1.25 + Math.random() * Math.random() * 6.5) * 100) / 100;
  const crash = landingCrash();
  const stake = Math.round((0.05 + Math.random() * 1.4) * 100) / 100;
  const win = crash >= target;
  return { id: Date.now() + Math.random(), target, crash, stake, payout: win ? Math.round(stake * target * 100) / 100 : 0, win };
}

const LIVE_NAMES = [
'0x8f…21a', 'degenace', 'luna.eth', '0x4c…9b2', 'satoshi_jr', 'vrf_maxi',
'0x71…0e4', 'moonboi', 'feltqueen', '0x2a…ff1', 'blockchad', 'edge.eth',
'0x9d…3c7', 'keccak_k', 'nonce404', '0xb3…7a0'];


// the looping money-shot that anchors the landing
function LandingDemo() {
  const [phase, setPhase] = useStateSc('revealing');
  const [round, setRound] = useStateSc(landingRound);
  const [recent, setRecent] = useStateSc(() => Array.from({ length: 5 }, () => {
    const c = landingCrash();return { crash: c, win: c >= 2 };
  }));
  const aliveRef = useRefSc(true);

  useEffectSc(() => () => {aliveRef.current = false;}, []);

  const onSettle = () => {
    setPhase('settled');
    setRecent((r) => [{ crash: round.crash, win: round.win }, ...r].slice(0, 6));
    setTimeout(() => {
      if (!aliveRef.current) return;
      setRound(landingRound());
      setPhase('revealing');
    }, 2100);
  };

  return (
    <ResultStage
      phase={phase} round={round} onSettle={onSettle} recent={recent}
      target={round.target} climbCfg={{ stiffness: 30, damping: 13, mass: 1.18 }} />);

}

// live, self-prepending bets feed — the "this room is busy" signal
function LiveBets() {
  // bias toward a lively mix: ~58% wins, occasional flashy multiplier
  const mk = () => {
    const who = LIVE_NAMES[Math.floor(Math.random() * LIVE_NAMES.length)];
    const stake = Math.round((0.05 + Math.random() * 1.6) * 100) / 100;
    const win = Math.random() < 0.58;
    let target, crash;
    if (win) {
      const big = Math.random() < 0.18;
      target = Math.round((big ? 4 + Math.random() * 9 : 1.3 + Math.random() * 2.4) * 100) / 100;
      crash = Math.round((target + 0.05 + Math.random() * target * 0.6) * 100) / 100;
    } else {
      target = Math.round((1.4 + Math.random() * 4) * 100) / 100;
      crash = Math.round((1.0 + Math.random() * (target - 1.02)) * 100) / 100;
    }
    return { id: Date.now() + Math.random(), who, target, crash, stake, win, payout: win ? Math.round(stake * target * 100) / 100 : 0 };
  };
  const [bets, setBets] = useStateSc(() => Array.from({ length: 5 }, mk));
  useEffectSc(() => {
    const iv = setInterval(() => setBets((b) => [mk(), ...b].slice(0, 5)), 1500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="live-feed" role="list" aria-label="Recent bets, live">
      {bets.map((b) =>
      <div key={b.id} className={`bet-row ${b.win ? 'win' : 'loss'}`} role="listitem">
          <span className="br-who mono">{b.who}</span>
          <span className="br-target mono">{fmt(b.target)}×</span>
          <span className="br-stake mono">{fmt(b.stake)} <i>PRF</i></span>
          <span className={`br-result mono ${b.win ? 'win' : 'loss'}`}>
            {b.win ? `+${fmt(b.payout)}` : `−${fmt(b.stake)}`}
          </span>
        </div>
      )}
    </div>);

}

// ---------- LANDING ----------
function Landing({ onEnter, lang, setLang }) {
  return (
    <div className="landing hp-screen">
      <div className="landing-topbar">
        <div className="landing-topbar-inner">
          <div className="brand-wordmark" data-size="header">
            <span className="wm-word">proof<span className="wm-tld">.bet</span></span>
          </div>
          <nav className="landing-topnav">
            <LangMenu lang={lang} setLang={setLang} />
            <Btn kind="accent" onClick={() => onEnter()}>Connect &amp; play</Btn>
          </nav>
        </div>
      </div>
      <div className="landing-hero">
        <div className="landing-copy">
          <h1 className="landing-h1">Every&nbsp;bet,<br /><em style={{ fontFamily: "Fraunces" }}>with&nbsp;proof.</em></h1>
          <p className="landing-sub">
            A provably-fair casino where every outcome is re-derived from on-chain
            randomness — in your own browser. The math is open. The edge is stated.
          </p>
          <div className="landing-cta">
            <Btn kind="accent" onClick={onEnter}>Connect & play</Btn>
            <Btn kind="ghost" onClick={() => onEnter('auditor')}>Audit a round →</Btn>
          </div>
          <HeroStats />
        </div>

        <div className="landing-board">
          <div className="board-glow" />
          <LandingDemo />
        </div>
      </div>

      <TrustBar />

      <LandingGames onPlay={() => onEnter()} />

      <div className="landing-live">
        <Reveal as="div" className="lg-head">
          <h2 className="lg-title serif">Last rounds</h2>
          <span className="live-tag"><span className="live-dot" />live</span>
        </Reveal>
        <LiveBets />
      </div>

      <HowItWorks onEnter={onEnter} />

      <ClosingCTA onEnter={onEnter} />

      <LandingFooter onEnter={onEnter} />
    </div>);

}

// how-it-works — the player journey, illustrated like the game cards
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
const HOW_STEPS = [
  { n: '01', art: HowArtConnect, t: 'Connect a wallet', m: 'Link any Web3 wallet — MetaMask, Coinbase or WalletConnect. We never hold your funds or your keys.' },
  { n: '02', art: HowArtPick, t: 'Pick a game', m: 'Choose Limbo, Plinko or anything in the room. Set your stake and how risky you want to play.' },
  { n: '03', art: HowArtBet, t: 'Place your bet', m: 'One tap, one signature. The round runs on-chain and the result lands in a couple of seconds.' },
  { n: '04', art: HowArtCash, t: 'Cash out — and check', m: 'Winnings hit your wallet straight away. Want proof it was fair? Re-check any round yourself, anytime.' },
];
function HowItWorks({ onEnter }) {
  const [gridRef, gridIn] = useInView();
  return (
    <div className="landing-how">
      <Reveal as="div" className="lg-head">
        <h2 className="lg-title serif">How it works</h2>
        <span className="kicker">no trust required — only math</span>
      </Reveal>
      <div className={`how-grid${gridIn ? ' in' : ''}`} ref={gridRef}>
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
        <button className="how-cta" onClick={() => onEnter('auditor')}>Audit any round <span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}

// ---------- CONNECT ----------
const WALLETS = [
{ id: 'metamask', name: 'MetaMask', meta: 'browser extension', tint: '#5FE3C0' },
{ id: 'walletconnect', name: 'WalletConnect', meta: 'scan to pair', tint: '#3a6f64' },
{ id: 'coinbase', name: 'Coinbase Wallet', meta: 'browser extension', tint: '#2c4f48' }];

// brand marks
const IconMetaMask = () =>
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
</svg>;

const IconWalletConnect = () =>
<svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden="true">
  <rect width="40" height="40" rx="11" fill="#3B99FC" />
  <path d="M11.8 15.4c4.5-4.4 11.9-4.4 16.4 0l.6.5c.2.2.2.6 0 .8l-1.9 1.8c-.1.1-.3.1-.4 0l-.8-.7c-3.2-3.1-8.3-3.1-11.4 0l-.8.8c-.1.1-.3.1-.4 0l-1.9-1.8c-.2-.2-.2-.6 0-.8l1-.6zm20.2 3.8 1.7 1.6c.2.2.2.6 0 .8l-7.6 7.4c-.2.2-.6.2-.8 0l-5.4-5.3c0-.1-.1-.1-.2 0l-5.4 5.3c-.2.2-.6.2-.8 0L5.9 21.6c-.2-.2-.2-.6 0-.8l1.7-1.6c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.2 0l5.4-5.3c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.2 0l5.4-5.3c.2-.2.6-.2.8 0z" fill="#fff" />
</svg>;

const IconCoinbase = () =>
<svg viewBox="0 0 40 40" width="30" height="30" fill="none" aria-hidden="true">
  <rect width="40" height="40" rx="11" fill="#0052FF" />
  <path d="M20 8a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm-3.3 8.4c0-.9.7-1.6 1.6-1.6h3.4c.9 0 1.6.7 1.6 1.6v7.2c0 .9-.7 1.6-1.6 1.6h-3.4c-.9 0-1.6-.7-1.6-1.6v-7.2z" fill="#fff" />
</svg>;

const WALLET_ICONS = { metamask: IconMetaMask, walletconnect: IconWalletConnect, coinbase: IconCoinbase };

function Connect({ onConnected }) {
  const [connecting, setConnecting] = useStateSc(false);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => {setConnecting(false);onConnected('metamask');}, 900);
  };

  const soon = WALLETS.filter((w) => w.id !== 'metamask');

  return (
    <div className="center-stage hp-screen">
      <div className="glass connect-card">
        <div className="connect-head">
          <div className="serif">Connect a wallet</div>
          <div className="sub">non-custodial · we never touch your keys</div>
        </div>

        <div className="net-banner info">
            <span className="net-dot" />
            <span className="grow">This dApp runs on the Sepolia testnet. MetaMask will ask to switch if needed.</span>
            <span className="mono" style={{ fontSize: 11 }}>chainId 11155111</span>
          </div>

        <button className="wallet-primary" disabled={connecting} onClick={connect}>
          <span className="wallet-primary-icon"><IconMetaMask /></span>
          <span className="wallet-primary-body">
            <span className="wallet-name">MetaMask</span>
            <span className="wallet-meta">browser extension · recommended</span>
          </span>
          <span className="wallet-primary-go">{connecting ? 'connecting…' : 'Connect →'}</span>
        </button>

        <div className="wallet-divider"><span>more wallets soon</span></div>

        <div className="wallet-list">
          {soon.map((w) => {
            const Icon = WALLET_ICONS[w.id];
            return (
              <div key={w.id} className="wallet-opt is-soon" aria-disabled="true">
                <span className="wallet-icon"><Icon /></span>
                <span className="wallet-opt-body">
                  <span className="wallet-name">{w.name}</span>
                  <span className="wallet-meta">{w.meta}</span>
                </span>
                <span className="wallet-soon">Soon</span>
              </div>);
          })}
        </div>

        <p className="wallet-meta" style={{ textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
          Testnet only. You bet play-money Proofs (PRF).<br />tETH only pays gas — no real funds are ever at risk.
        </p>
      </div>
    </div>);

}

// ---------- PENDING AS NARRATIVE ----------
const PENDING_STEPS = [
{ label: 'Requesting entropy', meta: (b) => `VRF request sent · block #${b}` },
{ label: 'Oracle responded', meta: (b) => `Chainlink fulfilled · block #${b + 3}` },
{ label: 'Settling on-chain', meta: (b) => `applying keccak256 · finalizing` }];


function Pending({ onDone, block }) {
  const [step, setStep] = useStateSc(0);
  const [elapsed, setElapsed] = useStateSc(0);
  const timers = useRefSc([]);

  useEffectSc(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durs = reduce ? [200, 200, 200] : [2200, 2600, 1600];
    let acc = 0;
    durs.forEach((d, i) => {
      acc += d;
      timers.current.push(setTimeout(() => setStep(i + 1), acc));
    });
    timers.current.push(setTimeout(onDone, acc + 500));
    const iv = setInterval(() => setElapsed((e) => e + 0.1), 100);
    timers.current.push(iv);
    return () => {timers.current.forEach((t) => {clearTimeout(t);clearInterval(t);});};
  }, []); // eslint-disable-line

  return (
    <div className="center-stage hp-screen">
      <div className="glass pending-stage">
        <div className="pending-title">Resolving on-chain</div>
        <div className="pending-sub">verifiable randomness can’t be rushed — that’s the point</div>

        <div className="pending-steps">
          {PENDING_STEPS.map((s, i) => {
            const state = step > i ? 'done' : step === i ? 'active' : '';
            return (
              <div key={i} className={`pstep ${state}`}>
                <div className="pstep-rail" />
                <div className="pstep-dot">{step > i ? '✓' : i + 1}</div>
                <div className="pstep-body">
                  <div className="pl">{s.label}</div>
                  <div className="pmeta">
                    {step === i && <span className="pulse-dot" />}
                    {step >= i ? s.meta(block) : 'waiting…'}
                  </div>
                </div>
              </div>);

          })}
        </div>

        <div className="pending-elapsed">
          elapsed <span className="mono" style={{ color: 'var(--ink-mut)' }}>{elapsed.toFixed(1)}s</span>
          <span style={{ margin: '0 8px', color: 'var(--line-3)' }}>·</span>
          typical VRF latency 30–120s
        </div>
      </div>
    </div>);

}

// compact, non-blocking version of the resolve narrative — slides up from the
// bottom so the chart/board stays fully visible while VRF settles.
function PendingToast({ onDone, block }) {
  const [step, setStep] = useStateSc(0);
  const [elapsed, setElapsed] = useStateSc(0);
  const [show, setShow] = useStateSc(false);
  const timers = useRefSc([]);

  useEffectSc(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durs = reduce ? [150, 150, 150] : [1500, 1700, 1100];
    const total = durs.reduce((a, b) => a + b, 0);
    requestAnimationFrame(() => setShow(true));
    let acc = 0;
    durs.forEach((d, i) => {
      acc += d;
      timers.current.push(setTimeout(() => setStep(i + 1), acc));
    });
    timers.current.push(setTimeout(() => setShow(false), total + 200));
    timers.current.push(setTimeout(onDone, total + 450));
    const t0 = performance.now();
    const iv = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    timers.current.push(iv);
    return () => timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); });
  }, []); // eslint-disable-line

  const cur = PENDING_STEPS[Math.min(step, PENDING_STEPS.length - 1)];
  const pct = Math.min(100, (step / PENDING_STEPS.length) * 100 + 6);

  return (
    <div className={`glass pending-toast${show ? ' show' : ''}`} role="status" aria-live="polite">
      <div className="pt-spinner" />
      <div className="pt-body">
        <div className="pt-head">
          <span className="pt-title">Resolving on-chain</span>
          <span className="pt-elapsed mono">{elapsed.toFixed(1)}s</span>
        </div>
        <div className="pt-step mono">
          <span className="pulse-dot" />
          {step >= PENDING_STEPS.length ? 'finalizing…' : cur.label}
        </div>
        <div className="pt-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>
    </div>);

}

// ---------- BANKROLL METER ----------
function BankrollMeter({ bankroll, maxBet, pct }) {
  return (
    <div className="bankroll">
      <div className="bankroll-head">
        <span className="kicker">House bankroll · live</span>
        <span className="chip" style={{ padding: '3px 9px' }}><span className="chip-dot" />solvent</span>
      </div>
      <div className="bankroll-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="bankroll-foot">
        <span className="lb"><span className="k">Bankroll</span><span className="v mono">{fmt(bankroll, 0)} PRF</span></span>
        <span className="mb"><span className="k">Max bet (this target)</span><span className="v mono" style={{ color: 'var(--acc)' }}>{fmt(maxBet)} PRF</span></span>
      </div>
    </div>);

}

// ---------- AUDITOR ----------
function Auditor({ knownRounds }) {
  const [hash, setHash] = useStateSc('');
  const [result, setResult] = useStateSc(null);
  const [err, setErr] = useStateSc('');

  const audit = () => {
    setErr('');setResult(null);
    const h = hash.trim();
    if (!/^0x[0-9a-fA-F]{6,}$/.test(h)) {setErr('That doesn’t look like a transaction hash.');return;}
    // a known round, or synthesize a deterministic one from the hash itself
    const known = knownRounds.find((r) => r.txHash.toLowerCase() === h.toLowerCase());
    let round;
    if (known) round = known;else
    {
      const vrfWord = '0x' + h.replace(/^0x/, '').padEnd(64, '0').slice(0, 64);
      const clientSeed = '0x' + h.replace(/^0x/, '').split('').reverse().join('').padEnd(64, 'a').slice(0, 64);
      const nonce = parseInt(h.slice(-3), 16) % 500;
      const { finalSeed, crash } = computeRound(vrfWord, clientSeed, nonce);
      round = { txHash: h, vrfWord, clientSeed, nonce, finalSeed, crash, requestId: '0x' + h.slice(2, 12) };
    }
    setResult(round);
  };

  return (
    <div className="auditor hp-screen">
      <div className="eyebrow" style={{ marginBottom: 18 }}>Public auditor</div>
      <h1 className="auditor-h">Verify <em>anyone’s</em> round.</h1>
      <p className="auditor-sub">
        Paste any proof.bet transaction hash — yours or a stranger’s. We pull the on-chain inputs
        and recompute the outcome in your browser. No account, no trust required.
      </p>

      <div className="auditor-input">
        <div className="auditor-field">
          <span className="mono" style={{ color: 'var(--ink-dim)', fontSize: 14, marginRight: 8 }}>tx</span>
          <input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="0x… paste a transaction hash"
          onKeyDown={(e) => e.key === 'Enter' && audit()} spellCheck="false" />
        </div>
        <Btn kind="accent" onClick={audit}>Recompute</Btn>
      </div>

      {err && <div className="err-card" style={{ marginTop: 18 }}>
        <div className="err-glyph">!</div>
        <div className="err-body"><div className="et">Can’t read that hash</div><div className="em">{err}</div></div>
      </div>}

      {result &&
      <div className="auditor-result">
          <div className="verify-block">
            <div className="seed-row"><span className="sk">Transaction</span><Hashish value={result.txHash} chars={6} /></div>
            <div className="seed-row"><span className="sk">VRF request ID</span><Hashish value={result.requestId} chars={5} /></div>
            <div className="seed-row"><span className="sk">Raw random word</span><Hashish value={result.vrfWord} chars={6} /></div>
            <div className="seed-row"><span className="sk">Client seed</span><Hashish value={result.clientSeed} chars={5} /></div>
            <div className="seed-row"><span className="sk">final keccak256 seed</span><Hashish value={result.finalSeed} chars={6} /></div>
          </div>
          <div className="match-reveal show" style={{ marginTop: 16 }}>
            <div className="match-check">✓</div>
            <div className="match-text">
              <div className="mt-1">Recomputed: {fmt(result.crash)}×</div>
              <div className="mt-2">independently derived from on-chain data — matches the contract</div>
            </div>
          </div>
        </div>
      }
    </div>);

}

// ---------- ERROR STATES ----------
const ERRORS = [
{ glyph: '✕', neutral: false, t: 'Transaction rejected', m: 'You declined the signature in your wallet. No bet was placed.', action: 'Try again' },
{ glyph: '⛽', neutral: true, t: 'Not enough gas', m: 'Your wallet lacks Sepolia ETH for gas. Grab some from a faucet.', action: 'Open faucet ↗' },
{ glyph: '⚡', neutral: true, t: 'Wrong network', m: 'This contract lives on Sepolia. Switch networks to continue.', action: 'Switch to Sepolia' },
{ glyph: '▣', neutral: true, t: 'Bankroll cap reached', m: 'This bet’s max payout exceeds what the house can safely cover right now. Lower your stake or target.', action: 'Adjust bet' },
{ glyph: '∅', neutral: false, t: 'Insufficient balance', m: 'Your stake is larger than your in-play Proofs (PRF) balance.', action: 'Lower stake' }];


function ErrorGallery() {
  return (
    <div className="center-stage hp-screen" style={{ alignItems: 'flex-start' }}>
      <div className="err-gallery" style={{ width: '100%' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Error states · calm, never alarming</div>
        {ERRORS.map((e, i) =>
        <div key={i} className="err-card">
            <div className={`err-glyph${e.neutral ? ' neutral' : ''}`}>{e.glyph}</div>
            <div className="err-body"><div className="et">{e.t}</div><div className="em">{e.m}</div></div>
            <div className="err-action"><Btn kind={e.neutral ? 'ghost' : 'danger'}>{e.action}</Btn></div>
          </div>
        )}
      </div>
    </div>);

}

// ---------- RESPONSIBLE GAMING NUDGE ----------
function RGNudge({ show, onDismiss }) {
  return (
    <div className={`glass rg-toast${show ? ' show' : ''}`} role="status">
      <div className="rg-icon">◷</div>
      <div className="rg-body">
        <div className="rt">You’ve been playing for 45 minutes.</div>
        <div className="rm">a good moment to take a break — the game will be here later</div>
      </div>
      <button className="rg-dismiss" onClick={onDismiss}>Dismiss</button>
    </div>);

}

Object.assign(window, { Landing, Connect, Pending, PendingToast, BankrollMeter, Auditor, ErrorGallery, RGNudge, WALLETS, Reveal, useInView });