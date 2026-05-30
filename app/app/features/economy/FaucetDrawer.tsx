"use client";

import { useRouter } from "next/navigation";
import { useApp } from "../../lib/app-context";
import { useFaucet } from "./hooks";
import { TxStateDisplay } from "../../components/TxState";
import { Btn } from "../../components/Btn";

const FP = 100n;

function fmtPRF(n: bigint) {
  const whole = n / FP;
  const frac = (n % FP).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

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

export function FaucetDrawer({ onClose, asDrawer = true }: FaucetDrawerProps) {
  const router = useRouter();
  const { walletPRF } = useApp();
  const { tx, faucet } = useFaucet();

  const busy = tx.phase === "signing" || tx.phase === "pending";
  const minted = walletPRF > 0n;

  const ctaLabel = busy
    ? tx.phase === "signing"
      ? "Awaiting signature…"
      : "Confirming…"
    : minted
      ? "1,000 Proofs in your wallet"
      : "Claim 1,000 Proofs";

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
          <div className="cr-v">{fmtPRF(walletPRF)}</div>
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
            <Btn
              kind="accent"
              full
              disabled={busy}
              onClick={faucet}
            >
              {ctaLabel}
            </Btn>
          ) : (
            <Btn
              kind="accent"
              full
              onClick={() => { onClose(); router.push("/deposit"); }}
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
