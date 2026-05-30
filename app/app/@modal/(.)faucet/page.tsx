"use client";

import { useRouter } from "next/navigation";
import { FaucetDrawer } from "../../features/economy/FaucetDrawer";

export default function FaucetModal() {
  const router = useRouter();
  return (
    <>
      <div
        className="drawer-scrim open"
        onClick={() => router.back()}
        style={{ zIndex: 50 }}
      />
      <aside className="drawer open" role="dialog" aria-label="Faucet">
        <div className="glass drawer-inner">
          <FaucetDrawer onClose={() => router.back()} />
        </div>
      </aside>
    </>
  );
}
