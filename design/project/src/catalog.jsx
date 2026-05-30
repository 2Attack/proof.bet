// ============================================================
// HOUSEPROOF — Games catalog (the hub)
// Brand-native cards. Live games are playable; the grid is built
// to grow — "coming soon" slots are real placeholders.
// ============================================================
const { useState: useStateCat, useRef: useRefCat } = React;

// ---------- abstract, on-brand game art (no mascots) ----------
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
      <circle cx="149" cy="96" r="11" fill="none" stroke="var(--acc)" strokeWidth="1.4" opacity="0.5" />
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <rect key={s} x={110 + (s - 2.5) * 26 - 11} y="112" width="22" height="12" rx="3"
          fill={s === 4 ? 'var(--acc-glow)' : 'var(--surf-3)'}
          stroke={s === 4 ? 'var(--acc)' : 'var(--line)'} strokeWidth="1" />
      ))}
    </svg>
  );
}
function ArtDice() {
  const pip = (x, y) => <circle cx={x} cy={y} r="3.4" fill="var(--ink-mut)" />;
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
      {[0.4, 0.7].map((f, i) => <line key={i} x1="0" x2="220" y1={130 * f} y2={130 * f} stroke="var(--line)" strokeWidth="1" />)}
      <path d="M0 118 C40 110 80 80 120 36 L132 22" fill="none" stroke="var(--acc)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M132 22 L150 70 L168 50 L210 116" fill="none" stroke="var(--loss)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 5" opacity="0.85" />
      <circle cx="132" cy="22" r="5" fill="var(--loss)" />
    </svg>
  );
}
function ArtMines() {
  const cells = [];
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

const ART = { limbo: ArtLimbo, plinko: ArtPlinko, dice: ArtDice, crash: ArtCrash, mines: ArtMines };

const GAMES = [
  { id: 'limbo', name: 'Limbo', tag: 'Set a target. Beat the climb.', edge: '2% edge', live: true },
  { id: 'plinko', name: 'Plinko', tag: 'Drop the ball. Ride the edges.', edge: '~1.9% edge', live: true, isNew: true },
  { id: 'crash', name: 'Crash', tag: 'Cash out before the bust.', edge: '2% edge', live: false },
  { id: 'dice', name: 'Dice', tag: 'Roll over or under your line.', edge: '2% edge', live: false },
  { id: 'mines', name: 'Mines', tag: 'Find the gems, dodge the bombs.', edge: '2% edge', live: false },
];

function GameCard({ game, onPlay, featured }) {
  const ref = useRefCat(null);
  const tiltable = game.live && !featured;
  const onMove = (e) => {
    if (!tiltable) return;
    const el = ref.current; if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = 5;
    el.style.transform = `perspective(820px) translateY(-4px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const onLeave = () => { const el = ref.current; if (el) el.style.transform = ''; };
  const Art = ART[game.id];
  return (
    <button ref={ref} className={`game-card${game.live ? '' : ' soon'}${featured ? ' featured' : ''}`}
      onPointerMove={onMove} onPointerLeave={onLeave}
      onClick={() => game.live && onPlay(game.id)} disabled={!game.live}>
      <div className="gc-visual">
        {Art && <Art />}
        <div className="gc-badges">
          {game.isNew && <span className="gc-pill new">New</span>}
          {game.live ? <span className="gc-pill live"><span className="chip-dot" />Live</span>
            : <span className="gc-pill soon">Soon</span>}
        </div>
      </div>
      <div className="gc-body">
        <div className="gc-title serif">{game.name}</div>
        <div className="gc-tag">{game.tag}</div>
        <div className="gc-foot">
          <span className="gc-fair"><span className="chip-dot" />provably fair</span>
          <span className="gc-edge mono">{game.edge}</span>
          <span className="gc-play">{game.live ? 'Play →' : 'Coming soon'}</span>
        </div>
      </div>
    </button>
  );
}

function Catalog({ onPlay }) {
  const featured = GAMES.find((g) => g.isNew) || GAMES[0];
  const rest = GAMES.filter((g) => g.id !== featured.id);
  return (
    <div className="catalog hp-screen">
      <div className="catalog-head">
        <div>
          <div className="eyebrow">Game catalog · all provably fair</div>
          <h1 className="catalog-h">Pick your game.</h1>
        </div>
        <p className="catalog-sub">
          Every outcome — every climb, every bounce — is re-derived from on-chain randomness.
          You can verify any round yourself. The library grows from here.
        </p>
      </div>

      <div className="catalog-grid">
        <GameCard game={featured} onPlay={onPlay} featured />
        {rest.map((g) => <GameCard key={g.id} game={g} onPlay={onPlay} />)}
      </div>
    </div>
  );
}

// landing section: same cards, Plinko featured first (mirrors the Games page)
function LandingGames({ onPlay }) {
  const featured = GAMES.find((g) => g.isNew) || GAMES[0];
  const rest = GAMES.filter((g) => g.id !== featured.id);
  return (
    <section className="landing-games">
      {window.Reveal ? (
        <window.Reveal as="div" className="lg-head">
          <h2 className="lg-title serif">The games</h2>
          <span className="kicker">all provably fair · the library grows</span>
        </window.Reveal>
      ) : (
        <div className="lg-head">
          <h2 className="lg-title serif">The games</h2>
          <span className="kicker">all provably fair · the library grows</span>
        </div>
      )}
      <div className="lg-grid">
        <GameCard game={featured} onPlay={onPlay} featured />
        {rest.map((g) => <GameCard key={g.id} game={g} onPlay={onPlay} />)}
      </div>
    </section>
  );
}

Object.assign(window, { Catalog, GameCard, LandingGames });
