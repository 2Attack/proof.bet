// ============================================================
// HOUSEPROOF — app orchestrator
// Routing, game state machine, balances, Tweaks.
// ============================================================
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp, useMemo: useMemoApp } = React;

// ---------- brand wordmark ----------
// proof.bet — heavy lowercase Syne; "proof" in brand white, ".bet" in
// brand green. Letters lift in on mount; ".bet" carries a soft glow
// pulse. Resting state is always fully visible (focus-loss safe).
function Logo({ onClick, size }) {
  return (
    <div className="brand-wordmark" onClick={onClick} style={onClick ? { cursor: 'pointer' } : null}
      data-size={size || 'header'}>
      <span className="wm-word">proof<span className="wm-tld">.bet</span></span>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5FE3C0",
  "glassIntensity": 45,
  "serif": "Fraunces",
  "bgMotion": "subtle",
  "sliderTreatment": "bar",
  "verifyLayout": "inline",
  "settleStyle": "rise",
  "climbSpeed": "measured",
  "forceOutcome": "random",
  "climbVoice": "velvet"
}/*EDITMODE-END*/;

const SERIF_STACK = {
  "Fraunces": "'Fraunces', Georgia, serif",
  "Playfair Display": "'Playfair Display', Georgia, serif",
  "Instrument Serif": "'Instrument Serif', Georgia, serif",
  "Spectral": "'Spectral', Georgia, serif",
};
const CLIMB_CFG = {
  measured: { stiffness: 38, damping: 14, mass: 1.1 },
  quick:    { stiffness: 80, damping: 20, mass: 1 },
  cinematic:{ stiffness: 24, damping: 12, mass: 1.25 },
};

// derive a darker shade for accent fills
function shade(hex, f) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  return `rgb(${r},${g},${b})`;
}
function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// synthesize a connected-wallet identity (address + blockie-style avatar)
const WALLET_NAMES = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' };
function makeAccount(walletId) {
  const addr = randHex(20); // 0x + 40 hex — looks like a real EVM address
  const short = addr.slice(0, 6) + '…' + addr.slice(-4);
  const h1 = parseInt(addr.slice(2, 6), 16) % 360;
  const h2 = (h1 + 70 + (parseInt(addr.slice(6, 8), 16) % 110)) % 360;
  const rot = parseInt(addr.slice(8, 10), 16);
  const ava = `conic-gradient(from ${rot}deg at 35% 30%, hsl(${h1} 72% 56%), hsl(${h2} 64% 46%), hsl(${h1} 72% 56%))`;
  return { addr, short, ava, wallet: WALLET_NAMES[walletId] || 'Wallet' };
}

