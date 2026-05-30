"use client";

import { useRef } from "react";
import { useApp } from "../../lib/app-context";
import { useWithdraw } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

interface WithdrawDrawerProps {
  onClose: () => void;
}

export function WithdrawDrawer({ onClose }: WithdrawDrawerProps) {
  const { walletPRF, inPlay } = useApp();
  const { tx, withdraw } = useWithdraw();
  const captured = useRef(inPlay);

  const busy = tx.phase === "signing" || tx.phase === "pending";
  const confirmed = tx.phase === "confirmed";

  const doWithdraw = () => {
    captured.current = inPlay;
    withdraw();
  };

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="drawer-title">Cash out to your wallet</div>
          <div className="drawer-sub">
            pull your full in-play balance back — the only real cash-out
          </div>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        <div className="xfer">
          <div className="xfer-side is-source">
            <div className="xfer-k"><span className="chip-token" />In play</div>
            <div className="xfer-v">{fmtPRF(inPlay)}</div>
            <div className="xfer-u">PRF</div>
          </div>
          <div className={`xfer-arrow${busy ? " active" : ""}`}>
            <span className="xa-line" />
            <span className="xa-chip" /><span className="xa-chip" /><span className="xa-chip" />
            <span className="xa-head">→</span>
          </div>
          <div className={`xfer-side is-dest${confirmed ? " active" : ""}`}>
            <div className="xfer-k"><span className="chip-token dim" />Wallet</div>
            <div className="xfer-v">{fmtPRF(walletPRF)}</div>
            <div className="xfer-u">PRF</div>
          </div>
        </div>

        {!confirmed ? (
          <>
            {tx.phase !== "idle" && (
              <TxStateDisplay tx={tx} verb="Withdrawing Proofs" doneLabel="Proofs returned to your wallet" />
            )}
            <div className="eco-actions">
              <Btn kind="accent" full disabled={busy || inPlay <= 0n} onClick={doWithdraw}>
                {busy
                  ? tx.phase === "signing" ? "Awaiting signature…" : "Confirming…"
                  : inPlay > 0n
                    ? `Withdraw all · ${fmtPRF(inPlay)} PRF`
                    : "Nothing in play"}
              </Btn>
              <Btn kind="ghost" full disabled={busy} onClick={onClose}>
                Back to game
              </Btn>
              <div className="eco-note">
                Protected withdrawal · in-play balance cleared before transfer
              </div>
            </div>
          </>
        ) : (
          <>
            <TxStateDisplay tx={tx} doneLabel={`${fmtPRF(captured.current)} PRF returned to your wallet`} />
            <div className="eco-actions">
              <Btn kind="accent" full onClick={onClose}>Back to game →</Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}
