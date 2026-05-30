/**
 * Plinko multiplier-table FORMULA — the off-chain generator source only.
 *
 * This float math runs ONCE at build time to produce the frozen ×100 integer
 * tables in `plinko-tables.json`. Neither the runtime nor the contract evaluates
 * it: they read the frozen tables. Ported faithfully from the prototype
 * (`crypto.jsx → plinkoMultipliers`): edges high, center low, normalized so
 * EV = 1 − 2% edge, then rounded for display (≥100 → int, ≥10 → 1dp, else 2dp).
 *
 * Because the table is normalized to EV = 0.98, the 2% house edge for Plinko is
 * baked into the multipliers themselves (no separate cut) — distinct from
 * Limbo's instant-bust band.
 */

import { type RiskKey } from "../types.js";

interface RiskCfg {
  lo: number;
  hiK: number;
  gamma: number;
}

const PLINKO_CFG: Record<RiskKey, RiskCfg> = {
  low: { lo: 0.5, hiK: 1.35, gamma: 1.9 },
  medium: { lo: 0.3, hiK: 4.2, gamma: 2.7 },
  high: { lo: 0.2, hiK: 14, gamma: 3.3 },
};

/** Binomial coefficient C(n, k) — bucket probabilities are C(rows, slot) / 2^rows. */
function binomC(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** Prototype display rounding: ≥100 → int, ≥10 → 1dp, else 2dp. */
function roundForDisplay(v: number): number {
  return v >= 100
    ? Math.round(v)
    : v >= 10
      ? Math.round(v * 10) / 10
      : Math.round(v * 100) / 100;
}

/** Decimal multipliers per bucket (slot 0..rows), exactly as the prototype renders them. */
export function computePlinkoMultipliers(rows: number, risk: RiskKey): number[] {
  const cfg = PLINKO_CFG[risk];
  const half = rows / 2;
  const hi = cfg.lo + cfg.hiK * rows;
  const raw: number[] = [];
  for (let s = 0; s <= rows; s++) {
    const d = half ? Math.abs(s - half) / half : 0;
    raw.push(cfg.lo + (hi - cfg.lo) * Math.pow(d, cfg.gamma));
  }
  const tot = Math.pow(2, rows);
  let ev = 0;
  for (let s = 0; s <= rows; s++) ev += (binomC(rows, s) / tot) * raw[s]!;
  const k = 0.98 / ev;
  return raw.map((m) => roundForDisplay(m * k));
}

/** Frozen ×100 integer table for a (rows, risk) pair — the canonical seam value. */
export function computePlinkoTableX100(rows: number, risk: RiskKey): number[] {
  return computePlinkoMultipliers(rows, risk).map((m) => Math.round(m * 100));
}

/** Honest house edge of the rounded table actually in play (for display only). */
export function computePlinkoEdge(rows: number, risk: RiskKey): number {
  const mults = computePlinkoMultipliers(rows, risk);
  const tot = Math.pow(2, rows);
  let ev = 0;
  for (let s = 0; s <= rows; s++) ev += (binomC(rows, s) / tot) * mults[s]!;
  return 1 - ev;
}
