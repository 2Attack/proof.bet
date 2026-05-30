/**
 * Deployed contract addresses per chain. Filled by the /contracts deploy script
 * in Phase 2 (it writes the verified Sepolia addresses here). The app reads them
 * via `NEXT_PUBLIC_CONTRACT_ADDRESS` / `NEXT_PUBLIC_PROOFS_ADDRESS` at runtime;
 * this map is the typed fallback / source of record.
 */

import type { Address } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111 as const;

export interface Deployment {
  proofBet: Address;
  proofs: Address;
}

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const DEPLOYMENTS: Record<number, Deployment> = {
  [SEPOLIA_CHAIN_ID]: {
    proofBet: ZERO, // set by script/Deploy.s.sol
    proofs: ZERO,
  },
};

export function getDeployment(chainId: number): Deployment | undefined {
  return DEPLOYMENTS[chainId];
}
