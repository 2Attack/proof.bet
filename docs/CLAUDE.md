# proof.bet — project context (read this first)

A **provably-fair crypto casino** on Ethereum **Sepolia** testnet, two games (**Limbo + Plinko**)
on one shared fairness engine. Hero feature: a **"Verify this round"** drawer that re-derives
each outcome from on-chain data in the player's own browser. Positioning: premium fintech
(Linear/Stripe register) applied to gambling — calm, exact, nothing hidden. 48-hour build.

> Tagline: **"Every bet, with proof."** · footer: *"The house always wins. Now you can prove it."*

## Sources of truth (do not contradict these)

- **`STACK.md`** — the LOCKED architecture & decisions. The engineering spec. If something
  here is ambiguous, STACK.md wins; if STACK.md is silent, ask before inventing.
- **`design/`** — the Claude Design handoff bundle (HTML/CSS/JSX prototype). The **pixel-perfect
  visual target**. Read `design/project/styles/tokens.css` for exact colors/fonts, and the
  `design/project/src/*.jsx` screens for layout/behavior. Recreate the look in React/Next.js;
  do NOT copy the prototype's internal structure if it doesn't fit.
- **`DESIGN-PROMPT-PROOFBET.md`** — narrative design spec (screens, drawer model). Reference.

## Repo layout (target)

```
/contracts      Foundry project (Solidity 0.8.24)
/app            Next.js (App Router, TS, Tailwind, wagmi, viem, framer-motion)
/design         the handoff bundle (reference only — never imported by /app)
STACK.md  DESIGN-PROMPT-PROOFBET.md  CLAUDE.md
```

## Build order (phases — do them in this order)

1. **Contracts first.** `Proofs.sol` (ERC-20 test token, name `Proofs` / symbol `PRF`,
   public `faucet()` minting 1000) + `ProofBet.sol` (`VRFConsumerBaseV2Plus` +
   `ReentrancyGuard`: deposit / withdraw / placeBet(gameType) / fulfillRandomWords / edge /
   max-bet cap). **One contract serves both games** — `placeBet` takes a `gameType`
   (Limbo | Plinko), `fulfillRandomWords` routes to the per-game settlement formula.
2. **`forge test`** covering outcome math for **both games**, the 2% edge, and reentrancy —
   green before any frontend work.
3. **Deploy to Sepolia**, add the contract as a **consumer on the VRF subscription**, fund it,
   and **verify the source on Etherscan**.
4. **Frontend.** Scaffold Next.js, wire wagmi/viem to Sepolia, then build screen by screen to
   match `design/` pixel-perfectly: catalog → Limbo table → Plinko table → Verify drawer →
   economy drawers (faucet/deposit/withdraw) → landing/connect/auditor/pending/errors.

## Non-negotiables

- **Contract safety:** Checks-Effects-Interactions + `ReentrancyGuard` on withdraw (zero the
  player's balance *before* transferring). Max bet capped vs. bankroll — must cover each game's
  **worst-case** payout (for Plinko, the highest-multiplier edge bucket, not the average).
- **VRF V2.5, native ETH payment** (no LINK). `callbackGasLimit` ≥ 250000 (all settlement math
  runs inside `fulfillRandomWords`; under-funding silently fails the callback).
  `requestConfirmations` = 3. Map `requestId → bet` so the async callback knows whose round it is.
- **Two currencies, two balances.** tETH = gas only (never bet). **Proofs (PRF)** = the only bet
  unit, living in the wallet (after faucet) or **In play** (moved into the contract). No
  tETH→Proofs conversion. Keep Wallet vs In play visually distinct (mono labels).
- **Pull, not push:** the VRF callback only writes balances; players pull funds via `withdraw`.
- **Provably-fair is the product.** `finalSeed = keccak256(vrfWord, clientSeed, nonce)`; client
  seed is player-controlled; the Verify drawer recomputes in-browser and shows "✓ matches";
  contract verified on Etherscan.
- **Design fidelity.** Serif = Fraunces, mono = Geist Mono, sans = Geist, wordmark = Syne.
  ONE accent `#5FE3C0`. Numbers/hashes always mono. Text never on the liquid-glass material.
  Spring physics everywhere; honor reduced-motion.
- **Secrets:** deployer `PRIVATE_KEY` lives in `/contracts` env only — NEVER in `/app` or any
  `NEXT_PUBLIC_*` var. Client env: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`,
  `NEXT_PUBLIC_PROOFS_ADDRESS`.

## Out of scope (protect the 48h)

A third game, multiplayer/leaderboards, mainnet/real money, off-chain DB/accounts (wallet is
the account), native mobile, contract upgradeability/proxies.

## Definition of done

Connect → faucet 1000 PRF → deposit → play Limbo and Plinko (real VRF rounds) → open Verify and
see the browser recompute match → withdraw — all real Sepolia txs, contract verified on Etherscan,
deployed frontend on a public Vercel URL.
