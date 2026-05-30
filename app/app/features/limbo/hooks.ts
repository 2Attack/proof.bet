"use client";

/**
 * Limbo bet hook — settles through the shared fairness engine.
 * In mock mode: uses a random vrfWord + settleRound.
 * In live mode: calls placeBet on the contract, watches BetSettled.
 */

import { useState, useCallback, useRef } from "react";
import type { Hex } from "viem";
import { GameType, type BetParams } from "@proofbet/shared/types";
import { settleRound } from "@proofbet/shared/fairness";
import {
  placeBetMock,
  resolveBet,
  type MockRound,
} from "../../lib/mock-store";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

export type BetPhase = "idle" | "pending" | "revealing" | "settled";

export interface LimboRound extends MockRound {
  crashX100: bigint;
  targetX100: bigint;
}

export function usePlaceBet() {
  const [phase, setPhase] = useState<BetPhase>("idle");
  const [round, setRound] = useState<LimboRound | null>(null);
  const inFlightRef = useRef(false);

  const placeBet = useCallback(
    async (
      stake: bigint,
      targetX100: bigint,
      clientSeed: Hex,
      nonce: bigint,
    ) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setPhase("pending");
      setRound(null);

      try {
        if (config.isMock) {
          const requestId = randHex(4);
          const txHash = randHex(32) as Hex;
          const params: BetParams = {
            target: targetX100,
            rows: 0,
            risk: 0,
          };

          // Lock stake from in-play immediately (placeholder round)
          placeBetMock({
            requestId,
            txHash,
            vrfWord: 0n,
            clientSeed,
            nonce,
            game: GameType.Limbo,
            stake,
            params: { target: targetX100, rows: 0, risk: 0 },
            finalSeed: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
            outcomeX100: 0n,
            win: false,
            payout: 0n,
          });

          // Fake VRF latency (3–8s)
          const vrfWord = await fakeVRFLatency();

          // Settle using the SHARED fairness engine — SAME logic as the contract
          const settlement = settleRound(
            GameType.Limbo,
            vrfWord,
            clientSeed,
            nonce,
            params,
            stake,
          );

          const settled: LimboRound = {
            requestId,
            txHash,
            vrfWord,
            clientSeed,
            nonce,
            game: GameType.Limbo,
            stake,
            params: { target: targetX100, rows: 0, risk: 0 },
            finalSeed: settlement.finalSeed,
            outcomeX100: settlement.outcomeX100,
            win: settlement.win,
            payout: settlement.payout,
            crashX100: settlement.outcomeX100,
            targetX100,
          };

          // Write the FULLY resolved round into the store — ensures Auditor is consistent
          resolveBet(settled);

          setRound(settled);
          setPhase("revealing");
        } else {
          throw new Error("Live mode not implemented yet");
        }
      } catch (err) {
        console.error("placeBet error:", err);
        setPhase("idle");
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const settle = useCallback(() => {
    setPhase("settled");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setRound(null);
  }, []);

  return { phase, round, placeBet, settle, reset };
}
