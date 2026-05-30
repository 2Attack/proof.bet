# Design Port Checklist — proof.bet → 1:1 fidelity

**Goal:** make `/app` match the locked design bundle in `design/project/` **100%** —
every screen, animation, spring physic, and sound effect. The design prototype
(`design/project/src/*.jsx` + `styles/*.css` + runnable `proof.bet.html`) is the
**visual / motion / sound source of truth**.

## Ground rules (read before any edit)

1. **Port the visual/animation/sound layer ONLY.** NEVER port the prototype's
   state, numeric, or RNG logic. The app keeps its real wiring:
   - **bigint fixed-point** (`x100`, see `lib/units.ts`) — the prototype uses JS floats. Do not regress to floats.
   - **wagmi/viem + live + mock modes** — outcomes come from real VRF / `lib/live-bet.ts` / `lib/mock-store.ts`, never from prototype mock RNG.
   - **App Router routes + parallel-route modals** — keep the Next structure; recreate the *look*, not the prototype's single-page state machine.
2. **Dev scaffolding is OUT of scope** (user decision): do **not** port `TweaksPanel`
   or `forceOutcome`. Outcomes always come from the real flow.
3. **Spring physics everywhere — no linear tweens.** Use the ported `lib/spring.ts`
   (`useSpringValue`, `useClimb`, `SPRING`). Honor `prefers-reduced-motion`.
4. **Sound on every interaction** via `lib/sound.ts` (`pkSound`). Muted state persists;
   AudioContext unlocks on first gesture. SSR-safe (guard `window`).
5. **Design CSS is authoritative.** When a class exists in both, the design value wins.
   `globals.css` is rebuilt from `design/project/styles/*.css`; app-specific rules
   (live-mode UI, Next bits) are re-added on top with no design equivalent.
6. **Single owner for `globals.css`** — only the CSS pass edits it. Screen agents edit
   their own `.tsx` only.

## Definition of done (per screen) — VERIFY, don't assume

For each screen: run the prototype (`proof.bet.html`) **and** the Next app side by side,
compare against the matching reference screenshot in `design/project/screenshots/`
(e.g. `01-game`, `01-verify`, `01-pk-game`, `01-landing`, `01-eco-*`, `01-aud`), and
confirm **behavior** fires: spring climb feel, sound on drop/peg/cross/land/win/loss,
hover/press states, reduced-motion fallback. A green build is necessary, not sufficient.

---

## Phase 1 — Foundation (engines + CSS) — blocks everything

- [ ] **`lib/spring.ts`** ← `src/motion.jsx`
  - `springStep`, `SPRING` presets (gentle/default/snappy/climb/slow),
    `useSpringValue(target, cfg, opts)`, `useClimb(from, to, play, cfg)`. TS types, reduced-motion.
- [ ] **`lib/sound.ts`** ← `src/sound.jsx`
  - Full Web Audio synth singleton: `muted`/`toggle`/`unlock`, `drop`, `peg(row,rows,x)`,
    `land(win,mult)`, `ui`, climb voice (`velvet`/`glass`), `limboStart`/`limboTo`/`limboCross`/`limboEnd`.
  - SSR-safe; lazy `AudioContext`; persists mute in localStorage. Export typed `pkSound`.
  - **Note:** climb-voice toggle exists for the engine, but no UI picker ships (TweaksPanel out).
    Default = `velvet`.
- [ ] **`components/Backdrop.tsx` + `FilterDefs`** ← `src/background.jsx`
  - Animated grain/glow backdrop with `intensity` (subtle/calm/static), SVG `<filter>` defs.
- [ ] **CSS consolidation** → `app/globals.css` rebuilt from `design/project/styles/`:
  tokens, app, glass, catalog, limbo, plinko, economy, verify, screens. Re-add app-only rules.
  - Verify accent `#5FE3C0`, Fraunces/Geist Mono/Geist/Syne fonts, liquid-glass vars.

## Phase 2 — Screens (parallel; consume Phase-1 API; edit own files only)

### A. Limbo — the money shot ← `src/limbo.jsx` → `features/limbo/LimboPage.tsx`
- [ ] **`ClimbChart`** (currently MISSING): SVG rocket curve, dynamic vmax, live sample trail,
  gridlines + value labels, dashed target line, glowing tip, win/loss stroke colors, area fill.
- [ ] **`ResultStage`** via `useClimb` (replace framer-motion `animate`).
- [ ] **Sound wiring**: `limboStart` on reveal, `limboTo(prog)` each frame, `limboCross` on crossing target,
  `limboEnd(win,mult)` on settle, `unlock()` on Place Bet.
- [ ] **`SoundToggle`** in stage corner.
- [ ] `stage-burst` on win, `recent` pills, idle/pending copy, slider (bar treatment), bet stats, edge chip.
- [ ] Keep bigint stake/target/maxBet/payout + real `usePlaceBet`.

### B. Plinko ← `src/plinko.jsx` → `features/plinko/PlinkoPage.tsx`
- [ ] **`usePlinkoDrop`** spring ball physics down pegs.
- [ ] **`PlinkoBoard`** peg grid, ball, landed slot, multiplier buckets by tier.
- [ ] **Sound**: `drop` on release, `peg(row,rows,x)` per bounce (pan follows x), `land(win,mult)`.
- [ ] `PlinkoResult`, `PlinkoPanel` (risk/rows/stake), edge + maxMult. Keep bigint + real outcome.

### C. Verify drawer ← `src/verify.jsx` → `features/verify/VerifyDrawer.tsx`
- [ ] In-browser recompute, "✓ matches", `DataRow`s, hash display (`Hashish`), reroll client seed,
  inline reveal layout. Keep real on-chain round data.

