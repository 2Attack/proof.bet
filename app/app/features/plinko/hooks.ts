"use client";

/**
 * Plinko bet hook — same pattern as Limbo, different game params.
 * Uses resolveBet to write the fully-settled round into the store
 * so the Auditor and Verify drawer are consistent.
 */

import { useState, useCallback, useEffect, useRef } from "react";
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

export type PlinkoBetPhase =
  | "idle"
  | "pending"
  | "error"
  | "dropping"
  | "settled";

export type BetError = BetErrorInfo;

export interface PlinkoRound extends MockRound {
  rows: number;
  risk: Risk;
  multiplierX100: bigint;
}

export function usePlinkoBet() {
  const [phase, setPhase] = useState<PlinkoBetPhase>("idle");
  const [stage, setStage] = useState<BetStage>("signing");
  const [round, setRound] = useState<PlinkoRound | null>(null);
  const [error, setError] = useState<BetError | null>(null);
  const inFlightRef = useRef(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Mirror `phase` into a ref so the store subscription below reads the live
  // value without re-subscribing every render.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Adopt a chain-recovered settled round (after a reload) and replay its drop,
  // identical to a live bet — recovery records balances/history but can't drive
  // this hook's reveal directly. Display-only: we set round + phase; the round was
  // already recorded by `resolveRecoveredRound`. rounds-store is live-only, so in
  // mock mode `recoveredResult` stays null and this never fires.
  useEffect(() => {
    const tryAdopt = () => {
      const rec = getLiveRounds().recoveredResult;
      if (!rec || rec.game !== GameType.Plinko) return;
      if (inFlightRef.current || phaseRef.current !== "idle") return;
      consumeRecoveredResult();
      setRound({
        ...rec,
        rows: rec.params.rows,
        risk: rec.params.risk as Risk,
        multiplierX100: rec.outcomeX100,
      });
      setPhase("dropping");
    };
    tryAdopt();
    return subscribeLiveRounds(tryAdopt);
  }, []);

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
      // A new bet cancels any lingering error toast from the previous one —
      // clearing the timer here is what stops a stale dismiss from stomping
      // this fresh pending toast (the auto-dismiss race).
      if (dismissRef.current) clearTimeout(dismissRef.current);
      setError(null);
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
        // A declined wallet prompt is an expected choice, not a bug — log it
        // quietly. Everything else (RPC down, revert, settlement timeout) is a
        // real failure and keeps the loud console.error so it isn't hidden.
        const info = classifyBetError(err);
        if (info.cancelled) {
          console.info("Plinko bet cancelled by user");
        } else {
          console.error("plinko placeBet error:", err);
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

  const startDrop = useCallback(() => {
    setPhase("dropping");
  }, []);

  const settle = useCallback(() => {
    setPhase("settled");
  }, []);

  const reset = useCallback(() => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
    setPhase("idle");
    setRound(null);
    setError(null);
  }, []);

  return { phase, stage, round, error, placeBet, startDrop, settle, reset };
}
