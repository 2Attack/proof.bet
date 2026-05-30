/**
 * Runtime configuration — reads env vars and decides whether
 * we're in MOCK MODE (no contract address set) or LIVE MODE.
 */

import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

function addr(v: string | undefined): Address {
  if (!v || v === ZERO || v.trim() === "") return ZERO;
  return v as Address;
}

export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "",
  proofBetAddress: addr(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS),
  proofsAddress: addr(process.env.NEXT_PUBLIC_PROOFS_ADDRESS),
  get isMock(): boolean {
    return (
      this.proofBetAddress === ZERO ||
      this.proofsAddress === ZERO
    );
  },
  chainId: 11155111, // Sepolia
} as const;
