/**
 * Live bet flow — placeBet → VRF settlement, reconstructed from on-chain events.
 *
 * The contract's `placeBet` return value (requestId) is NOT available to a tx
 * sender, so we recover it from the `BetPlaced` log in our own receipt. Sepolia
 * VRF then settles asynchronously (≈30s–2min); we poll `BetSettled` filtered on
 * the indexed requestId from the bet's block — a poll (not a live watcher) so a
 * fast callback can't fire in the gap before a watcher mounts (advisor #3).
 */

import {
  parseEventLogs,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { iProofBetAbi } from "@proofbet/shared/abi";
import { GameType, type BetParams, type Risk } from "@proofbet/shared/types";
import { settleRound } from "@proofbet/shared/fairness";
import { proofBetContract } from "./contracts";
import { weiToFp } from "./units";
import type { MockRound } from "./mock-store";

export interface LiveBetResult {
  requestId: bigint;
  txHash: Hex;
  vrfWord: bigint;
  finalSeed: Hex;
  outcomeX100: bigint;
  payout: bigint;
  win: boolean;
}

/**
 * The real, observable steps of a bet — fired as `placeBetLive` crosses each
 * await boundary so the pending toast reflects what is actually happening, not
 * a fixed animation. Mock mode reuses the same stages minus `signing` (there is
 * no wallet prompt). `done` is a terminal marker; the toast unmounts before it.
 */
export type BetStage = "signing" | "confirming" | "vrf" | "settling" | "done";

/** Ordered live stages (mock starts at index 1 — no `signing`). */
export const BET_STAGES: readonly BetStage[] = [
  "signing",
  "confirming",
  "vrf",
  "settling",
] as const;

export const BET_STAGE_LABEL: Record<BetStage, string> = {
  signing: "Awaiting wallet signature",
  confirming: "Confirming bet on-chain",
  vrf: "Waiting for VRF randomness",
  settling: "Settling round on-chain",
  done: "Done",
};

/**
 * Target progress-bar fill per stage. The bar deliberately parks at the `vrf`
 * value during the long (~30s–2min) oracle wait rather than faking movement —
 * the ticking elapsed counter and the pulsing step dot are the honest liveness
 * signals. "Nothing hidden" is the product's whole pitch.
 */
export const BET_STAGE_PCT: Record<BetStage, number> = {
  signing: 12,
  confirming: 38,
  vrf: 68,
  settling: 92,
  done: 100,
};

const SETTLE_POLL_MS = 4_000;
const SETTLE_TIMEOUT_MS = 180_000;

type WriteContractAsync = (args: {
  address: Hex;
  abi: typeof iProofBetAbi;
  functionName: "placeBet";
  args: readonly [GameType, bigint, Hex, { target: bigint; rows: number; risk: number }];
}) => Promise<Hex>;

/** Extract the requestId from the BetPlaced log in our own placeBet receipt. */
function requestIdFromReceipt(receipt: TransactionReceipt): bigint {
  const logs = parseEventLogs({
    abi: iProofBetAbi,
    eventName: "BetPlaced",
    logs: receipt.logs,
  });
  const placed = logs[0];
  if (!placed) throw new Error("placeBet receipt missing BetPlaced event");
  return (placed.args as { requestId: bigint }).requestId;
}

interface SettledArgs {
  requestId: bigint;
  vrfWord: bigint;
  finalSeed: Hex;
  outcome: bigint;
  payout: bigint;
  win: boolean;
}

/** Poll BetSettled for `requestId` from `fromBlock` until found or timeout. */
async function waitForSettled(
  publicClient: PublicClient,
  requestId: bigint,
  fromBlock: bigint,
): Promise<SettledArgs> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const events = await publicClient.getContractEvents({
      address: proofBetContract.address,
      abi: iProofBetAbi,
      eventName: "BetSettled",
      args: { requestId },
      fromBlock,
      toBlock: "latest",
    });
    const hit = events[0];
    if (hit) return hit.args as unknown as SettledArgs;
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for VRF settlement (BetSettled)");
    }
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
  }
}