### D. Economy drawers ← `src/economy.jsx` → `features/economy/*` + `components/TxState.tsx`
- [ ] `TxState` honest state machine (idle→signing→pending→confirmed), `FlowRail`, `GasPill`,
  `TransferBoard` (animated transfer), `DrawerHead`.
- [ ] `FaucetBody`, `DepositBody`, `WithdrawBody`, `EconomyDrawer` shell. Keep real tx hooks (`economy/hooks.ts`).
- [ ] `InPlayBar` (balance strip).

### E. TopNav / Wallet / Lang ← `src/app.jsx` + `economy.jsx` → `components/TopNav.tsx`, `Logo.tsx`
- [ ] `Logo` wordmark (Syne, lift-in, `.bet` glow), `WalletMenu` dropdown (addr/avatar/balances/disconnect),
  `LangMenu` (EN/RU/UA), nav links + active states.

### F. Catalog ← `src/catalog.jsx` → `features/catalog/CatalogPage.tsx`
- [ ] `ArtLimbo/Plinko/Dice/Crash/Mines` SVG art, `GameCard` (featured/soon), grid, hover springs.

### G. Landing ← `src/screens.jsx` (Landing block) → `features/landing/LandingPage.tsx`
- [ ] `HeroStats` count-up, `Reveal`/`useInView`, `LandingDemo`, `LiveBets` feed, `TrustBar`,
  `HowItWorks` (`HowArt*`), `ClosingCTA`, `LandingFooter`. Spring/scroll reveals.

### H. Connect ← `src/screens.jsx` (Connect) → `features/connect/ConnectPage.tsx`
- [ ] Wallet options (MetaMask/WalletConnect/Coinbase icons). Keep real wagmi connectors.

### I. Auditor + States ← `src/screens.jsx` → `features/verify/AuditorPage.tsx`, `states/page.tsx`
- [ ] `Auditor` known-rounds table; `ErrorGallery`, `RGNudge`, `Pending`/`PendingToast`, `BankrollMeter`.

## Phase 3 — Verification
- [x] `npm run build` green (TS strict) — 16 routes compile/prerender; `tsc --noEmit` clean.
- [x] Ran the app (mock mode) and walked every screen + the full economy/bet/verify flow.
- [x] Confirmed spring animations fire (faucet count-up, Limbo `useClimb`, deposit TransferBoard, Plinko rAF drop) and no runtime/console errors during live bets on BOTH games.
- [x] Console spot-checked clean (incl. load-time) on: home, Limbo, Plinko, States, Auditor, and a verify full-page load with an unknown hash (graceful "round not found").
- [x] Fixed a real hydration bug found in verification (random-seeded `useState` in `LandingDemo`/`LiveBets` → deterministic seeds).

## Verification results (2026-05-30, mock mode)
Walked end-to-end and confirmed against the design:
- **Landing** ✓ serif hero, count-up stats, live demo card, recent pills, trust bar. (hydration fixed)
- **Connect** ✓ mock connect works; real wagmi/wrong-net wiring preserved.
- **Catalog** ✓ "Pick your game.", featured Plinko (live peg-drop), Limbo (live climb curve), SOON cards.
- **Faucet drawer** ✓ FlowRail, serif balance, mint → spring count-up to 1,000 → TxState "confirmed".
- **Deposit drawer** ✓ TransferBoard WALLET→IN PLAY animation, "confirmed" tx state.
- **Limbo money-shot** ✓ pending toast → `ClimbChart` rocket curve + `useClimb` climbing number → settle verdict + recent pill + BankrollMeter update. (ClimbChart was MISSING before — now present.)
- **Verify drawer (hero)** ✓ on-chain inputs, open formula, "Recompute in your browser" → step log → "✓ Matches the contract".
- **Plinko money-shot** ✓ placed a live bet: pending toast → glowing ball animating down the 12-row grid (bespoke rAF physics) → landed in the 0.11× bucket (highlighted) → "landed 0.11× −22.25 PRF" verdict + recent pill (math correct). Per-peg `sound.peg()`/`land()` path executed without errors.
- **States** ✓ ErrorGallery (rejected / no-gas / wrong-net / bankroll-cap) + RGNudge toast.
- **Auditor** ✓ "Verify anyone's round." paste-a-hash recompute; unknown hash → graceful "round not found".
- **No console errors** across the entire flow (home, both games + live bets, economy drawers, verify, states, auditor).

### Sound — honest status
The Web Audio engine (`lib/sound.ts`) is a faithful 1:1 port; `SoundToggle` renders on both
games; the Limbo bet fired `limboStart/limboTo/limboCross/limboEnd` and Plinko fired
`drop/peg/land` with **zero AudioContext/runtime errors**. Audible playback could not be
confirmed through the automation harness (no audio capture) — wiring is verified, the sound
itself should be ear-checked by a human once.

## Known minor deltas / follow-ups (not blocking; flagged by agents)
- **Wordmark font:** the updated design CSS renders the wordmark in **Instrument Serif italic** (confirmed on screen), but the old `CLAUDE.md` non-negotiable says Syne. Followed the design per the "match current design 100%" instruction. **Needs user confirmation.**
- **Faucet → "Deposit to play"** closes to the catalog instead of opening the deposit drawer (deposit is reachable via the in-page "+ Deposit Proofs" button, which works as a client-side modal). Minor flow polish.
- **Landing top bar** has no `LangMenu` (the prototype's landing does). `LangMenu` is private to `TopNav.tsx` — needs a small refactor to share it.
- **`LandingDemo`** renders the climbing number + caption + recent pills but not the full `ClimbChart` rocket curve (kept lightweight as a marketing widget). Minor visual delta vs the prototype's full `ResultStage`.
- **Plinko ball-drop / sound** verified by render + code + clean console (same spring/sound infra proven on Limbo); not captured frame-by-frame in motion.
