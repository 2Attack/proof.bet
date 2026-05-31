// ============================================================
// HOUSEPROOF — Plinko (provably fair)
// The ball's every L/R bounce is a bit read off the finalSeed,
// so the whole path is recomputable in the Verify drawer.
// ============================================================
const { useState: useStatePk, useEffect: useEffectPk, useRef: useRefPk, useMemo: useMemoPk } = React;

const RISK_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

// colour tier for a slot multiplier
function slotTier(m) {
  if (m >= 10) return 'hot';
  if (m >= 2) return 'warm';
  if (m >= 1) return 'even';
  return 'cold';
}

// compact slot label — sheds decimals as values grow / tiles shrink,
// so 17 narrow bins never clip "27.10×" into "27.1".
function fmtSlot(m, slots) {
  const tight = slots >= 13;
  if (m >= 100) return String(Math.round(m));
  if (m >= 10) return tight ? String(Math.round(m)) : fmt(m, 1);
  if (m >= 1) return fmt(m, 1);
  return fmt(m, 2);
}

// ---------- ball drop animation (follows the verified path) ----------
function usePlinkoDrop(round, rows, playing, onDone) {
  const [ball, setBall] = useStatePk(null);
  const raf = useRefPk(0);
  const doneRef = useRefPk(onDone);
  doneRef.current = onDone;
  const lastRow = useRefPk(-1);

  useEffectPk(() => {
    if (!playing || !round) { setBall(null); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const path = round.path;
    const slotW = 1 / (rows + 1);
    const xAt = (k) => {
      let rights = 0;
      for (let i = 0; i < k; i++) rights += path[i];
      return 0.5 + (rights - k / 2) * slotW;
    };
    const perRow = reduce ? 6 : 132;
    const total = rows * perRow + 220;
    const start = performance.now();
    lastRow.current = -1;

    const tick = (now) => {
      const t = Math.min((now - start) / total, 1);
      const rf = t * rows;
      let k = Math.floor(rf);
      let frac = rf - k;
      if (k >= rows) { k = rows; frac = 0; }
      const x0 = xAt(k);
      const x1 = xAt(Math.min(k + 1, rows));
      const e = frac < 0.5 ? 2 * frac * frac : 1 - Math.pow(-2 * frac + 2, 2) / 2;
      const x = x0 + (x1 - x0) * e;
      const hop = Math.sin(frac * Math.PI) * (0.55 / (rows + 1)); // little upward hop between pegs
      // peg ping each time the ball clears a new row
      if (k > lastRow.current && k < rows && window.pkSound) {
        lastRow.current = k;
        window.pkSound.peg(k, rows, x1);
      }
      setBall({ x, y: rf / rows, hop, settling: false });
      if (t >= 1) {
        setBall({ x: xAt(rows), y: 1, hop: 0, settling: true });
        if (doneRef.current) doneRef.current();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line
  }, [playing, round && round.id]);

  return ball;
}

// ---------- the board (pegs + ball) ----------
function PlinkoBoard({ rows, ball, landedSlot, mults }) {
  const slotW = 1 / (rows + 1);
  const pegYSpan = 97; // % of board height used by the peg field (slots hug the base)
  const pegRows = [];
  for (let k = 1; k <= rows; k++) {
    const top = (k / (rows + 0.6)) * pegYSpan;
    const pegs = [];
    for (let j = 0; j <= k; j++) {
      const left = 0.5 + (j - k / 2) * slotW;
      pegs.push(<i key={j} className="pk-peg" style={{ left: `${left * 100}%`, top: `${top}%` }} />);
    }
    pegRows.push(pegs);
  }
  return (
    <div className="plinko-board">
      {pegRows}
      {ball && (
        <div className="pk-ball"
          style={{ left: `${ball.x * 100}%`, top: `${(ball.y * pegYSpan) - ball.hop * 100}%` }} />
      )}
    </div>
  );
}

// ---------- compact result bar (board stays the hero) ----------
function PlinkoResult({ phase, round, currency }) {
  const settled = phase === 'settled';
  const win = round ? round.multiplier >= 1 : false;
  return (
    <div className="pk-resultbar">
      {phase === 'idle' && <span className="pk-hint">Drop the ball — <span className="mono">edges pay big, the center is the house</span></span>}
      {phase === 'pending' && <span className="climb-live"><span className="climb-pulse" />resolving on-chain…</span>}
      {phase === 'dropping' && <span className="climb-live"><span className="climb-pulse" />dropping through {round ? round.rows : ''} rows…</span>}
      {settled && round && (
        <span className={`pk-verdict ${win ? 'win' : 'loss'}`}>
          <span className="serif">landed {fmt(round.multiplier)}×</span>
          <span className="pk-pay mono">{win ? `+${window.fmtChips(round.payout)} PRF` : `−${window.fmtChips(round.stake - round.payout)} PRF`}</span>
        </span>
      )}
    </div>
  );
}

// ---------- controls ----------
function PlinkoPanel({ risk, setRisk, rows, setRows, stake, setStake, balance, phase, onDrop, mults, edge, maxMult, currency }) {
  const busy = phase === 'dropping' || phase === 'pending';
  const overBalance = stake > balance;
  const tooSmall = stake <= 0;
  const canBet = !busy && !overBalance && !tooSmall;
  let cta = 'Drop Ball';
  if (phase === 'pending') cta = 'Resolving…';
  else if (phase === 'dropping') cta = 'Dropping…';
  else if (tooSmall) cta = 'Enter a stake';
  else if (overBalance) cta = 'Insufficient balance';

  return (
    <div className="glass betpanel">
      <div className="betpanel-section">
        <div className="kicker" style={{ marginBottom: 2 }}>Risk</div>
        <div className="pk-risk">
          {['low', 'medium', 'high'].map((r) => (
            <button key={r} className={`pk-risk-opt${risk === r ? ' active' : ''}`} disabled={busy}
              onClick={() => setRisk(r)}>{RISK_LABELS[r]}</button>
          ))}
        </div>
      </div>

      <div className="betpanel-section">
        <div className="pk-rows-head">
          <span className="kicker">Rows</span>
          <span className="mono pk-rows-val">{rows}</span>
        </div>
        <div className="slider">
          <div className="slider-track">
            <div className="slider-fill" style={{ width: `${((rows - 8) / 8) * 100}%` }} />
          </div>
          <input type="range" min="8" max="16" step="1" value={rows} disabled={busy}
            onChange={(e) => setRows(Number(e.target.value))} aria-label="rows" />
        </div>
        <div className="slider-scale"><span>8</span><span>10</span><span>12</span><span>14</span><span>16</span></div>
      </div>

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
          <button onClick={() => setStake(Math.round(balance * 100) / 100)}>max</button>
        </div>
      </div>

      <div className="bet-stats">
        <div className="bet-stat">
          <div className="k">Top payout</div>
          <div className="v mono acc">{fmt(maxMult)}×</div>
        </div>
        <div className="bet-stat">
          <div className="k">Best win</div>
          <div className="v mono">{window.fmtChips(stake * maxMult)} PRF</div>
        </div>
      </div>

      <Btn kind="accent" full disabled={!canBet} onClick={onDrop}>{cta}</Btn>

      <div className="chip chip-edge" style={{ alignSelf: 'center' }}>
        <span className="chip-dot" />House edge {(edge * 100).toFixed(1)}% — we don’t hide it.
      </div>
    </div>
  );
}

// ---------- the game ----------
function PlinkoGame({ balance, setBalance, bankroll, setBankroll, clientSeed, nonce, setNonce, setBlock, forceOutcome, onVerify, onGas }) {
  const [risk, setRisk] = useStatePk('medium');
  const [rows, setRows] = useStatePk(12);
  const [stake, setStake] = useStatePk(25);
  const [phase, setPhase] = useStatePk('idle'); // idle | pending | dropping | settled
  const [round, setLocalRound] = useStatePk(null);
  const [recent, setRecent] = useStatePk([]);
  const settledRef = useRefPk(false);

  const mults = useMemoPk(() => plinkoMultipliers(rows, risk), [rows, risk]);
  const edge = useMemoPk(() => plinkoEdge(rows, risk), [rows, risk]);
  const maxMult = useMemoPk(() => Math.max(...mults), [mults]);

  const drop = () => {
    if (phase === 'pending' || phase === 'dropping') return;
    let vrfWord, finalSeed, res, attempts = 0;
    do {
      vrfWord = randHex(32);
      finalSeed = deriveFinalSeed(vrfWord, clientSeed, nonce);
      res = plinkoFromSeed(finalSeed, rows, risk);
      attempts++;
      if (forceOutcome === 'random') break;
      if (forceOutcome === 'win' && res.multiplier >= 1) break;
      if (forceOutcome === 'loss' && res.multiplier < 1) break;
    } while (attempts < 400);

    const payout = Math.round(stake * res.multiplier * 1e6) / 1e6;
    const win = res.multiplier >= 1;
    const newRound = {
      id: Date.now(), game: 'plinko', txHash: randHex(32), requestId: randHex(8),
      vrfWord, clientSeed, nonce, finalSeed, rows, risk,
      path: res.path, slot: res.slot, multiplier: res.multiplier, stake, payout, win,
    };
    settledRef.current = false;
    setBalance((b) => Math.round((b - stake) * 1e6) / 1e6);
    if (onGas) onGas();
    setLocalRound(newRound);
    setBlock((b) => b + Math.floor(Math.random() * 4 + 1));
    if (window.pkSound) window.pkSound.unlock();
    setPhase('pending');
  };

  // begin the physical drop once the chain has “resolved”
  const startDrop = () => {
    if (window.pkSound) window.pkSound.drop();
    setPhase('dropping');
  };

  const onDone = () => {
    if (settledRef.current || !round) return;
    settledRef.current = true;
    setPhase('settled');
    if (window.pkSound) window.pkSound.land(round.win, round.multiplier);
    setBalance((b) => Math.round((b + round.payout) * 1e6) / 1e6);
    setBankroll((bk) => Math.round(bk + (round.stake - round.payout)));
    setRecent((r) => [{ m: round.multiplier }, ...r].slice(0, 6));
    setNonce((n) => n + 1);
  };

  // safety settle if rAF throttled
  useEffectPk(() => {
    if (phase !== 'dropping') return;
    const tm = setTimeout(onDone, 4200);
    return () => clearTimeout(tm);
  }, [phase]); // eslint-disable-line

  const ball = usePlinkoDrop(round, rows, phase === 'dropping', onDone);
  const landedSlot = phase === 'settled' && round ? round.slot : -1;

  return (
    <div className="limbo-wrap">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="stage plinko-stage">
          <div className="stage-eyebrow eyebrow">Plinko · {RISK_LABELS[risk]} · {rows} rows</div>
          <SoundToggle />
          <PlinkoBoard rows={rows} ball={ball} landedSlot={landedSlot} mults={mults} />
          <div className="plinko-slots" style={{ '--slot-fz': `${mults.length >= 15 ? 10.5 : mults.length >= 13 ? 11.5 : 13}px` }}>
            {mults.map((m, s) => (
              <div key={s} className={`pk-slot ${slotTier(m)}${s === landedSlot ? ' land' : ''}`}>
                {fmtSlot(m, mults.length)}<span className="pk-slot-x">×</span>
              </div>
            ))}
          </div>
          <PlinkoResult phase={phase} round={round} />
          {recent.length > 0 && (
            <div className="pk-recent">
              {recent.map((r, i) => (
                <span key={i} className={`recent-pill ${r.m >= 1 ? 'win' : 'loss'}`}>{fmt(r.m)}×</span>
              ))}
            </div>
          )}
        </div>
        {phase === 'settled' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Btn kind="primary" onClick={() => onVerify(round)}>Verify this drop</Btn>
            <Btn kind="ghost" onClick={() => { setPhase('idle'); setLocalRound(null); }}>New drop</Btn>
          </div>
        )}
      </div>
      <PlinkoPanel risk={risk} setRisk={setRisk} rows={rows} setRows={setRows} stake={stake} setStake={setStake}
        balance={balance} phase={phase} onDrop={drop} mults={mults} edge={edge} maxMult={maxMult} />
      {phase === 'pending' && <PendingToast onDone={startDrop} block={0} />}
    </div>
  );
}

Object.assign(window, { PlinkoGame, plinkoSlotTier: slotTier, RISK_LABELS });
