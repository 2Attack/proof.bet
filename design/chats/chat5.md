# Proof UI Updates

_Started 2026-05-30 11:13 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "proof.bet"
Project currently has 6 file(s)
User is viewing file: Houseproof.html
Current date is now May 30, 2026
</system-info>

<pasted_text name="Pasted text (208 lines)">
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

Primary slogan: **"Don't trust us. Verify us."**
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

**1. Landing (`/`)** — quiet dark page. Headline *"Don't trust us. Verify us."* in the serif.
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
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design System (design system)">
[Design System] This project uses the **Design System** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

    Explore it to find what you need:
    - Always copy out the fonts and colors you need
    - For prototypes and designs, always copy out any relevant components
    - If the design system contains existing mocks of products, and you were asked to design or prototype something similar, copy and fork those mocks to start your design. This helps you make high-quality designs.

    Explore it quickly to find relevant UI kits (e.g. mocks of existing products you can copy and fork)

Full system at `/projects/b70eaed6-1730-47a1-9663-e0a2c61bdb18/`. Before producing any visuals, explore it: call `list_files("/projects/b70eaed6-1730-47a1-9663-e0a2c61bdb18/")` to see the structure, then `read_file` the README/base.md or whatever index file it has. Don't guess at the design system's contents.

CSS tokens: the guide may describe tokens in prose, but the exact `--*` names are defined in the design system's stylesheet(s). Before writing any `var(--*)`, look up the real name in the design system's `.css` files (`list_files` + `read_file` under `/projects/b70eaed6-1730-47a1-9663-e0a2c61bdb18/`). Never guess a token name — an unresolved `var()` silently falls back to the browser default.

For assets and UI kits beyond the guide: `read_file("/projects/b70eaed6-1730-47a1-9663-e0a2c61bdb18/<path>")` and `copy_files` to bring them into the current project.
</attached-skill>

## Assistant

_[tool: list_files]_

_[tool: list_files]_

I'll start by exploring the current design and the design system before planning this restructure.

_[tool: list_files]_

_[tool: list_files]_

The design system appears empty. Let me explore the current project structure.

_[tool: read_file]_

A substantial design already exists. The screenshots suggest much of this work may already be done. Let me read the main file and key sources to understand the current state.

_[tool: read_file]_

The title is already "proof.bet" — this is a mature, iterative session. Let me read the core source files to understand exactly what's implemented.

_[tool: grep]_

This is a mature, near-complete implementation — proof.bet rebrand, both games, verify drawer, economy screens, auditor, errors, and RG nudge all exist. Let me assess the actual delta: the token naming and whether economy stages are drawers vs screens.

_[tool: read_file]_

The codebase is mature but still uses "chips" in all user-facing labels, and the economy (faucet/deposit/withdraw) are **full screens**, not drawers. Those are the two real deltas. Let me read the economy module fully to plan the work.

_[tool: questions_v2]_

I've now got a clear picture. This is a polished, near-complete build. After mapping it against your delta list:

- ✅ **Rebrand** (proof.bet wordmark, title) — done
- ✅ **Plinko** + catalog — done
- ✅ **Two-balance model** (Wallet / In play) + gas pill — done structurally
- ✅ **Per-round Verify** is already a drawer
- ⚠️ **Token still labeled "chips"** everywhere (not "Proofs / PRF")
- ⚠️ **Faucet / Deposit / Withdraw are full screens**, not drawers over the live table
- ⚠️ There's a **display-currency picker** (ETH/USD/EUR/USDT/BTC converting the balance) that directly contradicts the spec's "Proofs have no price, no conversion"

Before I touch a working build, two real judgment calls and a sequencing question:

## User

Questions answered:
- currency_picker: Remove it — Proofs are unitless, show PRF only
- ticker_usage: Spell out 'Proofs' in prose, use 'PRF' next to numbers/balances
- drawer_scope: Yes — convert all three to drawers over the app now
- faucet_naming: Claim 1,000 Proofs

## Assistant

_[tool: update_todos]_

Clear. Let me set up the task list and read the remaining files I need to touch.

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

The Verify drawer also wrongly labels stake/payout as **tETH** — bets are in Proofs, so that's another fix. Let me read the drawer CSS and scan the remaining modules for token labels and currency-picker usage.

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

I now have a complete map. The `CurrencyMenu`/`AccountMenu`/`CURRENCIES`/`fmtBal` in app.jsx are dead code (TopBar uses `WalletMenu`), so removing them cleanly satisfies the "remove currency picker" requirement. Let me execute the label changes first, then the drawer refactor.

Starting with the token-label changes across modules:Now screens.jsx — bankroll meter, bet feed, connect copy, and the tETH error:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

Now the economy module — the biggest change. I'll rewrite it to convert the three full-screen stages into drawer bodies, add an `EconomyDrawer` shell reusing the existing `.drawer` chrome, and apply all the Proofs/PRF labels.

_[tool: read_file]_

`ChipsMenu` was unused — dropped. Now I'll clean the dead currency code from app.jsx and rewire routing. Let me re-read the exact region to remove precisely.

_[tool: run_script]_

I'll remove the two dead blocks (`AccountMenu` and the currency picker) surgically via script, matching section markers.

_[tool: read_file]_

Now let me re-read the App function to rewire the routing for drawers.

_[tool: str_replace_edit]_

Now I'll rewire the routing in app.jsx — econDrawer state, connect→catalog with auto faucet drawer, balance triggers, remove the old economy screens, and render the `EconomyDrawer`.

_[tool: read_file]_

Let me check economy.css to ensure the inner classes render well inside the drawer (they were designed for a center-stage card).

_[tool: grep]_

The inner classes are all standalone — they'll render correctly inside the drawer. Let me verify no dangling references to removed functions remain.

_[tool: show_html]_

No dangling references — clean. Let me load the page and check console.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: done]_

Clean — only the standard Babel dev warning. Let me surface it and then have the verifier walk the new drawer flow.

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Done. The restructure is applied on top of the existing build — nothing regenerated. Summary of the delta:

- **chips → Proofs / PRF** across every surface (Limbo & Plinko payouts, stake fields, bankroll meter, bet feed, wallet pill, in-play bar, verify drawer). Prose reads "Proofs"; anything next to a number reads **PRF**.
- **Verify drawer fixed** — stake/payout were wrongly labeled tETH; now PRF.
- **Faucet / Deposit / Withdraw are now liquid-glass drawers** sliding over the live app (same chrome as the Verify drawer), not full screens. Flow: connect → lands on the catalog with the faucet drawer auto-open → "Deposit to play" opens the deposit drawer → "Choose a game" closes back to the catalog. Deposit/Withdraw are reachable anytime from the wallet pill and the in-game balance bar.
- **Faucet copy** → "Claim your Proofs" / "Claim 1,000 Proofs".
- **Display-currency picker removed** (it was already dead code behind the wallet menu) — Proofs are unitless, gas stays a quiet tETH indicator.

A verifier is walking the full flow in the background. Two notes:
- I kept internal variable names (`walletChips`, `mintChips`) as-is — only user-facing strings changed.
- This is a prototype, so drawers don't have real URLs/refresh-fallback yet (the app has no URL routing); the drawer-over-live-app behavior the spec emphasizes is in place. Say the word if you want real deep-link URLs.

