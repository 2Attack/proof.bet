# proof.bet contracts

Provably-fair Limbo + Plinko casino on Ethereum Sepolia. Chainlink VRF V2.5 (native ETH payment — no LINK). Solidity 0.8.24, Foundry.

## Architecture

```
src/
  IProofBet.sol              — Interface (events, errors, enums, BetParams) — FROZEN
  Proofs.sol                 — ERC20 test token (PRF). faucet() mints 1000 PRF. Owner can mint more.
  ProofBet.sol               — VRFConsumerBaseV2Plus + ReentrancyGuard. Both games, one bankroll.
  generated/
    PlinkoTables.sol         — Auto-generated from plinko-tables.json. Pure bytecode lookup, no SLOAD.

scripts/
  gen-plinko-tables.mjs      — Generates PlinkoTables.sol from packages/shared/src/tables/plinko-tables.json
  sync-abi.mjs               — Copies compiled ABIs into packages/shared/src/abi/ as TypeScript modules

test/
  Golden.t.sol               — Cross-track proof: asserts finalSeed + outcomes match golden.json exactly
  ProofBet.t.sol             — Integration + security: VRF flow, reentrancy, edge, accounting, params

script/
  Deploy.s.sol               — Foundry deploy script: Proofs + ProofBet + bankroll seed
```

## Provably-fair math

```
finalSeed = keccak256(abi.encode(uint256 vrfWord, bytes32 clientSeed, uint256 nonce))

Limbo:
  h = uint256(finalSeed) >> 204          (top 52 bits)
  if h % 50 == 0  => crashX100 = 100    (instant bust, 2% edge)
  else            => crashX100 = floor((100 * 2^52 - h) / (2^52 - h)), clamped [100, 100_000_000]
  win = crashX100 >= targetX100
  payout = win ? stake * target / 100 : 0

Plinko:
  x    = uint256(finalSeed) >> 64        (top 192 bits)
  slot = popcount of low `rows` bits of x
  multX100 = PlinkoTables.slotMultiplierX100(rows, risk, slot)
  payout   = stake * multX100 / 100      (always — even partial payouts on "loss")
  win      = multX100 >= 100
```

## Build

```bash
cd contracts
npm install                       # Install @chainlink/contracts + @openzeppelin/contracts
node scripts/gen-plinko-tables.mjs   # Generate PlinkoTables.sol
forge build
forge test -vvv                   # 25/25 tests
node scripts/sync-abi.mjs         # Emit ABIs to packages/shared/src/abi/
```

## Sepolia VRF V2.5 config (hard-coded)

| Param | Value |
|---|---|
| Coordinator | `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` |
| Key hash | `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` |
| requestConfirmations | `3` |
| callbackGasLimit | `300_000` |
| nativePayment | `true` (pay in Sepolia ETH) |

## Deploy (Phase 2)

### 1. Prerequisites

```bash
cp .env.example .env
# Edit .env:
#   PRIVATE_KEY=0x...           (deployer key with Sepolia ETH)
#   SEPOLIA_RPC_URL=https://...  (Alchemy or Infura endpoint)
#   ETHERSCAN_API_KEY=...        (for source verification)
#   VRF_SUBSCRIPTION_ID=...      (create at vrf.chain.link, fund with native ETH)
```

### 2. Deploy

```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

### 3. Add consumer (MANDATORY)

After deploy, go to [vrf.chain.link](https://vrf.chain.link), open your subscription, and click **Add consumer**. Paste the deployed `ProofBet` address. Without this, every `placeBet` will revert with `InvalidConsumer`.

### 4. Update addresses

Edit `packages/shared/src/addresses.ts` with the deployed addresses, then redeploy the frontend.

### 5. Verify manually (if auto-verify fails)

```bash
forge verify-contract <PROOFS_ADDRESS> src/Proofs.sol:Proofs \
  --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" $DEPLOYER)

forge verify-contract <PROOFBET_ADDRESS> src/ProofBet.sol:ProofBet \
  --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,uint256,address)" \
    $PROOFS_ADDRESS $VRF_SUBSCRIPTION_ID 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B)
```

## Max-bet cap

Worst-case payout is capped to 1.5% of bankroll per bet:

- **Limbo**: `maxBet = (bankroll * 0.015 * 100) / (target - 100)`
- **Plinko**: `maxBet = (bankroll * 0.015 * 100) / (maxMultiplier - 100)`

The contract enforces this on every `placeBet` (`BetTooLarge` error).

## Security notes

- **CEI + ReentrancyGuard** on `withdraw`: balance is zeroed before the ERC20 transfer.
- **Two-balance model**: `playerBalances` and `bankroll` are separate. The VRF callback only writes balances; players pull via `withdraw`.
- **No double-settle**: `AlreadySettled` guard in `fulfillRandomWords`.
- **No unknown-request settle**: `BetNotFound` guard.
- **SafeERC20** used for all token transfers.
- `VRFConsumerBaseV2Plus` inherits `ConfirmedOwner` — do NOT add OZ `Ownable`.
