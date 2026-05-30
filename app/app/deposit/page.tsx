"use client";

import { useRouter } from "next/navigation";
import { TopNav } from "../components/TopNav";
import { DepositDrawer } from "../features/economy/DepositDrawer";

export default function DepositFullPage() {
  const router = useRouter();
  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage">
        <div className="glass" style={{ maxWidth: 460, width: "100%", display: "flex", flexDirection: "column" }}>
          <DepositDrawer onClose={() => router.back()} />
        </div>
      </div>
    </div>
  );
}
