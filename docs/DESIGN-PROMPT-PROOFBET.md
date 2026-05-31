# Claude Design prompt — proof.bet

> **Paste into the SAME Claude Design session that already holds the current design.**
> This is a RESTRUCTURE, not a rebuild. Do NOT start from scratch and do NOT regenerate
> the visual system — keep every existing token, the liquid-glass material, the serif/mono
> pairing, the motion, and any screens that already work. Reuse what's there; only
> reorganize and extend to match the decisions below.
>
> **What actually changed and needs applying (the delta):**
> 1. **Rebrand** Houseproof → **proof.bet** (name, headers, wherever the old name appears).
> 2. **Token rename** chips → **Proofs (PRF)**, and make the two-balance model explicit.
> 3. **Second game added: Plinko** alongside the existing Limbo — same chrome, new play area.
> 4. **Drawer navigation**: faucet / deposit / withdraw / per-round verify become drawers
>    over the app (with URLs), not separate full screens.
> 5. **Economy stages** (faucet / deposit / withdraw) surfaced if the current "connect & play"
>    design skipped them.
>
> Everything else in this doc is the reference spec for *how* those pieces should look —
> apply it on top of the existing design, screen by screen, not by wiping and rebuilding.

---

## Context

Design the UI for **proof.bet** — a provably-fair crypto casino on Ethereum testnet
(Sepolia) with **two games at launch: Limbo and Plinko**, both running on one shared
provable-fairness engine. The hero feature is a **"Verify this round"** drawer that lets
a paranoid player independently re-derive each outcome from on-chain data, in their own
browser.

Primary slogan: **"Every bet, with proof."** (as in the built design). Footer easter-egg, kept: *"The house always wins. Now you can prove it."*
Positioning in one line: *premium fintech (Linear/Stripe register) applied to gambling —
calm, exact, nothing hidden.*

## The anti-brief (avoid at all costs)

This must NOT look like a generic crypto site. Explicitly avoid:
- Neon purple→gold gradients, glowing nodes, hexagons, "matrix" code, slot-machine sparkle.
- Cliché 2021 glassmorphism (frosted card on a rainbow blur).
- A stock wallet-connect modal that looks like RainbowKit / ConnectKit.
- Loud, busy, casino-energy layouts. Restraint is the whole point — including Plinko,
  which must read as a precise instrument, not an arcade toy.

## Visual system (already LOCKED — reuse as-is, do not regenerate)

These tokens already exist in the current design. Keep them exactly; they're restated only
so new surfaces (Plinko, the economy drawers) inherit the same system. Do not re-derive or
"refresh" them.

**Color** — dark, neutral, disciplined. Exactly ONE accent.
- Base background near-black neutral `#0A0B0D`. Elevated surfaces `#121316`, `#16181C`.
  Hairline borders at low-opacity white.
- Text: off-white primary `#ECECEE`, muted secondary `#9A9DA4`.
- Single accent = "verified" cool green-cyan `#5FE3C0` — used sparingly: confirm/verify/win,
  slider fill, the landed Plinko bucket, key CTAs. Never introduce a second hue.
- Win = accent green. Loss = a desaturated neutral or restrained red, quiet, never alarming.

**Typography**
- Headlines: a refined **serif display**, large, confident, sparse.
- Everything numeric — balances, multipliers, hashes, addresses, request IDs, payout
  tables, bucket values: **monospace** (Geist Mono / JetBrains Mono). Serif + mono, no
  generic sans for numbers — this pairing is the signature.

**Material — Liquid Glass** (Apple iOS-26 interpretation, NOT old glassmorphism)
- Dynamic translucent material with subtle refraction, depth, a thin specular edge.
- ONLY on interactive chrome: bet panel, drawers, balance pills, toggles, connect surface.
- **Text always sits on solid layers, never directly on glass.** Glass frames content.
- Dark-tinted and restrained — it makes the interface recede and the data step forward.

**Motion** — spring physics everywhere (framer-motion), no linear tweens. Confident,
physical, never bouncy-cartoonish. Honor reduced-motion.

