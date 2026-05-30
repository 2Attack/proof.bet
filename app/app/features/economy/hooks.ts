"use client";

/**
 * Economy hooks — thin wrapper over contract calls (or mock).
 * Interface is identical regardless of mode; the switch is on config.isMock.
 */

import { useState, useCallback } from "react";
import {
  mintPRF,
  depositPRF,
  withdrawAll,
  FAUCET_AMOUNT,
} from "../../lib/mock-store";
import { fakeTxLatency } from "../../lib/mock-utils";
import { config } from "../../lib/config";

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "error";

export interface TxState {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
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
        // TODO: live wagmi call
        throw new Error("Live mode not implemented yet");
      }
    } catch (err) {
      setState({ phase: "error", hash: null, error: String(err) });
    }
  }, [state.phase, setState]);

  return { tx: state, faucet, reset };
}

export function useDeposit() {
  const { state, setState, reset } = useTxState();

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
          throw new Error("Live mode not implemented yet");
        }
      } catch (err) {
        setState({
          phase: "error",
          hash: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [state.phase, setState],
  );

  return { tx: state, deposit, reset };
}

export function useWithdraw() {
  const { state, setState, reset } = useTxState();

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
        throw new Error("Live mode not implemented yet");
      }
    } catch (err) {
      setState({ phase: "error", hash: null, error: String(err) });
    }
  }, [state.phase, setState]);

  return { tx: state, withdraw, reset };
}
