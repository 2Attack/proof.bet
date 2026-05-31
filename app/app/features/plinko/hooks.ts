"use client";

/**
 * Plinko bet hook — same pattern as Limbo, different game params.
 * Uses resolveBet to write the fully-settled round into the store
 * so the Auditor and Verify drawer are consistent.
 */

import { useState, useCallback, useRef } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { GameType, type BetParams, type Risk } from "@proofbet/shared/types";
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
import { placeBetLive, type BetStage } from "../../lib/live-bet";
import { fpToWei, weiToFp } from "../../lib/units";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

const ZERO_SEED =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export type PlinkoBetPhase = "idle" | "pending" | "dropping" | "settled";

export interface PlinkoRound extends MockRound {
  rows: number;
  risk: Risk;
  multiplierX100: bigint;
}

export function usePlinkoBet() {
  const [phase, setPhase] = useState<PlinkoBetPhase>("idle");
  const [stage, setStage] = useState<BetStage>("signing");
  const [round, setRound] = useState<PlinkoRound | null>(null);
  const inFlightRef = useRef(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

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
      // Reset stage every bet so round 2's toast never opens on round 1's
      // leftover stage. Live confirms "signing" immediately; mock jumps to
      // "vrf" (no wallet prompt, single real wait).
      setStage("signing");
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

          // Mock has a single real await (the fake latency) → map it to the
          // VRF wait, the only stage that genuinely takes time here.
          setStage("vrf");
          // Fake VRF latency
          const vrfWord = await fakeVRFLatency();
          setStage("settling");

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
          if (!publicClient) throw new Error("No RPC client");
          const params: BetParams = { target: 0n, rows, risk };

          setPendingLiveRound({
            requestId: "",
            txHash: ZERO_SEED,
            vrfWord: 0n,
            clientSeed,
            nonce,
            game: GameType.Plinko,
            stake,
            params: { target: 0n, rows, risk },
            finalSeed: ZERO_SEED,
            outcomeX100: 0n,
            win: false,
            payout: 0n,
          });

          const res = await placeBetLive({
            publicClient,
            writeContractAsync,
            game: GameType.Plinko,
            stakeWei: fpToWei(stake),
            clientSeed,
            params,
            onProgress: setStage,
          });

          // Recompute path/slot via the shared engine for the ball-drop animation
          // and Verify parity (same logic the contract settled with).
          const s = settleRound(
            GameType.Plinko,
            res.vrfWord,
            clientSeed,
            nonce,
            params,
            fpToWei(stake),
          );

          const settled: PlinkoRound = {
            requestId: String(res.requestId),
            txHash: res.txHash,
            vrfWord: res.vrfWord,
            clientSeed,
            nonce,
            game: GameType.Plinko,
            stake,
            params: { target: 0n, rows, risk },
            finalSeed: res.finalSeed,
            outcomeX100: res.outcomeX100,
            win: res.win,
            payout: weiToFp(res.payout),
            path: s.path,
            slot: s.slot,
            rows,
            risk,
            multiplierX100: res.outcomeX100,
          };

          resolveLiveRound(settled);
          setRound(settled);
          setPhase("dropping");
        }
      } catch (err) {
        console.error("plinko placeBet error:", err);
        if (!config.isMock) clearPendingLiveRound();
        setPhase("idle");
      } finally {
        inFlightRef.current = false;
      }
    },
    [publicClient, writeContractAsync],
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

  return { phase, stage, round, placeBet, startDrop, settle, reset };
}
