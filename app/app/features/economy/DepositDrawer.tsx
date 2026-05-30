"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/app-context";
import { useDeposit } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

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

interface DepositDrawerProps {
  onClose: () => void;
}

export function DepositDrawer({ onClose }: DepositDrawerProps) {
  const router = useRouter();
  const { walletPRF, inPlay } = useApp();
  const { tx, deposit } = useDeposit();
  const [amt, setAmt] = useState(String(Number(walletPRF) / 100));
  const touched = useRef(false);

  const busy = tx.phase === "signing" || tx.phase === "pending";
  const confirmed = tx.phase === "confirmed";

  useEffect(() => {
    if (!touched.current) setAmt(String(Number(walletPRF) / 100));
  }, [walletPRF]);

  const a = Math.min(
    Math.max(0, Number(amt) || 0),
    Number(walletPRF) / 100
  );
  const aBigint = BigInt(Math.round(a * 100));
  const canDeposit = !busy && !confirmed && aBigint > 0n;

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

        <div className="xfer">
          <div className="xfer-side is-source">
            <div className="xfer-k"><span className="chip-token" />Wallet</div>
            <div className="xfer-v">{fmtPRF(walletPRF)}</div>
            <div className="xfer-u">PRF</div>
          </div>
          <div className={`xfer-arrow${busy ? " active" : ""}`}>
            <span className="xa-line" />
            <span className="xa-chip" /><span className="xa-chip" /><span className="xa-chip" />
            <span className="xa-head">→</span>
          </div>
          <div className={`xfer-side is-dest${confirmed ? " active" : ""}`}>
            <div className="xfer-k"><span className="chip-token" />In play</div>
            <div className="xfer-v">{fmtPRF(inPlay)}</div>
            <div className="xfer-u">PRF</div>
          </div>
        </div>

        {!confirmed ? (
          <>
            <div className="eco-amount">
              <div className="eco-amount-head">
                <span className="kicker">Amount</span>
                <span className="eco-avail">Wallet · {fmtPRF(walletPRF)} PRF</span>
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
                  onClick={() => { touched.current = false; setAmt(String(Number(walletPRF) / 100)); }}
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
              <Btn kind="accent" full disabled={!canDeposit} onClick={() => deposit(aBigint)}>
                {busy
                  ? tx.phase === "signing" ? "Awaiting signature…" : "Confirming…"
                  : aBigint > 0n
                    ? `Deposit ${fmtPRF(aBigint)} PRF`
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
