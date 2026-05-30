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
  settleBetMock,
  type MockRound,
} from "../../lib/mock-store";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

export type BetPhase = "idle" | "pending" | "revealing" | "settled";

export interface LimboRound extends MockRound {
  // Limbo-specific conveniences already in MockRound
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
          const vrfWord = BigInt("0x" + randHex(32).slice(2));
          const params: BetParams = {
            target: targetX100,
            rows: 0,
            risk: 0,
          };

          // Build round with stored inputs FIRST, settle with same inputs
          const requestId = randHex(4);
          const txHash = randHex(32) as Hex;

          // Put mock bet in "pending" state in the store
          placeBetMock({
            requestId,
            txHash,
            vrfWord,
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

          setPhase("pending");

          // Fake VRF latency
          const vrfWordResolved = await fakeVRFLatency();

          // Settle using the SAME shared fairness engine
          const settlement = settleRound(
            GameType.Limbo,
            vrfWordResolved,
            clientSeed,
            nonce,
            params,
            stake,
          );

          const settled: LimboRound = {
            requestId,
            txHash,
            vrfWord: vrfWordResolved,
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

          // Update the store with the settled round
          settleBetMock(requestId);

          // Override the auto-settled store entry with correct values
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
