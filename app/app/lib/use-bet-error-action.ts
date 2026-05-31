"use client";

/**
 * Wires a bet-error toast's recovery action to real behaviour — shared by
 * Limbo and Plinko so the two never drift. The classifier (`bet-errors.ts`)
 * names the intent; this turns each intent into an effect:
 *
 * - `faucet`         → open an external Sepolia GAS faucet (tETH, not PRF)
 * - `switch-network` → ask the wallet to switch to Sepolia, then clear the toast
 * - `retry` / `adjust` / `dismiss` → just clear the toast back to idle
 */

import { useCallback } from "react";
import { useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { SEPOLIA_GAS_FAUCET_URL, type BetErrorAction } from "./bet-errors";

export function useBetErrorAction(reset: () => void) {
  const { switchChain } = useSwitchChain();

  return useCallback(
    (intent: BetErrorAction) => {
      switch (intent) {
        case "faucet":
          window.open(SEPOLIA_GAS_FAUCET_URL, "_blank", "noopener,noreferrer");
          return;
        case "switch-network":
          switchChain({ chainId: sepolia.id });
          reset();
          return;
        case "retry":
        case "adjust":
        case "dismiss":
        default:
          reset();
          return;
      }
    },
    [switchChain, reset],
  );
}
