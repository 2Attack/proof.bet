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

export const DEPLOYMENTS: Record<number, Deployment> = {
  [SEPOLIA_CHAIN_ID]: {
    proofBet: "0xD07b66EE0AC7B73CFD501286F99Cb07238439992",
    proofs: "0x813693e7986a3779dA4cE7DE260c4BC30128c8B8",
  },
};

export function getDeployment(chainId: number): Deployment | undefined {
  return DEPLOYMENTS[chainId];
}
