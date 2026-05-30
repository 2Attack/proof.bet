"use client";

import { useRouter } from "next/navigation";
import { TopNav } from "../components/TopNav";
import { WithdrawDrawer } from "../features/economy/WithdrawDrawer";

export default function WithdrawFullPage() {
  const router = useRouter();
  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage">
        <div className="glass" style={{ maxWidth: 460, width: "100%", display: "flex", flexDirection: "column" }}>
          <WithdrawDrawer onClose={() => router.back()} />
        </div>
      </div>
    </div>
  );
}
