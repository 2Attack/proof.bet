"use client";

import { useRouter } from "next/navigation";
import { useApp } from "../../lib/app-context";
import { TopNav } from "../../components/TopNav";
import { VerifyDrawerContent } from "../../features/verify/VerifyDrawer";

interface Props {
  params: Promise<{ txHash: string }>;
}

export default function VerifyRoundPage({ params }: Props) {
  // We need to wait for params in Next.js 15+
  const router = useRouter();
  const { verifyRound } = useApp();

  // If we have the round in context, show it; otherwise show the auditor
  if (!verifyRound) {
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
          <VerifyDrawerContent
            round={verifyRound}
            onClose={() => router.back()}
          />
        </div>
      </div>
    </div>
  );
}
