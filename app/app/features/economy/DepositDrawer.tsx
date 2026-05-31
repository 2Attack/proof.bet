"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/app-context";
import { useDeposit, fpToFloat, fmtChips, fmtChipsFp, txCta } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";
import { useSpringValue } from "../../lib/spring";
import { getSound } from "../../lib/sound";

const FLOW = ["Connect", "Claim", "Deposit", "Play"] as const;
function FlowRail({ stage }: { stage: number }) {
  return (
    <div className="flow-rail" aria-hidden="true">
      {FLOW.map((label, i) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < FLOW.length - 1 ? "none" : 1 }}>
          {i > 0 && <span className="flow-sep" style={{ flex: 1 }} />}
          <span className={`flow-node${i < stage ? " done" : ""}${i === stage ? " active" : ""}`}>
            <span className="fn-dot" />{label}
          </span>
        </span>
      ))}
    </div>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 18 12" width="16" height="11" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6h13M10 1.5 15.5 6 10 10.5" />
    </svg>
  );
}

interface TransferBoardProps {
  srcLabel: string;
  srcVal: number;
  dstLabel: string;
  dstVal: number;
  flowing: boolean;
  arrived: boolean;
}
function TransferBoard({ srcLabel, srcVal, dstLabel, dstVal, flowing, arrived }: TransferBoardProps) {
  return (
    <div className="xfer">
      <div className="xfer-side is-source">
        <div className="xfer-k"><span className="chip-token" />{srcLabel}</div>
        <div className="xfer-v">{fmtChips(srcVal)}</div>
        <div className="xfer-u">PRF</div>
      </div>
      <div className={`xfer-arrow${flowing ? " active" : ""}`}>
        <span className="xa-line" />
        <span className="xa-chip" /><span className="xa-chip" /><span className="xa-chip" />
        <span className="xa-head"><ArrowGlyph /></span>
      </div>
      <div className={`xfer-side is-dest${arrived ? " active" : ""}`}>
        <div className="xfer-k"><span className="chip-token" />{dstLabel}</div>
        <div className="xfer-v">{fmtChips(dstVal)}</div>
        <div className="xfer-u">PRF</div>
      </div>
    </div>
  );
}

interface DepositDrawerProps {
  onClose: () => void;
}

export function DepositDrawer({ onClose }: DepositDrawerProps) {
  const router = useRouter();
  const { walletPRF, inPlay } = useApp();
  const { tx, deposit } = useDeposit();
  const [amt, setAmt] = useState(String(fpToFloat(walletPRF)));
  const touched = useRef(false);

  const busy = tx.phase === "signing" || tx.phase === "pending";
  const confirmed = tx.phase === "confirmed";

  // spring-driven transfer board values (whole PRF units)
  const wDisp = useSpringValue(fpToFloat(walletPRF), "gentle");
  const pDisp = useSpringValue(fpToFloat(inPlay), "gentle");

  // soft UI chime the instant the deposit confirms (design pkSound.ui)
  const chimed = useRef(false);
  useEffect(() => {
    if (tx.phase === "confirmed" && !chimed.current) {
      chimed.current = true;
      getSound().ui();
    }
  }, [tx.phase]);

  useEffect(() => {
    if (!touched.current) setAmt(String(fpToFloat(walletPRF)));
  }, [walletPRF]);

  const a = Math.min(
    Math.max(0, Number(amt) || 0),
    fpToFloat(walletPRF)
  );
  const aBigint = BigInt(Math.round(a * 100));
  const canDeposit = !busy && !confirmed && aBigint > 0n;

  const doDeposit = () => {
    if (!canDeposit) return;
    getSound().unlock();
    void deposit(aBigint);
  };

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="drawer-title">Move Proofs in play</div>
          <div className="drawer-sub">
            deposit into the game contract — the balance your bets draw from
          </div>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        <FlowRail stage={2} />

        <TransferBoard
          srcLabel="Wallet"
          srcVal={Math.round(wDisp)}
          dstLabel="In play"
          dstVal={Math.round(pDisp)}
          flowing={busy}
          arrived={confirmed}
        />

        {!confirmed ? (
          <>
            <div className="eco-amount">
              <div className="eco-amount-head">
                <span className="kicker">Amount</span>
                <span className="eco-avail">Wallet · {fmtChipsFp(walletPRF)} PRF</span>
              </div>
              <div className="eco-amount-field">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amt}
                  disabled={busy}
                  inputMode="numeric"
                  onChange={(e) => { touched.current = true; setAmt(e.target.value); }}
                  aria-label="deposit amount"
                />
                <button
                  className="eco-all"
                  disabled={busy}
                  onClick={() => { touched.current = false; setAmt(String(fpToFloat(walletPRF))); }}
                >
                  Deposit all
                </button>
                <span className="unit"><span className="chip-token" />PRF</span>
              </div>
            </div>

            {tx.phase !== "idle" && (
              <TxStateDisplay tx={tx} verb="Depositing Proofs" doneLabel="Proofs moved into play" />
            )}

            <div className="eco-actions">
              <Btn kind="accent" full disabled={!canDeposit} onClick={doDeposit}>
                {busy
                  ? txCta(tx.phase)
                  : aBigint > 0n
                    ? `Deposit ${fmtChipsFp(aBigint)} PRF`
                    : "Enter an amount"}
              </Btn>
              <div className="eco-note">
                Non-custodial · withdraw your Proofs back to your wallet anytime
              </div>
            </div>
          </>
        ) : (
          <>
            <TxStateDisplay tx={tx} doneLabel="Proofs moved into play" />
            <div className="eco-actions">
              <Btn kind="accent" full onClick={() => { onClose(); router.push("/games"); }}>
                Choose a game →
              </Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}
