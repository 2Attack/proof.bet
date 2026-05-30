"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { useApp } from "../../lib/app-context";
import { loadRoundByTxHash } from "../../lib/live-bet";
import type { MockRound } from "../../lib/mock-store";
import { TopNav } from "../../components/TopNav";
import { VerifyDrawerContent } from "../../features/verify/VerifyDrawer";

interface Props {
  // Next 16: route params arrive as a Promise.
  params: Promise<{ txHash: string }>;
}

type LoadState =
  | { kind: "ready"; round: MockRound }
  | { kind: "loading" }
  | { kind: "notfound" };

export default function VerifyRoundPage({ params }: Props) {
  const { txHash } = use(params);
  const router = useRouter();
  const { verifyRound, isMock } = useApp();
  const publicClient = usePublicClient();
  const [cold, setCold] = useState<LoadState>(
    verifyRound ? { kind: "ready", round: verifyRound } : { kind: "loading" },
  );

  // Cold direct-load: if the round isn't in the session, reconstruct it from
  // chain logs (live mode only — mock rounds exist only in memory).
  useEffect(() => {
    if (verifyRound) {
      setCold({ kind: "ready", round: verifyRound });
      return;
    }
    if (isMock || !publicClient) {
      setCold({ kind: "notfound" });
      return;
    }
    let active = true;
    setCold({ kind: "loading" });
    loadRoundByTxHash(publicClient, txHash as Hex)
      .then((round) => {
        if (!active) return;
        setCold(round ? { kind: "ready", round } : { kind: "notfound" });
      })
      .catch(() => {
        if (active) setCold({ kind: "notfound" });
      });
    return () => {
      active = false;
    };
  }, [verifyRound, isMock, publicClient, txHash]);

  if (cold.kind === "loading") {
    return (
      <div className="hp-screen">
        <TopNav />
        <div className="center-stage">
          <div className="glass" style={{ maxWidth: 460, width: "100%", padding: 24, textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Loading round…</div>
            <p className="mono" style={{ color: "var(--ink-dim)", fontSize: 12, wordBreak: "break-all" }}>
              {txHash}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (cold.kind === "notfound") {
    return (
      <div className="hp-screen">
        <TopNav />
        <div className="center-stage">
          <div className="glass" style={{ maxWidth: 460, width: "100%", padding: 24, textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Round not found</div>
            <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
              This round isn&apos;t in your session. Paste the tx hash in the Auditor to verify it.
            </p>
            <button
              className="btn btn-accent"
              style={{ marginTop: 16 }}
              onClick={() => router.push("/verify")}
            >
              Open Auditor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage" style={{ alignItems: "flex-start", paddingTop: 32 }}>
        <div
          className="glass"
          style={{
            maxWidth: 460,
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <VerifyDrawerContent round={cold.round} onClose={() => router.back()} />
        </div>
      </div>
    </div>
  );
}
