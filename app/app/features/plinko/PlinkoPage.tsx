"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TopNav } from "../../components/TopNav";
import { Btn } from "../../components/Btn";
import { useApp } from "../../lib/app-context";
import { usePlinkoBet } from "./hooks";
import { randHex } from "../../lib/mock-utils";
import { Risk } from "@proofbet/shared/types";
import type { Hex } from "viem";
import type { PlinkoRound } from "./hooks";
// Import tables from the shared workspace package source
// The package exports don't include these JSON files so we use
// a server-side import via dynamic require in the hook instead.
// Tables are inlined below from @proofbet/shared/src/tables/.
import plinkoTables from "../../lib/plinko-tables";
import plinkoEdges from "../../lib/plinko-edges";

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function slotTier(m: number): string {
  if (m >= 10) return "hot";
  if (m >= 2) return "warm";
  if (m >= 1) return "even";
  return "cold";
}

type TablesType = Record<string, Record<string, number[]>>;
type EdgesType = Record<string, Record<string, number>>;

const RISK_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function getMults(rows: number, risk: number): number[] {
  const tables = plinkoTables as TablesType;
  const riskKey = ["low", "medium", "high"][risk] ?? "medium";
  return (tables[String(rows)]?.[riskKey] ?? []).map((m: number) => m / 100);
}

function getEdge(rows: number, risk: number): number {
  const edges = plinkoEdges as EdgesType;
  const riskKey = ["low", "medium", "high"][risk] ?? "medium";
  return edges[String(rows)]?.[riskKey] ?? 0.02;
}

