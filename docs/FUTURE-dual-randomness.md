# Future work — dual randomness source (VRF + Pyth Entropy)

> Status: **decided, not implemented.** Post-MVP. The shipped MVP uses Chainlink
> VRF V2.5 only (as locked in `STACK.md`). This document records the agreed
> direction so it can be picked up later without re-deriving the analysis.

## Motivation

Requirement: *"The casino logic must be verifiable on-chain — a paranoid player
using a block explorer should be able to confirm it's not a scam."*

VRF satisfies this fully, but VRF settlement is asynchronous (~60s on Sepolia:
`requestConfirmations = 3` + node processing + fulfillment tx). For UX we want a
fast option (~seconds) **without** giving up on-chain verifiability.

## The constraint that drives everything

For a single outcome you cannot have all three at once:

**instant** · **explorer-verifiable** · **unmanipulable-by-validator**

Whoever builds the block sees the randomness when deciding what to include, so a
synchronous (single-tx) settle is always at least predictable to the proposer.

| Source | Latency | Explorer-verifiable | Unmanipulable |
|---|---|---|---|
| Chainlink VRF V2.5 (MVP) | ~60s on L1 | ✅ | ✅ cryptographic proof |
| `block.prevrandao` (synchronous) | ~12s on L1 (1 block) | ✅ | ⚠️ proposer can bias/predict |
| future `blockhash` | ~12–24s | ✅ | ⚠️ + only last 256 blocks |
| **Pyth Entropy** | ~2–4s **on a fast L2** | ✅ | ✅ (commit-reveal w/ provider) |

**Key fact:** ≤5s is physically impossible on Ethereum L1 (block ≈ 12s) with any
scheme. True ≤5s requires a fast L2 (Base/Arbitrum). On Sepolia L1, a Pyth path
would still be ~12–24s (faster than VRF's ~60s, but not 5s).

## Decision

Support **two pluggable randomness backends behind one settlement engine**, with
the **player choosing per bet**:

- **"Maximum integrity"** → Chainlink VRF (slow, strongest guarantee).
- **"Fast"** → Pyth Entropy (seconds on L2, still verifiable + strong).

Great product narrative for a provably-fair casino: the paranoid player picks the
bulletproof slow oracle; everyone else picks fast. Both verifiable on the explorer.

VRF stays the default/canonical source, so this is **additive** to the locked spec
rather than a replacement.

## Why it's a small change

All fairness rests on `finalSeed = keccak256(abi.encode(uint256 randomWord,
bytes32 clientSeed, uint256 nonce))` → per-game settlement math. The contract and
the browser don't care where `randomWord` came from. So:

```
placeBet(game, stake, clientSeed, params, SOURCE)   // SOURCE = Vrf | Pyth
   ├─ Vrf  → s_vrfCoordinator.requestRandomWords()  ──┐
   └─ Pyth → IEntropy.requestWithCallback{value:fee}()─┤   requestId → Bet
                                                        ▼
   fulfillRandomWords / entropyCallback → _settle(requestId, randomWord)
       (existing math, CEI, bankroll clamp, BetSettled — all unchanged)
```

### What changes
- **Contract:** add `enum RandomnessSource { Vrf, Pyth }` to the bet record;
  branch the request path in `placeBet`; add the Pyth `entropyCallback`
  (`IEntropyConsumer`); both callbacks funnel into a shared `_settle(requestId,
  word)` (refactor the current `fulfillRandomWords` body into it). Pyth charges a
  per-request fee in native ETH — `placeBet` for the Pyth path must be `payable`
  and forward `entropy.getFee(provider)`. CEI, `nonReentrant`, the insolvency
  clamp, and `maxBet` are untouched.
- **Deploy:** redeploy; wire the Pyth Entropy contract + provider for the target
  chain; keep funding the VRF subscription as today.
- **Frontend:** a source toggle on the bet panel; the live bet hook mirrors
  `placeBetLive` (request → poll/await callback) — already the established pattern.
  Surface which source produced the word in the Verify drawer.
- **Tests:** cover both request paths + the shared `_settle`.

### What does NOT change
- `packages/shared` fairness engine — **zero changes** (`randomWord` is a
  `randomWord`).
- The Verify "✓ matches" recompute — identical; it just labels the source.
- Golden vectors, seed derivation, game math, 2% edge, payout/bankroll logic.

## Open items before implementing
1. Confirm Pyth Entropy contract + default provider addresses on the target chain
   (it's on several L2 testnets; verify Ethereum Sepolia support specifically).
2. Pick the chain: **L2 (Base/Arbitrum Sepolia)** for genuine ≤5s, or stay on
   Sepolia L1 (Pyth ~12–24s) — speed is gated by block time, not the oracle.
3. Decide UI copy for the integrity-vs-speed trade so the choice reads as a
   feature, not a footnote.

## Pointers
- Locked baseline: [`STACK.md`](./STACK.md) (VRF V2.5, `requestConfirmations=3`,
  all settlement inside the VRF callback).
- Live VRF flow already implemented: `app/app/lib/live-bet.ts`
  (request → recover requestId from the `BetPlaced` log → await `BetSettled`).
- Settlement to refactor into `_settle`: `contracts/src/ProofBet.sol`
  (`fulfillRandomWords`).
