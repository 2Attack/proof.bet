/**
 * The frozen provably-fair engine — the SEAM both /contracts and /app build on.
 *
 * Everything here is deterministic and reproducible by the Solidity contract.
 * The Verify drawer calls `settleRound` in the browser; the contract runs the
 * same logic in `fulfillRandomWords`; `forge test` asserts both against the
 * golden vectors. If any of the three drifts, "✓ matches" breaks — that is the
 * tripwire that keeps the two parallel tracks honest.
 */

import type { Hex } from "viem";
import {
  GameType,
  type BetParams,
  type Round,
} from "../types.js";
import { deriveFinalSeed } from "./seed.js";
import { limboCrashX100, limboPayout, limboWin } from "./limbo.js";
import { plinkoPayout, plinkoSettle } from "./plinko.js";

export * from "./seed.js";
export * from "./limbo.js";
export * from "./plinko.js";

export interface Settlement {
  finalSeed: Hex;
  outcomeX100: bigint;
  win: boolean;
  payout: bigint;
  /** Plinko only. */
  path?: number[];
  slot?: number;
}

/**
 * Settle any round end-to-end from on-chain inputs. This is the single function
 * the Verify drawer recomputes and the contract mirrors.
 */
export function settleRound(
  game: GameType,
  vrfWord: bigint,
  clientSeed: Hex,
  nonce: bigint,
  params: BetParams,
  stake: bigint,
): Settlement {
  const finalSeed = deriveFinalSeed(vrfWord, clientSeed, nonce);

  if (game === GameType.Limbo) {
    const outcomeX100 = limboCrashX100(finalSeed);
    return {
      finalSeed,
      outcomeX100,
      win: limboWin(outcomeX100, params.target),
      payout: limboPayout(stake, params.target, outcomeX100),
    };
  }

  const { path, slot, outcomeX100, win } = plinkoSettle(finalSeed, params);
  return {
    finalSeed,
    outcomeX100,
    win,
    payout: plinkoPayout(stake, outcomeX100),
    path,
    slot,
  };
}

/** Convenience: settle and shape into the UI `Round` record. */
export function deriveRound(
  game: GameType,
  vrfWord: bigint,
  clientSeed: Hex,
  nonce: bigint,
  params: BetParams,
): Round {
  const s = settleRound(game, vrfWord, clientSeed, nonce, params, 0n);
  return {
    game,
    vrfWord,
    clientSeed,
    nonce,
    params,
    finalSeed: s.finalSeed,
    outcomeX100: s.outcomeX100,
    win: s.win,
    path: s.path,
    slot: s.slot,
  };
}
