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
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Hex } from "viem";
import {
  useAccount,
  useBalance,
  useBlockNumber,
  usePublicClient,
  useReadContract,
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
  setPendingLiveRound,
  resolveRecoveredRound,
  clearPendingLiveRound,
} from "./rounds-store";
import { recoverPendingRound } from "./recover-pending";
import { resolveSettledRound } from "./live-bet";
import { proofBetContract, proofsContract } from "./contracts";
import { weiToFp } from "./units";
import { config } from "./config";
import plinkoTables from "./plinko-tables";

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
  maxBetPlinko: (rows: number, risk: number) => bigint;
  // Verify
  verifyRound: MockRound | null;
  setVerifyRound: (r: MockRound | null) => void;
  // true until hydration + wagmi's initial (re)connect settle — lets the header
  // show a loader instead of flashing the Connect button (live mode only)
  resolving: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Shared max-bet cap (mirrors ProofBet.maxBet): worst-case profit ≤ 1.5% of
 * bankroll. `worstMultX100` is the worst-case multiplier for the house — the
 * Limbo target, or Plinko's top bucket. Result in ×100 fixed-point.
 */
function maxBetCapFp(bankrollFp: bigint, worstMultX100: bigint): bigint {
  if (worstMultX100 <= 100n) return bankrollFp;
  return (bankrollFp * 15n) / ((worstMultX100 - 100n) * 10n);
}

function maxBetLimboFp(bankrollFp: bigint, targetX100: bigint): bigint {
  return maxBetCapFp(bankrollFp, targetX100);
}

const PLINKO_RISK_KEYS = ["low", "medium", "high"] as const;

/** Highest multiplier (×100) for a Plinko rows/risk — the house's worst case. */
function plinkoMaxMultX100(rows: number, risk: number): bigint {
  const riskKey = PLINKO_RISK_KEYS[risk] ?? "medium";
  const row = (plinkoTables as Record<string, Record<string, number[]>>)[
    String(rows)
  ]?.[riskKey];
  if (!row || row.length === 0) return 0n;
  return BigInt(Math.max(...row));
}

function maxBetPlinkoFp(bankrollFp: bigint, rows: number, risk: number): bigint {
  return maxBetCapFp(bankrollFp, plinkoMaxMultX100(rows, risk));
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
  const maxBetPlinko = useCallback(
    (rows: number, risk: number) => maxBetPlinkoFp(snap.bankroll, rows, risk),
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
    maxBetPlinko,
    verifyRound,
    setVerifyRound,
    // Mock mode resolves synchronously from the in-memory store.
    resolving: false,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Live provider — reads balances on-chain, converts wei → ×100 fp.
// ---------------------------------------------------------------------------

function LiveAppProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAccount();
  const publicClient = usePublicClient();
  const [verifyRound, setVerifyRound] = useState<MockRound | null>(null);

  // Gate the header until hydration completes and wagmi finishes its initial
  // reconnect (see ReconnectManager in providers.tsx). Until then we can't tell
  // a connected wallet from a disconnected one, so the header shows a loader
  // instead of flashing "Connect & play". `mounted` keeps SSR and the first
  // client render in agreement.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const resolving =
    !mounted || status === "connecting" || status === "reconnecting";

  // Session rounds (populated by the bet hooks).
  const [roundsSnap, setRoundsSnap] = useState(() => getLiveRounds());
  useEffect(() => {
    return subscribeLiveRounds(() => setRoundsSnap({ ...getLiveRounds() }));
  }, []);

  // Recover an in-flight bet after a reload. The pending round lives only in
  // memory, so a refresh during the VRF wait would otherwise drop it (and let
  // the player bet again). We rebuild it from the chain, then re-attach the
  // settlement watcher — `resolveSettledRound` reads the exact on-chain stake and
  // waits for BetSettled, exactly as the live bet flow would have. Runs once per
  // connected address; never clobbers a bet already started this session.
  const recoveredFor = useRef<Hex | null>(null);
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;
    if (recoveredFor.current === address) return;
    recoveredFor.current = address;
    if (getLiveRounds().pendingRound) return;

    let cancelled = false;
    void (async () => {
      try {
        const recovered = await recoverPendingRound(publicClient, address);
        if (cancelled || !recovered) return;
        // A fresh bet may have started during the scan — don't overwrite it.
        if (getLiveRounds().pendingRound) return;
        setPendingLiveRound(recovered.round);

        const settled = await resolveSettledRound(publicClient, recovered.resume);
        if (cancelled) return;
        resolveRecoveredRound(settled);
      } catch (err) {
        console.error("pending-bet recovery failed:", err);
        if (!cancelled) clearPendingLiveRound();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, address, publicClient]);

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

  // Keep the latest refetch closure in a ref so the block-driven effect below
  // depends only on the block number, never on the per-render query handles
  // (which get fresh identities every render).
  const refetchRef = useRef(() => {});
  refetchRef.current = () => {
    void walletRead.refetch();
    void inPlayRead.refetch();
    void bankrollRead.refetch();
    void nonceRead.refetch();
    void ethBal.refetch();
  };

  // Liveness: poll the block number — a single, stateless `eth_blockNumber` per
  // interval — and refetch the header reads whenever the chain advances; the
  // existing `batch: { multicall: true }` coalesces them into ~one eth_call.
  //
  // This REPLACES four per-event `useWatchContractEvent` filters
  // (Transfer/Deposit/Withdraw/BetSettled). Those were the source of the
  // /games rate-limit (HTTP 429): (a) all four polled on the same tick, firing a
  // request burst every interval, and (b) event filters are stateful and
  // node-specific — on our `fallback([infura, publicnode])` transport, when
  // Infura 429s and the call fails over to publicnode the filter ID doesn't
  // exist there → "filter not found" → viem recreates it, feeding the rate-limit
  // loop. `eth_blockNumber` is stateless and works identically on any node, so it
  // is fallback-safe. (Supersedes the earlier "events over block-polling" choice:
  // the burst + filter churn, not block-polling, was the real cost. The active
  // bet flow still owns its own BetSettled poll in live-bet.ts.)
  const { data: blockNumber } = useBlockNumber({
    watch: enabled,
    query: { enabled },
  });
  useEffect(() => {
    if (!enabled || blockNumber === undefined) return;
    refetchRef.current();
  }, [blockNumber, enabled]);

  const bankrollFp = bankrollRead.data ? weiToFp(bankrollRead.data) : 0n;

  const maxBetLimbo = useCallback(
    (targetX100: bigint) => maxBetLimboFp(bankrollFp, targetX100),
    [bankrollFp],
  );
  const maxBetPlinko = useCallback(
    (rows: number, risk: number) => maxBetPlinkoFp(bankrollFp, rows, risk),
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
    maxBetPlinko,
    verifyRound,
    setVerifyRound,
    resolving,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
