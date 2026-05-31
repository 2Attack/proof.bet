// ============================================================
// HOUSEPROOF — Limbo (the core screen)
// Target-multiplier slider, stake, live bankroll + max bet,
// honest house-edge chip, and the money-shot result.
// ============================================================
const { useState: useStateLb, useEffect: useEffectLb, useRef: useRefLb, useMemo: useMemoLb } = React;

const HOUSE_EDGE = 0.02;
const MULT_MIN = 1.01,MULT_MAX = 1000;

// log mapping between slider pos (0..1) and target multiplier
const posToTarget = (p) => {
  const v = MULT_MIN * Math.pow(MULT_MAX / MULT_MIN, p);
  return Math.round(v * 100) / 100;
};
const targetToPos = (t) =>
Math.log(t / MULT_MIN) / Math.log(MULT_MAX / MULT_MIN);

const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- shared sound on/off toggle (sits in a stage corner) ----------
function SoundToggle() {
  const [muted, setMuted] = useStateLb(window.pkSound ? window.pkSound.muted : false);
  const toggle = () => {
    if (!window.pkSound) return;
    const m = window.pkSound.toggle();
    setMuted(m);
    if (!m) window.pkSound.ui();
  };
  return (
    <button className={`pk-sound${muted ? ' muted' : ''}`} onClick={toggle}
    aria-label={muted ? 'Unmute sound' : 'Mute sound'} title={muted ? 'Sound off' : 'Sound on'}>
      {muted ?
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></svg> :

      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 6a9 9 0 0 1 0 12" /></svg>
      }
    </button>);

}

// ---------- play-field chart helpers ----------
// linear y so a single round's curve reads like a rocket; vmax dynamic per round.
const vmaxFor = (target, crash) => Math.max(1.5, Math.max(target || 1, crash || 1) * 1.32);
const yFrac = (v, vmax) => Math.max(0, Math.min(1, (v - 1) / (vmax - 1)));

// synth a smooth ease-out curve 1→crash (used when rAF is throttled / settled cold)
function synthSamples(crash, n = 46) {
  const arr = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const e = 1 - Math.pow(1 - p, 2.6);
    arr.push({ t: p, v: 1 + (crash - 1) * e });
  }
  return arr;
}

