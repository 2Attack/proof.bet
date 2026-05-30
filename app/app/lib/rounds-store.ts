/**
 * Live-mode rounds store — session-scoped pub/sub for the player's bets.
 *
 * In mock mode, mock-store.ts owns balances AND rounds. In live mode, balances
 * come from the chain (wagmi reads), but the per-session list of rounds and the
 * current pending round are still UI state — this holds them, decoupled from any
 * balance bookkeeping. The bet hooks push here; LiveAppProvider subscribes.
 *
 * Rounds carry ×100-fixed-point `stake`/`payout` (already converted at the hook
 * boundary) so they render identically to mock rounds.
 */

import type { MockRound } from "./mock-store";

interface LiveRoundsState {
  rounds: MockRound[];
  pendingRound: MockRound | null;
}

const state: LiveRoundsState = {
  rounds: [],
  pendingRound: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function getLiveRounds(): Readonly<LiveRoundsState> {
  return state;
}

export function subscribeLiveRounds(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** Mark a freshly-placed bet as pending (stake already debited on-chain). */
export function setPendingLiveRound(round: MockRound): void {
  state.pendingRound = round;
  notify();
}

/** Replace the pending round with its fully-settled form and prepend to history. */
export function resolveLiveRound(settled: MockRound): void {
  state.pendingRound = null;
  state.rounds = [settled, ...state.rounds].slice(0, 50);
  notify();
}

/** Drop the pending round without recording it (e.g. on placeBet failure). */
export function clearPendingLiveRound(): void {
  state.pendingRound = null;
  notify();
}
