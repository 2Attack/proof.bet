/**
 * On-chain pending-bet recovery.
 *
 * The pending round lives only in module/React state (rounds-store.ts), so a page
 * reload during the ~30s–2min VRF wait orphans it: the UI forgets the bet and
 * would happily let the player place another. The chain, however, is the source
 * of truth — `BetPlaced` and `BetSettled` are both indexed by player. On mount we
 * reconstruct the in-flight bet by diffing them: any `BetPlaced` with no matching
 * `BetSettled` is still pending.
 *
 * We return both a *display* round (real requestId/txHash, zeroed outcome) and the
 * `resume` inputs needed to finalize it via `resolveSettledRound` — which reads the
 * EXACT on-chain stake from the event (never round-tripped through fp) and waits
 * for BetSettled. No extra receipt fetch: we already hold the BetPlaced log.
 */

import type { Hex, PublicClient } from "viem";
import { iProofBetAbi } from "@proofbet/shared/abi";
import { GameType } from "@proofbet/shared/types";
import { proofBetContract } from "./contracts";
import type { PlacedRoundInputs } from "./live-bet";
import { weiToFp } from "./units";
import type { MockRound } from "./mock-store";

/**
 * How far back to scan for an unsettled bet. Sepolia is ~12s/block, so ~600
 * blocks ≈ 2h — comfortably longer than any live VRF wait, while keeping the
 * `eth_getLogs` range small (some RPCs cap it). Orphans older than this window
 * are not auto-recovered; they still settle on-chain into the player's In-play
 * balance and remain inspectable via /verify/[txHash].
 */
const RECOVERY_BLOCK_WINDOW = 600n;

const ZERO_SEED =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const SCAN_RETRIES = 3;
const SCAN_RETRY_MS = 1_500;

/** Retry an async read a few times — rides out transient batched-RPC failures. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < SCAN_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, SCAN_RETRY_MS));
    }
  }
  throw lastErr;
}

interface PlacedArgs {
  requestId: bigint;
  player: Hex;
  gameType: number;
  stake: bigint;
  clientSeed: Hex;
  nonce: bigint;
  params: { target: bigint; rows: number; risk: number };
}

export interface RecoveredPending {
  /** Optimistic round for the pending toast / history slot (fp units). */
  round: MockRound;
  /** Inputs for `resolveSettledRound` to await settlement and finalize. */
  resume: PlacedRoundInputs;
}

/**
 * Find the player's most-recent unsettled bet, if any.
 *
 * The store holds a single pending round; the contract permits concurrent bets,
 * so if several are in flight we surface the latest and let the rest settle into
 * the balance silently. Returns null when nothing is pending (the common case).
 */
export async function recoverPendingRound(
  publicClient: PublicClient,
  player: Hex,
): Promise<RecoveredPending | null> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock =
    latest > RECOVERY_BLOCK_WINDOW ? latest - RECOVERY_BLOCK_WINDOW : 0n;

  // The scan fires during the mount "storm" of concurrent reads; with the
  // transport's `batch: true`, a batched eth_getLogs sub-response can come back
  // without a result (→ a thrown read error). Retry a few times before giving up
  // so recovery isn't lost to a one-off batching hiccup.
  const scan = (eventName: "BetPlaced" | "BetSettled") =>
    withRetry(() =>
      publicClient.getContractEvents({
        address: proofBetContract.address,
        abi: iProofBetAbi,
        eventName,
        args: { player },
        fromBlock,
        toBlock: "latest",
      }),
    );

  const [placed, settled] = await Promise.all([
    scan("BetPlaced"),
    scan("BetSettled"),
  ]);

  const settledIds = new Set(
    settled.map((log) => String((log.args as { requestId: bigint }).requestId)),
  );

  // getContractEvents returns logs in ascending (block, logIndex) order, so the
  // last unsettled entry is the most recent bet.
  const pending = placed.filter(
    (log) =>
      !settledIds.has(String((log.args as { requestId: bigint }).requestId)),
  );
  const hit = pending[pending.length - 1];
  if (!hit) return null;

  const a = hit.args as unknown as PlacedArgs;
  const game: 0 | 1 = a.gameType === GameType.Plinko ? 1 : 0;
  const params = {
    target: a.params.target,
    rows: a.params.rows,
    risk: a.params.risk,
  };

  return {
    round: {
      requestId: String(a.requestId),
      txHash: hit.transactionHash,
      vrfWord: 0n,
      clientSeed: a.clientSeed,
      nonce: a.nonce,
      game,
      stake: weiToFp(a.stake),
      params,
      finalSeed: ZERO_SEED,
      outcomeX100: 0n,
      win: false,
      payout: 0n,
    },
    resume: {
      requestId: a.requestId,
      txHash: hit.transactionHash,
      clientSeed: a.clientSeed,
      nonce: a.nonce,
      gameType: a.gameType,
      stake: a.stake,
      params,
      fromBlock: hit.blockNumber,
    },
  };
}
