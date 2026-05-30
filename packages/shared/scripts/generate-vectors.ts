/**
 * Generate GOLDEN VECTORS (Phase-0 seam artifact).
 *
 * Each vector is `{vrfWord, clientSeed, nonce, params, stake}` paired with the
 * canonical `{finalSeed, outcomeX100, win, payout, (slot, path)}` from the frozen
 * shared engine. `forge test` loads this JSON and asserts the Solidity contract
 * reproduces every field — that is what lets /contracts and /app develop in
 * parallel and still agree byte-for-byte.
 *
 * Schema (forge-friendly): uint256 values are DECIMAL strings; bytes32 are hex;
 * small ordinals (rows, risk, nonce, slot) are JSON numbers; win is bool.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toHex, type Hex } from "viem";
import {
  GameType,
  Risk,
  type BetParams,
  PLINKO_ROW_RANGE,
} from "../src/types.js";
import {
  settleRound,
  limboCrashX100,
  deriveFinalSeed,
  plinkoPath,
} from "../src/fairness/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "src", "vectors");
mkdirSync(outDir, { recursive: true });

const STAKE = 1_000_000_000_000_000_000n; // 1 PRF (18 decimals)
const CLIENT_SEEDS: Hex[] = [
  keccak256(toHex("proof.bet/client-seed/alpha")),
  keccak256(toHex("proof.bet/client-seed/bravo")),
];

/** Deterministic pseudo-VRF word from an index (stands in for the oracle word). */
const vrfWordAt = (i: number): bigint =>
  BigInt(keccak256(toHex(`proof.bet/vrf/${i}`, { size: 32 })));

interface LimboVector {
  vrfWord: string;
  clientSeed: Hex;
  nonce: number;
  targetX100: string;
  stake: string;
  finalSeed: Hex;
  outcomeX100: string;
  win: boolean;
  payout: string;
}

interface PlinkoVector {
  vrfWord: string;
  clientSeed: Hex;
  nonce: number;
  rows: number;
  risk: number;
  stake: string;
  finalSeed: Hex;
  slot: number;
  outcomeX100: string;
  win: boolean;
  payout: string;
  path: number[];
}

const limbo: LimboVector[] = [];
const plinko: PlinkoVector[] = [];

const limboParams = (targetX100: bigint): BetParams => ({
  target: targetX100,
  rows: 0,
  risk: Risk.Low,
});

function pushLimbo(vrfWord: bigint, clientSeed: Hex, nonce: bigint, targetX100: bigint) {
  const params = limboParams(targetX100);
  const s = settleRound(GameType.Limbo, vrfWord, clientSeed, nonce, params, STAKE);
  limbo.push({
    vrfWord: vrfWord.toString(),
    clientSeed,
    nonce: Number(nonce),
    targetX100: targetX100.toString(),
    stake: STAKE.toString(),
    finalSeed: s.finalSeed,
    outcomeX100: s.outcomeX100.toString(),
    win: s.win,
    payout: s.payout.toString(),
  });
}

function pushPlinko(vrfWord: bigint, clientSeed: Hex, nonce: bigint, rows: number, risk: Risk) {
  const params: BetParams = { target: 0n, rows, risk };
  const s = settleRound(GameType.Plinko, vrfWord, clientSeed, nonce, params, STAKE);
  plinko.push({
    vrfWord: vrfWord.toString(),
    clientSeed,
    nonce: Number(nonce),
    rows,
    risk,
    stake: STAKE.toString(),
    finalSeed: s.finalSeed,
    slot: s.slot!,
    outcomeX100: s.outcomeX100.toString(),
    win: s.win,
    payout: s.payout.toString(),
    path: s.path!,
  });
}

// ---- broad coverage: a spread of seeds across representative params ----
const LIMBO_TARGETS = [150n, 200n, 1000n, 10000n, 100000n]; // 1.5× .. 1000×
for (let i = 0; i < 24; i++) {
  const cs = CLIENT_SEEDS[i % CLIENT_SEEDS.length]!;
  const target = LIMBO_TARGETS[i % LIMBO_TARGETS.length]!;
  pushLimbo(vrfWordAt(i), cs, BigInt(i), target);
}

const PLINKO_PARAMS: Array<[number, Risk]> = [
  [8, Risk.Low],
  [8, Risk.High],
  [12, Risk.Medium],
  [16, Risk.Low],
  [16, Risk.Medium],
  [16, Risk.High],
];
for (let i = 0; i < 30; i++) {
  const cs = CLIENT_SEEDS[i % CLIENT_SEEDS.length]!;
  const [rows, risk] = PLINKO_PARAMS[i % PLINKO_PARAMS.length]!;
  pushPlinko(vrfWordAt(1000 + i), cs, BigInt(i), rows, risk);
}

// ---- targeted edge cases (deterministic search) ----
const cs0 = CLIENT_SEEDS[0]!;

// Limbo instant-bust (h % 50 == 0 → crash 1.00×)
for (let i = 0; i < 200_000; i++) {
  const w = vrfWordAt(50_000 + i);
  if (limboCrashX100(deriveFinalSeed(w, cs0, 0n)) === 100n) {
    pushLimbo(w, cs0, 0n, 200n);
    break;
  }
}
// Limbo very high crash (>= 100×) to exercise the large branch
for (let i = 0; i < 500_000; i++) {
  const w = vrfWordAt(300_000 + i);
  if (limboCrashX100(deriveFinalSeed(w, cs0, 0n)) >= 10_000n) {
    pushLimbo(w, cs0, 0n, 200n);
    break;
  }
}
// Plinko slot extremes (all-left slot 0 and all-right slot=rows) at 8 rows
const ROWS_EDGE = 8;
let gotZero = false;
let gotMax = false;
for (let i = 0; i < 2_000_000 && !(gotZero && gotMax); i++) {
  const w = vrfWordAt(2_000_000 + i);
  const { slot } = plinkoPath(deriveFinalSeed(w, cs0, 0n), ROWS_EDGE);
  if (slot === 0 && !gotZero) {
    pushPlinko(w, cs0, 0n, ROWS_EDGE, Risk.High);
    gotZero = true;
  } else if (slot === ROWS_EDGE && !gotMax) {
    pushPlinko(w, cs0, 0n, ROWS_EDGE, Risk.High);
    gotMax = true;
  }
}

const doc = {
  meta: {
    description:
      "Golden vectors for the proof.bet fairness engine. forge test asserts the contract reproduces every field.",
    seedFormula:
      "finalSeed = keccak256(abi.encode(uint256 vrfWord, bytes32 clientSeed, uint256 nonce))",
    fixedPoint: "all *X100 fields are multiplier×100 integers",
    stakeDecimals: 18,
    rowsRange: [PLINKO_ROW_RANGE[0], PLINKO_ROW_RANGE.at(-1)],
    counts: { limbo: limbo.length, plinko: plinko.length },
  },
  limbo,
  plinko,
};

writeFileSync(join(outDir, "golden.json"), JSON.stringify(doc, null, 2) + "\n");
console.log(
  `✓ Wrote ${limbo.length} Limbo + ${plinko.length} Plinko golden vectors` +
    `${gotZero ? "" : " (WARN: no slot-0)"}${gotMax ? "" : " (WARN: no slot-max)"}.`,
);
