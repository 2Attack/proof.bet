/**
 * Shared domain types — the vocabulary both tracks speak.
 *
 * Numeric enums are declared as `const` objects (not TS `enum`) so the values
 * line up 1:1 with the Solidity `enum GameType`/`enum Risk` ordinals and the
 * modules stay erasable-TS friendly. Do NOT reorder — the integers are the ABI.
 */

import type { Hex } from "viem";

export type { Hex };

/** Solidity: `enum GameType { Limbo, Plinko }` */
export const GameType = {
  Limbo: 0,
  Plinko: 1,
} as const;
export type GameType = (typeof GameType)[keyof typeof GameType];

/** Solidity: `enum Risk { Low, Medium, High }` */
export const Risk = {
  Low: 0,
  Medium: 1,
  High: 2,
} as const;
export type Risk = (typeof Risk)[keyof typeof Risk];

export const RISK_KEYS = ["low", "medium", "high"] as const;
export type RiskKey = (typeof RISK_KEYS)[number];

export const riskToKey = (r: Risk): RiskKey => RISK_KEYS[r];
export const keyToRisk = (k: RiskKey): Risk => RISK_KEYS.indexOf(k) as Risk;

/** Plinko rows are continuous 8..16 inclusive (locked Phase-0 decision). */
export const PLINKO_ROWS_MIN = 8;
export const PLINKO_ROWS_MAX = 16;
export const PLINKO_ROW_RANGE = Array.from(
  { length: PLINKO_ROWS_MAX - PLINKO_ROWS_MIN + 1 },
  (_, i) => PLINKO_ROWS_MIN + i,
);

/**
 * Bet parameters — one struct for both games; the per-game fields the active
 * game ignores must be sent as zero. Mirrors Solidity `struct BetParams`.
 *
 * - `target` — Limbo target multiplier as ×100 fixed-point (200 = 2.00×). Plinko: 0.
 * - `rows`   — Plinko peg rows 8..16. Limbo: 0.
 * - `risk`   — Plinko risk tier. Limbo: Risk.Low (ignored).
 */
export interface BetParams {
  target: bigint;
  rows: number;
  risk: Risk;
}

/** Fixed-point convention shared across the seam: all multipliers are ×100 integers. */
export const FP_SCALE = 100n;

/** A fully-derived round — what the Verify drawer recomputes and the UI renders. */
export interface Round {
  game: GameType;
  /** Raw VRF random word (uint256) returned on-chain. */
  vrfWord: bigint;
  clientSeed: Hex;
  nonce: bigint;
  params: BetParams;
  /** keccak256(abi.encode(uint256 vrfWord, bytes32 clientSeed, uint256 nonce)). */
  finalSeed: Hex;
  /** crash×100 (Limbo) | multiplier×100 (Plinko). */
  outcomeX100: bigint;
  win: boolean;
  /** Plinko only: L/R bounce path (0 = left, 1 = right) and landed slot. */
  path?: number[];
  slot?: number;
}