function PendingToast({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const steps = ["Requesting entropy", "Oracle responded", "Settling on-chain"];

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const durs = reduced ? [150, 150, 150] : [1500, 1700, 1100];
    const total = durs.reduce((a, b) => a + b, 0);
    requestAnimationFrame(() => setShow(true));
    let acc = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    durs.forEach((d, i) => { acc += d; timers.push(setTimeout(() => setStep(i + 1), acc)); });
    timers.push(setTimeout(() => setShow(false), total + 200));
    timers.push(setTimeout(onDone, total + 450));
    const t0 = performance.now();
    const iv = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, (step / steps.length) * 100 + 6);
  const cur = steps[Math.min(step, steps.length - 1)];

  return (
    <div className={`glass pending-toast${show ? " show" : ""}`} role="status" aria-live="polite">
      <div className="pt-spinner" />
      <div className="pt-body">
        <div className="pt-head">
          <span className="pt-title">Resolving on-chain</span>
          <span className="pt-elapsed mono">{elapsed.toFixed(1)}s</span>
        </div>
        <div className="pt-step mono"><span className="pulse-dot" />{step >= steps.length ? "finalizing…" : cur}</div>
        <div className="pt-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

function PlinkoBoard({ rows, path, landedSlot }: { rows: number; path?: number[]; landedSlot: number }) {
  const slotW = 1 / (rows + 1);
  const pegYSpan = 97;
  const pegRows = [];
  for (let k = 1; k <= rows; k++) {
    const top = (k / (rows + 0.6)) * pegYSpan;
    const pegs = [];
    for (let j = 0; j <= k; j++) {
      const left = 0.5 + (j - k / 2) * slotW;
      pegs.push(
        <i key={j} className="pk-peg" style={{ left: `${left * 100}%`, top: `${top}%` }} />
      );
    }
    pegRows.push(<div key={k}>{pegs}</div>);
  }

  return (
    <div className="plinko-board">
      {pegRows}
    </div>
  );
}

export function PlinkoPage() {
  const router = useRouter();
  const { inPlay, bankroll, nonce, setVerifyRound } = useApp();
  const { phase, round, placeBet, settle, reset } = usePlinkoBet();
  const [risk, setRisk] = useState<Risk>(Risk.Medium);
  const [rows, setRows] = useState(12);
  const [stake, setStake] = useState(25);
  const [clientSeed, setClientSeed] = useState<Hex>(() => randHex(32) as Hex);
  const [recent, setRecent] = useState<Array<{ m: number }>>([]);

  const riskKey = (["low", "medium", "high"] as const)[risk];
  const mults = useMemo(() => getMults(rows, risk), [rows, risk]);
  const edge = useMemo(() => getEdge(rows, risk), [rows, risk]);
  const maxMult = useMemo(() => Math.max(...mults), [mults]);

  const stakeN = BigInt(Math.round(stake * 100));
  const busy = phase === "pending" || phase === "dropping";
  const overBalance = stakeN > inPlay;
  const canBet = !busy && !overBalance && stakeN > 0n;

  let cta = "Drop Ball";
  if (phase === "pending") cta = "Resolving…";
  else if (phase === "dropping") cta = "Dropping…";
  else if (stakeN <= 0n) cta = "Enter a stake";
  else if (overBalance) cta = "Insufficient balance";

  const onDrop = () => {
    if (!canBet) return;
    placeBet(stakeN, rows, risk, clientSeed, nonce);
  };

  useEffect(() => {
    if (phase === "settled" && round) {
      setRecent((r) => [{ m: Number(round.multiplierX100) / 100 }, ...r].slice(0, 6));
    }
  }, [phase, round]);

  const onVerify = () => {
    if (round) {
      setVerifyRound(round);
      router.push(`/verify/${round.txHash}`);
    }
  };

  const landedSlot = phase === "settled" && round ? round.slot ?? -1 : -1;
  const multiplier = round ? Number(round.multiplierX100) / 100 : 0;
  const win = round?.win ?? false;

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="balance-strip">
        <Link href="/games" className="game-back" style={{ textDecoration: "none" }}>‹ Games</Link>
        <div className="inplay-bar">
          <span className="ip-pill">
            <span className="chip-token" />In play <b>{fmtPRF(inPlay)}</b><i>PRF</i>
          </span>
          {inPlay > 0n ? (
            <button className="ip-withdraw" onClick={() => router.push("/withdraw")}>Withdraw</button>
          ) : (
            <button className="ip-deposit" onClick={() => router.push("/deposit")}>+ Deposit Proofs</button>
          )}
        </div>
      </div>

      <div className="limbo-wrap">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stage plinko-stage">
            <div className="stage-eyebrow eyebrow">
              Plinko · {RISK_LABELS[riskKey]} · {rows} rows
            </div>

            <PlinkoBoard rows={rows} path={round?.path} landedSlot={landedSlot} />

            <div
              className="plinko-slots"
              style={{ "--slot-fz": `${mults.length >= 15 ? 10.5 : mults.length >= 13 ? 11.5 : 13}px` } as React.CSSProperties}
            >
              {mults.map((m, s) => (
                <div
                  key={s}
                  className={`pk-slot ${slotTier(m)}${s === landedSlot ? " land" : ""}`}
                >
                  {m >= 100 ? Math.round(m) : m >= 10 ? fmt(m, 1) : fmt(m, 1)}
                  <span className="pk-slot-x">×</span>
                </div>
              ))}
            </div>

            <div className="pk-resultbar">
              {phase === "idle" && (
                <span className="pk-hint">
                  Drop the ball — <span className="mono">edges pay big, the center is the house</span>
                </span>
              )}
              {phase === "pending" && (
                <span className="climb-live"><span className="climb-pulse" />resolving on-chain…</span>
              )}
              {phase === "dropping" && (
                <span className="climb-live"><span className="climb-pulse" />dropping through {rows} rows…</span>
              )}
              {phase === "settled" && round && (
                <span className={`pk-verdict ${win ? "win" : "loss"}`}>
                  <span className="serif">landed {fmt(multiplier)}×</span>
                  <span className="pk-pay mono">
                    {win ? `+${fmtPRF(round.payout)} PRF` : `−${fmtPRF(round.stake - round.payout)} PRF`}
                  </span>
                </span>
              )}
            </div>

            {recent.length > 0 && (
              <div className="pk-recent">
                {recent.map((r, i) => (
                  <span key={i} className={`recent-pill ${r.m >= 1 ? "win" : "loss"}`}>
                    {fmt(r.m)}×
                  </span>
                ))}
              </div>
            )}
          </div>

          {phase === "settled" && (
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Btn kind="primary" onClick={onVerify}>Verify this drop</Btn>
              <Btn kind="ghost" onClick={reset}>New drop</Btn>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="glass betpanel">
          <div className="betpanel-section">
            <div className="kicker" style={{ marginBottom: 2 }}>Risk</div>
            <div className="pk-risk">
              {(["Low", "Medium", "High"] as const).map((label, i) => (
                <button
                  key={i}
                  className={`pk-risk-opt${risk === i ? " active" : ""}`}
                  disabled={busy}
                  onClick={() => setRisk(i as Risk)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="betpanel-section">
            <div className="pk-rows-head">
              <span className="kicker">Rows</span>
              <span className="mono pk-rows-val">{rows}</span>
            </div>
            <div className="slider">
              <div className="slider-track">
                <div className="slider-fill" style={{ width: `${((rows - 8) / 8) * 100}%` }} />
              </div>
              <input
                type="range"
                min="8"
                max="16"
                step="1"
                value={rows}
                disabled={busy}
                onChange={(e) => setRows(Number(e.target.value))}
                aria-label="rows"
              />
            </div>
            <div className="slider-scale">
              <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span>
            </div>
          </div>

          <div className="stake glass-solid" style={{ padding: 14, borderRadius: "var(--r-md)" }}>
            <div className="kicker" style={{ marginBottom: 9 }}>Stake</div>
            <div className="stake-field">
              <input
                type="number"
                min="0"
                step="0.01"
                value={stake}
                disabled={busy}
                onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
                aria-label="stake"
              />
              <span className="unit">PRF</span>
            </div>
            <div className="stake-quick" style={{ marginTop: 10 }}>
              <button disabled={busy} onClick={() => setStake(Math.round(stake * 50) / 100)}>½</button>
              <button disabled={busy} onClick={() => setStake(Math.round(stake * 200) / 100)}>2×</button>
              <button disabled={busy} onClick={() => setStake(Math.round((Number(inPlay) / 100) * 100) / 100)}>max</button>
            </div>
          </div>

          <div className="bet-stats">
            <div className="bet-stat">
              <div className="k">Top payout</div>
              <div className="v mono acc">{fmt(maxMult)}×</div>
            </div>
            <div className="bet-stat">
              <div className="k">Best win</div>
              <div className="v mono">{fmtPRF(BigInt(Math.round(stake * maxMult * 100)))} PRF</div>
            </div>
          </div>

          <Btn kind="accent" full disabled={!canBet} onClick={onDrop}>{cta}</Btn>

          <div className="chip chip-edge" style={{ alignSelf: "center" }}>
            <span className="chip-dot" />
            House edge {(edge * 100).toFixed(1)}% — we don&apos;t hide it.
          </div>
        </div>
      </div>

      {phase === "pending" && <PendingToast onDone={() => settle()} />}
    </div>
  );
}
