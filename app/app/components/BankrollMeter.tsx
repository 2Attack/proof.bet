"use client";

/**
 * House bankroll panel — shared by Limbo and Plinko so the two never drift.
 *
 * The bar shows ROUND EXPOSURE: the current stake as a fraction of the max bet.
 * Because max bet is the stake whose worst-case profit hits the house's 1.5%
 * risk budget, `stake / maxBet` is exactly "how much of that budget this bet
 * spends" — it fills to 100% precisely when the stake reaches the cap. This
 * replaces the old hardcoded `bankroll / 50000` fill, which pinned at 100% for
 * any real bankroll and carried no information.
 */

import { fmtPRF } from "../lib/mock-utils";

export function BankrollMeter({
  bankroll,
  maxBet,
  stake,
  maxBetCaption = "this target",
}: {
  bankroll: bigint;
  maxBet: bigint;
  stake: bigint;
  /** Parenthetical under "Max bet" — Limbo varies by target, Plinko by board. */
  maxBetCaption?: string;
}) {
  // stake / maxBet as a percent (2-decimal precision via bigint), capped 0–100.
  const rawPct =
    maxBet > 0n ? Number((stake * 10000n) / maxBet) / 100 : 0;
  const pct = Math.min(100, Math.max(0, rawPct));
  const atCap = stake > 0n && maxBet > 0n && stake >= maxBet;

  return (
    <div className="bankroll">
      <div className="bankroll-head">
        <span className="kicker">House bankroll · live</span>
        <span className="chip" style={{ padding: "3px 9px" }}>
          <span className="chip-dot" />
          solvent
        </span>
      </div>
      <div className="bankroll-bar">
        <i
          style={{
            width: `${pct}%`,
            background: atCap ? "var(--loss)" : undefined,
          }}
        />
      </div>
      <div
        className="mono"
        style={{
          marginTop: 6,
          fontSize: 10,
          letterSpacing: "0.04em",
          textAlign: "right",
          color: atCap ? "var(--loss)" : "var(--ink-mut)",
        }}
      >
        {atCap
          ? "at house cap"
          : `round exposure · ${
              pct > 0 && pct < 1 ? "<1" : pct.toFixed(0)
            }% of max`}
      </div>
      <div className="bankroll-foot">
        <span className="lb">
          <span className="k">Bankroll</span>
          <span className="v mono">{fmtPRF(bankroll)} PRF</span>
        </span>
        <span className="mb">
          <span className="k">Max bet ({maxBetCaption})</span>
          <span className="v mono acc">{fmtPRF(maxBet)} PRF</span>
        </span>
      </div>
    </div>
  );
}
