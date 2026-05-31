# proof.bet — Stack & Architecture (LOCKED)

> *A casino with nothing up its sleeve.*
> Provably-fair Limbo on Ethereum testnet, where verifying the house is a first-class feature, not a footnote.

**These decisions are frozen for the 48h build. Do not re-litigate during the race.**
Last verified: 29 May 2026.

---

## 0. Identity

| | |
|---|---|
| **Name** | proof.bet |
| **Tagline** | *Every bet, with proof.* (primary, per the built design) · footer easter-egg: *The house always wins. Now you can prove it.* |
| **Concept** | Premium-fintech-grade casino (Linear/Stripe feel, not neon Vegas) whose hero feature is a "Verify this round" drawer that walks a paranoid player through proving each outcome on-chain. |
| **Games** | Limbo + Plinko (two games, one shared provable-fairness engine) |
| **Chain** | Ethereum — Sepolia testnet |
| **Randomness** | Chainlink VRF V2.5 (native ETH payment) |

---

## 1. Why these choices (for the README later)

- **Ethereum/Sepolia over Solana/devnet:** far more docs, examples, and battle-tested provably-fair patterns. With 2 days in unfamiliar territory, depth of reference beats novelty. Solana is cooler on paper but Rust/Anchor + Switchboard/ORAO VRF adds risk we can't absorb.
- **Chainlink VRF over block-based randomness:** `block.prevrandao`/`blockhash` are validator-manipulable — a paranoid player would call that out instantly. VRF returns a random word *with cryptographic proof* it wasn't predictable or tampered with. This is the honest answer to the task's core ask.
- **Limbo + Plinko on one VRF engine:** both derive from a single random word via an open formula, so the second game reuses the *entire* provably-fair + Verify stack instead of duplicating it. Limbo = one number vs a target (player sets risk on a slider). Plinko = a ball path derived from the same seed, landing in a multiplier bucket. Two games, one trust layer — this is the §10 roadmap ("more games on one Verify engine") pulled to launch.

---

## 2. Smart contract stack (the "backend")

| Layer | Choice | Pinned |
|---|---|---|
| Toolchain | **Foundry** (`forge`, `cast`, `anvil`) | latest |
| Language | **Solidity** | `0.8.24` |
| Randomness | **`@chainlink/contracts`** — `VRFConsumerBaseV2Plus` | `^1.5.0` |
| Safety libs | **OpenZeppelin** (`ReentrancyGuard`, `Ownable`, `ERC20`) | `^5.x` |

**Import paths (VRF V2.5):**
```solidity
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient}        from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
```

**Sepolia VRF V2.5 config (hard-code these):**
| Param | Value |
|---|---|
| VRF Coordinator | `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` |
| Key hash (gas lane) | `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` |
| `requestConfirmations` | `3` (Sepolia minimum) |
| `callbackGasLimit` | **`250000`+** (under-funding silently fails the callback) |
| `nativePayment` | `true` (pay in Sepolia ETH → no LINK faucet needed) |

