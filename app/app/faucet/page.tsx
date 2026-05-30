"use client";

import { useRouter } from "next/navigation";
import { TopNav } from "../components/TopNav";
import { FaucetDrawer } from "../features/economy/FaucetDrawer";

export default function FaucetFullPage() {
  const router = useRouter();
  return (
    <div className="hp-screen">
      <TopNav />
      <div className="center-stage">
        <div className="glass" style={{ maxWidth: 460, width: "100%", display: "flex", flexDirection: "column" }}>
          <FaucetDrawer onClose={() => router.back()} asDrawer={false} />
        </div>
      </div>
    </div>
  );
}
