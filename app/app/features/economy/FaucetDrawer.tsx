"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/app-context";
import { useFaucet, fpToFloat, fmtChips, txCta } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";
import { useSpringValue } from "../../lib/spring";
import { getSound } from "../../lib/sound";

const FLOW = ["Connect", "Claim", "Deposit", "Play"] as const;
function FlowRail({ stage }: { stage: number }) {
  return (
    <div className="flow-rail" aria-hidden="true">
      {FLOW.map((label, i) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < FLOW.length - 1 ? "none" : 1 }}>
          {i > 0 && <span className="flow-sep" style={{ flex: 1 }} />}
          <span className={`flow-node${i < stage ? " done" : ""}${i === stage ? " active" : ""}`}>
            <span className="fn-dot" />{label}
          </span>
        </span>
      ))}
    </div>
  );
}

interface FaucetDrawerProps {
  onClose: () => void;
  asDrawer?: boolean;
}

export function FaucetDrawer({ onClose }: FaucetDrawerProps) {
  const router = useRouter();
  const { walletPRF } = useApp();
  const { tx, faucet } = useFaucet();

  const busy = tx.phase === "signing" || tx.phase === "pending";
  const minted = walletPRF > 0n;

  // climb the wallet readout toward the live balance (spring, whole PRF units)
  const display = useSpringValue(fpToFloat(walletPRF), "climb");

  // soft UI chime the instant the on-chain mint confirms (design pkSound.ui)
  const chimed = useRef(false);
  useEffect(() => {
    if (tx.phase === "confirmed" && !chimed.current) {
      chimed.current = true;
      getSound().ui();
    }
  }, [tx.phase]);

  const claim = () => {
    if (busy || minted) return;
    getSound().unlock();
    void faucet();
  };

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="drawer-title">Claim your Proofs</div>
          <div className="drawer-sub">
            free test Proofs · not real money · tETH only pays gas
          </div>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="drawer-body">
        <FlowRail stage={1} />

        <div className={`chips-readout${minted ? " lit" : ""}`}>
          <div className="cr-k">
            <span className="chip-token" />
            Wallet balance
          </div>
          <div className="cr-v">{fmtChips(Math.round(display))}</div>
          <div className="cr-u">PRF</div>
          <div className="cr-stack" />
        </div>

        {tx.phase !== "idle" && (
          <TxStateDisplay
            tx={tx}
            verb="Minting 1,000 Proofs"
            doneLabel="1,000 Proofs minted to your wallet"
          />
        )}

        <div className="eco-actions">
          {!minted ? (
            <Btn kind="accent" full disabled={busy} onClick={claim}>
              {busy ? txCta(tx.phase) : "Claim 1,000 Proofs"}
            </Btn>
          ) : (
            <Btn
              kind="accent"
              full
              onClick={() => router.push("/deposit")}
            >
              Deposit to play →
            </Btn>
          )}
          <div className="eco-note">
            Testnet faucet · mints the PRF ERC-20 test token to your address
          </div>
        </div>
      </div>
    </>
  );
}
