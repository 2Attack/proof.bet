"use client";

/**
 * Plinko bet hook — same pattern as Limbo, different game params.
 * Uses resolveBet to write the fully-settled round into the store
 * so the Auditor and Verify drawer are consistent.
 */

import { useState, useCallback, useRef } from "react";
import type { Hex } from "viem";
import { GameType, type BetParams, type Risk } from "@proofbet/shared/types";
import { settleRound } from "@proofbet/shared/fairness";
import {
  placeBetMock,
  resolveBet,
  type MockRound,
} from "../../lib/mock-store";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

export type PlinkoBetPhase = "idle" | "pending" | "dropping" | "settled";

export interface PlinkoRound extends MockRound {
  rows: number;
  risk: Risk;
  multiplierX100: bigint;
}

export function usePlinkoBet() {
  const [phase, setPhase] = useState<PlinkoBetPhase>("idle");
  const [round, setRound] = useState<PlinkoRound | null>(null);
  const inFlightRef = useRef(false);

  const placeBet = useCallback(
    async (
      stake: bigint,
      rows: number,
      risk: Risk,
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
          const params: BetParams = { target: 0n, rows, risk };

          // Lock stake from in-play immediately
          placeBetMock({
            requestId,
            txHash,
            vrfWord: 0n,
            clientSeed,
            nonce,
            game: GameType.Plinko,
            stake,
            params: { target: 0n, rows, risk },
            finalSeed: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
            outcomeX100: 0n,
            win: false,
            payout: 0n,
          });

          // Fake VRF latency
          const vrfWord = await fakeVRFLatency();

          const settlement = settleRound(
            GameType.Plinko,
            vrfWord,
            clientSeed,
            nonce,
            params,
            stake,
          );

          const settled: PlinkoRound = {
            requestId,
            txHash,
            vrfWord,
            clientSeed,
            nonce,
            game: GameType.Plinko,
            stake,
            params: { target: 0n, rows, risk },
            finalSeed: settlement.finalSeed,
            outcomeX100: settlement.outcomeX100,
            win: settlement.win,
            payout: settlement.payout,
            path: settlement.path,
            slot: settlement.slot,
            rows,
            risk,
            multiplierX100: settlement.outcomeX100,
          };

          // Write the FULLY resolved round into the store
          resolveBet(settled);

          setRound(settled);
          setPhase("dropping");
        } else {
          throw new Error("Live mode not implemented yet");
        }
      } catch (err) {
        console.error("plinko placeBet error:", err);
        setPhase("idle");
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const startDrop = useCallback(() => {
    setPhase("dropping");
  }, []);

  const settle = useCallback(() => {
    setPhase("settled");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setRound(null);
  }, []);

  return { phase, round, placeBet, startDrop, settle, reset };
}
