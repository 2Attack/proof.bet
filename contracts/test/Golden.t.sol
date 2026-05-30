// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { stdJson } from "forge-std/StdJson.sol";
import { ProofBet } from "../src/ProofBet.sol";
import { Proofs } from "../src/Proofs.sol";
import { GameType, Risk, BetParams } from "../src/IProofBet.sol";

/// @title Golden — cross-track correctness proof.
/// @notice Loads packages/shared/src/vectors/golden.json and asserts that the
///         contract's pure settlement functions reproduce finalSeed, outcomeX100,
///         payout, win (and slot for Plinko) for every vector in the file.
///         This is the integration seam proof — if this passes, the Solidity math
///         is byte-identical to the TypeScript fairness engine in proofbet/shared.
contract GoldenTest is Test {
    using stdJson for string;

    // -------------------------------------------------------------------------
    // Setup — deploy minimal ProofBet (no VRF subscription needed for pure tests)
    // -------------------------------------------------------------------------

    ProofBet private _game;

    function setUp() public {
        // Deploy Proofs token.
        Proofs proofsToken = new Proofs(address(this));
        // Use a dummy coordinator address — pure-function tests never call VRF.
        address dummyCoordinator = address(0xC0);
        // Sub ID 0 is fine for pure-function tests.
        _game = new ProofBet(address(proofsToken), 0, dummyCoordinator);
    }

    // -------------------------------------------------------------------------
    // Limbo golden vectors
    // -------------------------------------------------------------------------

    function test_GoldenLimbo() public view {
        string memory json = vm.readFile("../packages/shared/src/vectors/golden.json");

        // vrfWord, stake, targetX100, outcomeX100, payout are quoted decimal strings in JSON.
        // clientSeed, finalSeed are 0x-prefixed hex strings.
        // nonce, win are raw JSON numbers / booleans.

        uint256 count = json.readUint(".meta.counts.limbo");
        // Vacuous-pass guard: must process exactly the declared count.
        assertEq(count, 26, "golden.json limbo count must be 26");

        uint256 processed = 0;
        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".limbo[", vm.toString(i), "]");

            // vrfWord: quoted decimal string → read as string → parseUint
            uint256 vrfWord = vm.parseUint(json.readString(string.concat(base, ".vrfWord")));

            // clientSeed: 0x-prefixed hex string → readBytes32
            bytes32 clientSeed = json.readBytes32(string.concat(base, ".clientSeed"));

            // nonce: raw JSON number
            uint256 nonce = json.readUint(string.concat(base, ".nonce"));

            // targetX100: quoted decimal string
            uint256 targetX100 = vm.parseUint(json.readString(string.concat(base, ".targetX100")));

            // stake: quoted decimal string
            uint256 stake = vm.parseUint(json.readString(string.concat(base, ".stake")));

            // Expected outputs.
            bytes32 expectedFinalSeed = json.readBytes32(string.concat(base, ".finalSeed"));

            // outcomeX100: quoted decimal string
            uint256 expectedOutcomeX100 =
                vm.parseUint(json.readString(string.concat(base, ".outcomeX100")));

            bool expectedWin = json.readBool(string.concat(base, ".win"));

            // payout: quoted decimal string
            uint256 expectedPayout = vm.parseUint(json.readString(string.concat(base, ".payout")));

            // ---- Assert finalSeed ----
            bytes32 gotFinalSeed = _game.deriveFinalSeed(vrfWord, clientSeed, nonce);
            assertEq(
                gotFinalSeed,
                expectedFinalSeed,
                string.concat("Limbo[", vm.toString(i), "] finalSeed mismatch")
            );

            // ---- Assert outcome, payout, win ----
            (uint256 gotOutcome, uint256 gotPayout, bool gotWin) =
                _game.settleLimboPublic(uint256(gotFinalSeed), stake, targetX100);

            assertEq(
                gotOutcome,
                expectedOutcomeX100,
                string.concat("Limbo[", vm.toString(i), "] outcomeX100 mismatch")
            );
            assertEq(
                gotPayout,
                expectedPayout,
                string.concat("Limbo[", vm.toString(i), "] payout mismatch")
            );
            assertEq(gotWin, expectedWin, string.concat("Limbo[", vm.toString(i), "] win mismatch"));

            processed++;
        }

        assertEq(processed, count, "Did not process all limbo vectors");
    }

    // -------------------------------------------------------------------------
    // Plinko golden vectors
    // -------------------------------------------------------------------------

    function test_GoldenPlinko() public view {
        string memory json = vm.readFile("../packages/shared/src/vectors/golden.json");

        uint256 count = json.readUint(".meta.counts.plinko");
        assertEq(count, 32, "golden.json plinko count must be 32");

        uint256 processed = 0;
        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".plinko[", vm.toString(i), "]");

            uint256 vrfWord = vm.parseUint(json.readString(string.concat(base, ".vrfWord")));
            bytes32 clientSeed = json.readBytes32(string.concat(base, ".clientSeed"));
            uint256 nonce = json.readUint(string.concat(base, ".nonce"));

            uint8 rows = uint8(json.readUint(string.concat(base, ".rows")));
            // risk is a raw number: 0=Low, 1=Medium, 2=High
            Risk risk = Risk(json.readUint(string.concat(base, ".risk")));

            uint256 stake = vm.parseUint(json.readString(string.concat(base, ".stake")));

            bytes32 expectedFinalSeed = json.readBytes32(string.concat(base, ".finalSeed"));
            uint256 expectedSlot = json.readUint(string.concat(base, ".slot"));

            // outcomeX100 is a raw JSON number in plinko vectors
            uint256 expectedOutcomeX100 = json.readUint(string.concat(base, ".outcomeX100"));
            bool expectedWin = json.readBool(string.concat(base, ".win"));
            uint256 expectedPayout = vm.parseUint(json.readString(string.concat(base, ".payout")));

            // ---- Assert finalSeed ----
            bytes32 gotFinalSeed = _game.deriveFinalSeed(vrfWord, clientSeed, nonce);
            assertEq(
                gotFinalSeed,
                expectedFinalSeed,
                string.concat("Plinko[", vm.toString(i), "] finalSeed mismatch")
            );

            // ---- Assert outcome, payout, win, slot ----
            (uint256 gotOutcome, uint256 gotPayout, bool gotWin, uint256 gotSlot) =
                _game.settlePlinkoPublic(uint256(gotFinalSeed), stake, rows, risk);

            assertEq(
                gotSlot, expectedSlot, string.concat("Plinko[", vm.toString(i), "] slot mismatch")
            );
            assertEq(
                gotOutcome,
                expectedOutcomeX100,
                string.concat("Plinko[", vm.toString(i), "] outcomeX100 mismatch")
            );
            assertEq(
                gotPayout,
                expectedPayout,
                string.concat("Plinko[", vm.toString(i), "] payout mismatch")
            );
            assertEq(
                gotWin, expectedWin, string.concat("Plinko[", vm.toString(i), "] win mismatch")
            );

            processed++;
        }

        assertEq(processed, count, "Did not process all plinko vectors");
    }
}
