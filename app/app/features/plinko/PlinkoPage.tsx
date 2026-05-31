"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "../../components/TopNav";
import { Btn } from "../../components/Btn";
import { PendingToast } from "../../components/PendingToast";
import { useApp } from "../../lib/app-context";
import { usePlinkoBet } from "./hooks";
import { randHex } from "../../lib/mock-utils";
import { getSound } from "../../lib/sound";
import { Risk } from "@proofbet/shared/types";
import type { Hex } from "viem";
import plinkoTables from "../../lib/plinko-tables";
import plinkoEdges from "../../lib/plinko-edges";

const sound = getSound();

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// colour tier for a slot multiplier
function slotTier(m: number): string {
  if (m >= 10) return "hot";
  if (m >= 2) return "warm";
  if (m >= 1) return "even";
  return "cold";
}

// compact slot label — sheds decimals as values grow / tiles shrink,
// so 17 narrow bins never clip "27.10×" into "27.1".
function fmtSlot(m: number, slots: number): string {
  const tight = slots >= 13;
  if (m >= 100) return String(Math.round(m));
  if (m >= 10) return tight ? String(Math.round(m)) : fmt(m, 1);
  if (m >= 1) return fmt(m, 1);
  return fmt(m, 2);
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

interface BallState {
  x: number;
  y: number;
  hop: number;
  settling: boolean;
}

// ---------- ball drop animation (follows the verified path) ----------
// Cosmetic only: the ball traces `path` — the path the REAL outcome already
// settled on. The animation never decides anything.
function usePlinkoDrop(
  path: number[] | undefined,
  rows: number,
  playing: boolean,
  roundKey: string | undefined,
  onDone: () => void
): BallState | null {
  const [ball, setBall] = useState<BallState | null>(null);
  const raf = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const lastRow = useRef(-1);

  useEffect(() => {
    if (!playing || !path) {
      setBall(null);
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const slotW = 1 / (rows + 1);
    const xAt = (k: number): number => {
      let rights = 0;
      for (let i = 0; i < k; i++) rights += path[i] ?? 0;
      return 0.5 + (rights - k / 2) * slotW;
    };
    const perRow = reduce ? 6 : 132;
    const total = rows * perRow + 220;
    const start = performance.now();
    lastRow.current = -1;

    const tick = (now: number) => {
      const t = Math.min((now - start) / total, 1);
      const rf = t * rows;
      let k = Math.floor(rf);
      let frac = rf - k;
      if (k >= rows) {
        k = rows;
        frac = 0;
      }
      const x0 = xAt(k);
      const x1 = xAt(Math.min(k + 1, rows));
      const e = frac < 0.5 ? 2 * frac * frac : 1 - Math.pow(-2 * frac + 2, 2) / 2;
      const x = x0 + (x1 - x0) * e;
      const hop = Math.sin(frac * Math.PI) * (0.55 / (rows + 1)); // little upward hop between pegs
      // peg ping each time the ball clears a new row
      if (k > lastRow.current && k < rows) {
        lastRow.current = k;
        sound.peg(k, rows, x1);
      }
      setBall({ x, y: rf / rows, hop, settling: false });
      if (t >= 1) {
        setBall({ x: xAt(rows), y: 1, hop: 0, settling: true });
        doneRef.current();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, roundKey]);

  return ball;
}

function SoundToggle() {
  // Deterministic on server + first client render to avoid a hydration mismatch
  // (the SSR sound singleton is a muted no-op); sync to the real engine after mount.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(sound.muted);
  }, []);
  const toggle = () => {
    const m = sound.toggle();
    setMuted(m);
    if (!m) sound.ui();
  };
  return (
    <button
      className={`pk-sound${muted ? " muted" : ""}`}
      onClick={toggle}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </svg>
      )}
    </button>
  );
}

// ---------- the board (pegs + ball) ----------
function PlinkoBoard({ rows, ball }: { rows: number; ball: BallState | null }) {
  const slotW = 1 / (rows + 1);
  const pegYSpan = 97; // % of board height used by the peg field (slots hug the base)
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
      {ball && (
        <div
          className="pk-ball"
          style={{
            left: `${ball.x * 100}%`,
            top: `${ball.y * pegYSpan - ball.hop * 100}%`,
          }}
        />
      )}
    </div>
  );
}

