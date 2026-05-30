# @proofbet/shared — the seam

Single source of truth shared by `/contracts` and `/app`. **Framework-agnostic**
(no React, no wagmi). If you change anything here, both tracks must agree and the
golden vectors must be regenerated.

## What lives here

| Path | Purpose | Consumed by |
|---|---|---|
| `src/types.ts` | `GameType`, `Risk`, `BetParams`, `Round`, fixed-point + rows constants | both |
| `src/fairness/` | **frozen** provably-fair engine (seed, Limbo, Plinko, `settleRound`) | app (Verify drawer), vector gen |
| `src/tables/plinko-tables.json` | 27 frozen ×100 multiplier tables (rows 8–16 × low/med/high) | app, contract (generated from this), vectors |
| `src/tables/plinko-edges.json` | per-table house edge (display only) | app |
| `src/vectors/golden.json` | `{inputs} → {finalSeed, outcome, payout, …}` truth set | `forge test` |
| `src/abi/*.ts` | **codegen** `as const` ABIs (from `forge build`) | app |
| `src/addresses.ts` | deployed addresses per chain (filled at deploy) | app |

## The seam contract (do NOT drift)

```
finalSeed = keccak256(abi.encode(uint256 vrfWord, bytes32 clientSeed, uint256 nonce))

Limbo:  h = uint256(finalSeed) >> 204            # top 52 bits
        if h % 50 == 0 -> crash 1.00× (instant-bust, the 2% edge)
        else crashX100 = floor((100·2^52 - h) / (2^52 - h)), clamped [100, 100_000_000]
        win = crashX100 >= targetX100 ;  payout = win ? stake·target : 0

Plinko: x = uint256(finalSeed) >> 64             # top 192 bits
        bit k = (x >> k) & 1   (1=right, 0=left) ;  slot = popcount of first `rows` bits
        multiplierX100 = plinko-tables.json[rows][risk][slot]   # 2% edge baked in (EV=0.98)
        payout = stake·multiplier
```

All multipliers/targets/crashes are **×100 integer fixed-point**. Verified: the EVM
`cast keccak(abi.encode(...))` reproduces `deriveFinalSeed` byte-for-byte.

## Regenerate (only with a reviewed change)

```bash
npm run gen        # rewrites plinko-tables.json + golden.json
npm run typecheck
```

The `/contracts` track generates its Solidity table **from** `plinko-tables.json`
and proves equality in `forge test` against `golden.json`. The `/app` track imports
`fairness` directly so the Verify drawer's "✓ matches" is a real recomputation.
