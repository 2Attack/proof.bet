"use client";

/**
 * Limbo bet hook — settles through the shared fairness engine.
 * In mock mode: uses a random vrfWord + settleRound.
 * In live mode: calls placeBet on the contract, watches BetSettled.
 */

import { useState, useCallback, useRef } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { GameType, type BetParams } from "@proofbet/shared/types";
import { settleRound } from "@proofbet/shared/fairness";
import {
  placeBetMock,
  resolveBet,
  type MockRound,
} from "../../lib/mock-store";
import {
  setPendingLiveRound,
  resolveLiveRound,
  clearPendingLiveRound,
} from "../../lib/rounds-store";
import { placeBetLive } from "../../lib/live-bet";
import { fpToWei, weiToFp } from "../../lib/units";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

const ZERO_SEED =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export type BetPhase = "idle" | "pending" | "revealing" | "settled";

export interface LimboRound extends MockRound {
  crashX100: bigint;
  targetX100: bigint;
}

export function usePlaceBet() {
  const [phase, setPhase] = useState<BetPhase>("idle");
  const [round, setRound] = useState<LimboRound | null>(null);
  const inFlightRef = useRef(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

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
          if (!publicClient) throw new Error("No RPC client");
          const params: BetParams = { target: targetX100, rows: 0, risk: 0 };

          // Optimistic pending round (fp units for display); stake is already
          // debited on-chain once placeBet confirms.
          setPendingLiveRound({
            requestId: "",
            txHash: ZERO_SEED,
            vrfWord: 0n,
            clientSeed,
            nonce,
            game: GameType.Limbo,
            stake,
            params: { target: targetX100, rows: 0, risk: 0 },
            finalSeed: ZERO_SEED,
            outcomeX100: 0n,
            win: false,
            payout: 0n,
          });

          const res = await placeBetLive({
            publicClient,
            writeContractAsync,
            game: GameType.Limbo,
            stakeWei: fpToWei(stake),
            clientSeed,
            params,
          });

          // Recompute via the shared engine (same logic the contract ran) — this
          // is what the Verify drawer will also reproduce.
          const s = settleRound(
            GameType.Limbo,
            res.vrfWord,
            clientSeed,
            nonce,
            params,
            fpToWei(stake),
          );

          const settled: LimboRound = {
            requestId: String(res.requestId),
            txHash: res.txHash,
            vrfWord: res.vrfWord,
            clientSeed,
            nonce,
            game: GameType.Limbo,
            stake,
            params: { target: targetX100, rows: 0, risk: 0 },
            finalSeed: res.finalSeed,
            outcomeX100: res.outcomeX100,
            win: res.win,
            payout: weiToFp(res.payout),
            crashX100: s.outcomeX100,
            targetX100,
          };

          resolveLiveRound(settled);
          setRound(settled);
          setPhase("revealing");
        }
      } catch (err) {
        console.error("placeBet error:", err);
        if (!config.isMock) clearPendingLiveRound();
        setPhase("idle");
      } finally {
        inFlightRef.current = false;
      }
    },
    [publicClient, writeContractAsync],
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
