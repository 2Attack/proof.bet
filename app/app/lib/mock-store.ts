/**
 * In-memory mock store — single source of truth for the mock adapter.
 * All balances are bigint (×100 fixed-point PRF units, matching FP_SCALE=100n).
 * Shared across all hook consumers via a simple pub/sub.
 */

import type { Hex } from "viem";

export const FP_SCALE = 100n;
export const FAUCET_AMOUNT = 1000n * FP_SCALE; // 1000 PRF in ×100 fp

export interface MockRound {
  requestId: string;
  txHash: Hex;
  vrfWord: bigint;
  clientSeed: Hex;
  nonce: bigint;
  game: 0 | 1; // GameType.Limbo | GameType.Plinko
  stake: bigint;
  params: { target: bigint; rows: number; risk: number };
  finalSeed: Hex;
  outcomeX100: bigint;
  win: boolean;
  payout: bigint;
  path?: number[];
  slot?: number;
}

export interface MockState {
  address: Hex | null;
  walletPRF: bigint;   // balanceOf — in MetaMask wallet
  inPlay: bigint;      // inPlayOf — locked in contract
  bankroll: bigint;    // house bankroll
  tEth: number;        // gas indicator only
  nonce: bigint;
  rounds: MockRound[];
  pendingRound: MockRound | null;
}

const state: MockState = {
  address: null,
  walletPRF: 0n,
  inPlay: 0n,
  bankroll: 42850n * FP_SCALE,
  tEth: 0.412,
  nonce: 0n,
  rounds: [],
  pendingRound: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function getState(): Readonly<MockState> {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function setAddress(addr: Hex | null): void {
  state.address = addr;
  notify();
}

export function mintPRF(amount: bigint): void {
  state.walletPRF += amount;
  state.tEth = Math.max(0, state.tEth - 0.001);
  notify();
}

export function depositPRF(amount: bigint): void {
  if (amount > state.walletPRF) throw new Error("Insufficient wallet balance");
  state.walletPRF -= amount;
  state.inPlay += amount;
  state.tEth = Math.max(0, state.tEth - 0.0014);
  notify();
}

export function withdrawAll(): void {
  const amount = state.inPlay;
  state.inPlay = 0n;
  state.walletPRF += amount;
  state.tEth = Math.max(0, state.tEth - 0.0012);
  notify();
}

export function placeBetMock(round: MockRound): void {
  state.inPlay -= round.stake;
  state.pendingRound = round;
  state.tEth = Math.max(0, state.tEth - 0.0016);
  notify();
}

export function settleBetMock(requestId: string): void {
  const r = state.pendingRound;
  if (!r || r.requestId !== requestId) return;
  state.pendingRound = null;
  if (r.win) {
    state.inPlay += r.payout;
    state.bankroll -= r.payout - r.stake;
  } else {
    state.bankroll += r.stake;
  }
  state.nonce += 1n;
  state.rounds = [r, ...state.rounds].slice(0, 50);
  notify();
}

/**
 * Resolve a bet with the FINAL settled round (all fields resolved).
 * Replaces the placeholder-based settleBetMock — ensures the store
 * contains the real vrfWord, finalSeed, outcomeX100, win, payout.
 * This keeps the Auditor and per-round Verify drawer consistent.
 */
export function resolveBet(settled: MockRound): void {
  // Clear pending round regardless of requestId match
  state.pendingRound = null;
  if (settled.win) {
    state.inPlay += settled.payout;
    state.bankroll -= settled.payout - settled.stake;
  } else {
    state.bankroll += settled.stake;
  }
  state.nonce += 1n;
  state.rounds = [settled, ...state.rounds].slice(0, 50);
  notify();
}

export function reset(): void {
  state.address = null;
  state.walletPRF = 0n;
  state.inPlay = 0n;
  state.tEth = 0.412;
  state.nonce = 0n;
  state.rounds = [];
  state.pendingRound = null;
  notify();
}
