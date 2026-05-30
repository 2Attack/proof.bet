"use client";

import type { TxState as TxStateType } from "../features/economy/hooks";
import { Hashish } from "./Hashish";

interface TxStateProps {
  tx: TxStateType;
  verb?: string;
  doneLabel?: string;
}

export function TxStateDisplay({ tx, verb, doneLabel }: TxStateProps) {
  const { phase, hash } = tx;
  const cls =
    phase === "confirmed"
      ? "tx-state confirmed"
      : phase === "error"
        ? "tx-state error"
        : "tx-state";

  return (
    <div className={cls} role="status" aria-live="polite">
      <div className="tx-ind">
        {(phase === "signing" || phase === "pending") && (
          <div className="tx-spin" />
        )}
        {phase === "confirmed" && <div className="tx-tick">✓</div>}
        {phase === "error" && <div className="tx-x">✕</div>}
      </div>
      <div className="tx-body">
        <div className="tx-label">
          {phase === "signing" && "Awaiting signature in your wallet…"}
          {phase === "pending" && `${verb ?? "Confirming on-chain"}…`}
          {phase === "confirmed" && (doneLabel ?? "Confirmed on-chain")}
          {phase === "error" && "Transaction failed"}
        </div>
        <div className="tx-meta">
          {phase === "signing" && <span>sign to broadcast · Sepolia</span>}
          {phase === "pending" && hash && (
            <>
              <span>tx</span>
              <Hashish value={hash} chars={5} />
            </>
          )}
          {phase === "confirmed" && hash && (
            <>
              <span className="chip-dot" style={{ width: 5, height: 5 }} />
              <span>confirmed</span>
              <Hashish value={hash} chars={5} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
