/**
 * finalSeed derivation — the root of the whole provably-fair chain.
 *
 * SEAM CONTRACT (must be byte-identical on-chain and in-browser):
 *   finalSeed = keccak256(abi.encode(uint256 vrfWord, bytes32 clientSeed, uint256 nonce))
 *
 * `encodeAbiParameters` produces the exact 96-byte preimage Solidity's
 * `abi.encode(...)` produces (three left-padded 32-byte words), so this and the
 * contract's `keccak256` land on the same hash by construction. The golden
 * vectors prove it.
 */

import { encodeAbiParameters, keccak256, type Hex } from "viem";

const SEED_ABI = [
  { type: "uint256" }, // vrfWord
  { type: "bytes32" }, // clientSeed
  { type: "uint256" }, // nonce
] as const;

export function deriveFinalSeed(
  vrfWord: bigint,
  clientSeed: Hex,
  nonce: bigint,
): Hex {
  return keccak256(encodeAbiParameters(SEED_ABI, [vrfWord, clientSeed, nonce]));
}
