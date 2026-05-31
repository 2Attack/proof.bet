"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "../../components/TopNav";
import { Btn } from "../../components/Btn";
import { ClimbChart } from "../../components/ClimbChart";
import { PendingToast } from "../../components/PendingToast";
import { BankrollMeter } from "../../components/BankrollMeter";
import { useApp } from "../../lib/app-context";
import { usePlaceBet } from "./hooks";
import { useClimb } from "../../lib/spring";
import { getSound } from "../../lib/sound";
import { randHex } from "../../lib/mock-utils";
import type { Hex } from "viem";
import type { LimboRound, BetPhase } from "./hooks";

const sound = getSound();

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


// ---------- shared sound on/off toggle (sits in a stage corner) ----------
function SoundToggle() {
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



// ---------- the result stage (money-shot) ----------
function ResultStage({
  phase,
  round,
  onSettle,
  recent,
  idleTarget,
}: {
  phase: BetPhase;
  round: LimboRound | null;
  onSettle: () => void;
  recent: Array<{ crashX100: bigint; win: boolean }>;
  idleTarget: number;
}) {
  const playing = phase === "revealing";
  const crash = round ? Number(round.crashX100) / 100 : 1.0;
  const [climbVal, done] = useClimb(1.0, round ? crash : 1.0, playing, "climb");
  const settledRef = useRef(false);
  const crossedRef = useRef(false);

  useEffect(() => {
    if (playing) settledRef.current = false;
    if (done && playing && !settledRef.current) {
      settledRef.current = true;
      const t = setTimeout(onSettle, 420);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, playing]);

  // ---- sound: launch + reset cross-flag while climbing ----
  useEffect(() => {
    if (playing) {
      crossedRef.current = false;
      sound.limboStart();
    }
  }, [playing]);

  const settled = phase === "settled";
  const showNum = playing || settled;
  const val = settled && round ? crash : climbVal;
  // in-round target comes from the LOCKED round, not the live slider
  const target = round ? Number(round.targetX100) / 100 : idleTarget || 2;
  const win = round ? round.win : false;
  const crossing = (playing && round ? val >= target : false) || (settled && win);

  // ---- sound: ramp tone with climb, ping on cross, resolve on settle ----
  useEffect(() => {
    if (!playing || !round) return;
    const prog = (climbVal - 1) / (crash - 1 || 1);
    sound.limboTo(prog);
    if (!crossedRef.current && climbVal >= target) {
      crossedRef.current = true;
      sound.limboCross();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [climbVal, playing]);

  useEffect(() => {
    if (settled && round) sound.limboEnd(win, crash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const numClass =
    "result-number" +
    (settled
      ? win
        ? " result-win"
        : " result-loss"
      : crossing
        ? " result-win"
        : "");
  const settleAnim = settled ? (win ? " is-win" : " is-loss") : "";

  return (
    <div className={`stage${showNum ? " live" : ""}${settleAnim}`}>
      <div className="stage-eyebrow eyebrow">Limbo · provably fair</div>
      <SoundToggle />

      <ClimbChart
        playing={playing}
        settled={settled}
        val={val}
        target={target}
        crash={crash}
        win={win}
      />

      {settled && win && round && <div className="stage-burst" key={round.requestId} />}

      <div className="stage-content">
        {!showNum && (
          <div className="stage-idle">
            {phase === "pending" ? (
              <>
                <span className="serif">Locking in your bet…</span>
                <span className="kicker">fetching verifiable randomness</span>
              </>
            ) : (
              <>
                <span className="serif">Ready to launch.</span>
                <span className="kicker">set a target · beat it to win</span>
              </>
            )}
          </div>
        )}

        {showNum && (
          <div className="stage-numwrap">
            <div className={numClass} aria-live="polite">
              {fmt(val)}
              <span className="x">×</span>
            </div>
            <div className="result-caption">
              {playing && (
                <span className="climb-live">
                  <span className="climb-pulse" />
                  climbing…
                </span>
              )}
              {settled && win && round && (
                <>
                  <span className="result-verdict verdict-win">
                    Beat {fmt(target)}×.
                  </span>
                  <span className="payout-flash">
                    +{fmtPRF(round.payout)} PRF
                  </span>
                </>
              )}
              {settled && !win && round && (
                <>
                  <span className="result-verdict verdict-loss">
                    Fell short of {fmt(target)}×.
                  </span>
                  <span style={{ color: "var(--ink-dim)" }}>
                    −{fmtPRF(round.stake)} PRF
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="recent">
          {recent.map((r, i) => (
            <span key={i} className={`recent-pill ${r.win ? "win" : "loss"}`}>
              {fmt(Number(r.crashX100) / 100)}×
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- the slider (bar treatment) ----------
function TargetSlider({
  target,
  setTarget,
  disabled,
}: {
  target: number;
  setTarget: (t: number) => void;
  disabled: boolean;
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
          disabled={disabled}
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
  const { phase, stage, round, placeBet, settle, reset } = usePlaceBet();
  const [target, setTarget] = useState(2.0);
  const [stake, setStake] = useState(25);
  const [clientSeed] = useState<Hex>(() => randHex(32) as Hex);
  const [recent, setRecent] = useState<
    Array<{ crashX100: bigint; win: boolean }>
  >([]);

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

  // push the resolved round into the recent strip exactly once, at settle
  const onSettle = () => {
    settle();
    if (round) {
      setRecent((r) =>
        [{ crashX100: round.crashX100, win: round.win }, ...r].slice(0, 6)
      );
    }
  };

  const onPlace = () => {
    if (!canBet) return;
    sound.unlock();
    placeBet(stakeN, targetX100, clientSeed, nonce);
  };

  const onVerify = () => {
    if (round) {
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
        <Link
          href="/games"
          className="game-back"
          style={{ textDecoration: "none" }}
        >
          ‹ Games
        </Link>
        <div className="inplay-bar">
          <span className="ip-pill">
            <span className="chip-token" />
            In play <b>{fmtPRF(inPlay)}</b>
            <i>PRF</i>
          </span>
          {inPlay > 0n ? (
            <button
              className="ip-withdraw"
              onClick={() => router.push("/withdraw")}
            >
              Withdraw
            </button>
          ) : (
            <button
              className="ip-deposit"
              onClick={() => router.push("/deposit")}
            >
              + Deposit Proofs
            </button>
          )}
        </div>
      </div>

      <div className="limbo-wrap">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ResultStage
            phase={phase}
            round={round}
            onSettle={onSettle}
            recent={recent}
            idleTarget={target}
          />

          {phase === "settled" && (
            <div
              style={{ display: "flex", gap: 12, justifyContent: "center" }}
            >
              <Btn kind="primary" onClick={onVerify}>
                Verify this round
              </Btn>
              <Btn kind="ghost" onClick={reset}>
                New bet
              </Btn>
            </div>
          )}

          <BankrollMeter bankroll={bankroll} maxBet={maxBet} stake={stakeN} />
        </div>

        {/* Bet panel */}
        <div className="glass betpanel">
          <TargetSlider target={target} setTarget={setTarget} disabled={busy} />

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
              <div className="v mono acc">
                {fmtPRF(BigInt(Math.round(payout * 100)))} PRF
              </div>
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

      {phase === "pending" && <PendingToast stage={stage} />}
    </div>
  );
}