> Install for Foundry via npm + remappings (Chainlink's recommended path), **not** `forge install`:
> `npm i @chainlink/contracts @openzeppelin/contracts`
> then add to `remappings.txt`:
> `@chainlink/contracts/=node_modules/@chainlink/contracts/`
> `@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/`

**Contracts to ship:**
1. `Proofs.sol` — mintable ERC20 test token, name `Proofs` / symbol `PRF`, with a public `faucet()` ("Get 1000 Proofs"). The in-game token; name ties it to the verify theme. Not real money, not tETH — tETH only pays gas.
2. `ProofBet.sol` — `VRFConsumerBaseV2Plus` + `ReentrancyGuard`: deposit / withdraw, `placeBet`, `fulfillRandomWords`, edge logic, max-bet cap vs. bankroll. (Solidity identifier `ProofBet` — the `proof.bet` brand can't be a contract name because of the dot.) One contract serves both games: `placeBet` takes a `gameType` (Limbo | Plinko) + game params; `fulfillRandomWords` routes to the per-game settlement formula. Single bankroll, single VRF subscription, shared deposit/withdraw — only the outcome math forks.

**Non-negotiable contract safety:**
- Checks-Effects-Interactions + `ReentrancyGuard` on withdraw.
- Max bet capped relative to house bankroll (never accept a bet you can't pay out). **Per game:** the cap must cover each game's *worst-case* payout — for Plinko that's the highest-multiplier edge bucket, not the average.
- Add the deployed contract as a **consumer** on the VRF subscription, or every bet reverts.
- `forge test` covering outcome math (**both games**), edge, and reentrancy **before** touching the frontend.

---

## 3. Frontend stack (the "client")

| Layer | Choice | Pinned |
|---|---|---|
| Framework | **Next.js** (App Router) | latest stable |
| Chain hooks | **wagmi** | `^3.x` (currently 3.6.x) |
| Low-level client | **viem** | `^2.x` (currently 2.5x) |
| Async state | **@tanstack/react-query** | peer dep of wagmi |
| Styling | **Tailwind CSS** | latest |
| Motion | **framer-motion** (spring physics) | latest |
| Wallet connect | **Custom flow built on wagmi `useConnect`/`useAccount`** | — |

> **Deliberately NOT using RainbowKit / ConnectKit defaults.** Their modals are instantly recognizable = "generic Claude build". A hand-rolled connect on raw wagmi hooks is the cheapest, highest-signal way to not look like everyone else.

**Core wagmi hooks:**
- `useConnect` / `useAccount` / `useSwitchChain` — connect + force Sepolia.
- `useReadContract` — balances, bankroll, max bet.
- `useWriteContract` (+ `useSimulateContract`) — faucet, deposit, withdraw, placeBet.
- `useWatchContractEvent` — listen for `BetPlaced` / `BetSettled`.

**framer-motion notes:** springs everywhere, no linear tweens, honor reduced-motion. Use it for the climbing-number money-shot (Limbo) and the Plinko ball drop.

### 3.1 Routes & navigation (LOCKED)

Full screens stay pages; **actions become drawers** (overlays over the app) but keep real URLs with a full-page fallback on direct hit / refresh.

| URL | Type | Behavior |
|---|---|---|
| `/` | Page | Landing |
| `/connect` | Page | Connect wallet, force Sepolia |
| `/games` | Page | Catalog: Limbo, Plinko |
| `/games/[game]` | Page | Game table — `/games/limbo`, `/games/plinko` |
| `/verify` | Page | Auditor — paste any tx hash |
| `/faucet` | **Drawer** | "Get 1000 Proofs" → wallet |
| `/deposit` | **Drawer** | Wallet → In play |
| `/withdraw` | **Drawer** | In play → Wallet |
| `/verify/[txHash]` | **Drawer** | Verify a single round + shareable proof link |

**Pattern: parallel route + intercepting routes.** A `@modal` slot in the root layout holds overlays; `(.)` intercepting routes render those URLs as a drawer when navigated to *inside* the app, and as a full page on direct load / refresh. Each drawer URL therefore lives twice — intercepted (overlay) and plain (fallback).

```
app/
├─ layout.tsx                      // renders {children} and {modal}
├─ page.tsx                        →  /
├─ @modal/
│  ├─ default.tsx                  // null when no overlay
│  ├─ (.)faucet/page.tsx           →  /faucet    as drawer
│  ├─ (.)deposit/page.tsx          →  /deposit   as drawer
│  ├─ (.)withdraw/page.tsx         →  /withdraw  as drawer
│  └─ (.)verify/[txHash]/page.tsx  →  /verify/<hash> as drawer
├─ connect/page.tsx                →  /connect
├─ faucet/page.tsx                 →  /faucet    (fallback: full page)
├─ deposit/page.tsx                →  /deposit   (fallback)
├─ withdraw/page.tsx               →  /withdraw  (fallback)
├─ games/
│  ├─ page.tsx                     →  /games
│  └─ [game]/page.tsx              →  /games/limbo, /games/plinko
└─ verify/
   ├─ page.tsx                     →  /verify          (Auditor, full)
   └─ [txHash]/page.tsx            →  /verify/<hash>    (fallback)
```

- Open a drawer via `<Link>` / `router.push`; the game table stays mounted underneath (parallel route doesn't unmount it).
- Close via `router.back()` (Esc / scrim click / ×) → returns to the originating URL.
- Drawers are client components owning tx state (pending / confirmed / error); because the background never unmounts, the table's `useWatchContractEvent` subscriptions keep running while deposit/withdraw is open.
- `/verify` (Auditor) is a standalone page, not a drawer. `/verify/[txHash]` is the per-round drawer — direct links / shares open it as a full page.

**Mapping to the built design.** The Claude Design prototype is a single-page React app with **state-based screens** (`landing · connect · catalog · limbo · plinko · auditor · errors`), not URL routing — that's expected for a prototype. Map them to the routes above when building in Next.js. Confirmed behaviors to preserve: top-nav labels **Games / Audit / States**; after connect it lands on **catalog with the faucet drawer auto-open**; the Verify drawer opens via a **"Verify this round"** button (not auto); a browsable **"States"** error gallery exists as a showcase screen (in production these are contextual states, not a standalone page).

---

## 4. Provably-fair design (LOCKED — this is the differentiator)

Outcome derivation is **deterministic and public** — the *same* seed feeds both games:
```
finalSeed  = keccak256(vrfRandomWord, clientSeed, nonce)
Limbo:   multiplier = f(finalSeed)              // open formula, see §5
Plinko:  bits = expand(finalSeed) → ball path → bucket → multiplier   // see §5
```

- **Client seed:** player sets/rerolls their own seed, mixed in on-chain → the house *cannot* have known the result in advance, by construction.
- **Verify drawer (per round):** shows `requestId`, the raw VRF random word, the formula, a **"Recompute in your browser"** button (frontend independently re-derives the outcome from on-chain data and shows it matches), and a deep-link to the exact Etherscan tx.
- **Auditor page:** paste any tx hash (even someone else's) → app recomputes and proves the outcome. 
- **Contract is verified on Etherscan** (a paranoid player reads the source).

---

## 5. Game math (LOCKED)

Both games share `finalSeed = keccak256(vrfRandomWord, clientSeed, nonce)` and a **2% house edge shown openly** in the UI ("House edge 2% — we don't hide it"). Each outcome is one short, reproducible computation → ideal for the Verify drawer.

**Limbo**
- Player picks a **target multiplier** via slider (e.g. 1.01x → 1000x).
- A random **result multiplier** is derived from `finalSeed`.
- **Win** if `result ≥ target` → payout = `stake × target`. Else lose stake.
- House edge applied in the result distribution.

**Plinko**
- Player picks a **risk profile** (rows + low/med/high) → selects the payout table.
- Expand `finalSeed` into **N bits** (N = number of rows). Each bit = ball bounces left (0) / right (1) at one peg.
- Final **bucket = count of rights** (0…N). Binomial distribution → center buckets common (low multiplier), edge buckets rare (high multiplier).
- Payout = `stake × multiplier[bucket]`. House edge **baked into the multiplier table** (Σ probability × multiplier = 0.98), not a separate cut.
- Verifiable identically: anyone re-expands `finalSeed` into the same bit path and lands in the same bucket.

---

## 6. Infra & deploy

| | |
|---|---|
| Frontend host | **Vercel** (public URL) |
| RPC | Alchemy or Infura Sepolia endpoint (env var) |
| Repo | GitHub (public or invite-only) |
| Faucets needed | Sepolia ETH only (multiple faucets) — **no LINK**, thanks to native VRF payment |
| Env vars | `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_PROOFS_ADDRESS`, deployer `PRIVATE_KEY` (contracts only, never client) |

---

## 7. Design direction (LOCKED — matches the built design)

- Dark, **neutral** base (not purple-gold Vegas) + **one** accent color.
- **Serif display** font for headlines + **monospace** for all numbers/hashes (fintech-luxe; mono signals "raw data lives here").
- framer-motion **spring** easing everywhere, no linear tweens.
- No default glassmorphism — a restrained iOS-26-style liquid-glass material only on interactive chrome. Restraint = the pattern-interrupt.

**Concrete tokens (source of truth = the design's `styles/tokens.css`):**
- Fonts: serif headlines **Fraunces**; all data **Geist Mono**; UI/sans **Geist**; brand wordmark **Syne** (heavy lowercase — `proof` in ink + `.bet` in accent).
- Palette: bg `#0A0B0D`, surfaces `#121316` / `#16181C` / `#1C1F24`, ink `#ECECEE` / `#9A9DA4` / `#5E626B`, accent `#5FE3C0` (deep `#2FB89A`), loss `#B7787A` (quiet, never alarming). Glass tint `rgba(20,22,27,~.55)`, blur ~18px, driven by a single `--glass-k`.

**Light features that punch above their cost (do these):**
- Pending state as narrative: real on-chain progress (`requesting entropy → oracle responded → settling`) instead of a dead spinner — turns VRF latency into a trust moment.
- Live **house bankroll meter** + derived max bet.
- Sound design on bet/win/lose.
- A nod to **responsible gaming** (session-time nudge, e.g. "you've been playing for 45 minutes") — an iGaming jury will notice.
- Language selector (EN / RU / UA) present in the built design — keep copy localizable.

---

## 8. Out of scope (protect the 48h — do NOT build)

- A **third** game (beyond Limbo + Plinko). Two ship; resist a third.
- Multiplayer / leaderboards / chat.
- Mainnet anything, real tokens, real money.
- Account system / off-chain DB (wallet is the account).
- Mobile-native app (responsive web only).
- Smart-contract upgradeability/proxies.

---

## 9. First commands

```bash
# contracts
forge init proofbet-contracts
cd proofbet-contracts
npm i @chainlink/contracts @openzeppelin/contracts
# (add remappings.txt as in §2)

# frontend
npx create-next-app@latest proofbet-app   # TS + Tailwind + App Router
cd proofbet-app
npm i wagmi viem @tanstack/react-query framer-motion
```
