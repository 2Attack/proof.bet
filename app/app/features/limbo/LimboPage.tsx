"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useSpring, useMotionValue, animate } from "framer-motion";
import { TopNav } from "../../components/TopNav";
import { Btn } from "../../components/Btn";
import { useApp } from "../../lib/app-context";
import { usePlaceBet } from "./hooks";
import { randHex } from "../../lib/mock-utils";
import type { Hex } from "viem";
import type { LimboRound } from "./hooks";

const MULT_MIN = 1.01;
const MULT_MAX = 1000;
const HOUSE_EDGE = 0.02;
const FP = 100n;

const posToTarget = (p: number) => {
  const v = MULT_MIN * Math.pow(MULT_MAX / MULT_MIN, p);
  return Math.round(v * 100) / 100;
};
const targetToPos = (t: number) =>
  Math.log(t / MULT_MIN) / Math.log(MULT_MAX / MULT_MIN);

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

function BankrollMeter({
  bankroll,
  maxBet,
}: {
  bankroll: bigint;
  maxBet: bigint;
}) {
  const pct = Math.min(100, Number(bankroll / FP) / 50000 * 100);
  return (
    <div className="bankroll">
      <div className="bankroll-head">
        <span className="kicker">House bankroll · live</span>
        <span className="chip" style={{ padding: "3px 9px" }}>
          <span className="chip-dot" />solvent
        </span>
      </div>
      <div className="bankroll-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="bankroll-foot">
        <span className="lb">
          <span className="k">Bankroll</span>
          <span className="v mono">{fmtPRF(bankroll)} PRF</span>
        </span>
        <span className="mb">
          <span className="k">Max bet (this target)</span>
          <span className="v mono acc">{fmtPRF(maxBet)} PRF</span>
        </span>
      </div>
    </div>
  );
}

