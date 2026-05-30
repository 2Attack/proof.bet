// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { Proofs } from "../src/Proofs.sol";
import { ProofBet } from "../src/ProofBet.sol";

/// @title Deploy — deploy Proofs + ProofBet to Sepolia, seed the bankroll.
///
/// Prerequisites (run once on vrf.chain.link before deploying):
///   1. Create a VRF V2.5 subscription (native ETH payment).
///   2. Fund it with at least 0.5 Sepolia ETH.
///   3. Set VRF_SUBSCRIPTION_ID in .env.
///   4. After deploy: add the ProofBet contract address as a consumer on the subscription.
///
/// Usage:
///   # Dry run (local fork, no real transactions):
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 -vvvv
///
///   # Real Sepolia deploy:
///   forge script script/Deploy.s.sol \
///     --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $ETHERSCAN_API_KEY \
///     -vvvv
///
///   # Verify manually (if auto-verify fails):
///   forge verify-contract <PROOFS_ADDRESS> src/Proofs.sol:Proofs \
///     --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY \
///     --constructor-args $(cast abi-encode "constructor(address)" $DEPLOYER)
///
///   forge verify-contract <PROOFBET_ADDRESS> src/ProofBet.sol:ProofBet \
///     --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY \
///     --constructor-args $(cast abi-encode "constructor(address,uint256,address)" \
///       $PROOFS_ADDRESS $VRF_SUBSCRIPTION_ID $VRF_COORDINATOR)
contract DeployScript is Script {
    /// @dev Amount of PRF to seed the bankroll: 1,000,000 PRF.
    uint256 private constant BANKROLL_SEED = 1_000_000e18;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 subId = vm.envUint("VRF_SUBSCRIPTION_ID");
        address deployer = vm.addr(deployerKey);

        console.log("=== proof.bet deploy ===");
        console.log("Deployer:         ", deployer);
        console.log("VRF sub ID:       ", subId);
        console.log("VRF coordinator:   0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B");
        console.log("Bankroll seed:    ", BANKROLL_SEED / 1e18, "PRF");

        vm.startBroadcast(deployerKey);

        // 1. Deploy Proofs (PRF) token.
        Proofs proofsToken = new Proofs(deployer);
        console.log("Proofs deployed:  ", address(proofsToken));

        // 2. Deploy ProofBet (use Sepolia VRF coordinator).
        address sepoliaCoordinator = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
        ProofBet game = new ProofBet(address(proofsToken), subId, sepoliaCoordinator);
        console.log("ProofBet deployed:", address(game));

        // 3. Mint 1,000,000 PRF to deployer, approve ProofBet, seed bankroll.
        proofsToken.mint(deployer, BANKROLL_SEED);
        proofsToken.approve(address(game), BANKROLL_SEED);
        game.seedBankroll(BANKROLL_SEED);
        console.log("Bankroll seeded:   1,000,000 PRF");

        vm.stopBroadcast();

        console.log("");
        console.log("=== NEXT STEPS ===");
        console.log("1. Go to https://vrf.chain.link -> Your Subscription");
        console.log("   Add consumer:", address(game));
        console.log("   (Without this, every placeBet will revert.)");
        console.log("");
        console.log("2. Update packages/shared/src/addresses.ts:");
        console.log("   proofBet: '", address(game), "'");
        console.log("   proofs:   '", address(proofsToken), "'");
        console.log("");
        console.log("3. Verify on Etherscan (if --verify flag was not passed):");
        console.log("   forge verify-contract <address> --chain sepolia");
    }
}
