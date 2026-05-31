"use client";

/**
 * Limbo bet hook — settles through the shared fairness engine.
 * In mock mode: uses a random vrfWord + settleRound.
 * In live mode: calls placeBet on the contract, watches BetSettled.
 */

import { useState, useCallback, useEffect, useRef } from "react";
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
  getLiveRounds,
  subscribeLiveRounds,
  consumeRecoveredResult,
} from "../../lib/rounds-store";
import { placeBetLive, type BetStage } from "../../lib/live-bet";
import { classifyBetError, type BetErrorInfo } from "../../lib/bet-errors";
import { fpToWei, weiToFp } from "../../lib/units";
import { randHex, fakeVRFLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

const ZERO_SEED =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/** How long the terminal toast lingers before auto-dismiss. A bare rejection
 *  clears fast; an actionable, fixable error (gas, network, cap) stays up long
 *  enough to act on before it fades. */
const ERROR_LINGER_MS = 3_000;
const ERROR_LINGER_PERSIST_MS = 12_000;

export type BetPhase = "idle" | "pending" | "error" | "revealing" | "settled";

export type BetError = BetErrorInfo;

export interface LimboRound extends MockRound {
  crashX100: bigint;
  targetX100: bigint;
}

export function usePlaceBet() {
  const [phase, setPhase] = useState<BetPhase>("idle");
  const [stage, setStage] = useState<BetStage>("signing");
  const [round, setRound] = useState<LimboRound | null>(null);
  const [error, setError] = useState<BetError | null>(null);
  const inFlightRef = useRef(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Mirror `phase` into a ref so the store subscription below reads the live
  // value without re-subscribing every render.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Adopt a chain-recovered settled round (after a reload) and replay its reveal,
  // identical to a live bet — recovery records balances/history but can't drive
  // this hook's reveal directly. Display-only: we set round + phase; the round was
  // already recorded by `resolveRecoveredRound`. rounds-store is live-only, so in
  // mock mode `recoveredResult` stays null and this never fires.
  useEffect(() => {
    const tryAdopt = () => {
      const rec = getLiveRounds().recoveredResult;
      if (!rec || rec.game !== GameType.Limbo) return;
      if (inFlightRef.current || phaseRef.current !== "idle") return;
      consumeRecoveredResult();
      setRound({
        ...rec,
        crashX100: rec.outcomeX100,
        targetX100: rec.params.target,
      });
      setPhase("revealing");
    };
    tryAdopt();
    return subscribeLiveRounds(tryAdopt);
  }, []);

  const placeBet = useCallback(
    async (
      stake: bigint,
      targetX100: bigint,
      clientSeed: Hex,
      nonce: bigint,
    ) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      // A new bet cancels any lingering error toast from the previous one —
      // clearing the timer here is what stops a stale dismiss from stomping
      // this fresh pending toast (the auto-dismiss race).
      if (dismissRef.current) clearTimeout(dismissRef.current);
      setError(null);
      // Reset stage every bet so round 2's toast never opens on round 1's
      // leftover stage. Live confirms "signing" immediately; mock jumps to
      // "confirming" (no wallet prompt).
      setStage("signing");
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

          // Mock has a single real await (the fake latency) → map it to the
          // VRF wait, the only stage that genuinely takes time here.
          setStage("vrf");
          // Fake VRF latency (3–8s)
          const vrfWord = await fakeVRFLatency();
          setStage("settling");

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
            onProgress: setStage,
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
        // A declined wallet prompt is an expected choice, not a bug — log it
        // quietly. Everything else (RPC down, revert, settlement timeout) is a
        // real failure and keeps the loud console.error so it isn't hidden.
        const info = classifyBetError(err);
        if (info.cancelled) {
          console.info("Limbo bet cancelled by user");
        } else {
          console.error("placeBet error:", err);
        }
        if (!config.isMock) clearPendingLiveRound();
        setError(info);
        setPhase("error");
        // Linger, then return to idle. The functional guard makes the timer a
        // no-op if a new bet (or a recovery action) has already left "error".
        dismissRef.current = setTimeout(() => {
          setPhase((p) => (p === "error" ? "idle" : p));
          setError(null);
        }, info.persist ? ERROR_LINGER_PERSIST_MS : ERROR_LINGER_MS);
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
    if (dismissRef.current) clearTimeout(dismissRef.current);
    setPhase("idle");
    setRound(null);
    setError(null);
  }, []);

  return { phase, stage, round, error, placeBet, settle, reset };
}
