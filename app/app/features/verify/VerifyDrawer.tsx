"use client";

import { useEffect } from "react";
import { GameType, Risk } from "@proofbet/shared/types";
import { useVerify } from "./hooks";
import { Hashish } from "../../components/Hashish";
import { Btn } from "../../components/Btn";
import type { MockRound } from "../../lib/mock-store";

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const RISK_LABELS = ["Low", "Medium", "High"];

interface VerifyDrawerProps {
  round: MockRound | null;
  onClose: () => void;
  onReroll?: () => void;
}

export function VerifyDrawerContent({ round, onClose, onReroll }: VerifyDrawerProps) {
  const { phase, result, steps, recompute, resetVerify } = useVerify(round);

  useEffect(() => {
    resetVerify();
  }, [round?.requestId, resetVerify]);

  if (!round) return null;

  const isPlinko = round.game === GameType.Plinko;
  const outcomeX100 = round.outcomeX100;
  const outcomeNum = `${fmt(Number(outcomeX100) / 100)}×`;
  const win = round.win;

  const etherscan = `https://sepolia.etherscan.io/tx/${round.txHash}`;
  const target = round.params.target;
  const risk = round.params.risk;
  const rows = round.params.rows;

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="drawer-title">
            Verify this {isPlinko ? "drop" : "round"}
          </div>
          <div className="drawer-sub">
            re-derive the outcome yourself — nothing trusted
          </div>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        {/* Verdict */}
        <div className={`verify-verdict ${win ? "win" : "loss"}`}>
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {isPlinko ? "Multiplier" : "Outcome"}
            </div>
            <div className="vv-num mono">{outcomeNum}</div>
          </div>
          <div className="vv-meta">
            {isPlinko ? (
              <>
                {RISK_LABELS[risk]} · {rows} rows<br />
                slot {round.slot} · stake {fmtPRF(round.stake)} PRF<br />
              </>
            ) : (
              <>
                target {fmt(Number(target) / 100)}×<br />
                stake {fmtPRF(round.stake)} PRF<br />
              </>
            )}
            <span style={{ color: win ? "var(--acc)" : "var(--loss)" }}>
              {win
                ? `+${fmtPRF(round.payout)}`
                : `−${fmtPRF(round.stake - (round.payout ?? 0n))}`}{" "}
              PRF
            </span>
          </div>
        </div>

        {/* Plinko path */}
        {isPlinko && round.path && (
          <div>
            <div className="verify-section-label" style={{ marginBottom: 8 }}>
              <span className="kicker">Ball path · {rows} bounces</span>
            </div>
            <div className="verify-path">
              {round.path.map((b, i) => (
                <span key={i} className={`vp-step ${b ? "r" : "l"}`}>
                  {b ? "R" : "L"}
                </span>
              ))}
              <span className="vp-arrow">→ slot {round.slot}</span>
            </div>
          </div>
        )}

        {/* On-chain inputs */}
        <div className="verify-block">
          <div className="verify-section-label">
            <span className="kicker">On-chain inputs</span>
          </div>
          <div className="seed-row">
            <span className="sk">VRF request ID</span>
            <Hashish value={round.requestId} chars={5} />
          </div>
          <div className="seed-row">
            <span className="sk">Raw random word</span>
            <Hashish value={round.vrfWord} chars={6} />
          </div>
          <div className="seed-row">
            <span className="sk">Client seed</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Hashish value={round.clientSeed} chars={5} />
              {onReroll && (
                <button
                  className="seed-reroll"
                  onClick={onReroll}
                  title="Use a fresh seed on your next bet"
                >
                  ↻ reroll
                </button>
              )}
            </span>
          </div>
          <div className="seed-row">
            <span className="sk">Nonce</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {round.nonce.toString()}
            </span>
          </div>
        </div>

        {/* Open formula */}
        <div>
          <div className="verify-section-label" style={{ marginBottom: 8 }}>
            <span className="kicker">The open formula</span>
          </div>
          <div className="formula">
            <div className="formula-line">
              <span className="var">finalSeed</span> ={" "}
              <span className="fn">keccak256</span>(
              <span className="cm">vrfWord, clientSeed, nonce</span>)
            </div>
            {isPlinko ? (
              <>
                <div className="formula-line">
                  <span className="var">path</span> ={" "}
                  <span className="fn">bits</span>(
                  <span className="cm">finalSeed, {rows}</span>){" "}
                  <span className="formula-arrow">→ slot {round.slot}</span>
                </div>
                <div className="formula-line">
                  <span className="var">multiplier</span> ={" "}
                  <span className="fn">table</span>(
                  <span className="cm">{rows}, {RISK_LABELS[risk]}</span>)[
                  <span className="cm">slot</span>]{" "}
                  <span className="formula-arrow">→ {fmt(Number(outcomeX100) / 100)}×</span>
                </div>
              </>
            ) : (
              <div className="formula-line">
                <span className="var">crashPoint</span> ={" "}
                <span className="fn">limbo</span>(
                <span className="cm">finalSeed, edge=2%</span>){" "}
                <span className="formula-arrow">→ {fmt(Number(outcomeX100) / 100)}×</span>
              </div>
            )}
          </div>
        </div>

        {/* Recompute */}
        <div className="recompute">
          {phase !== "idle" && (
            <div className="compute-log">
              <div className={`cl${steps >= 1 ? " show" : ""}`}>
                <span className="tick">›</span> packing abi.encode(vrfWord, clientSeed, nonce)
              </div>
              <div className={`cl${steps >= 2 ? " show" : ""}`}>
                <span className="tick">›</span> finalSeed = keccak256(…) in your browser
              </div>
              <div className={`cl${steps >= 3 ? " show" : ""}`}>
                <span className="tick">›</span>{" "}
                {isPlinko
                  ? `reading ${rows} bits → path → slot → multiplier`
                  : "deriving crashPoint with 2% edge"}
              </div>
            </div>
          )}

          {phase === "matched" && result && (
            <div className="match-reveal">
              <div className="match-check">✓</div>
              <div className="match-text">
                <div className="mt-1">
                  {result.matches ? "Matches the contract." : "Mismatch"}
                </div>
                <div className="mt-2">
                  {result.matches
                    ? "your browser reached the same outcome, independently"
                    : "unexpected — do not trust this round"}
                </div>
              </div>
            </div>
          )}

          {phase !== "matched" && (
            <Btn
              kind="accent"
              full
              onClick={recompute}
              disabled={phase === "computing"}
            >
              {phase === "computing"
                ? "Recomputing…"
                : "Recompute in your browser"}
            </Btn>
          )}

          <a
            className="btn btn-ghost btn-full"
            href={etherscan}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>View on Etherscan ↗</span>
          </a>
        </div>
      </div>
    </>
  );
}
