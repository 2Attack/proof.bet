"use client";

import { useEffect, useRef } from "react";
import { useApp } from "../../lib/app-context";
import { useWithdraw, fpToFloat, fmtChips, fmtChipsFp, txCta } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";
import { useSpringValue } from "../../lib/spring";
import { getSound } from "../../lib/sound";

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
  srcDim?: boolean;
  dstLabel: string;
  dstVal: number;
  dstDim?: boolean;
  flowing: boolean;
  arrived: boolean;
}
function TransferBoard({ srcLabel, srcVal, dstLabel, dstVal, dstDim, flowing, arrived }: TransferBoardProps) {
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
        <div className="xfer-k"><span className={`chip-token${dstDim ? " dim" : ""}`} />{dstLabel}</div>
        <div className="xfer-v">{fmtChips(dstVal)}</div>
        <div className="xfer-u">PRF</div>
      </div>
    </div>
  );
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

  // spring-driven transfer board values (whole PRF units)
  const wDisp = useSpringValue(fpToFloat(walletPRF), "gentle");
  const pDisp = useSpringValue(fpToFloat(inPlay), "gentle");

  // soft UI chime the instant the withdrawal confirms (design pkSound.ui)
  const chimed = useRef(false);
  useEffect(() => {
    if (tx.phase === "confirmed" && !chimed.current) {
      chimed.current = true;
      getSound().ui();
    }
  }, [tx.phase]);

  const doWithdraw = () => {
    if (busy || confirmed || inPlay <= 0n) return;
    captured.current = inPlay;
    getSound().unlock();
    void withdraw();
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
        <TransferBoard
          srcLabel="In play"
          srcVal={Math.round(pDisp)}
          dstLabel="Wallet"
          dstVal={Math.round(wDisp)}
          dstDim
          flowing={busy}
          arrived={confirmed}
        />

        {!confirmed ? (
          <>
            {tx.phase !== "idle" && (
              <TxStateDisplay tx={tx} verb="Withdrawing Proofs" doneLabel="Proofs returned to your wallet" />
            )}
            <div className="eco-actions">
              <Btn kind="accent" full disabled={busy || inPlay <= 0n} onClick={doWithdraw}>
                {busy
                  ? txCta(tx.phase)
                  : inPlay > 0n
                    ? `Withdraw all · ${fmtChipsFp(inPlay)} PRF`
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
            <TxStateDisplay tx={tx} doneLabel={`${fmtChipsFp(captured.current)} PRF returned to your wallet`} />
            <div className="eco-actions">
              <Btn kind="accent" full onClick={onClose}>Back to game →</Btn>
            </div>
          </>
        )}
      </div>
    </>
  );
}
