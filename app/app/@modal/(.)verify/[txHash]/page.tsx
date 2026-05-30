"use client";

import { useRouter } from "next/navigation";
import { useApp } from "../../../lib/app-context";
import { VerifyDrawerContent } from "../../../features/verify/VerifyDrawer";

export default function VerifyModal() {
  const router = useRouter();
  const { verifyRound } = useApp();

  if (!verifyRound) {
    router.replace("/verify");
    return null;
  }

  return (
    <>
      <div className="drawer-scrim open" onClick={() => router.back()} style={{ zIndex: 50 }} />
      <aside className="drawer open" role="dialog" aria-label="Verify round">
        <div className="glass drawer-inner">
          <VerifyDrawerContent round={verifyRound} onClose={() => router.back()} />
        </div>
      </aside>
    </>
  );
}
