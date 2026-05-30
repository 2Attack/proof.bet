"use client";

/**
 * AppContext — single source of truth for mock mode state.
 * In live mode this defers to wagmi hooks directly.
 * Components subscribe here for balances, nonce, rounds, etc.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Hex } from "viem";
import {
  getState,
  subscribe,
  type MockState,
  type MockRound,
} from "./mock-store";
import { config } from "./config";

export interface AppContextValue {
  isMock: boolean;
  address: Hex | null;
  walletPRF: bigint;
  inPlay: bigint;
  bankroll: bigint;
  tEth: number;
  nonce: bigint;
  rounds: MockRound[];
  pendingRound: MockRound | null;
  // Derived
  maxBetLimbo: (targetX100: bigint) => bigint;
  // Verify
  verifyRound: MockRound | null;
  setVerifyRound: (r: MockRound | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<MockState>(getState() as MockState);
  const [verifyRound, setVerifyRound] = useState<MockRound | null>(null);

  useEffect(() => {
    return subscribe(() => setSnap({ ...getState() } as MockState));
  }, []);

  const maxBetLimbo = useCallback(
    (targetX100: bigint): bigint => {
      // max profit ≤ 1.5% of bankroll
      // All values in ×100 fixed-point.
      // maxBet100 = bankroll100 × 1.5 / (target100 - 100)
      // = bankroll100 × 15 / ((target100 - 100) × 10)
      if (targetX100 <= 100n) return snap.bankroll;
      return (snap.bankroll * 15n) / ((targetX100 - 100n) * 10n);
    },
    [snap.bankroll],
  );

  const value: AppContextValue = {
    isMock: config.isMock,
    address: snap.address,
    walletPRF: snap.walletPRF,
    inPlay: snap.inPlay,
    bankroll: snap.bankroll,
    tEth: snap.tEth,
    nonce: snap.nonce,
    rounds: snap.rounds,
    pendingRound: snap.pendingRound,
    maxBetLimbo,
    verifyRound,
    setVerifyRound,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
