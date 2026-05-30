/**
 * Typed contract handles for the live (on-chain) hooks.
 *
 * Addresses come from runtime env via config.ts; ABIs come from the codegen'd
 * shared package (synced after `forge build`). The app talks to ProofBet through
 * the IProofBet ABI surface — the frozen seam — and to Proofs for faucet/approve.
 */

import { iProofBetAbi, proofsAbi } from "@proofbet/shared/abi";
import { config } from "./config";

export const proofBetContract = {
  address: config.proofBetAddress,
  abi: iProofBetAbi,
} as const;

export const proofsContract = {
  address: config.proofsAddress,
  abi: proofsAbi,
} as const;
