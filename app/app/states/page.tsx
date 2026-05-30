"use client";

import { useState } from "react";
import { TopNav } from "../components/TopNav";
import { Btn } from "../components/Btn";

interface ErrorCase {
  glyph: string;
  neutral: boolean;
  t: string;
  m: string;
  action: string;
}

const ERRORS: ErrorCase[] = [
  {
    glyph: "✕",
    neutral: false,
    t: "Transaction rejected",
    m: "You declined the signature in your wallet. No bet was placed.",
    action: "Try again",
  },
  {
    glyph: "⛽",
    neutral: true,
    t: "Not enough gas",
    m: "Your wallet lacks Sepolia ETH for gas. Grab some from a faucet.",
    action: "Open faucet ↗",
  },
  {
    glyph: "⚡",
    neutral: true,
    t: "Wrong network",
    m: "This contract lives on Sepolia. Switch networks to continue.",
    action: "Switch to Sepolia",
  },
  {
    glyph: "▣",
    neutral: true,
    t: "Bankroll cap reached",
    m: "This bet's max payout exceeds what the house can safely cover right now. Lower your stake or target.",
    action: "Adjust bet",
  },
  {
    glyph: "∅",
    neutral: false,
    t: "Insufficient balance",
    m: "Your stake is larger than your in-play Proofs (PRF) balance.",
    action: "Lower stake",
  },
];

/**
 * Responsible-gaming nudge — fixed-position glass toast that slides up.
 * Mirrors the design `RGNudge`; `show` drives the slide-in transform.
 */
interface RGNudgeProps {
  show: boolean;
  onDismiss: () => void;
}

function RGNudge({ show, onDismiss }: RGNudgeProps) {
  return (
    <div className={`glass rg-toast${show ? " show" : ""}`} role="status">
      <div className="rg-icon">◷</div>
      <div className="rg-body">
        <div className="rt">You&apos;ve been playing for 45 minutes.</div>
        <div className="rm">
          a good moment to take a break — the game will be here later
        </div>
      </div>
      <button className="rg-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

export default function StatesPage() {
  const [nudge, setNudge] = useState(true);

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage" style={{ alignItems: "flex-start" }}>
        <div className="err-gallery" style={{ width: "100%" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Error states · calm, never alarming
          </div>
          {ERRORS.map((e, i) => (
            <div key={i} className="err-card">
              <div className={`err-glyph${e.neutral ? " neutral" : ""}`}>
                {e.glyph}
              </div>
              <div className="err-body">
                <div className="et">{e.t}</div>
                <div className="em">{e.m}</div>
              </div>
              <div className="err-action">
                <Btn kind={e.neutral ? "ghost" : "danger"}>{e.action}</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RGNudge show={nudge} onDismiss={() => setNudge(false)} />
    </div>
  );
}