function PendingToast({
  onDone,
  block,
}: {
  onDone: () => void;
  block: number;
}) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const durs = reduced ? [150, 150, 150] : [1500, 1700, 1100];
    const total = durs.reduce((a, b) => a + b, 0);

    requestAnimationFrame(() => setShow(true));
    let acc = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    durs.forEach((d, i) => {
      acc += d;
      timers.push(setTimeout(() => setStep(i + 1), acc));
    });
    timers.push(setTimeout(() => setShow(false), total + 200));
    timers.push(setTimeout(onDone, total + 450));
    const t0 = performance.now();
    const iv = setInterval(
      () => setElapsed((performance.now() - t0) / 1000),
      100
    );
    return () => {
      timers.forEach((t) => clearTimeout(t));
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = [
    "Requesting entropy",
    "Oracle responded",
    "Settling on-chain",
  ];
  const cur = steps[Math.min(step, steps.length - 1)];
  const pct = Math.min(100, (step / steps.length) * 100 + 6);

  return (
    <div
      className={`glass pending-toast${show ? " show" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="pt-spinner" />
      <div className="pt-body">
        <div className="pt-head">
          <span className="pt-title">Resolving on-chain</span>
          <span className="pt-elapsed mono">{elapsed.toFixed(1)}s</span>
        </div>
        <div className="pt-step mono">
          <span className="pulse-dot" />
          {step >= steps.length ? "finalizing…" : cur}
        </div>
        <div className="pt-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ResultNumber({
  value,
  win,
  settled,
  crossing,
}: {
  value: number;
  win: boolean;
  settled: boolean;
  crossing: boolean;
}) {
  const cls =
    "result-number" +
    (settled
      ? win
        ? " result-win"
        : " result-loss"
      : crossing
        ? " result-win"
        : "");
  return (
    <motion.div
      className={cls}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 18 }}
      aria-live="polite"
    >
      {fmt(value)}
      <span className="x">×</span>
    </motion.div>
  );
}

function TargetSlider({
  target,
  setTarget,
}: {
  target: number;
  setTarget: (t: number) => void;
}) {
  const pos = targetToPos(target);
  const pct = Math.max(0, Math.min(1, pos)) * 100;

  return (
    <div className="betpanel-section">
      <div className="target-display">
        <div className="tval mono">
          {fmt(target)}
          <span className="x">×</span>
        </div>
        <div className="tlabel">target multiplier</div>
      </div>
      <div className="slider">
        <div className="slider-track">
          <div className="slider-fill" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(pos * 1000)}
          onChange={(e) => setTarget(posToTarget(Number(e.target.value) / 1000))}
          aria-label="target multiplier"
        />
      </div>
      <div className="slider-scale">
        <span>1.01×</span>
        <span>2×</span>
        <span>10×</span>
        <span>100×</span>
        <span>1000×</span>
      </div>
    </div>
  );
}

export function LimboPage() {
  const router = useRouter();
  const { inPlay, bankroll, nonce, setVerifyRound, maxBetLimbo } = useApp();
  const { phase, round, placeBet, settle, reset } = usePlaceBet();
  const [target, setTarget] = useState(2.0);
  const [stake, setStake] = useState(25);
  const [clientSeed, setClientSeed] = useState<Hex>(() => randHex(32) as Hex);
  const [displayVal, setDisplayVal] = useState(1.0);
  const [block] = useState(6294117);
  const [recent, setRecent] = useState<Array<{ crashX100: bigint; win: boolean }>>([]);

  const targetX100 = BigInt(Math.round(target * 100));
  const maxBet = maxBetLimbo(targetX100);
  const stakeN = BigInt(Math.round(stake * 100));
  const winChance = Math.min(99.9, ((1 - HOUSE_EDGE) / target) * 100);
  const payout = stake * target;

  const busy = phase === "pending" || phase === "revealing";
  const overBalance = stakeN > inPlay;
  const overMax = stakeN > maxBet;
  const canBet = !busy && !overBalance && !overMax && stakeN > 0n;

  let cta = "Place Bet";
  if (busy) cta = phase === "pending" ? "Waiting on chain…" : "Revealing…";
  else if (stakeN <= 0n) cta = "Enter a stake";
  else if (overBalance) cta = "Insufficient balance";
  else if (overMax) cta = "Above max bet";

  // Spring climbing number (honors prefers-reduced-motion)
  const springVal = useMotionValue(1.0);
  useEffect(() => {
    if (phase === "revealing" && round) {
      const target_crash = Number(round.crashX100) / 100;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setDisplayVal(target_crash);
        settle();
        setRecent((r) => [{ crashX100: round.crashX100, win: round.win }, ...r].slice(0, 6));
        return;
      }
      const ctrl = animate(springVal, target_crash, {
        type: "spring",
        stiffness: 38,
        damping: 14,
        mass: 1.1,
        onUpdate: (v) => setDisplayVal(v),
        onComplete: () => {
          setDisplayVal(target_crash);
          settle();
          if (round) {
            setRecent((r) => [{ crashX100: round.crashX100, win: round.win }, ...r].slice(0, 6));
          }
        },
      });
      return () => ctrl.stop();
    }
    if (phase === "settled" && round) {
      setDisplayVal(Number(round.crashX100) / 100);
    }
    if (phase === "idle") setDisplayVal(1.0);
  }, [phase, round]);

  const crossing = phase === "revealing" && displayVal >= target;

  const onPlace = () => {
    if (!canBet) return;
    placeBet(stakeN, targetX100, clientSeed, nonce);
  };

  const onVerify = () => {
    if (round) {
      // Shape into the verify format
      setVerifyRound({
        ...round,
        requestId: round.requestId,
        txHash: round.txHash,
      });
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
          {inPlay > 0n && (
            <span className="ip-wallet">
              Wallet <b>{fmtPRF(inPlay)}</b>
            </span>
          )}
          <span className="ip-pill">
            <span className="chip-token" />
            In play <b>{fmtPRF(inPlay)}</b>
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
          <div
            className={`stage${phase === "revealing" || phase === "settled" ? " live" : ""}${phase === "settled" && round?.win ? " is-win" : ""}${phase === "settled" && !round?.win ? " is-loss" : ""}`}
          >
            <div className="stage-eyebrow eyebrow">Limbo · provably fair</div>

            <div className="stage-content">
              {phase === "idle" && (
                <div className="stage-idle">
                  <span className="serif">Ready to launch.</span>
                  <span className="kicker">set a target · beat it to win</span>
                </div>
              )}
              {phase === "pending" && (
                <div className="stage-idle">
                  <span className="serif">Locking in your bet…</span>
                  <span className="kicker">fetching verifiable randomness</span>
                </div>
              )}
              {(phase === "revealing" || phase === "settled") && (
                <div className="stage-numwrap">
                  <ResultNumber
                    value={displayVal}
                    win={round?.win ?? false}
                    settled={phase === "settled"}
                    crossing={crossing}
                  />
                  <div className="result-caption">
                    {phase === "revealing" && (
                      <span className="climb-live">
                        <span className="climb-pulse" />
                        climbing…
                      </span>
                    )}
                    {phase === "settled" && round?.win && (
                      <>
                        <span className="result-verdict verdict-win">
                          Beat {fmt(Number(round.targetX100) / 100)}×.
                        </span>
                        <span className="payout-flash">
                          +{fmtPRF(round.payout)} PRF
                        </span>
                      </>
                    )}
                    {phase === "settled" && !round?.win && (
                      <>
                        <span className="result-verdict verdict-loss">
                          Fell short of {fmt(Number(round?.targetX100 ?? 0n) / 100)}×.
                        </span>
                        <span style={{ color: "var(--ink-dim)" }}>
                          −{fmtPRF(round?.stake ?? 0n)} PRF
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {phase === "settled" && round?.win && (
                <div className="stage-burst" key={round.requestId} />
              )}
            </div>

            {recent.length > 0 && (
              <div className="recent">
                {recent.map((r, i) => (
                  <span
                    key={i}
                    className={`recent-pill ${r.win ? "win" : "loss"}`}
                  >
                    {fmt(Number(r.crashX100) / 100)}×
                  </span>
                ))}
              </div>
            )}
          </div>

          {phase === "settled" && (
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Btn kind="primary" onClick={onVerify}>
                Verify this round
              </Btn>
              <Btn kind="ghost" onClick={reset}>
                New bet
              </Btn>
            </div>
          )}

          <BankrollMeter bankroll={bankroll} maxBet={maxBet} />
        </div>

        {/* Bet panel */}
        <div className="glass betpanel">
          <TargetSlider target={target} setTarget={setTarget} />

          <div
            className="stake glass-solid"
            style={{ padding: 14, borderRadius: "var(--r-md)" }}
          >
            <div className="kicker" style={{ marginBottom: 9 }}>
              Stake
            </div>
            <div className="stake-field">
              <input
                type="number"
                min="0"
                step="0.01"
                value={stake}
                disabled={busy}
                onChange={(e) =>
                  setStake(Math.max(0, Number(e.target.value)))
                }
                aria-label="stake"
              />
              <span className="unit">PRF</span>
            </div>
            <div className="stake-quick" style={{ marginTop: 10 }}>
              <button
                disabled={busy}
                onClick={() => setStake(Math.round(stake * 50) / 100)}
              >
                ½
              </button>
              <button
                disabled={busy}
                onClick={() => setStake(Math.round(stake * 200) / 100)}
              >
                2×
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  setStake(
                    Math.round(
                      (Number(maxBet < inPlay ? maxBet : inPlay) / 100) * 100
                    ) / 100
                  )
                }
              >
                max
              </button>
            </div>
          </div>

          <div className="bet-stats">
            <div className="bet-stat">
              <div className="k">Win chance</div>
              <div className="v mono">
                {fmt(winChance, winChance < 1 ? 3 : 2)}%
              </div>
            </div>
            <div className="bet-stat">
              <div className="k">Payout</div>
              <div className="v mono acc">{fmtPRF(BigInt(Math.round(payout * 100)))} PRF</div>
            </div>
          </div>

          <Btn kind="accent" full disabled={!canBet} onClick={onPlace}>
            {cta}
          </Btn>

          <div className="chip chip-edge" style={{ alignSelf: "center" }}>
            <span className="chip-dot" />
            House edge 2% — we don&apos;t hide it.
          </div>
        </div>
      </div>

      {phase === "pending" && (
        <PendingToast onDone={() => {}} block={block} />
      )}
    </div>
  );
}
