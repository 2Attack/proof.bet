// ============================================================
// HOUSEPROOF — Verify drawer (game-aware: Limbo + Plinko)
// Re-derives the round outcome from on-chain data IN THE BROWSER.
// Same keccak256 the contract used → the "✓ matches" is honest.
// ============================================================
const { useState: useStateVf, useEffect: useEffectVf, useRef: useRefVf } = React;

function VerifyDrawer({ open, round, onClose, onReroll, layout }) {
  const [phase, setPhase] = useStateVf('idle'); // idle | computing | matched
  const [steps, setSteps] = useStateVf(0);
  const [browser, setBrowser] = useStateVf(null);
  const timers = useRefVf([]);

  useEffectVf(() => {
    if (open) { setPhase('idle'); setSteps(0); setBrowser(null); }
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [open, round && round.id]);

  if (!round) return null;
  const isPlinko = round.game === 'plinko';
  const win = isPlinko ? round.multiplier >= 1 : round.crash >= round.target;

  const recomputeNow = () => {
    const finalSeed = deriveFinalSeed(round.vrfWord, round.clientSeed, round.nonce);
    if (isPlinko) {
      const p = plinkoFromSeed(finalSeed, round.rows, round.risk);
      return { finalSeed, slot: p.slot, multiplier: p.multiplier, path: p.path };
    }
    return computeRound(round.vrfWord, round.clientSeed, round.nonce);
  };

  const recompute = () => {
    setPhase('computing'); setSteps(0); setBrowser(null);
    timers.current.forEach(clearTimeout); timers.current = [];
    [1, 2, 3].forEach((s, i) => {
      timers.current.push(setTimeout(() => setSteps(s), 420 + i * 360));
    });
    timers.current.push(setTimeout(() => {
      setBrowser(recomputeNow());
      setPhase('matched');
    }, 420 + 3 * 360 + 260));
  };

  const matches = browser && browser.finalSeed === round.finalSeed && (isPlinko
    ? browser.slot === round.slot && Math.abs(browser.multiplier - round.multiplier) < 1e-9
    : Math.abs(browser.crash - round.crash) < 1e-9);

  const etherscan = `https://sepolia.etherscan.io/tx/${round.txHash}`;
  const outcomeNum = isPlinko ? `${fmt(round.multiplier)}×` : `${fmt(round.crash)}×`;

  return (
    <>
      <div className={`drawer-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} role="dialog" aria-label="Verify this round" aria-hidden={!open}>
        <div className="glass drawer-inner">
          <div className="drawer-head">
            <div>
              <div className="drawer-title">Verify this {isPlinko ? 'drop' : 'round'}</div>
              <div className="drawer-sub">re-derive the outcome yourself — nothing trusted</div>
            </div>
            <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="drawer-body">
            {/* verdict */}
            <div className={`verify-verdict ${win ? 'win' : 'loss'}`}>
              <div>
                <div className="kicker" style={{ marginBottom: 6 }}>{isPlinko ? 'Multiplier' : 'Outcome'}</div>
                <div className="vv-num mono">{outcomeNum}</div>
              </div>
              <div className="vv-meta">
                {isPlinko
                  ? <>{RISK_LABELS[round.risk]} · {round.rows} rows<br />slot {round.slot} · stake {fmt(round.stake)} PRF<br /></>
                  : <>target {fmt(round.target)}×<br />stake {fmt(round.stake)} PRF<br /></>}
                <span style={{ color: win ? 'var(--acc)' : 'var(--loss)' }}>
                  {win ? `+${fmt(round.payout)}` : `−${fmt(round.stake - (round.payout || 0))}`} PRF
                </span>
              </div>
            </div>

            {/* plinko: the verified ball path */}
            {isPlinko && (
              <div>
                <div className="verify-section-label" style={{ marginBottom: 8 }}><span className="kicker">Ball path · {round.rows} bounces</span></div>
                <div className="verify-path">
                  {round.path.map((b, i) => (
                    <span key={i} className={`vp-step ${b ? 'r' : 'l'}`}>{b ? 'R' : 'L'}</span>
                  ))}
                  <span className="vp-arrow">→ slot {round.slot}</span>
                </div>
              </div>
            )}

            {/* on-chain inputs */}
            <div className="verify-block">
              <div className="verify-section-label"><span className="kicker">On-chain inputs</span></div>
              <div className="seed-row">
                <span className="sk">VRF request ID</span>
                <Hashish value={round.requestId} chars={5} />
              </div>
              <div className="seed-row">
                <span className="sk">Raw random word</span>
                <Hashish value={round.vrfWord} chars={6} />
              </div>
              <div className="seed-row">
                <span className="sk">Client seed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Hashish value={round.clientSeed} chars={5} />
                  <button className="seed-reroll" onClick={onReroll} title="Use a fresh seed on your next bet">↻ reroll</button>
                </span>
              </div>
              <div className="seed-row">
                <span className="sk">Nonce</span>
                <span className="mono" style={{ fontSize: 13 }}>{round.nonce}</span>
              </div>
            </div>

            {/* the open formula */}
            <div>
              <div className="verify-section-label" style={{ marginBottom: 8 }}><span className="kicker">The open formula</span></div>
              <div className="formula">
                <div className="formula-line">
                  <span className="var">finalSeed</span> = <span className="fn">keccak256</span>(<span className="cm">vrfWord, clientSeed, nonce</span>)
                </div>
                {isPlinko ? (
                  <>
                    <div className="formula-line">
                      <span className="var">path</span> = <span className="fn">bits</span>(<span className="cm">finalSeed, {round.rows}</span>) <span className="formula-arrow">→ slot {round.slot}</span>
                    </div>
                    <div className="formula-line">
                      <span className="var">multiplier</span> = <span className="fn">table</span>(<span className="cm">{round.rows}, {round.risk}</span>)[<span className="cm">slot</span>] <span className="formula-arrow">→ {fmt(round.multiplier)}×</span>
                    </div>
                  </>
                ) : (
                  <div className="formula-line">
                    <span className="var">crashPoint</span> = <span className="fn">limbo</span>(<span className="cm">finalSeed, edge=2%</span>) <span className="formula-arrow">→ {fmt(round.crash)}×</span>
                  </div>
                )}
              </div>
            </div>

            {/* recompute */}
            <div className="recompute">
              {phase !== 'idle' && (
                <div className="compute-log">
                  <div className={`cl${steps >= 1 ? ' show' : ''}`}><span className="tick">›</span> packing abi.encodePacked(vrfWord, clientSeed, nonce)</div>
                  <div className={`cl${steps >= 2 ? ' show' : ''}`}><span className="tick">›</span> finalSeed = keccak256(…) in your browser</div>
                  <div className={`cl${steps >= 3 ? ' show' : ''}`}><span className="tick">›</span> {isPlinko ? `reading ${round.rows} bits → path → slot → multiplier` : 'deriving crashPoint with 2% edge'}</div>
                </div>
              )}

              {layout === 'diff' && browser && (
                <div className="verify-diff">
                  <div>
                    <div className="dh">Contract said</div>
                    <div className="dv">{round.finalSeed.slice(0, 22)}…</div>
                    <div className="dv" style={{ marginTop: 8 }}>{isPlinko ? `slot ${round.slot} · ${fmt(round.multiplier)}×` : `${fmt(round.crash)}×`}</div>
                  </div>
                  <div>
                    <div className="dh">Your browser derived</div>
                    <div className={`dv${matches ? ' match' : ''}`}>{browser.finalSeed.slice(0, 22)}…</div>
                    <div className={`dv${matches ? ' match' : ''}`} style={{ marginTop: 8 }}>{isPlinko ? `slot ${browser.slot} · ${fmt(browser.multiplier)}×` : `${fmt(browser.crash)}×`}</div>
                  </div>
                </div>
              )}

              {phase === 'matched' && (
                <div className={`match-reveal show`}>
                  <div className="match-check">✓</div>
                  <div className="match-text">
                    <div className="mt-1">{matches ? 'Matches the contract.' : 'Mismatch'}</div>
                    <div className="mt-2">{matches ? 'your browser reached the same outcome, independently' : 'unexpected — do not trust this round'}</div>
                  </div>
                </div>
              )}

              {phase !== 'matched' && (
                <Btn kind="accent" full onClick={recompute} disabled={phase === 'computing'}>
                  {phase === 'computing' ? 'Recomputing…' : 'Recompute in your browser'}
                </Btn>
              )}

              <a className="btn btn-ghost btn-full" href={etherscan} target="_blank" rel="noopener noreferrer">
                <span>View on Etherscan ↗</span>
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

Object.assign(window, { VerifyDrawer });