**Background** — a slow, dark, near-monochrome abstract drift, low-contrast, far behind a
solid content layer. A quiet backdrop, never a hero video. Must not compete with text.

## Token & money model (CRITICAL — get this exactly right)

Two currencies, two balances. The UI must teach this without a paragraph of explanation:

- **tETH (Sepolia test ETH)** = gas only. Pays transaction fees. Never bet, won, or
  withdrawn. Show it quietly as a small "gas" indicator — never a primary balance.
- **Proofs (ticker `PRF`)** = the only thing the player bets. The in-game ERC-20 test
  token. No price, NOT converted from tETH — there is no tETH→Proofs conversion anywhere.

Proofs live in two places, kept visually distinct (labels in mono):
- **Wallet** — Proofs in MetaMask (after faucet, before deposit).
- **In play** — Proofs moved into the proof.bet contract; bets draw from this, wins pay
  into it.

A first-timer should glance and understand: "my Proofs are either in my wallet or in the
game, and tETH is just fuel." Never collapse Wallet and In-play into one number.

## Navigation model (LOCKED)

Full screens are **pages**; actions are **drawers** over the app (liquid-glass), each with
a real URL and a full-page fallback on direct load / refresh. The game table stays visible
(and live) behind an open drawer.

| URL | Type |
|---|---|
| `/` Landing · `/connect` · `/games` catalog · `/games/limbo` · `/games/plinko` · `/verify` Auditor | **Page** |
| `/faucet` · `/deposit` · `/withdraw` · `/verify/[txHash]` per-round proof | **Drawer** |

Drawers open from the game chrome (faucet/deposit/withdraw from the balance area; per-round
verify auto-slides after a round). Close returns to the originating screen. The Auditor
(`/verify`) is a standalone page; the per-round Verify (`/verify/[txHash]`) is a drawer that
opens as a full page when shared/linked directly.

## Screens & surfaces to design

**1. Landing (`/`)** — quiet dark page. Headline *"Every bet, with proof."* in the serif.
Subtle moving backdrop. One primary CTA (Connect / Enter). Footer easter-egg in mono:
*"The house always wins. Now you can prove it."* Restraint over hero-clutter.

**2. Connect (`/connect`, custom — not a stock modal)** — hand-built wallet-connect surface
in liquid glass. Detects wrong network, offers one-tap **"Switch to Sepolia."** Bespoke, not
a dropped-in library modal.

**3. Game catalog (`/games`)** — two cards: **Limbo** and **Plinko**, equal weight, same
visual language. Each card hints at its mechanic (Limbo = a number vs a target; Plinko = a
ball path into buckets) and shows it shares the same Verify guarantee. Persistent balance
chrome (Wallet / In play / gas) visible here too.

**4a. Limbo table (`/games/limbo`)**
- Large **target-multiplier slider** (1.01x → 1000x); chosen target huge, in mono; fill in accent.
- Stake input (mono), Place Bet CTA, drawing from **In play**.
- Live **house bankroll meter** + derived **max bet** as honest data.
- Openly-displayed **"House edge 2% — we don't hide it."** chip.
- Result: a single number that **climbs with spring physics**, settles to win (accent) or
  loss (quiet neutral). The money-shot — make win/lose feel earned.

**4b. Plinko table (`/games/plinko`)**
- A **risk-profile selector** (rows count, e.g. 8/12/16, and low/med/high) that swaps the
  **payout table** — show the multiplier-per-bucket row in mono, edges high, center low.
- A clean **peg board** in the restrained palette (precise, not neon/arcade). Stake input
  (mono), Place Bet from **In play**.
- Same bankroll meter, max bet, and 2% house-edge chip as Limbo.
- Result: the **ball drops with spring physics**, bounces down the pegs, lands in a bucket;
  the landed bucket lights in the accent on win, quiet neutral on loss. This is Plinko's
  money-shot — equal care to Limbo's climbing number.
- Both games must feel like siblings: same chrome, same trust surfaces, only the play area differs.

