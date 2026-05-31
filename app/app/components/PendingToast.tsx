"use client";

/**
 * Pending-bet toast — driven by the REAL bet stage from `usePlaceBet`, not a
 * fixed timer. The label is whatever step the bet is actually at right now;
 * the bar parks at each stage's target fill (notably ~68% through the long VRF
 * wait), while the ticking elapsed counter and the pulsing dot carry liveness.
 * Shared by Limbo and Plinko so the two never drift.
 */

import { useEffect, useRef, useState } from "react";
import {
  BET_STAGES,
  BET_STAGE_LABEL,
  BET_STAGE_PCT,
  type BetStage,
} from "../lib/live-bet";

export function PendingToast({ stage }: { stage: BetStage }) {
  const [elapsed, setElapsed] = useState(0);
  const [show, setShow] = useState(false);
  const startRef = useRef<number | null>(null);

  // Real wall-clock elapsed since the toast mounted (the honest liveness cue).
  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    startRef.current = performance.now();
    const iv = setInterval(() => {
      if (startRef.current != null) {
        setElapsed((performance.now() - startRef.current) / 1000);
      }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // Resolve label/fill from the live stage; fall back to the first stage before
  // the first onProgress fires.
  const known = BET_STAGES.includes(stage) ? stage : BET_STAGES[0];
  const label = BET_STAGE_LABEL[known];
  const pct = BET_STAGE_PCT[known];

  return (
    <div
      className={`glass pending-toast${show ? " show" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="pt-spinner" />
      <div className="pt-body">
        <div className="pt-head">
          <span className="pt-title">Resolving on-chain</span>
          <span className="pt-elapsed mono">{elapsed.toFixed(1)}s</span>
        </div>
        <div className="pt-step mono">
          <span className="pulse-dot" />
          {label}
        </div>
        <div className="pt-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