function buildPaths(samples, vmax) {
  if (!samples.length) return { line: '', area: '' };
  const totalT = samples[samples.length - 1].t || 1;
  const pts = samples.map((s) => {
    const x = s.t / totalT * 100;
    const y = 100 - yFrac(s.v, vmax) * 100;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `M${pts[0][0].toFixed(2)} 100 ` +
  pts.map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') +
  ` L${last[0].toFixed(2)} 100 Z`;
  return { line, area, tip: last };
}

// ---------- the climb chart (the play field) ----------
function ClimbChart({ playing, settled, val, target, crash, win }) {
  const samplesRef = useRefLb([]);
  const startRef = useRefLb(0);

  // reset sample trail at the start of each reveal
  useEffectLb(() => {
    if (playing) {samplesRef.current = [];startRef.current = performance.now();}
  }, [playing]);

  const vmax = vmaxFor(target, settled ? crash : Math.max(target, crash || 1));

  // collect live samples during the climb
  if (playing) {
    const t = (performance.now() - startRef.current) / 1000;
    const arr = samplesRef.current;
    if (!arr.length || t - arr[arr.length - 1].t > 0.012) arr.push({ t, v: val });
    if (arr.length > 360) arr.shift();
  }

  let samples = samplesRef.current;
  if (settled && samples.length < 8) samples = synthSamples(crash);
  if (settled && samples.length >= 8) samples = [...samples, { t: samples[samples.length - 1].t + 0.001, v: crash }];

  const { line, area, tip } = buildPaths(samples, vmax);
  const tgtY = 100 - yFrac(target, vmax) * 100;
  const beat = playing && val >= target || settled && win;
  const stroke = beat ? 'var(--acc)' : settled ? 'var(--loss)' : 'var(--ink-mut)';

  // multiplier gridlines
  const grid = [0.25, 0.5, 0.75].map((f) => ({ y: 100 - f * 100, v: 1 + f * (vmax - 1) }));

  return (
    <div className="stage-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="climb-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={beat ? 'rgba(95,227,192,0.22)' : 'rgba(154,157,164,0.10)'} />
            <stop offset="100%" stopColor="rgba(95,227,192,0)" />
          </linearGradient>
        </defs>
        {grid.map((g, i) =>
        <line key={i} x1="0" x2="100" y1={g.y} y2={g.y} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        )}
        {/* target line */}
        <line x1="0" x2="100" y1={tgtY} y2={tgtY} stroke={beat ? 'var(--acc-line)' : 'var(--line-3)'}
        strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {(playing || settled) &&
        <>
            <path d={area} fill="url(#climb-fill)" />
            <path d={line} fill="none" stroke={stroke} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </>
        }
      </svg>
      {/* gridline value labels (HTML overlay, crisp) */}
      <div className="chart-labels">
        {grid.map((g, i) =>
        <span key={i} className="chart-label mono" style={{ top: `${g.y}%` }}>{fmt(g.v, g.v < 10 ? 2 : 0)}×</span>
        )}
      </div>
      {/* target flag */}
      <div className={`chart-target${beat ? ' beat' : ''}`} style={{ top: `${tgtY}%` }}>
        <span className="mono">target {fmt(target)}×</span>
      </div>
      {/* glowing tip */}
      {(playing || settled) && tip &&
      <div className={`chart-tip${beat ? ' beat' : ''}${settled ? ' settled' : ''}`}
      style={{ left: `${tip[0]}%`, top: `${tip[1]}%` }} />
      }
    </div>);

}

// ---------- the result stage (money-shot) ----------
function ResultStage({ phase, round, onSettle, recent, settleStyle, climbCfg, target: idleTarget, currency }) {
  const playing = phase === 'revealing';
  const [climbVal, done] = useClimb(1.0, round ? round.crash : 1.0, playing, climbCfg || 'climb');
  const settledRef = useRefLb(false);
  const crossedRef = useRefLb(false);

  useEffectLb(() => {
    if (playing) settledRef.current = false;
    if (done && playing && !settledRef.current) {
      settledRef.current = true;
      const t = setTimeout(onSettle, 420);
      return () => clearTimeout(t);
    }
  }, [done, playing]); // eslint-disable-line

  // ---- sound: launch + rising tension while climbing ----
  useEffectLb(() => {
    if (playing && window.pkSound) {crossedRef.current = false;window.pkSound.limboStart();}
  }, [playing]); // eslint-disable-line

  const settled = phase === 'settled';
  const showNum = playing || settled;
  const val = settled && round ? round.crash : climbVal;
  const target = round ? round.target : idleTarget || 2;
  const crash = round ? round.crash : 1;
  const win = round ? round.crash >= round.target : false;
  const crossing = playing && val >= target || settled && win;

  // ---- sound: ramp tone with climb, ping on cross, resolve on settle ----
  useEffectLb(() => {
    if (!playing || !round || !window.pkSound) return;
    const prog = (climbVal - 1) / (round.crash - 1 || 1);
    window.pkSound.limboTo(prog);
    if (!crossedRef.current && climbVal >= round.target) {
      crossedRef.current = true;
      window.pkSound.limboCross();
    }
  }, [climbVal, playing]); // eslint-disable-line

  useEffectLb(() => {
    if (settled && round && window.pkSound) window.pkSound.limboEnd(win, round.crash);
  }, [settled]); // eslint-disable-line

  const numClass = 'result-number' + (
  settled ? win ? ' result-win' : ' result-loss' : crossing ? ' result-win' : '');
  const settleAnim = settled ? win ? ' is-win' : ' is-loss' : '';

  return (
    <div className={`stage${showNum ? ' live' : ''}${settleAnim}`}>
      <div className="stage-eyebrow eyebrow">Limbo · provably fair</div>
      <SoundToggle />

      <ClimbChart playing={playing} settled={settled} val={val} target={target} crash={crash} win={win} />

      {settled && win && <div className="stage-burst" key={round.id} />}

      <div className="stage-content">
        {!showNum &&
        <div className="stage-idle">
            {phase === 'pending' ?
          <>
                <span className="serif">Locking in your bet…</span>
                <span className="kicker">fetching verifiable randomness</span>
              </> :

          <>
                <span className="serif">Ready to launch.</span>
                <span className="kicker">set a target · beat it to win</span>
              </>
          }
          </div>
        }

        {showNum &&
        <div className="stage-numwrap">
            <div className={numClass} aria-live="polite">
              {fmt(val)}<span className="x">×</span>
            </div>
            <div className="result-caption">
              {playing && <span className="climb-live"><span className="climb-pulse" />climbing…</span>}
              {settled && win &&
            <>
                  <span className="result-verdict verdict-win">Beat {fmt(round.target)}×.</span>
                  <span className="payout-flash">+{window.fmtChips(round.payout)} PRF</span>
                </>
            }
              {settled && !win &&
            <>
                  <span className="result-verdict verdict-loss">Fell short of {fmt(round.target)}×.</span>
                  <span style={{ color: 'var(--ink-dim)' }}>−{window.fmtChips(round.stake)} PRF</span>
                </>
            }
            </div>
          </div>
        }
      </div>

      {recent && recent.length > 0 &&
      <div className="recent">
          {recent.map((r, i) =>
        <span key={i} className={`recent-pill ${r.win ? 'win' : 'loss'}`}>{fmt(r.crash)}×</span>
        )}
        </div>
      }
    </div>);

}

// ---------- the slider (3 treatments) ----------
function TargetSlider({ target, setTarget, treatment }) {
  const pos = targetToPos(target);
  const pct = Math.max(0, Math.min(1, pos)) * 100;

  const onInput = (e) => setTarget(posToTarget(Number(e.target.value) / 1000));

  return (
    <div className="betpanel-section">
      <div className="target-display">
        <div className="tval mono">{fmt(target)}<span className="x">×</span></div>
        <div className="tlabel">target multiplier</div>
      </div>

      <div className="slider">
        <div className="slider-track">
          <div className="slider-fill" style={{ width: `${pct}%` }} />
        </div>
        {treatment === 'ticks' &&
        <div className="slider-ticks">
            {Array.from({ length: 25 }).map((_, i) =>
          <i key={i} style={{ height: i % 6 === 0 ? '8px' : '4px' }} />
          )}
          </div>
        }
        <input type="range" min="0" max="1000" value={Math.round(pos * 1000)}
        onChange={onInput} aria-label="target multiplier" />
      </div>
      <div className="slider-scale">
        <span>1.01×</span><span>2×</span><span>10×</span><span>100×</span><span>1000×</span>
      </div>
    </div>);

}

// ---------- the bet panel ----------
function BetPanel({ target, setTarget, stake, setStake, balance, bankroll, phase, onPlace, treatment, currency }) {
  const winChance = Math.min(99.9, (1 - HOUSE_EDGE) / target * 100);
  const payout = stake * target;
  const profit = payout - stake;
  // honest max bet: capped so max profit ≤ 1.5% of bankroll
  const maxBet = Math.max(0, bankroll * 0.015 / (target - 1 || 0.01));
  const bankrollPct = Math.min(100, bankroll / 50000 * 100);

  const busy = phase === 'pending' || phase === 'revealing';
  const overBalance = stake > balance;
  const overMax = stake > maxBet;
  const tooSmall = stake <= 0;
  const canBet = !busy && !overBalance && !overMax && !tooSmall;

  let cta = 'Place Bet';
  if (busy) cta = phase === 'pending' ? 'Waiting on chain…' : 'Revealing…';else
  if (tooSmall) cta = 'Enter a stake';else
  if (overBalance) cta = 'Insufficient balance';else
  if (overMax) cta = 'Above max bet';

  return (
    <div className="glass betpanel">
      <TargetSlider target={target} setTarget={setTarget} treatment={treatment} />

      <div className="stake glass-solid" style={{ padding: '14px', borderRadius: 'var(--r-md)' }}>
        <div className="kicker" style={{ marginBottom: 9 }}>Stake</div>
        <div className="stake-field">
          <input type="number" min="0" step="0.001" value={stake}
          onChange={(e) => setStake(Math.max(0, Number(e.target.value)))} aria-label="stake" />
          <span className="unit">PRF</span>
        </div>
        <div className="stake-quick" style={{ marginTop: 10 }}>
          <button onClick={() => setStake(Math.round(stake * 50) / 100)}>½</button>
          <button onClick={() => setStake(Math.round(stake * 200) / 100)}>2×</button>
          <button onClick={() => setStake(Math.round(Math.min(maxBet, balance) * 100) / 100)}>max</button>
        </div>
      </div>

      <div className="bet-stats">
        <div className="bet-stat">
          <div className="k">Win chance</div>
          <div className="v mono">{fmt(winChance, winChance < 1 ? 3 : 2)}%</div>
        </div>
        <div className="bet-stat">
          <div className="k">Payout</div>
          <div className="v mono acc">{window.fmtChips(payout)} PRF</div>
        </div>
      </div>

      <Btn kind="accent" full disabled={!canBet} onClick={() => {if (window.pkSound) window.pkSound.unlock();onPlace();}}>{cta}</Btn>

      <div className="chip chip-edge" style={{ alignSelf: 'center' }}>
        <span className="chip-dot" />House edge 2% — we don’t hide it.
      </div>
    </div>);

}

Object.assign(window, { ResultStage, BetPanel, TargetSlider, SoundToggle, HOUSE_EDGE, posToTarget, targetToPos, fmt, MULT_MIN, MULT_MAX });