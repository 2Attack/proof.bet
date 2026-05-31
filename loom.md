# Loom script (5 minutes) — proof.bet

> Recording format: show the product flow + talk through **one thing I didn't know before**
> and how I dealt with it. Below: timing, what to show on screen, and what to say.

**proof.bet** — a provably-fair crypto casino on Ethereum Sepolia. Two games (Limbo + Plinko)
on one shared fairness engine. The hero feature: a **"Verify this round"** drawer that
recomputes each round's result right in the player's browser from on-chain data.
Tagline: *"Every bet, with proof."*

Live: https://proofbet.vercel.app

---

## 0:00–0:30 — Intro (camera + screen)

- "Hi, this is proof.bet — a provably-fair casino on Sepolia. Built in 48 hours: two smart
  contracts, Chainlink VRF for fair randomness, and a Next.js frontend deployed on Vercel."
- "I'll walk through the full player flow, then dig into one thing I didn't know going in that
  gave me real trouble — how I diagnosed it and fixed it."
- On screen: the homepage open at https://proofbet.vercel.app

## 0:30–1:15 — Connect + two currencies

- Click **Connect** → MetaMask (Sepolia).
- Show the two balances in the header: **Wallet (PRF)** and **In play**.
- "The two currencies are deliberately separated: tETH is gas only — you can't bet it.
  **Proofs (PRF)** is the only betting currency. There's no tETH→PRF conversion."
- Click **Faucet** → claim 1000 PRF. Show the Wallet balance update.

## 1:15–1:45 — Deposit (Wallet → In play)

- Open the **Deposit** drawer, move some PRF "into play."
- "Deposit is approve + transfer into the contract. The In-play balance now lives inside the
  contract. To get it back, you withdraw — pull, not push."

## 1:45–2:45 — Playing: Limbo and Plinko

- **Limbo**: place a bet, set the target multiplier, hit Bet. Show the pending toast: signing →
  confirming → **waiting for VRF** → settling. "This long pause is the real, asynchronous
  Chainlink VRF callback — about 30 seconds. We don't fake it — the ticking counter shows an
  honest wait."
- **Plinko**: place a bet, the ball drops through the grid and lands in a multiplier bucket.
- Emphasize: **one contract serves both games** — `placeBet(gameType)`, and
  `fulfillRandomWords` routes to the right settlement formula.

## 2:45–3:15 — The hero feature: Verify this round

- Open the **Verify** drawer on a settled round.
- "This is the core of the product. We take the `vrfWord` from on-chain, the client seed (the
  player sets it), and the nonce, and compute `finalSeed = keccak256(vrfWord, clientSeed, nonce)`
  — **right in the browser** — and compare it to what the contract recorded. We see '✓ matches.'
  The contract is verified on Etherscan."
- "The line: *The house always wins. Now you can prove it.*"

## 3:15–5:00 — One thing I didn't know: an RPC rate-limit and why fallback didn't save me

This is the most valuable part — I tell it as problem → hypothesis → fix.

**Symptom.** On `/games/plinko`, the Network tab showed a flood of requests to Infura and
periodic **HTTP 429 "Too Many Requests."** The header balances flickered / froze.

**What I didn't know (two surprises):**

1. **Infura answers a rate-limited *batch* with HTTP 200 and a malformed body.**
   When several JSON-RPC calls are coalesced into one batch request and hit the limit, Infura
   returns not a 429 but `200 OK` with an array `[{"code":-32005,"message":"Too Many Requests"}]`
   — no `result`. viem reads `result` as `undefined` and throws "Cannot convert undefined to a
   BigInt." And because the HTTP status is 200, the `fallback` transport **doesn't fail over** to
   the backup node. → So I had to turn off transport-level `batch: true` (keeping only
   `batch:{multicall:true}` at the app level). With batching off, the same limit comes back as an
   honest 429, and fallback correctly switches to publicnode.

2. **viem event filters are incompatible with a `fallback()` transport.** This was the main
   source of the 429 on the game pages. My `AppContext` had **four** `useWatchContractEvent`
   hooks (Transfer / Deposit / Withdraw / BetSettled). On an HTTP transport each one polls, and:
   - all four fired **on the same tick** → a burst of ~5 requests every 5 seconds;
   - `eth_newFilter` creates a **stateful filter bound to a specific node**. When Infura returns
     429 and `fallback` switches to publicnode, that filter doesn't exist there → "filter not
     found" → viem recreates the filter → another request → feeding the same rate-limit loop.

**How I worked it out.**
- First I ruled out the obvious: confirmed React Query was already tuned (`staleTime`, no
  refetch-on-focus) and that the Plinko page itself has no extra reads (`maxBet` is a pure
  function).
- I checked in `node_modules` whether `useWatchContractEvent` re-subscribes when `onLogs`
  changes — it **doesn't**; it ref-stabilizes the callback. So there's no re-subscribe storm; the
  problem is the steady filter polling plus its incompatibility with fallback.

**The fix.** I replaced the 4 event watchers with **one stateless `eth_blockNumber` watch**
(`useBlockNumber({ watch: true })`) and refetch balances when a new block appears. Why this is
right:
- `eth_blockNumber` is stateless and works identically on any node → **fallback-safe** (no
  "filter not found");
- one request per tick instead of a burst of five;
- the refetch coalesces into **a single `eth_call`** via multicall3.

**One-line takeaway for the Loom:** "I assumed it was about polling frequency, but it turned out
stateful event filters are fundamentally incompatible with a fallback transport — and Infura even
masks the rate limit as a 200 OK. The cure is switching to stateless block-number polling."

---

### Recording tips
- Keep two tabs open: the live site and DevTools → Network (show "before/after" by request count).
- Pacing: flow ~3 minutes, technical deep-dive ~2 minutes.
- Don't dive into Solidity — focus on the UX flow + one technical insight.