export function PlinkoPage() {
  const router = useRouter();
  const { inPlay, nonce, setVerifyRound } = useApp();
  const { phase, stage, round, placeBet, settle, reset } = usePlinkoBet();
  const [risk, setRisk] = useState<Risk>(Risk.Medium);
  const [rows, setRows] = useState(12);
  const [stake, setStake] = useState(25);
  const [clientSeed] = useState<Hex>(() => randHex(32) as Hex);
  const [recent, setRecent] = useState<Array<{ m: number }>>([]);
  const settledRef = useRef(false);

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
    sound.unlock();
    placeBet(stakeN, rows, risk, clientSeed, nonce);
  };

  const setRiskTick = (r: Risk) => {
    setRisk(r);
    sound.ui();
  };
  const setRowsTick = (n: number) => {
    setRows(n);
    sound.ui();
  };

  const multiplier = round ? Number(round.multiplierX100) / 100 : 0;
  const win = round?.win ?? false;
  const landedSlot = phase === "settled" && round ? round.slot ?? -1 : -1;

  // sound.drop() on entering the dropping phase (the hook flips pending→dropping
  // once the real/mock VRF resolves). Guarded so it fires exactly once per round.
  useEffect(() => {
    if (phase === "dropping") {
      settledRef.current = false;
      sound.drop();
    }
    if (phase === "idle") settledRef.current = false;
  }, [phase, round?.txHash]);

  // settle once the ball lands (or via the safety timeout if rAF is throttled).
  const onDone = () => {
    if (settledRef.current || !round) return;
    settledRef.current = true;
    sound.land(win, multiplier);
    settle();
  };

  // safety settle if rAF throttled
  useEffect(() => {
    if (phase !== "dropping") return;
    const tm = setTimeout(onDone, 4200);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round?.txHash]);

  const ball = usePlinkoDrop(round?.path, rows, phase === "dropping", round?.txHash, onDone);

  useEffect(() => {
    if (phase === "settled" && round) {
      setRecent((r) => [{ m: Number(round.multiplierX100) / 100 }, ...r].slice(0, 6));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round?.txHash]);

  const onVerify = () => {
    if (round) {
      setVerifyRound(round);
      router.push(`/verify/${round.txHash}`);
    }
  };

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="balance-strip">
        <Link href="/games" className="game-back" style={{ textDecoration: "none" }}>
          ‹ Games
        </Link>
        <div className="inplay-bar">
          <span className="ip-pill">
            <span className="chip-token" />In play <b>{fmtPRF(inPlay)}</b>
            <i>PRF</i>
          </span>
          {inPlay > 0n ? (
            <button className="ip-withdraw" onClick={() => router.push("/withdraw")}>
              Withdraw
            </button>
          ) : (
            <button className="ip-deposit" onClick={() => router.push("/deposit")}>
              + Deposit Proofs
            </button>
          )}
        </div>
      </div>

      <div className="limbo-wrap">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stage plinko-stage">
            <div className="stage-eyebrow eyebrow">
              Plinko · {RISK_LABELS[riskKey]} · {rows} rows
            </div>
            <SoundToggle />

            <PlinkoBoard rows={rows} ball={ball} />

            <div
              className="plinko-slots"
              style={
                {
                  "--slot-fz": `${mults.length >= 15 ? 10.5 : mults.length >= 13 ? 11.5 : 13}px`,
                } as React.CSSProperties
              }
            >
              {mults.map((m, s) => (
                <div
                  key={s}
                  className={`pk-slot ${slotTier(m)}${s === landedSlot ? " land" : ""}`}
                >
                  {fmtSlot(m, mults.length)}
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
                <span className="climb-live">
                  <span className="climb-pulse" />resolving on-chain…
                </span>
              )}
              {phase === "dropping" && (
                <span className="climb-live">
                  <span className="climb-pulse" />dropping through {rows} rows…
                </span>
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
              <Btn kind="primary" onClick={onVerify}>
                Verify this drop
              </Btn>
              <Btn kind="ghost" onClick={reset}>
                New drop
              </Btn>
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
                  onClick={() => setRiskTick(i as Risk)}
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
                onChange={(e) => setRowsTick(Number(e.target.value))}
                aria-label="rows"
              />
            </div>
            <div className="slider-scale">
              <span>8</span>
              <span>10</span>
              <span>12</span>
              <span>14</span>
              <span>16</span>
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
              <button disabled={busy} onClick={() => setStake(Math.round(stake * 50) / 100)}>
                ½
              </button>
              <button disabled={busy} onClick={() => setStake(Math.round(stake * 200) / 100)}>
                2×
              </button>
              <button
                disabled={busy}
                onClick={() => setStake(Math.round((Number(inPlay) / 100) * 100) / 100)}
              >
                max
              </button>
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

          <Btn kind="accent" full disabled={!canBet} onClick={onDrop}>
            {cta}
          </Btn>

          <div className="chip chip-edge" style={{ alignSelf: "center" }}>
            <span className="chip-dot" />
            House edge {(edge * 100).toFixed(1)}% — we don&apos;t hide it.
          </div>
        </div>
      </div>

      {/* Toast mirrors the real bet stage; the hook drives pending→dropping. */}
      {phase === "pending" && <PendingToast stage={stage} />}
    </div>
  );
}
