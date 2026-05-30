/**
 * Contract ABIs — codegen target, NOT hand-maintained.
 *
 * `node scripts/sync-abi.mjs` (in /contracts) runs after `forge build` and emits
 * `<Name>.ts` modules here, each exporting an `as const` ABI so wagmi/viem infer
 * fully-typed calls. The app addresses the deployed ProofBet through the
 * `iProofBetAbi` surface. `Proofs.ts` ships as a hand-written placeholder until
 * the first `forge build` overwrites it with the compiled ABI.
 */

export { iProofBetAbi } from "./IProofBet.js";
export { proofsAbi } from "./Proofs.js";
