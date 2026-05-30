/**
 * Plinko outcome — runtime path is pure integer + a frozen-table lookup.
 *
 * SEAM CONTRACT (byte-identical on-chain and in-browser):
 *   x      = top 192 bits of finalSeed           // uint256(finalSeed) >> 64
 *   bit k  = (x >> k) & 1                         // 1 = right, 0 = left
 *   slot   = popcount of the first `rows` bits    // count of rights, 0..rows
 *   payout = stake × table[rows][risk][slot]      // table is FROZEN ×100 ints
 *
 * The multiplier table is never recomputed here — it is read from the frozen
 * `plinko-tables.json` (generated once from `plinko-formula.ts`). The contract
 * embeds the same numbers; the golden vectors lock all three together.
 */

import type { Hex } from "viem";
import { riskToKey, type BetParams, type Risk } from "../types.js";
import tablesJson from "../tables/plinko-tables.json" with { type: "json" };

/** Bits of finalSeed consumed by Plinko (top 192). */
export const PLINKO_SHIFT = 64n; // 256 - 192

type TablesByRisk = { low: number[]; medium: number[]; high: number[] };
const TABLES = tablesJson as Record<string, TablesByRisk>;

/** Frozen ×100 multiplier table for a (rows, risk) pair. */
export function plinkoTableX100(rows: number, risk: Risk): bigint[] {
  const byRisk = TABLES[String(rows)];
  if (!byRisk) throw new Error(`No Plinko table for rows=${rows}`);
  return byRisk[riskToKey(risk)].map((m) => BigInt(m));
}

/** Highest multiplier×100 in a table — the worst-case payout driver for maxBet. */
export function plinkoMaxMultiplierX100(rows: number, risk: Risk): bigint {
  let max = 0n;
  for (const m of plinkoTableX100(rows, risk)) if (m > max) max = m;
  return max;
}

/** Derive the verified L/R bounce path and landed slot from the seed. */
export function plinkoPath(
  finalSeed: Hex,
  rows: number,
): { path: number[]; slot: number } {
  const x = BigInt(finalSeed) >> PLINKO_SHIFT;
  const path: number[] = [];
  let rights = 0;
  for (let k = 0; k < rows; k++) {
    const bit = Number((x >> BigInt(k)) & 1n);
    path.push(bit);
    rights += bit;
  }
  return { path, slot: rights };
}

export interface PlinkoOutcome {
  path: number[];
  slot: number;
  outcomeX100: bigint;
  win: boolean;
}

/** Full Plinko settlement from a final seed + params. */
export function plinkoSettle(finalSeed: Hex, params: BetParams): PlinkoOutcome {
  const { path, slot } = plinkoPath(finalSeed, params.rows);
  const outcomeX100 = plinkoTableX100(params.rows, params.risk)[slot]!;
  return { path, slot, outcomeX100, win: outcomeX100 >= 100n };
}

/** Payout in token base units: `stake × multiplier`. */
export function plinkoPayout(stake: bigint, outcomeX100: bigint): bigint {
  return (stake * outcomeX100) / 100n;
}