// language options (display selector — EN / RU / UA)
const LANGS = [
  { id: 'en', code: 'EN', label: 'English' },
  { id: 'ru', code: 'RU', label: 'Русский' },
  { id: 'ua', code: 'UA', label: 'Українська' },
];
function langById(id) { return LANGS.find((l) => l.id === id) || LANGS[0]; }

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.6 8h12.8M8 1.6c1.9 2 1.9 10.8 0 12.8M8 1.6c-1.9 2-1.9 10.8 0 12.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// language picker (same dropdown chrome as the account / currency menus)
function LangMenu({ lang, setLang }) {
  const [open, setOpen] = useStateApp(false);
  const [pos, setPos] = useStateApp({ top: 0, right: 0 });
  const pillRef = useRefApp(null);
  const ddRef = useRefApp(null);
  const cur = langById(lang);

  const place = () => {
    const el = pillRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
  };
  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffectApp(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (pillRef.current && pillRef.current.contains(e.target)) return;
      if (ddRef.current && ddRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const dropdown = (
    <div className="acct-dropdown lang-dropdown glass" role="menu" ref={ddRef} style={{ top: pos.top, right: pos.right }}>
      <div className="cur-dd-head">Language</div>
      <div className="cur-list">
        {LANGS.map((l) => (
          <button key={l.id} className={`cur-opt${l.id === lang ? ' sel' : ''}`} role="menuitemradio"
            aria-checked={l.id === lang} onClick={() => { setLang(l.id); setOpen(false); }}>
            <span className="lang-code mono">{l.code}</span>
            <span className="cur-meta"><span className="cur-name">{l.label}</span></span>
            {l.id === lang && <span className="cur-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="acct-menu" style={{ marginLeft: 0 }}>
      <button ref={pillRef} className={`glass-pill acct-pill lang-pill${open ? ' open' : ''}`} onClick={toggle}
        aria-haspopup="menu" aria-expanded={open} title="Language">
        <span className="lang-globe"><GlobeIcon /></span>
        <span className="lang-cur mono">{cur.code}</span>
        <svg className="acct-caret" viewBox="0 0 12 8" width="11" height="8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- keep the climb sound variant in sync with the tweak ----
  useEffectApp(() => {
    if (window.pkSound) window.pkSound.setClimbVoice(t.climbVoice);
  }, [t.climbVoice]);

  // ---- apply tweaks to CSS vars ----
  useEffectApp(() => {
    const r = document.documentElement.style;
    r.setProperty('--acc', t.accent);
    r.setProperty('--acc-deep', shade(t.accent, 0.74));
    r.setProperty('--acc-glow', rgba(t.accent, 0.16));
    r.setProperty('--acc-line', rgba(t.accent, 0.32));
    const k = t.glassIntensity / 100;
    r.setProperty('--glass-k', k.toFixed(3));
    r.setProperty('--glass-blur', `${(6 + k * 22).toFixed(1)}px`);
    r.setProperty('--glass-sat', (1 + k * 0.7).toFixed(2));
    r.setProperty('--glass-tint', `rgba(20,22,27,${(0.42 + k * 0.22).toFixed(3)})`);
    r.setProperty('--serif', SERIF_STACK[t.serif] || SERIF_STACK.Fraunces);
  }, [t.accent, t.glassIntensity, t.serif]);

  // ---- routing ----
  // Pages are full screens; the economy actions (faucet/deposit/withdraw)
  // are liquid-glass drawers that slide over whatever page is behind.
  const [screen, setScreen] = useStateApp('landing'); // landing|connect|catalog|limbo|plinko|auditor|errors
  const goEnter = (where) => setScreen(where === 'auditor' ? 'auditor' : 'connect');
  const [econDrawer, setEconDrawer] = useStateApp(null); // null|'faucet'|'deposit'|'withdraw'
  const [econKey, setEconKey] = useStateApp(0);
  const openEcon = (type) => { setEconKey((k) => k + 1); setEconDrawer(type); };
  const closeEcon = () => setEconDrawer(null);

  // ---- two currencies, two balances ----
  // tETH = gas only, never bet. Proofs (PRF) = the only bet unit, living
  // either in the wallet (after the faucet) or moved into the contract (in play).
  const [gas, setGas] = useStateApp(0.412);             // Sepolia test ETH — fuel
  const [walletChips, setWalletChips] = useStateApp(0); // Proofs sitting in MetaMask
  const [inPlay, setInPlay] = useStateApp(0);           // Proofs moved into the contract
  const burnGas = () => setGas((g) => Math.max(0, Math.round((g - (0.0012 + Math.random() * 0.0016)) * 1e6) / 1e6));

  // ---- game state ----
  const [bankroll, setBankroll] = useStateApp(42850);
  const [target, setTarget] = useStateApp(2.0);
  const [stake, setStake] = useStateApp(25);
  const [clientSeed, setClientSeed] = useStateApp(() => randHex(32));
  const [nonce, setNonce] = useStateApp(417);
  const [phase, setPhase] = useStateApp('idle'); // idle|pending|revealing|settled
  const [round, setRound] = useStateApp(null);
  const [recent, setRecent] = useStateApp([
    { crash: 4.21, win: true }, { crash: 1.08, win: false }, { crash: 2.67, win: true }, { crash: 1.51, win: false },
  ]);
  const [drawerOpen, setDrawerOpen] = useStateApp(false);
  const [verifyRound, setVerifyRound] = useStateApp(null); // the round shown in the Verify drawer (any game)
  const [block, setBlock] = useStateApp(6294117);
  const [rgShow, setRgShow] = useStateApp(false);
  const [account, setAccount] = useStateApp(null);
  const [lang, setLang] = useStateApp('en');
  const appliedRef = useRefApp(false);

  const maxBet = useMemoApp(() => Math.max(0.01, (bankroll * 0.015) / (target - 1 || 0.01)), [bankroll, target]);
  const bankrollPct = Math.min(100, (bankroll / 50000) * 100);

  // ---- place bet ----
  const placeBet = () => {
    if (phase === 'pending' || phase === 'revealing') return;
    // build a round, honoring forceOutcome tweak
    let vrfWord, finalSeed, crash, attempts = 0;
    do {
      vrfWord = randHex(32);
      const res = computeRound(vrfWord, clientSeed, nonce);
      finalSeed = res.finalSeed; crash = res.crash;
      attempts++;
      if (t.forceOutcome === 'random') break;
      if (t.forceOutcome === 'win' && crash >= target) break;
      if (t.forceOutcome === 'loss' && crash < target) break;
    } while (attempts < 400);

    const win = crash >= target;
    const payout = win ? stake * target : 0;
    const newRound = {
      id: Date.now(), txHash: randHex(32), requestId: randHex(8),
      vrfWord, clientSeed, nonce, finalSeed, crash, target, stake, payout, win,
    };
    setInPlay((b) => Math.round((b - stake) * 1e6) / 1e6); // stake locked from in-play
    burnGas();
    setRound(newRound);
    appliedRef.current = false;
    setBlock((b) => b + Math.floor(Math.random() * 4 + 1));
    setPhase('pending');
  };

  // ---- settle (called when climb finishes) ----
  const settle = () => {
    if (!round || appliedRef.current) return;
    appliedRef.current = true;
    setPhase('settled');
    if (round.win) {
      setInPlay((b) => Math.round((b + round.payout) * 1e6) / 1e6);
      setBankroll((bk) => Math.round(bk - (round.payout - round.stake)));
    } else {
      setBankroll((bk) => bk + round.stake);
    }
    setRecent((r) => [{ crash: round.crash, win: round.win }, ...r].slice(0, 6));
    setNonce((n) => n + 1);
    // make the round available to verify, but don't auto-open the drawer —
    // the user opens it from the "Verify this round" button.
    setVerifyRound(round);
  };

  const reroll = () => { setClientSeed(randHex(32)); };

  // safety: guarantee the round settles even if rAF is throttled (bg tab / capture)
  useEffectApp(() => {
    if (phase !== 'revealing') return;
    const tm = setTimeout(() => settle(), 4200);
    return () => clearTimeout(tm);
  }, [phase]); // eslint-disable-line

  // responsible-gaming nudge — fires once per session, after a while in game
  const rgFiredRef = useRefApp(false);
  useEffectApp(() => {
    if ((screen !== 'limbo' && screen !== 'plinko') || rgFiredRef.current) return;
    const tm = setTimeout(() => { rgFiredRef.current = true; setRgShow(true); }, 40000);
    return () => clearTimeout(tm);
  }, [screen]);

  // after connect, land on the catalog with the faucet drawer open over it
  const onConnected = (walletId) => { setAccount(makeAccount(walletId)); setScreen('catalog'); openEcon('faucet'); };
  const onDisconnect = () => {
    setAccount(null); setScreen('landing'); setDrawerOpen(false); setEconDrawer(null);
    setPhase('idle'); setRound(null); setVerifyRound(null);
    setWalletChips(0); setInPlay(0); setGas(0.412);
  };

  // ---- Proofs economy actions (each is a real on-chain tx) ----
  const mintChips = (amount) => { setWalletChips((c) => Math.round((c + amount) * 1e6) / 1e6); burnGas(); };
  const depositChips = (a) => {
    setWalletChips((c) => Math.round((c - a) * 1e6) / 1e6);
    setInPlay((p) => Math.round((p + a) * 1e6) / 1e6);
    burnGas();
  };
  const withdrawAll = () => {
    setWalletChips((c) => Math.round((c + inPlay) * 1e6) / 1e6);
    setInPlay(0);
    burnGas();
  };

  const newBet = () => { setPhase('idle'); setRound(null); setDrawerOpen(false); };

  const openVerify = (r) => { if (r) { setVerifyRound(r); setDrawerOpen(true); } };

  // ---- top bar ----
  const inGame = screen === 'catalog' || screen === 'limbo' || screen === 'plinko';
  const TopBar = () => (
    <header className="hp-topbar">
      <Logo onClick={() => setScreen('catalog')} />
      <nav className="hp-nav">
        <button className={`hp-nav-link${inGame ? ' active' : ''}`} onClick={() => setScreen('catalog')}>Games</button>
        <button className={`hp-nav-link${screen === 'auditor' ? ' active' : ''}`} onClick={() => setScreen('auditor')}>Audit</button>
        <button className={`hp-nav-link${screen === 'errors' ? ' active' : ''}`} onClick={() => setScreen('errors')}>States</button>
        {verifyRound && <button className="hp-nav-link" onClick={() => setDrawerOpen(true)} style={{ color: 'var(--acc)' }}>Verify ↗</button>}
        {account && <WalletMenu account={account} walletChips={walletChips} inPlay={inPlay} gas={gas}
          onDeposit={() => openEcon('deposit')}
          onWithdraw={() => openEcon('withdraw')}
          onDisconnect={onDisconnect} />}
        <LangMenu lang={lang} setLang={setLang} />
      </nav>
    </header>
  );

  return (
    <div className="hp-app">
      <FilterDefs />
      <Backdrop intensity={t.bgMotion} />

      {screen === 'landing' && <Landing onEnter={goEnter} lang={lang} setLang={setLang} />}

      {screen === 'connect' && (<><TopBar /><Connect onConnected={onConnected} /></>)}

      {screen === 'catalog' && (<><TopBar /><Catalog onPlay={(id) => setScreen(id)} /></>)}

      {screen === 'limbo' && (
        <>
          <TopBar />
          <div className="balance-strip">
            <button className="game-back" onClick={() => setScreen('catalog')}>‹ Games</button>
            <InPlayBar inPlay={inPlay} walletChips={walletChips}
              onWithdraw={() => openEcon('withdraw')} onDeposit={() => openEcon('deposit')} />
          </div>
          <div className="limbo-wrap">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ResultStage phase={phase} round={round} onSettle={settle} recent={recent}
                settleStyle={t.settleStyle} climbCfg={CLIMB_CFG[t.climbSpeed]} target={target} />
              {phase === 'settled' && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <Btn kind="primary" onClick={() => openVerify(round)}>Verify this round</Btn>
                  <Btn kind="ghost" onClick={newBet}>New bet</Btn>
                </div>
              )}
              <BankrollMeter bankroll={bankroll} maxBet={maxBet} pct={bankrollPct} />
            </div>
            <BetPanel target={target} setTarget={setTarget} stake={stake} setStake={setStake}
              balance={inPlay} bankroll={bankroll} phase={phase} onPlace={placeBet}
              treatment={t.sliderTreatment} />
          </div>
        </>
      )}

      {screen === 'plinko' && (
        <>
          <TopBar />
          <div className="balance-strip">
            <button className="game-back" onClick={() => setScreen('catalog')}>‹ Games</button>
            <InPlayBar inPlay={inPlay} walletChips={walletChips}
              onWithdraw={() => openEcon('withdraw')} onDeposit={() => openEcon('deposit')} />
          </div>
          <PlinkoGame balance={inPlay} setBalance={setInPlay} bankroll={bankroll} setBankroll={setBankroll}
            clientSeed={clientSeed} nonce={nonce} setNonce={setNonce} onGas={burnGas}
            setBlock={setBlock} forceOutcome={t.forceOutcome} onVerify={openVerify} />
        </>
      )}

      {screen === 'auditor' && (<><TopBar /><Auditor knownRounds={round ? [round] : []} /></>)}
      {screen === 'errors' && (<><TopBar /><ErrorGallery /></>)}

      <VerifyDrawer open={drawerOpen} round={verifyRound} onClose={() => setDrawerOpen(false)}
        onReroll={reroll} layout={t.verifyLayout} />

      <EconomyDrawer type={econDrawer} openKey={econKey} onClose={closeEcon}
        goDeposit={() => openEcon('deposit')} goPlay={closeEcon}
        walletChips={walletChips} inPlay={inPlay} gas={gas}
        onMint={mintChips} onDeposit={depositChips} onWithdraw={withdrawAll} />

      <RGNudge show={rgShow} onDismiss={() => setRgShow(false)} />

      {screen === 'limbo' && phase === 'pending' &&
        <PendingToast onDone={() => setPhase('revealing')} block={block} />}

      {/* ---- Tweaks ---- */}
      <TweaksPanel>
        <TweakSection label="Material" />
        <TweakSlider label="Liquid-glass intensity" value={t.glassIntensity} min={0} max={100} step={5} unit="%"
          onChange={(v) => setTweak('glassIntensity', v)} />
        <TweakColor label="Accent" value={t.accent}
          options={['#5FE3C0', '#7FD1FF', '#C7B8FF', '#E8D27A']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Typography" />
        <TweakSelect label="Serif display" value={t.serif}
          options={['Fraunces', 'Playfair Display', 'Instrument Serif', 'Spectral']}
          onChange={(v) => setTweak('serif', v)} />
        <TweakSection label="Money-shot" />
        <TweakRadio label="Climb speed" value={t.climbSpeed} options={['measured', 'quick', 'cinematic']}
          onChange={(v) => setTweak('climbSpeed', v)} />
        <TweakRadio label="Force outcome" value={t.forceOutcome} options={['random', 'win', 'loss']}
          onChange={(v) => setTweak('forceOutcome', v)} />
        <TweakSection label="Sound" />
        <TweakRadio label="Limbo climb voice" value={t.climbVoice} options={['velvet', 'glass']}
          onChange={(v) => { setTweak('climbVoice', v); if (window.pkSound) { window.pkSound.setClimbVoice(v); window.pkSound.limboPreview(); } }} />
        <TweakSection label="Slider treatment" />
        <TweakRadio label="Style" value={t.sliderTreatment} options={['bar', 'ticks']}
          onChange={(v) => setTweak('sliderTreatment', v)} />
        <TweakSection label="Verify drawer" />
        <TweakRadio label="Recompute reveal" value={t.verifyLayout} options={['inline', 'diff']}
          onChange={(v) => setTweak('verifyLayout', v)} />
        <TweakSection label="Background" />
        <TweakRadio label="Motion" value={t.bgMotion} options={['subtle', 'calm', 'static']}
          onChange={(v) => setTweak('bgMotion', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
