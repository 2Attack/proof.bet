"use client";

import { useRouter } from "next/navigation";
import { WithdrawDrawer } from "../../features/economy/WithdrawDrawer";

export default function WithdrawModal() {
  const router = useRouter();
  return (
    <>
      <div className="drawer-scrim open" onClick={() => router.back()} style={{ zIndex: 50 }} />
      <aside className="drawer open" role="dialog" aria-label="Withdraw">
        <div className="glass drawer-inner">
          <WithdrawDrawer onClose={() => router.back()} />
        </div>
      </aside>
    </>
  );
}
