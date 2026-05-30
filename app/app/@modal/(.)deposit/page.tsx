"use client";

import { useRouter } from "next/navigation";
import { DepositDrawer } from "../../features/economy/DepositDrawer";

export default function DepositModal() {
  const router = useRouter();
  return (
    <>
      <div className="drawer-scrim open" onClick={() => router.back()} style={{ zIndex: 50 }} />
      <aside className="drawer open" role="dialog" aria-label="Deposit">
        <div className="glass drawer-inner">
          <DepositDrawer onClose={() => router.back()} />
        </div>
      </aside>
    </>
  );
}
