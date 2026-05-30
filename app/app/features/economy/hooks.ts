"use client";

/**
 * Economy hooks — thin wrapper over contract calls (or mock).
 * Interface is identical regardless of mode; the switch is on config.isMock.
 * Balances cross the wei↔×100-fp boundary here (see units.ts).
 */

import { useState, useCallback } from "react";
import { maxUint256 } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  mintPRF,
  depositPRF,
  withdrawAll,
  FAUCET_AMOUNT,
} from "../../lib/mock-store";
import { proofBetContract, proofsContract } from "../../lib/contracts";
import { fpToWei } from "../../lib/units";
import { fakeTxLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "error";

export interface TxState {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Display-only shaping (ported from design economy.jsx fmtChips/fmtGas/txCta).
// Money stays bigint ×100 fp everywhere real; these helpers only format the
// transient *float* a spring is animating toward, so the readouts can climb.
// ---------------------------------------------------------------------------

/**
 * The app's bigint balances are ×100 fixed-point. Springs animate floats, so
 * convert a balance to whole-PRF units (e.g. 1000n*100 → 1000) for the spring
 * target, then format the live float with `fmtChips`.
 */
export function fpToFloat(fp: bigint): number {
  return Number(fp) / 100;
}

/** Proofs: en-US grouping, up to 2dp, no trailing zeros (design fmtChips). */
export function fmtChips(n: number): string {
  if (n == null || Number.isNaN(n)) n = 0;
  const v = Math.round(n * 100) / 100;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Bigint ×100 fp → design-style chips string (grouping, up to 2dp, no trailing
 * zeros). Same visual rule as `fmtChips` but fed the real bigint balance, so
 * static balances on every surface match the screenshots exactly.
 */
export function fmtChipsFp(fp: bigint): string {
  return fmtChips(fpToFloat(fp));
}

/** Gas (tETH): quiet, three decimals (design fmtGas). */
export function fmtGas(n: number): string {
  if (n == null || Number.isNaN(n)) n = 0;
  return Math.max(0, n).toFixed(3);
}

/** Busy-phase CTA label (design txCta). */
export function txCta(phase: TxPhase): string {
  if (phase === "signing") return "Awaiting signature…";
  if (phase === "pending") return "Confirming…";
  return "…";
}

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    // viem wraps revert reasons; the short message is the user-facing line.
    return (err as { shortMessage?: string }).shortMessage ?? err.message;
  }
  return String(err);
}

function useTxState() {
  const [state, setState] = useState<TxState>({
    phase: "idle",
    hash: null,
    error: null,
  });
  const reset = useCallback(
    () => setState({ phase: "idle", hash: null, error: null }),
    [],
  );
  return { state, setState, reset };
}

export function useFaucet() {
  const { state, setState, reset } = useTxState();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const faucet = useCallback(async () => {
    if (state.phase !== "idle") return;
    setState({ phase: "signing", hash: null, error: null });
    try {
      if (config.isMock) {
        setState((s) => ({ ...s, phase: "pending" }));
        const hash = await fakeTxLatency();
        mintPRF(FAUCET_AMOUNT);
        setState({ phase: "confirmed", hash, error: null });
      } else {
        if (!publicClient) throw new Error("No RPC client");
        const hash = await writeContractAsync({
          ...proofsContract,
          functionName: "faucet",
        });
        setState({ phase: "pending", hash, error: null });
        await publicClient.waitForTransactionReceipt({ hash });
        setState({ phase: "confirmed", hash, error: null });
      }
    } catch (err) {
      setState({ phase: "error", hash: null, error: errMessage(err) });
    }
  }, [state.phase, setState, publicClient, writeContractAsync]);

  return { tx: state, faucet, reset };
}

export function useDeposit() {
  const { state, setState, reset } = useTxState();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const deposit = useCallback(
    async (amount: bigint) => {
      if (state.phase !== "idle") return;
      setState({ phase: "signing", hash: null, error: null });
      try {
        if (config.isMock) {
          setState((s) => ({ ...s, phase: "pending" }));
          const hash = await fakeTxLatency();
          depositPRF(amount);
          setState({ phase: "confirmed", hash, error: null });
        } else {
          if (!publicClient || !address) throw new Error("Wallet not connected");
          const amountWei = fpToWei(amount);

          // deposit() pulls via transferFrom — ensure allowance first. Approve
          // max once so subsequent deposits are a single signature.
          const allowance = (await publicClient.readContract({
            ...proofsContract,
            functionName: "allowance",
            args: [address, proofBetContract.address],
          })) as bigint;
          if (allowance < amountWei) {
            const approveHash = await writeContractAsync({
              ...proofsContract,
              functionName: "approve",
              args: [proofBetContract.address, maxUint256],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }

          const hash = await writeContractAsync({
            ...proofBetContract,
            functionName: "deposit",
            args: [amountWei],
          });
          setState({ phase: "pending", hash, error: null });
          await publicClient.waitForTransactionReceipt({ hash });
          setState({ phase: "confirmed", hash, error: null });
        }
      } catch (err) {
        setState({ phase: "error", hash: null, error: errMessage(err) });
      }
    },
    [state.phase, setState, address, publicClient, writeContractAsync],
  );

  return { tx: state, deposit, reset };
}

export function useWithdraw() {
  const { state, setState, reset } = useTxState();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const withdraw = useCallback(async () => {
    if (state.phase !== "idle") return;
    setState({ phase: "signing", hash: null, error: null });
    try {
      if (config.isMock) {
        setState((s) => ({ ...s, phase: "pending" }));
        const hash = await fakeTxLatency();
        withdrawAll();
        setState({ phase: "confirmed", hash, error: null });
      } else {
        if (!publicClient) throw new Error("No RPC client");
        const hash = await writeContractAsync({
          ...proofBetContract,
          functionName: "withdraw",
        });
        setState({ phase: "pending", hash, error: null });
        await publicClient.waitForTransactionReceipt({ hash });
        setState({ phase: "confirmed", hash, error: null });
      }
    } catch (err) {
      setState({ phase: "error", hash: null, error: errMessage(err) });
    }
  }, [state.phase, setState, publicClient, writeContractAsync]);

  return { tx: state, withdraw, reset };
}
