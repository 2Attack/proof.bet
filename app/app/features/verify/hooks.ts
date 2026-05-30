"use client";

/**
 * Verify hook — recomputes any round in the browser using the shared fairness engine.
 * This is the "✓ matches" feature.
 */

import { useState, useCallback } from "react";
import type { Hex } from "viem";
import { GameType, Risk, type BetParams } from "@proofbet/shared/types";
import { settleRound } from "@proofbet/shared/fairness";
import type { MockRound } from "../../lib/mock-store";

export type VerifyPhase = "idle" | "computing" | "matched";

export interface VerifyResult {
  finalSeed: Hex;
  outcomeX100: bigint;
  win: boolean;
  path?: number[];
  slot?: number;
  matches: boolean;
}

export function useVerify(round: MockRound | null) {
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [steps, setSteps] = useState(0);

  const recompute = useCallback(async () => {
    if (!round) return;
    setPhase("computing");
    setSteps(0);
    setResult(null);

    // Simulate step-by-step reveal for UX
    await new Promise((r) => setTimeout(r, 420));
    setSteps(1);
    await new Promise((r) => setTimeout(r, 360));
    setSteps(2);
    await new Promise((r) => setTimeout(r, 360));
    setSteps(3);
    await new Promise((r) => setTimeout(r, 300));

    const params: BetParams = {
      target: round.params.target,
      rows: round.params.rows,
      risk: round.params.risk as Risk,
    };

    const s = settleRound(
      round.game as typeof GameType.Limbo | typeof GameType.Plinko,
      round.vrfWord,
      round.clientSeed,
      round.nonce,
      params,
      round.stake,
    );

    const matches =
      s.finalSeed === round.finalSeed &&
      s.outcomeX100 === round.outcomeX100 &&
      s.win === round.win;

    setResult({
      finalSeed: s.finalSeed,
      outcomeX100: s.outcomeX100,
      win: s.win,
      path: s.path,
      slot: s.slot,
      matches,
    });
    setPhase("matched");
  }, [round]);

  const resetVerify = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setSteps(0);
  }, []);

  return { phase, result, steps, recompute, resetVerify };
}
