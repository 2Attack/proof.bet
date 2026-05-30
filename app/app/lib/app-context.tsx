"use client";

/**
 * AppContext — one shape, two implementations.
 *
 * `config.isMock` is env-derived and constant for the whole session, so we branch
 * ONCE at mount into MockAppProvider or LiveAppProvider. Each provider calls only
 * its own hooks (LiveAppProvider uses wagmi reads; calling those conditionally
 * inside a single component would violate the rules of hooks). Consumers use
 * `useApp()` and never learn which mode they're in.
 *
 * Balances are exposed in ×100 fixed-point ("fp") regardless of mode — the live
 * provider converts on-chain wei at this boundary (see units.ts).
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
  useAccount,
  useBalance,
  useReadContract,
  useWatchContractEvent,
} from "wagmi";
import {
  getState,
  subscribe,
  type MockState,
  type MockRound,
} from "./mock-store";
import {
  getLiveRounds,
  subscribeLiveRounds,
} from "./rounds-store";
import { proofBetContract, proofsContract } from "./contracts";
import { weiToFp } from "./units";
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

/** Limbo cap: worst-case profit ≤ 1.5% of bankroll, in ×100 fixed-point. */
function maxBetLimboFp(bankrollFp: bigint, targetX100: bigint): bigint {
  if (targetX100 <= 100n) return bankrollFp;
  return (bankrollFp * 15n) / ((targetX100 - 100n) * 10n);
}

export function AppProvider({ children }: { children: ReactNode }) {
  return config.isMock ? (
    <MockAppProvider>{children}</MockAppProvider>
  ) : (
    <LiveAppProvider>{children}</LiveAppProvider>
  );
}

// ---------------------------------------------------------------------------
// Mock provider — subscribes to the in-memory mock-store.
// ---------------------------------------------------------------------------

function MockAppProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<MockState>(getState() as MockState);
  const [verifyRound, setVerifyRound] = useState<MockRound | null>(null);

  useEffect(() => {
    return subscribe(() => setSnap({ ...getState() } as MockState));
  }, []);

  const maxBetLimbo = useCallback(
    (targetX100: bigint) => maxBetLimboFp(snap.bankroll, targetX100),
    [snap.bankroll],
  );

  const value: AppContextValue = {
    isMock: true,
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

// ---------------------------------------------------------------------------
// Live provider — reads balances on-chain, converts wei → ×100 fp.
// ---------------------------------------------------------------------------

function LiveAppProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [verifyRound, setVerifyRound] = useState<MockRound | null>(null);

  // Session rounds (populated by the bet hooks).
  const [roundsSnap, setRoundsSnap] = useState(() => getLiveRounds());
  useEffect(() => {
    return subscribeLiveRounds(() => setRoundsSnap({ ...getLiveRounds() }));
  }, []);

  const enabled = isConnected && !!address;
  const queryOpts = { query: { enabled } } as const;

  const ethBal = useBalance({ address, query: { enabled } });
  const walletRead = useReadContract({
    ...proofsContract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    ...queryOpts,
  });
  const inPlayRead = useReadContract({
    ...proofBetContract,
    functionName: "inPlayOf",
    args: address ? [address] : undefined,
    ...queryOpts,
  });
  const bankrollRead = useReadContract({
    ...proofBetContract,
    functionName: "bankroll",
    ...queryOpts,
  });
  const nonceRead = useReadContract({
    ...proofBetContract,
    functionName: "nonceOf",
    args: address ? [address] : undefined,
    ...queryOpts,
  });

  // Refetch balances/nonce whenever the chain emits something about this player.
  // Cheaper and more responsive than block-polling; the bet hook owns its own
  // BetSettled watcher for settlement, this just keeps the header numbers fresh.
  const refetchAll = useCallback(() => {
    void walletRead.refetch();
    void inPlayRead.refetch();
    void bankrollRead.refetch();
    void nonceRead.refetch();
    void ethBal.refetch();
  }, [walletRead, inPlayRead, bankrollRead, nonceRead, ethBal]);

  const bankrollFp = bankrollRead.data ? weiToFp(bankrollRead.data) : 0n;

  const maxBetLimbo = useCallback(
    (targetX100: bigint) => maxBetLimboFp(bankrollFp, targetX100),
    [bankrollFp],
  );

  const value: AppContextValue = {
    isMock: false,
    address: (address as Hex | undefined) ?? null,
    walletPRF: walletRead.data ? weiToFp(walletRead.data) : 0n,
    inPlay: inPlayRead.data ? weiToFp(inPlayRead.data) : 0n,
    bankroll: bankrollFp,
    tEth: ethBal.data ? Number(ethBal.data.value) / 1e18 : 0,
    nonce: nonceRead.data ?? 0n,
    rounds: roundsSnap.rounds,
    pendingRound: roundsSnap.pendingRound,
    maxBetLimbo,
    verifyRound,
    setVerifyRound,
  };

  return (
    <AppContext.Provider value={value}>
      <ChainEventRefresher player={address} onChange={refetchAll} />
      {children}
    </AppContext.Provider>
  );
}

/**
 * Invalidates balance reads when this player's Deposit/Withdraw/BetSettled events
 * land. Kept as a child so its watchers don't gate the provider's own reads.
 * No-op when disconnected.
 */
function ChainEventRefresher({
  player,
  onChange,
}: {
  player: Hex | undefined;
  onChange: () => void;
}) {
  const enabled = !!player;
  const filter = player ? { player } : undefined;
  useWatchContractEvent({
    ...proofBetContract,
    eventName: "Deposit",
    args: filter,
    enabled,
    onLogs: onChange,
  });
  useWatchContractEvent({
    ...proofBetContract,
    eventName: "Withdraw",
    args: filter,
    enabled,
    onLogs: onChange,
  });
  useWatchContractEvent({
    ...proofBetContract,
    eventName: "BetSettled",
    args: filter,
    enabled,
    onLogs: onChange,
  });
  return null;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
