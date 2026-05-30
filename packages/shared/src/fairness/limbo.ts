/**
 * Limbo outcome — bustabit-style crash point with a 2% house edge.
 *
 * EXACT-INTEGER canonical. The prototype (`crypto.jsx`) computed this in float,
 * where `100 * 2^52` exceeds the IEEE-754 safe-integer range and silently loses
 * precision. That can never reproduce on-chain, so the seam fixes the canonical
 * to the exact integer formula below — same intent, reproducible by Solidity.
 *
 *   h         = top 52 bits of finalSeed            // uint256(finalSeed) >> 204
 *   if h % 50 == 0 -> crash = 1.00                  // ~2% instant-bust band
 *   else crashX100 = floor((100·E - h) / (E - h))   // E = 2^52, pure integer div
 *   crashX100 clamped to [100, 100_000_000]         // 1.00× .. 1,000,000×
 *
 * Returns crash×100 as a bigint (the seam's ×100 fixed-point).
 */

import type { Hex } from "viem";

/** E = 2^52 — the 52-bit entropy space the crash point is drawn from. */
export const LIMBO_E = 1n << 52n;
/** 1-in-50 → ~2% instant-bust band (the house edge for Limbo). */
export const LIMBO_BUST_MODULUS = 50n;
/** Bits of finalSeed consumed by Limbo (top 52). */
export const LIMBO_SHIFT = 204n; // 256 - 52
export const LIMBO_MIN_X100 = 100n; // 1.00×
export const LIMBO_MAX_X100 = 100_000_000n; // 1,000,000×

export function limboCrashX100(finalSeed: Hex): bigint {
  const h = BigInt(finalSeed) >> LIMBO_SHIFT;
  if (h % LIMBO_BUST_MODULUS === 0n) return LIMBO_MIN_X100;
  let crashX100 = (100n * LIMBO_E - h) / (LIMBO_E - h);
  if (crashX100 < LIMBO_MIN_X100) crashX100 = LIMBO_MIN_X100;
  if (crashX100 > LIMBO_MAX_X100) crashX100 = LIMBO_MAX_X100;
  return crashX100;
}

/** Win iff the crash point reached the player's target. */
export function limboWin(crashX100: bigint, targetX100: bigint): boolean {
  return crashX100 >= targetX100;
}

/** Payout in token base units: win pays `stake × target`, loss pays 0. */
export function limboPayout(
  stake: bigint,
  targetX100: bigint,
  crashX100: bigint,
): bigint {
  return limboWin(crashX100, targetX100) ? (stake * targetX100) / 100n : 0n;
}