**5. Pending state — "pending as narrative"** (shared by both games) — instead of a spinner,
a 3-step on-chain progress: **requesting entropy → oracle responded → settling**, each step
ticking from a real event. Turns the ~30–120s VRF latency into a trust ritual. Mono labels,
calm motion. For Limbo the number is poised to climb; for Plinko the ball is poised to drop.

**6. Faucet drawer (`/faucet`)** — calm, single-action liquid-glass drawer. Serif headline,
primary **"Get 1,000 Proofs"** in accent. Mono microcopy making the model explicit:
`Free test Proofs · not real money · tETH only pays gas`. On tap: honest on-chain states
`minting → confirmed`, then the count climbs into **Wallet** with spring. Offers **Deposit** next.

**7. Deposit drawer (`/deposit`)** — moves Proofs **Wallet → In play**. Two labeled balances
(mono) with a directional, accent affordance between them. Amount input + quiet **"Deposit all"**.
States `awaiting signature → pending → confirmed`; on confirm, animate Proofs leaving Wallet
and arriving In play (numbers move in opposite directions, one continuous transfer).

**8. Withdraw drawer (`/withdraw`)** — mirror of deposit, **In play → Wallet**. Primary
**"Withdraw all"** (MVP withdraws full balance). Understated mono reassurance:
`Protected withdrawal · balance cleared before transfer`. Same spring transfer animation.

**9. Verify drawer (`/verify/[txHash]`)** — the centerpiece, slides out after a round (works
for BOTH games). In mono, clearly labeled:
- VRF **request ID**, the **raw random word** the oracle returned on-chain,
- the player's **client seed** (with a reroll affordance),
- the **open formula** `finalSeed = keccak256(vrfWord, clientSeed, nonce)` →
  Limbo: a multiplier · Plinko: a bit-path → bucket → multiplier,
- a primary **"Recompute in your browser"** button → the browser-derived result matching the
  contract's; design the satisfying **"✓ matches"** reveal in the accent,
- a **"View on Etherscan"** deep-link.
The proof layout adapts to the game (multiplier vs bucket path) but keeps one identical frame.

**10. Auditor page (`/verify`)** — paste any tx hash (even a stranger's) → recompute and prove
that outcome, for either game. Focused, single-input, data-forward layout.

**11. Error states** — legible, calm, never alarming: rejected tx, insufficient gas, wrong
network, bankroll cap hit, insufficient In-play balance. Each: a one-line explanation + the
obvious next action.

**12. Responsible-gaming nudge** — a small, tasteful session-limit reminder surface. A
maturity signal, not a nag.

## Constraints

- Responsive web, desktop-first, holds up on mobile.
- One accent color, enforced. If a second hue sneaks in, remove it.
- Numbers / hashes / addresses / multipliers / buckets: always mono. Headlines: always serif.
- Text never on the liquid-glass material; data sits on solid layers.
- Spring physics on every transition, including balance transfers, the Limbo climb, and the
  Plinko drop. Honor reduced-motion.
- Honest on-chain states everywhere (awaiting signature / pending / confirmed / error). No
  decorative spinners.
- UI copy here is English; localize strings (e.g. `Get 1,000 Proofs`, `Wallet`, `In play`)
  if the interface ships in another language.

## Order to apply the changes (restructure, don't restart)

Work on top of the existing design in this order — reuse existing components wherever they fit:

1. Confirm the existing token set + liquid-glass component still read right after the
   rebrand text changes. Do NOT regenerate them.
2. Apply the **rebrand** (proof.bet) and the **Proofs/PRF + two-balance** model across the
   screens that already exist.
3. Add the **Plinko table** by cloning the existing Limbo table's chrome and swapping only
   the play area; add/restructure the **Game catalog** to hold both.
4. Convert faucet / deposit / withdraw / per-round verify into **drawers** (add them if the
   current "connect & play" flow skipped the economy stages).
5. Fill remaining gaps: Pending narrative, Auditor, error states, responsible-gaming nudge.
