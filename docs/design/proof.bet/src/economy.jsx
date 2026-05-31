// ============================================================
// proof.bet — Proofs economy
// The on-chain stages between connect and play, and the cash-out —
// now presented as liquid-glass DRAWERS that slide over the live app
// (the table stays visible behind them).
//   connect → claim Proofs → deposit → play → withdraw
// Two currencies (tETH = gas only · Proofs/PRF = the only bet unit),
// two Proofs balances (Wallet vs In play). Honest tx states, spring
// transfers, one accent. Nothing here invents new visual language.
// ============================================================
const { useState: useStateEco, useEffect: useEffectEco, useRef: useRefEco } = React;

// Proofs: whole-ish, thousands separators, up to 2dp, no trailing zeros
function fmtChips(n) {
  if (n == null || isNaN(n)) n = 0;
  const v = Math.round(n * 100) / 100;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// gas: tETH, quiet, three decimals so a tx visibly nudges it
function fmtGas(n) {
  if (n == null || isNaN(n)) n = 0;
  return (Math.max(0, n)).toFixed(3);
}
window.fmtChips = fmtChips;
window.fmtGas = fmtGas;

// ---------- honest on-chain transaction state machine ----------
// idle → signing (awaiting wallet signature) → pending (broadcast,
// confirming) → confirmed. Real-ish latencies; never a fake spinner
// with no destination.
function useTx() {
  const [state, setState] = useStateEco('idle');
  const [hash, setHash] = useStateEco(null);
  const timers = useRefEco([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffectEco(() => clear, []);
  const run = (onConfirm) => {
    clear();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const h = randHex(32);
    setHash(h);
    setState('signing');
    const dSign = reduce ? 140 : 950;
    const dPend = reduce ? 160 : 1500;
    timers.current.push(setTimeout(() => setState('pending'), dSign));
    timers.current.push(setTimeout(() => { setState('confirmed'); if (onConfirm) onConfirm(h); }, dSign + dPend));
  };
  const reset = () => { clear(); setState('idle'); setHash(null); };
  return { state, hash, run, reset };
}
function txCta(state) {
  if (state === 'signing') return 'Awaiting signature…';
  if (state === 'pending') return 'Confirming…';
  return '…';
}

// the on-chain state row (signing / pending / confirmed / error)
function TxState({ tx, verb, doneLabel }) {
  const { state, hash } = tx;
  const cls = state === 'confirmed' ? 'confirmed' : state === 'error' ? 'error' : '';
  return (
    <div className={`tx-state ${cls}`} role="status" aria-live="polite">
      <div className="tx-ind">
        {(state === 'signing' || state === 'pending') && <div className="tx-spin" />}
        {state === 'confirmed' && <div className="tx-tick">✓</div>}
        {state === 'error' && <div className="tx-x">✕</div>}
      </div>
      <div className="tx-body">
        <div className="tx-label">
          {state === 'signing' && 'Awaiting signature in your wallet…'}
          {state === 'pending' && `${verb || 'Confirming on-chain'}…`}
          {state === 'confirmed' && (doneLabel || 'Confirmed on-chain')}
          {state === 'error' && 'Transaction rejected'}
        </div>
        <div className="tx-meta">
          {state === 'signing' && <span>sign to broadcast · Sepolia</span>}
          {state === 'pending' && hash && <><span>tx</span><Hashish value={hash} chars={5} /></>}
          {state === 'confirmed' && hash && <><span className="chip-dot" style={{ width: 5, height: 5 }} />confirmed<Hashish value={hash} chars={5} /></>}
        </div>
      </div>
    </div>
  );
}

// ---------- quiet flow breadcrumb ----------
const FLOW = [
  { id: 'connect', label: 'Connect' },
  { id: 'chips', label: 'Claim' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'play', label: 'Play' },
];
function FlowRail({ stage }) {
  const idx = FLOW.findIndex((s) => s.id === stage);
  return (
    <div className="flow-rail" aria-hidden="true">
      {FLOW.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <span className="flow-sep" />}
          <span className={`flow-node${i < idx ? ' done' : ''}${i === idx ? ' active' : ''}`}>
            <span className="fn-dot" />{s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------- small fuel glyph for the gas indicator ----------
function FuelIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.6" y="2" width="6.4" height="12" rx="1.4" />
      <line x1="2.6" y1="6.4" x2="9" y2="6.4" />
      <path d="M9 5.6l2.6 2.1v4.1a1.2 1.2 0 0 1-2.4 0" />
      <path d="M11.6 5.3 10.2 4" />
    </svg>
  );
}
// top-bar gas pill — small, quiet, never a primary balance
function GasPill({ gas }) {
  return (
    <span className="glass-pill gas-pill" title="Sepolia test ETH — pays transaction fees only. You never bet it.">
      <span className="gas-ico"><FuelIcon /></span>
      <span className="gas-v mono">{fmtGas(gas)}</span>
      <span className="gas-u mono">tETH · gas</span>
    </span>
  );
}

// ---------- the Wallet → In play transfer visual ----------
function ArrowGlyph() {
  return (
    <svg viewBox="0 0 18 12" width="16" height="11" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6h13M10 1.5 15.5 6 10 10.5" />
    </svg>
  );
}
function TransferBoard({ srcLabel, srcVal, dstLabel, dstVal, flowing, arrived }) {
  return (
    <div className="xfer">
      <div className="xfer-side is-source">
        <div className="xfer-k"><span className="chip-token" />{srcLabel}</div>
        <div className="xfer-v">{fmtChips(srcVal)}</div>
        <div className="xfer-u">PRF</div>
      </div>
      <div className={`xfer-arrow${flowing ? ' active' : ''}`}>
        <span className="xa-line" />
        <span className="xa-chip" /><span className="xa-chip" /><span className="xa-chip" />
        <span className="xa-head"><ArrowGlyph /></span>
      </div>
      <div className={`xfer-side is-dest${arrived ? ' active' : ''}`}>
        <div className="xfer-k"><span className="chip-token" />{dstLabel}</div>
        <div className="xfer-v">{fmtChips(dstVal)}</div>
        <div className="xfer-u">PRF</div>
      </div>
    </div>
  );
}

// reusable drawer head (matches the Verify drawer chrome)
function DrawerHead({ title, sub, onClose }) {
  return (
    <div className="drawer-head">
      <div>
        <div className="drawer-title">{title}</div>
        <div className="drawer-sub">{sub}</div>
      </div>
      <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

// ============================================================
// A. FAUCET — claim free test Proofs into a zero-balance wallet
// ============================================================
function FaucetBody({ walletChips, gas, onMint, onContinue, onClose }) {
  const tx = useTx();
  const display = useSpringValue(walletChips, 'climb');
  const minted = walletChips > 0;
  const busy = tx.state === 'signing' || tx.state === 'pending';

  const mint = () => {
    if (busy || minted) return;
    if (window.pkSound) window.pkSound.unlock();
    tx.run(() => { onMint(1000); if (window.pkSound && window.pkSound.ui) window.pkSound.ui(); });
  };

  return (
    <>
      <DrawerHead title="Claim your Proofs" sub="free test Proofs · not real money · tETH only pays gas" onClose={onClose} />
      <div className="drawer-body">
        <FlowRail stage="chips" />

        <div className={`chips-readout${minted ? ' lit' : ''}`}>
          <div className="cr-k"><span className="chip-token" />Wallet balance</div>
          <div className="cr-v">{fmtChips(Math.round(display))}</div>
          <div className="cr-u">PRF</div>
          <div className="cr-stack" />
        </div>

        {tx.state !== 'idle' && <TxState tx={tx} verb="Minting 1,000 Proofs" doneLabel="1,000 Proofs minted to your wallet" />}

        <div className="eco-actions">
          {!minted
            ? <Btn kind="accent" full disabled={busy} onClick={mint}>{busy ? txCta(tx.state) : 'Claim 1,000 Proofs'}</Btn>
            : <Btn kind="accent" full onClick={onContinue}>Deposit to play →</Btn>}
          <div className="eco-note">Testnet faucet · mints the PRF ERC-20 test token to your address</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// B. DEPOSIT — move Proofs from Wallet into In play
// ============================================================
function DepositBody({ walletChips, inPlay, onDeposit, onContinue, onClose }) {
  const tx = useTx();
  const [amt, setAmt] = useStateEco(walletChips);
  const touched = useRefEco(false);
  const wDisp = useSpringValue(walletChips, 'gentle');
  const pDisp = useSpringValue(inPlay, 'gentle');
  const confirmed = tx.state === 'confirmed';
  const busy = tx.state === 'signing' || tx.state === 'pending';

  // keep the default ("deposit all") synced until the user edits it
  useEffectEco(() => { if (!touched.current) setAmt(walletChips); }, [walletChips]);

  const a = Math.min(Math.max(0, Number(amt) || 0), walletChips);
  const canDeposit = !busy && !confirmed && a > 0;

  const deposit = () => {
    if (!canDeposit) return;
    if (window.pkSound) window.pkSound.unlock();
    tx.run(() => { onDeposit(a); if (window.pkSound && window.pkSound.ui) window.pkSound.ui(); });
  };

  return (
    <>
      <DrawerHead title="Move Proofs in play" sub="deposit into the game contract — the balance your bets draw from" onClose={onClose} />
      <div className="drawer-body">
        <FlowRail stage="deposit" />

        <TransferBoard srcLabel="Wallet" srcVal={Math.round(wDisp)} dstLabel="In play" dstVal={Math.round(pDisp)}
          flowing={busy} arrived={confirmed} />

        {!confirmed ? (
          <>
            <div className="eco-amount">
              <div className="eco-amount-head">
                <span className="kicker">Amount</span>
                <span className="eco-avail">Wallet · {fmtChips(walletChips)} PRF</span>
              </div>
              <div className="eco-amount-field">
                <input type="number" min="0" step="1" value={amt} disabled={busy} inputMode="numeric"
                  onChange={(e) => { touched.current = true; setAmt(e.target.value); }} aria-label="deposit amount" />
                <button className="eco-all" disabled={busy} onClick={() => { touched.current = false; setAmt(walletChips); }}>Deposit all</button>
                <span className="unit"><span className="chip-token" />PRF</span>
              </div>
            </div>

            {tx.state !== 'idle' && <TxState tx={tx} verb="Depositing Proofs" doneLabel="Proofs moved into play" />}

            <div className="eco-actions">
              <Btn kind="accent" full disabled={!canDeposit} onClick={deposit}>
                {busy ? txCta(tx.state) : a > 0 ? `Deposit ${fmtChips(a)} PRF` : 'Enter an amount'}
              </Btn>
              <div className="eco-note">Non-custodial · withdraw your Proofs back to your wallet anytime</div>
            </div>
          </>
        ) : (
          <>
            <TxState tx={tx} doneLabel="Proofs moved into play" />
            <div className="eco-actions">
              <Btn kind="accent" full onClick={onContinue}>Choose a game →</Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// C. WITHDRAW — pull the entire In play balance back to Wallet
// ============================================================
function WithdrawBody({ inPlay, walletChips, onWithdraw, onClose }) {
  const tx = useTx();
  const captured = useRefEco(inPlay);
  const wDisp = useSpringValue(walletChips, 'gentle');
  const pDisp = useSpringValue(inPlay, 'gentle');
  const confirmed = tx.state === 'confirmed';
  const busy = tx.state === 'signing' || tx.state === 'pending';

  const withdraw = () => {
    if (busy || confirmed || inPlay <= 0) return;
    captured.current = inPlay;
    if (window.pkSound) window.pkSound.unlock();
    tx.run(() => { onWithdraw(); if (window.pkSound && window.pkSound.ui) window.pkSound.ui(); });
  };

  return (
    <>
      <DrawerHead title="Cash out to your wallet" sub="pull your full in-play balance back — the only real cash-out" onClose={onClose} />
      <div className="drawer-body">
        <TransferBoard srcLabel="In play" srcVal={Math.round(pDisp)} dstLabel="Wallet" dstVal={Math.round(wDisp)}
          flowing={busy} arrived={confirmed} />

        {!confirmed ? (
          <>
            {tx.state !== 'idle' && <TxState tx={tx} verb="Withdrawing Proofs" doneLabel="Proofs returned to your wallet" />}
            <div className="eco-actions">
              <Btn kind="accent" full disabled={busy || inPlay <= 0} onClick={withdraw}>
                {busy ? txCta(tx.state) : inPlay > 0 ? `Withdraw all · ${fmtChips(inPlay)} PRF` : 'Nothing in play'}
              </Btn>
              <Btn kind="ghost" full disabled={busy} onClick={onClose}>Back to game</Btn>
              <div className="eco-note">Protected withdrawal · in-play balance cleared before transfer</div>
            </div>
          </>
        ) : (
          <>
            <TxState tx={tx} doneLabel={`${fmtChips(captured.current)} PRF returned to your wallet`} />
            <div className="eco-actions">
              <Btn kind="accent" full onClick={onClose}>Back to game →</Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// The liquid-glass economy drawer shell. Slides over the live app
// (same chrome as the Verify drawer). `type` selects the body;
// `openKey` changes on every open so each session mounts fresh
// (tx state resets). The last body stays mounted through the
// slide-out so the close animation is smooth.
// ============================================================
function EconomyDrawer({ type, openKey, onClose, goDeposit, goPlay, ...props }) {
  const open = !!type;
  const [render, setRender] = useStateEco(null); // { type, key }
  useEffectEco(() => {
    if (type) { setRender({ type, key: openKey }); return; }
    const t = setTimeout(() => setRender(null), 560);
    return () => clearTimeout(t);
  }, [type, openKey]);

  let body = null;
  if (render) {
    const k = `${render.type}-${render.key}`;
    if (render.type === 'faucet')
      body = <FaucetBody key={k} {...props} onContinue={goDeposit} onClose={onClose} />;
    else if (render.type === 'deposit')
      body = <DepositBody key={k} {...props} onContinue={goPlay} onClose={onClose} />;
    else if (render.type === 'withdraw')
      body = <WithdrawBody key={k} {...props} onClose={onClose} />;
  }

  return (
    <>
      <div className={`drawer-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer eco-drawer${open ? ' open' : ''}`} role="dialog"
        aria-label="Wallet" aria-hidden={!open}>
        <div className="glass drawer-inner">{body}</div>
      </aside>
    </>
  );
}

// ---------- combined wallet + Proofs menu (one header dropdown) ----------
// Pill shows the avatar + total Proofs. The dropdown carries wallet identity,
// the In play / Wallet split, Deposit & Withdraw, network, gas and disconnect.
function WalletMenu({ account, walletChips, inPlay, gas, onDeposit, onWithdraw, onDisconnect }) {
  const [open, setOpen] = useStateEco(false);
  const [copied, setCopied] = useStateEco(false);
  const [pos, setPos] = useStateEco({ top: 0, right: 0 });
  const pillRef = useRefEco(null);
  const ddRef = useRefEco(null);

  const place = () => { const el = pillRef.current; if (!el) return; const r = el.getBoundingClientRect(); setPos({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) }); };
  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffectEco(() => {
    if (!open) return;
    const onDoc = (e) => { if (pillRef.current && pillRef.current.contains(e.target)) return; if (ddRef.current && ddRef.current.contains(e.target)) return; setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll); window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onScroll); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const copy = () => { try { navigator.clipboard && navigator.clipboard.writeText(account.addr); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const act = (fn) => { setOpen(false); if (fn) fn(); };
  const total = (walletChips || 0) + (inPlay || 0);

  const dropdown = (
    <div className="acct-dropdown wallet-dropdown glass" role="menu" ref={ddRef} style={{ top: pos.top, right: pos.right }}>
      <div className="ad-head">
        <span className="acct-ava ad-ava-lg" style={{ background: account.ava }} />
        <div className="ad-id">
          <div className="ad-wallet">{account.wallet}</div>
          <button className="ad-addr mono" onClick={copy} title="Copy address">{copied ? 'address copied ✓' : account.short}</button>
        </div>
      </div>

      <div className="wallet-chips">
        <div className="cur-dd-head">Your Proofs</div>
        <div className="chips-rows">
          <div className="chips-row"><span className="chips-row-k"><span className="chip-token" />In play</span><span className="chips-row-v mono">{fmtChips(inPlay)}</span></div>
          <div className="chips-row"><span className="chips-row-k"><span className="chip-token dim" />Wallet</span><span className="chips-row-v mono">{fmtChips(walletChips)}</span></div>
        </div>
        <div className="chips-acts">
          <button className="chips-act" onClick={() => act(onDeposit)}>Deposit</button>
          <button className="chips-act primary" disabled={inPlay <= 0} onClick={() => inPlay > 0 && act(onWithdraw)}>Withdraw all</button>
        </div>
      </div>

      <div className="ad-rows">
        <div className="ad-row"><span className="ad-k">Network</span><span className="ad-v mono"><span className="chip-dot" />Sepolia</span></div>
        <div className="ad-row"><span className="ad-k">Gas</span><span className="ad-v mono">{fmtGas(gas)} tETH</span></div>
      </div>

      <button className="ad-disconnect" onClick={() => { setOpen(false); if (onDisconnect) onDisconnect(); }} role="menuitem">Disconnect</button>
    </div>
  );

  return (
    <div className="acct-menu" style={{ marginLeft: 0 }}>
      <button ref={pillRef} className={`glass-pill acct-pill wallet-pill${open ? ' open' : ''}`} onClick={toggle} aria-haspopup="menu" aria-expanded={open} title="Wallet & Proofs">
        <span className="acct-ava" style={{ background: account.ava }} />
        <span className="chips-pill-v mono">{fmtChips(total)}</span>
        <span className="chips-pill-u mono">PRF</span>
        <svg className="acct-caret" viewBox="0 0 12 8" width="11" height="8" aria-hidden="true"><path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
}

// ---------- persistent in-game balance bar (In play + deposit/withdraw) ----------
function InPlayBar({ inPlay, walletChips, onWithdraw, onDeposit }) {
  return (
    <div className="inplay-bar">
      {walletChips > 0 && <span className="ip-wallet">Wallet <b>{fmtChips(walletChips)}</b></span>}
      <span className="ip-pill"><span className="chip-token" />In play <b>{fmtChips(inPlay)}</b><i>PRF</i></span>
      {inPlay > 0
        ? <button className="ip-withdraw" onClick={onWithdraw}>Withdraw</button>
        : <button className="ip-deposit" onClick={onDeposit}>+ Deposit Proofs</button>}
    </div>
  );
}

Object.assign(window, {
  fmtChips, fmtGas, useTx, TxState, FlowRail, GasPill,
  TransferBoard, EconomyDrawer, FaucetBody, DepositBody, WithdrawBody,
  InPlayBar, WalletMenu,
});