export async function placeBetLive(opts: {
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  game: GameType;
  stakeWei: bigint;
  clientSeed: Hex;
  params: BetParams;
  /** Fired as each real await boundary is crossed (drives the pending toast). */
  onProgress?: (stage: BetStage) => void;
}): Promise<LiveBetResult> {
  const {
    publicClient,
    writeContractAsync,
    game,
    stakeWei,
    clientSeed,
    params,
    onProgress,
  } = opts;

  // "signing" covers the brief maxBet read (~300ms) plus the wallet prompt.
  // The UI cap is derived from a fp-truncated bankroll, so a stake at the
  // displayed max can land a hair above the contract's wei cap → BetTooLarge.
  // Clamp to the on-chain maxBet (the source of truth) to never revert at max.
  onProgress?.("signing");
  const contractMax = (await publicClient.readContract({
    address: proofBetContract.address,
    abi: iProofBetAbi,
    functionName: "maxBet",
    args: [game, { target: params.target, rows: params.rows, risk: params.risk }],
  })) as bigint;
  const finalStakeWei = stakeWei > contractMax ? contractMax : stakeWei;

  // wagmi's writeContractAsync resolves when the user confirms and the tx is
  // BROADCAST (not when mined) — so this await is the signing→confirming boundary.
  const txHash = await writeContractAsync({
    address: proofBetContract.address,
    abi: iProofBetAbi,
    functionName: "placeBet",
    args: [
      game,
      finalStakeWei,
      clientSeed,
      { target: params.target, rows: params.rows, risk: params.risk },
    ],
  });

  // Tx is broadcast; now wait for it to be mined (~12–24s, 1–2 Sepolia blocks).
  onProgress?.("confirming");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const requestId = requestIdFromReceipt(receipt);

  // requestId known → the async VRF callback is the long wait (~30s–2min).
  onProgress?.("vrf");
  const settled = await waitForSettled(publicClient, requestId, receipt.blockNumber);

  // BetSettled observed — balances are written, round is final.
  onProgress?.("settling");

  return {
    requestId,
    txHash,
    vrfWord: settled.vrfWord,
    finalSeed: settled.finalSeed,
    outcomeX100: settled.outcome,
    payout: settled.payout,
    win: settled.win,
  };
}

interface PlacedArgs {
  requestId: bigint;
  gameType: number;
  stake: bigint;
  clientSeed: Hex;
  nonce: bigint;
  params: { target: bigint; rows: number; risk: number };
}

/**
 * Reconstruct a full round from its placeBet tx hash alone — for cold-loading
 * `/verify/[txHash]` with no in-memory session. The round is the union of the
 * BetPlaced log (inputs) and the BetSettled log (result); path/slot are
 * recomputed via the shared engine. Returns null if the tx isn't a settled bet.
 */
export async function loadRoundByTxHash(
  publicClient: PublicClient,
  txHash: Hex,
): Promise<MockRound | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  const placedLogs = parseEventLogs({
    abi: iProofBetAbi,
    eventName: "BetPlaced",
    logs: receipt.logs,
  });
  const placed = placedLogs[0];
  if (!placed) return null;
  const p = placed.args as unknown as PlacedArgs;

  const settled = await waitForSettled(publicClient, p.requestId, receipt.blockNumber);

  const game: GameType =
    p.gameType === GameType.Plinko ? GameType.Plinko : GameType.Limbo;
  const params: BetParams = {
    target: p.params.target,
    rows: p.params.rows,
    risk: p.params.risk as Risk,
  };
  const s = settleRound(game, settled.vrfWord, p.clientSeed, p.nonce, params, p.stake);

  return {
    requestId: String(p.requestId),
    txHash,
    vrfWord: settled.vrfWord,
    clientSeed: p.clientSeed,
    nonce: p.nonce,
    game: game as 0 | 1,
    stake: weiToFp(p.stake),
    params: { target: p.params.target, rows: p.params.rows, risk: p.params.risk },
    finalSeed: settled.finalSeed,
    outcomeX100: settled.outcome,
    win: settled.win,
    payout: weiToFp(settled.payout),
    path: s.path,
    slot: s.slot,
  };
}
