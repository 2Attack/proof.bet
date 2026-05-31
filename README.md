# proof.bet — *Every bet, with proof.*

A **provably-fair crypto casino** on Ethereum **Sepolia**. Two games — **Limbo** and
**Plinko** — run on one shared fairness engine. The hero feature is a **"Verify this round"**
drawer that re-derives every outcome from on-chain data *in your own browser*, so you never
have to trust the house.

> *"The house always wins. Now you can prove it."*

| | |
|:--|:--|
| **Live app** | https://proofbet.vercel.app/ |
| **Network** | Ethereum Sepolia (chainId `11155111`) |
| **ProofBet contract** | [`0xD07b66EE0AC7B73CFD501286F99Cb07238439992`](https://sepolia.etherscan.io/address/0xD07b66EE0AC7B73CFD501286F99Cb07238439992) — verified |
| **Proofs token (PRF)** | [`0x813693e7986a3779dA4cE7DE260c4BC30128c8B8`](https://sepolia.etherscan.io/address/0x813693e7986a3779dA4cE7DE260c4BC30128c8B8) — verified |
| **Randomness** | Chainlink VRF V2.5 (native-ETH payment) |

---

## What works

The full **Definition of Done** flow runs end-to-end on real Sepolia transactions:

> Connect → faucet 1000 PRF → deposit → play **Limbo** and **Plinko** (real VRF rounds) →
> open **Verify** and watch the browser recompute the match → withdraw.

**Smart contracts** (`/contracts` — Foundry, Solidity 0.8.24)
- `Proofs.sol` — ERC-20 test token (name `Proofs`, symbol `PRF`) with a public `faucet()`
  minting 1000 PRF.
- `ProofBet.sol` — one contract serving **both games**: `deposit` / `withdraw`,
  `placeBet(gameType)` with a `Limbo | Plinko` enum, and `fulfillRandomWords` routing to the
  per-game settlement formula. Single bankroll, single VRF subscription, shared deposit path —
  only the outcome math forks.
- **Safety:** Checks-Effects-Interactions + `ReentrancyGuard` on withdraw (balance zeroed
  before transfer); a per-game **max-bet cap** sized against the bankroll's *worst-case*
  payout (Plinko's highest-multiplier edge bucket, not the average); and an **insolvency
  clamp** in the VRF callback so a payout can never exceed the bankroll. A flat **2% house
  edge**, shown openly in the UI.
- **VRF V2.5, native ETH** (no LINK): `callbackGasLimit >= 250000`, `requestConfirmations = 3`,
  `requestId -> bet` mapping so each async callback settles the right round.
- **Tests** (`forge test`): `ProofBet.t.sol` covers both games' math, the 2% edge, reentrancy,
  and the max-bet / insolvency clamps; `Golden.t.sol` asserts settlement against shared
  **golden vectors** (see below).

**Shared fairness engine** (`/packages/shared`)
- One TypeScript source of truth for seed derivation and both games' math
  (`fairness/seed.ts`, `limbo.ts`, `plinko.ts`), the Plinko payout tables, the contract ABIs,
  and `vectors/golden.json`.
- The **golden vectors** are the linchpin: the same fixed `(vrfWord, clientSeed, nonce)` ->
  outcome cases are asserted by the Solidity tests *and* re-run by the browser. On-chain
  Solidity and in-browser TypeScript are proven to produce **byte-identical** results — that's
  what makes "Verify" trustworthy rather than decorative.

**Frontend** (`/app` — Next.js App Router, TS, Tailwind, wagmi/viem, framer-motion)
- Hand-rolled wallet connect on raw wagmi hooks (not RainbowKit), forces Sepolia.
- Routes as pages, **actions as intercepting-route drawers** (`@modal`): catalog ->
  `/games/limbo` -> `/games/plinko` -> Verify drawer -> faucet / deposit / withdraw drawers ->
  landing / connect / auditor / pending / error states.
- **Verify drawer** recomputes `finalSeed = keccak256(vrfWord, clientSeed, nonce)` in-browser
  (viem keccak matches the chain exactly) and shows **"matches"**; the client seed is
  player-controlled. A standalone **Auditor** page (`/verify`) verifies *any* tx hash.
- **Live on-chain mode** (`app/app/lib/live-bet.ts`): place bet -> recover `requestId` from the
  `BetPlaced` log -> await `BetSettled`. VRF latency is rendered as a narrative **pending** state
  (`requesting entropy -> oracle responded -> settling`) instead of a dead spinner.
- Two visually distinct balances — **Wallet** PRF vs **In play** PRF (mono labels). tETH is gas
  only; there is no tETH->PRF conversion. Pull-not-push: the callback only writes balances;
  players `withdraw`. A live **house-bankroll meter** drives a dynamic max bet.

**Deployment**
- Contracts deployed to Sepolia, added as a **consumer on the VRF subscription**, funded, and
  **source-verified on Etherscan**. Frontend deployed on **Vercel**.

---

## What doesn't (limitations & scope)

- **Testnet only.** Sepolia, no mainnet, no real money — by design.
- **VRF settlement is slow (~60s).** `requestConfirmations = 3` + node processing + fulfillment
  tx. It's rendered as a pending narrative, but it is genuinely asynchronous, and under-funding
  the subscription or callback gas would silently fail a round (mitigated by the >=250k gas limit
  + a funded sub, but it remains an external dependency).
- **Two games only.** No third game (Crash/Dice/Mines).
- **No off-chain state.** No database, no accounts (the wallet *is* the account), no
  leaderboards/multiplayer; history is only what's reconstructable on-chain.
- **Web only**, no native mobile.
- **No contract upgradeability** (no proxies) — logic changes require a redeploy.
- **External gas faucet.** Players need Sepolia tETH for gas; no gasless/paymaster path yet.

---

## Why Ethereum (not Solana)

The product *is* the verifiability, and EVM made it both stronger and faster to ship in a
48-hour build:

1. **Mature, native VRF.** Chainlink **VRF V2.5 with native-ETH payment** is well-documented and
   battle-tested on Sepolia. Provably-fair randomness is the whole premise; starting from a
   proven primitive de-risked the core. Solana would mean Rust/Anchor + a less familiar VRF
   (Switchboard/ORAO) — risk we couldn't absorb in two days. We also chose VRF over
   `block.prevrandao`/`blockhash`, which are validator-manipulable — something a paranoid player
   would (rightly) call out.
2. **The Verify drawer maps 1:1 to EVM primitives.** On-chain settlement hashes with
   `keccak256`; viem's `keccak256` in the browser reproduces it byte-for-byte. "Recompute it
   yourself and see it match" is exact, not approximate.
3. **"Verified on Etherscan" closes the trust loop.** A reader goes UI -> verified Solidity
   source -> re-derives the math themselves.
4. **Tooling velocity.** Foundry (fast tests + scripted deploy), wagmi/viem (typed contract
   I/O), and one-command Etherscan verification let contracts -> tests -> deploy -> frontend land
   inside the time box.

Solana wins on fees and latency, but for a *provably-fair* demo whose value is "trust nothing,
verify everything," randomness maturity + in-browser keccak parity + Etherscan verification were
decisive.

---

## The hardest unknown we figured out

**Closing the loop on asynchronous VRF settlement *and* proving the result outside the contract
— byte-for-byte.** Three things had to line up:

- **Async round bookkeeping.** A bet and its result are two separate transactions. We map
  `requestId -> bet` on request; the client recovers the `requestId` from the `BetPlaced` log
  and awaits `BetSettled` (`app/app/lib/live-bet.ts`), so the UI always settles the right round
  despite the gap.
- **Callback gas budgeting.** *All* settlement math runs inside `fulfillRandomWords`. With V2.5
  native payment, under-funding the callback gas doesn't revert loudly — it **silently fails**
  and the round never settles. Pinning `callbackGasLimit >= 250000`, sized against the most
  expensive path (Plinko's worst-case bucket), was the fix.
- **On-chain <-> in-browser parity.** Proving the chain right means recomputing
  `keccak256(vrfWord, clientSeed, nonce)` client-side and getting the *identical* outcome the
  contract produced. We made this provable rather than hopeful by extracting the fairness math
  into `packages/shared` and pinning **golden vectors** that the Solidity tests and the browser
  both assert against. The "matches" claim is true by construction.

Two smaller-but-genuinely-non-obvious unknowns (both fixed, both in git history):
- **RPC reliability:** Infura returns **HTTP 200 with a malformed error body** for rate-limited
  JSON-RPC *batches*, which defeats viem's fallback transport. Disabling transport-level
  batching restored correct failover.
- **Wallet UX:** MetaMask resolves a tx's human-readable method name from the **4byte directory
  only** — not Etherscan/Sourcify — so `placeBet` showed as "Contract Interaction" until the
  selector was registered.

We also reasoned through (and documented in `docs/FUTURE-dual-randomness.md`) the impossibility
triangle behind the design: no single outcome can be simultaneously *instant*,
*explorer-verifiable*, and *unmanipulable-by-the-block-proposer*. That's exactly why VRF is
slow-but-trustworthy — and why we leaned into the pending state instead of fighting it.

---

## What we'd build next

- **Dual randomness source (already designed — `docs/FUTURE-dual-randomness.md`).** Add **Pyth
  Entropy** as a second backend behind the *same* settlement engine, with the player choosing
  per bet: *Maximum integrity* -> Chainlink VRF (slow, strongest), *Fast* -> Pyth Entropy
  (seconds on an L2, still verifiable). Because all fairness rests on `finalSeed`, the contract
  just branches the request path and funnels both callbacks into a shared `_settle`;
  `packages/shared` needs **zero** changes. Best paired with an **L2 (Base/Arbitrum)** deploy,
  where sub-5s settlement is actually physically possible.
- **More games on the shared engine** — Dice, Crash, Mines — reusing `placeBet(gameType)` + the
  fairness spine.
- **Gasless onboarding** via account abstraction / a paymaster, so players never touch a tETH
  faucet.
- **Richer fairness UX** — shareable verify links, per-player nonce/round history, and a live
  auditor that streams and re-verifies recent rounds.
- **Mainnet/L2 path** with real economics, an audit, and a bug bounty.
- **Mobile** — responsive/PWA polish for phone play.

---

## Repo layout

```
/contracts        Foundry — Proofs.sol (PRF) + ProofBet.sol (VRF V2.5 + ReentrancyGuard)
                  test/ProofBet.t.sol, test/Golden.t.sol (golden-vector parity)
/packages/shared  Fairness engine: seed + Limbo/Plinko math, Plinko tables, ABIs,
                  golden vectors — the single source of truth shared by tests and browser
/app              Next.js App Router — wagmi/viem to Sepolia, the Verify drawer, live mode
/docs             STACK.md (locked spec), DESIGN-PROMPT, FUTURE-dual-randomness, CLAUDE.md
/design           Design handoff bundle (reference only — never imported by /app)
```

**Provably-fair core:** `finalSeed = keccak256(vrfWord, clientSeed, nonce)` -> per-game formula
-> outcome. The contract only writes balances (pull-not-push; players `withdraw`). The browser
re-derives the same seed from on-chain data and confirms the match.

## Running it

```bash
# Contracts
cd contracts
forge test                 # both games' math, 2% edge, reentrancy, golden vectors

# Frontend
cd app
npm install
npm run dev                # http://localhost:3000
```

**Client env** (`/app`): `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`,
`NEXT_PUBLIC_PROOFS_ADDRESS` (a working Sepolia set is committed in `app/.env.local`).
**Deployer secret** (`/contracts` only): `PRIVATE_KEY` — never in `/app` or any `NEXT_PUBLIC_*`
var.

---

*Sepolia testnet · not real money · a demonstration of provably-fair casino mechanics.*
