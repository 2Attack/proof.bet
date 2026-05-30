"use client";

import { TopNav } from "../components/TopNav";
import { Btn } from "../components/Btn";

const ERRORS = [
  {
    glyph: "✕",
    neutral: false,
    t: "Transaction rejected",
    m: "You declined the signature in your wallet. No bet was placed.",
    action: "Try again",
    kind: "danger" as const,
  },
  {
    glyph: "⛽",
    neutral: true,
    t: "Not enough gas",
    m: "Your wallet lacks Sepolia ETH for gas. Grab some from a faucet.",
    action: "Open faucet ↗",
    kind: "ghost" as const,
  },
  {
    glyph: "⚡",
    neutral: true,
    t: "Wrong network",
    m: "This contract lives on Sepolia. Switch networks to continue.",
    action: "Switch to Sepolia",
    kind: "ghost" as const,
  },
  {
    glyph: "▣",
    neutral: true,
    t: "Bankroll cap reached",
    m: "This bet's max payout exceeds what the house can safely cover right now. Lower your stake or target.",
    action: "Adjust bet",
    kind: "ghost" as const,
  },
  {
    glyph: "∅",
    neutral: false,
    t: "Insufficient balance",
    m: "Your stake is larger than your in-play Proofs (PRF) balance.",
    action: "Lower stake",
    kind: "danger" as const,
  },
];

export default function StatesPage() {
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
                <Btn kind={e.kind}>{e.action}</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
