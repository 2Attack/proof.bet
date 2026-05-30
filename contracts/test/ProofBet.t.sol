// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import {
    VRFCoordinatorV2_5Mock
} from "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";
import { ProofBet } from "../src/ProofBet.sol";
import { Proofs } from "../src/Proofs.sol";
import { GameType, Risk, BetParams } from "../src/IProofBet.sol";

// ---------------------------------------------------------------------------
// Malicious token for reentrancy testing
// ---------------------------------------------------------------------------

/// @dev A token that re-enters withdraw() inside its transfer() hook.
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public _game;

    function setGame(address game) external {
        _game = game;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        // Re-entrant call: attempt withdraw again while the first withdraw is in flight.
        // CEI in ProofBet zeroed the balance before this call, so the second call reverts
        // on ZeroAmount — proving reentrancy is defeated.
        try ProofBet(_game).withdraw() { } catch { }
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

// ---------------------------------------------------------------------------
// Test harness exposing internal fulfillRandomWords for direct invocation
// ---------------------------------------------------------------------------

/// @dev Extends ProofBet to expose fulfillRandomWords as external — allows tests to
///      call it directly (bypassing the VRF coordinator) and assert the guards work.
contract ProofBetHarness is ProofBet {
    constructor(address proofsToken, uint256 subId, address coordinator)
        ProofBet(proofsToken, subId, coordinator)
    { }

    /// @notice Directly call fulfillRandomWords — bypasses the coordinator.
    function exposedFulfill(uint256 requestId, uint256[] calldata randomWords) external {
        fulfillRandomWords(requestId, randomWords);
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------

contract ProofBetTest is Test {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    VRFCoordinatorV2_5Mock private _coordinator;
    ProofBet private _game;
    Proofs private _token;

    address private constant PLAYER = address(0xBEEF);
    address private constant OWNER = address(0xCAFE);

    uint256 private constant STAKE = 10e18; // 10 PRF
    uint256 private constant BANKROLL_SEED = 1_000_000e18; // 1M PRF

    uint256 private _subId;

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    function setUp() public {
        // Deploy VRF mock (baseFee=100000, gasPrice=1e9, weiPerUnitLink=4e15).
        _coordinator = new VRFCoordinatorV2_5Mock(100_000, 1e9, 4e15);

        // Create + fund subscription with native ETH.
        _subId = _coordinator.createSubscription();
        _coordinator.fundSubscriptionWithNative{ value: 10 ether }(_subId);

        // Deploy token + game (pass mock coordinator address).
        vm.startPrank(OWNER);
        _token = new Proofs(OWNER);
        _game = new ProofBet(address(_token), _subId, address(_coordinator));
        vm.stopPrank();

        // Add game as VRF consumer.
        _coordinator.addConsumer(_subId, address(_game));

        // Seed bankroll: mint to owner, approve, call seedBankroll.
        vm.startPrank(OWNER);
        _token.mint(OWNER, BANKROLL_SEED);
        _token.approve(address(_game), BANKROLL_SEED);
        _game.seedBankroll(BANKROLL_SEED);
        vm.stopPrank();

        // Give player some tokens and in-play balance.
        vm.startPrank(PLAYER);
        _token.faucet(); // 1000 PRF
        _token.approve(address(_game), type(uint256).max);
        _game.deposit(100e18);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------------
    // Deposit / Withdraw accounting
    // -----------------------------------------------------------------------

    function test_DepositAccountingCorrect() public {
        uint256 before = _game.inPlayOf(PLAYER);
        vm.startPrank(PLAYER);
        _token.faucet();
        _game.deposit(50e18);
        vm.stopPrank();
        assertEq(_game.inPlayOf(PLAYER), before + 50e18, "inPlay should increase");
    }

    function test_WithdrawAccountingCorrect() public {
        uint256 inPlay = _game.inPlayOf(PLAYER);
        uint256 tokenBefore = _token.balanceOf(PLAYER);
        vm.prank(PLAYER);
        _game.withdraw();
        assertEq(_game.inPlayOf(PLAYER), 0, "inPlay should be 0 after withdraw");
        assertEq(_token.balanceOf(PLAYER), tokenBefore + inPlay, "tokens should be returned");
    }

    function test_WithdrawZeroReverts() public {
        // Withdraw once to empty balance.
        vm.prank(PLAYER);
        _game.withdraw();
        // Second withdraw should revert.
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vm.prank(PLAYER);
        _game.withdraw();
    }

    function test_DepositZeroReverts() public {
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vm.prank(PLAYER);
        _game.deposit(0);
    }

    function test_InsufficientInPlayReverts() public {
        // Player has 100 PRF in-play; try to bet 200.
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("InsufficientInPlay(uint256,uint256)")), 100e18, 200e18
            )
        );
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, 200e18, bytes32("seed"), params);
    }

    // -----------------------------------------------------------------------
    // Limbo bet flow (mock VRF)
    // -----------------------------------------------------------------------

    function test_LimboBetPlacedAndSettled() public {
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        uint256 inPlayBefore = _game.inPlayOf(PLAYER);
        uint256 bankrollBefore = _game.bankroll();

        vm.prank(PLAYER);
        uint256 requestId = _game.placeBet(GameType.Limbo, STAKE, bytes32("myseed"), params);

        // Balance should be deducted immediately.
        assertEq(_game.inPlayOf(PLAYER), inPlayBefore - STAKE, "stake should be escrowed");

        // Use VRF mock with a specific random word that produces a known outcome.
        // We use a high word to guarantee a win (crashX100 will be large).
        uint256[] memory words = new uint256[](1);
        words[0] = uint256(keccak256("high_limbo_word"));

        _coordinator.fulfillRandomWordsWithOverride(requestId, address(_game), words);

        // After settlement, balance should be restored (win or loss).
        // Can't predict exact outcome without reproducing the math here; just check non-revert.
        // Bankroll + playerBalance conservation check:
        uint256 inPlayAfter = _game.inPlayOf(PLAYER);
        uint256 bankrollAfter = _game.bankroll();
        // Total PRF in contract = bankroll + playerBalance (no leaks).
        assertEq(
            inPlayAfter + bankrollAfter,
            inPlayBefore + bankrollBefore,
            "PRF conservation: inPlay + bankroll must be constant"
        );
    }

    function test_LimboNonceIncrementsOnEachBet() public {
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        assertEq(_game.nonceOf(PLAYER), 0, "initial nonce should be 0");

        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, STAKE, bytes32("seed1"), params);
        assertEq(_game.nonceOf(PLAYER), 1, "nonce should be 1 after first bet");

        // Settle first bet.
        uint256[] memory words = new uint256[](1);
        words[0] = 12345;
        _coordinator.fulfillRandomWordsWithOverride(1, address(_game), words);

        // Player needs more in-play for second bet.
        vm.prank(PLAYER);
        _game.deposit(20e18);

        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, STAKE, bytes32("seed2"), params);
        assertEq(_game.nonceOf(PLAYER), 2, "nonce should be 2 after second bet");
    }

    // -----------------------------------------------------------------------
    // Plinko bet flow (mock VRF)
    // -----------------------------------------------------------------------

    function test_PlinkoBetPlacedAndSettled() public {
        BetParams memory params = BetParams({ target: 0, rows: 8, risk: Risk.Low });
        uint256 inPlayBefore = _game.inPlayOf(PLAYER);
        uint256 bankrollBefore = _game.bankroll();

        vm.prank(PLAYER);
        uint256 requestId = _game.placeBet(GameType.Plinko, STAKE, bytes32("plinko_seed"), params);

        assertEq(_game.inPlayOf(PLAYER), inPlayBefore - STAKE, "stake escrowed for Plinko");

        uint256[] memory words = new uint256[](1);
        words[0] = uint256(keccak256("plinko_word"));
        _coordinator.fulfillRandomWordsWithOverride(requestId, address(_game), words);

        // Conservation check.
        assertEq(
            _game.inPlayOf(PLAYER) + _game.bankroll(),
            inPlayBefore + bankrollBefore,
            "Plinko PRF conservation"
        );
    }

    // -----------------------------------------------------------------------
    // Double-settle blocked (harness bypasses coordinator to test OUR guard)
    // -----------------------------------------------------------------------

    function test_DoubleSettleReverts() public {
        // Deploy harness — shares the same mock coordinator and subscription.
        vm.startPrank(OWNER);
        ProofBetHarness harness =
            new ProofBetHarness(address(_token), _subId, address(_coordinator));
        vm.stopPrank();
        _coordinator.addConsumer(_subId, address(harness));

        // Seed harness bankroll.
        vm.startPrank(OWNER);
        _token.mint(OWNER, BANKROLL_SEED);
        _token.approve(address(harness), BANKROLL_SEED);
        harness.seedBankroll(BANKROLL_SEED);
        vm.stopPrank();

        // Player deposits into harness.
        vm.startPrank(PLAYER);
        _token.approve(address(harness), type(uint256).max);
        harness.deposit(100e18);
        vm.stopPrank();

        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        vm.prank(PLAYER);
        uint256 requestId = harness.placeBet(GameType.Limbo, STAKE, bytes32("ds_seed"), params);

        uint256[] memory words = new uint256[](1);
        words[0] = 999;

        // First fulfillment via harness: ok.
        harness.exposedFulfill(requestId, words);

        // Second fulfillment of the SAME requestId must revert with AlreadySettled — OUR guard.
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("AlreadySettled(uint256)")), requestId)
        );
        harness.exposedFulfill(requestId, words);
    }

    function test_BetNotFoundReverts() public {
        // Deploy harness.
        vm.startPrank(OWNER);
        ProofBetHarness harness =
            new ProofBetHarness(address(_token), _subId, address(_coordinator));
        vm.stopPrank();
        _coordinator.addConsumer(_subId, address(harness));

        uint256[] memory words = new uint256[](1);
        words[0] = 42;

        // Attempt to fulfill a requestId that was never placed.
        uint256 unknownId = 999999;
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("BetNotFound(uint256)")), unknownId)
        );
        harness.exposedFulfill(unknownId, words);
    }

    // -----------------------------------------------------------------------
    // End-to-end: golden vector proves full callback path produces correct payout
    // -----------------------------------------------------------------------

    function test_LimboGoldenVector0_EndToEnd() public {
        // golden.limbo[0]:
        //   vrfWord    = 8790951480701132859224755765811319828226411200449165407444523148757165036634
        //   clientSeed = 0x3c4d6dde74e2d6796883c3ebcc27b17be2c8cba4edbf9a4da229d94d02d146f7
        //   nonce      = 0
        //   targetX100 = 150
        //   stake      = 1e18
        //   outcome    = 843, win = true, payout = 1.5e18

        uint256 vrfWord =
            8_790_951_480_701_132_859_224_755_765_811_319_828_226_411_200_449_165_407_444_523_148_757_165_036_634;
        bytes32 clientSeed = 0x3c4d6dde74e2d6796883c3ebcc27b17be2c8cba4edbf9a4da229d94d02d146f7;
        uint256 targetX100 = 150;
        uint256 stake = 1e18;
        uint256 expectedPayout = 1.5e18;

        // Deploy harness and seed.
        vm.startPrank(OWNER);
        ProofBetHarness harness =
            new ProofBetHarness(address(_token), _subId, address(_coordinator));
        vm.stopPrank();
        _coordinator.addConsumer(_subId, address(harness));

        vm.startPrank(OWNER);
        _token.mint(OWNER, BANKROLL_SEED);
        _token.approve(address(harness), BANKROLL_SEED);
        harness.seedBankroll(BANKROLL_SEED);
        vm.stopPrank();

        vm.startPrank(PLAYER);
        _token.approve(address(harness), type(uint256).max);
        harness.deposit(10e18);
        vm.stopPrank();

        // Place bet — player nonce starts at 0 (matches the vector).
        assertEq(harness.nonceOf(PLAYER), 0, "nonce must be 0 for golden vector to match");

        BetParams memory params = BetParams({ target: targetX100, rows: 0, risk: Risk.Low });
        vm.prank(PLAYER);
        uint256 requestId = harness.placeBet(GameType.Limbo, stake, clientSeed, params);

        uint256 inPlayBeforeSettle = harness.inPlayOf(PLAYER);

        // Fulfill with the exact golden vrfWord.
        uint256[] memory words = new uint256[](1);
        words[0] = vrfWord;
        harness.exposedFulfill(requestId, words);

        // Player's balance must have increased by exactly the expected payout.
        assertEq(
            harness.inPlayOf(PLAYER),
            inPlayBeforeSettle + expectedPayout,
            "golden vector 0 payout must match"
        );
    }

    // -----------------------------------------------------------------------
    // Max-bet cap enforcement
    // -----------------------------------------------------------------------

    function test_MaxBetCapEnforced_Limbo() public {
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        uint256 cap = _game.maxBet(GameType.Limbo, params);

        // Give player enough in-play to exceed the cap.
        vm.startPrank(PLAYER);
        // Fund extra tokens.
        for (uint256 i = 0; i < 200; i++) {
            _token.faucet();
        }
        _game.deposit(cap + 1e18);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("BetTooLarge(uint256)")), cap));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, cap + 1e18, bytes32("over_cap"), params);
    }

    function test_MaxBetCapEnforced_Plinko() public {
        BetParams memory params = BetParams({ target: 0, rows: 8, risk: Risk.High });
        uint256 cap = _game.maxBet(GameType.Plinko, params);

        vm.startPrank(PLAYER);
        for (uint256 i = 0; i < 200; i++) {
            _token.faucet();
        }
        _game.deposit(cap + 1e18);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("BetTooLarge(uint256)")), cap));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Plinko, cap + 1e18, bytes32("over_cap_plinko"), params);
    }

    function test_MaxBetAtCapAllowed() public {
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        uint256 cap = _game.maxBet(GameType.Limbo, params);

        vm.startPrank(PLAYER);
        for (uint256 i = 0; i < 200; i++) {
            _token.faucet();
        }
        _game.deposit(cap);
        vm.stopPrank();

        // Should NOT revert.
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, cap, bytes32("at_cap"), params);
    }

    // -----------------------------------------------------------------------
    // Invalid params
    // -----------------------------------------------------------------------

    function test_LimboTargetTooLow() public {
        // target == 100 is invalid (must be >= 101).
        BetParams memory params = BetParams({ target: 100, rows: 0, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, STAKE, bytes32("seed"), params);
    }

    function test_LimboTargetTooHigh() public {
        BetParams memory params = BetParams({ target: 100_000_001, rows: 0, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, STAKE, bytes32("seed"), params);
    }

    function test_LimboNonZeroRowsReverts() public {
        BetParams memory params = BetParams({ target: 200, rows: 8, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Limbo, STAKE, bytes32("seed"), params);
    }

    function test_PlinkoRowsTooLow() public {
        BetParams memory params = BetParams({ target: 0, rows: 7, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Plinko, STAKE, bytes32("seed"), params);
    }

    function test_PlinkoRowsTooHigh() public {
        BetParams memory params = BetParams({ target: 0, rows: 17, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Plinko, STAKE, bytes32("seed"), params);
    }

    function test_PlinkoNonZeroTargetReverts() public {
        BetParams memory params = BetParams({ target: 200, rows: 8, risk: Risk.Low });
        vm.expectRevert(abi.encodeWithSignature("InvalidGameParams()"));
        vm.prank(PLAYER);
        _game.placeBet(GameType.Plinko, STAKE, bytes32("seed"), params);
    }

    // -----------------------------------------------------------------------
    // 2% house edge statistical check
    // -----------------------------------------------------------------------

    function test_LimboHouseEdge2Pct() public {
        // Sweep 1000 pseudo-random seeds and verify the average EV is ~0.98.
        // We use target = 200 (2.00×) — win prob should be ~49%, EV ≈ 0.98.
        uint256 target = 200;
        uint256 stake = 1e18;
        uint256 totalPayout = 0;
        uint256 n = 1000;

        for (uint256 i = 0; i < n; i++) {
            bytes32 seed = keccak256(abi.encode("edge_test", i));
            uint256 seedAsUint = uint256(seed);
            (, uint256 payout,) = _game.settleLimboPublic(seedAsUint, stake, target);
            totalPayout += payout;
        }

        // Expected total: n * stake * 0.98 = 980e18
        // Allow ±5% tolerance for small-sample variance.
        uint256 expected = n * stake * 98 / 100;
        uint256 tolerance = expected * 5 / 100;
        assertApproxEqAbs(totalPayout, expected, tolerance, "Limbo house edge ~2%");
    }

    function test_PlinkoHouseEdge2Pct() public {
        // 8-row Low risk: EV should be ~0.98.
        uint8 rows = 8;
        Risk risk = Risk.Low;
        uint256 stake = 1e18;
        uint256 totalPayout = 0;
        uint256 n = 1000;

        for (uint256 i = 0; i < n; i++) {
            bytes32 seed = keccak256(abi.encode("plinko_edge_test", i));
            uint256 seedAsUint = uint256(seed);
            (, uint256 payout,,) = _game.settlePlinkoPublic(seedAsUint, stake, rows, risk);
            totalPayout += payout;
        }

        // ±10% tolerance (Plinko has high variance — edge buckets are rare)
        uint256 expected = n * stake * 98 / 100;
        uint256 tolerance = expected * 10 / 100;
        assertApproxEqAbs(totalPayout, expected, tolerance, "Plinko house edge ~2%");
    }

    // -----------------------------------------------------------------------
    // Reentrancy protection
    // -----------------------------------------------------------------------

    function test_ReentrancyOnWithdrawBlocked() public {
        // Deploy a malicious token that re-enters withdraw() on transfer().
        ReentrantToken badToken = new ReentrantToken();
        badToken.setGame(address(0)); // set to actual game below

        // Deploy a fresh ProofBet using the malicious token.
        ProofBet badGame = new ProofBet(address(badToken), _subId, address(_coordinator));
        _coordinator.addConsumer(_subId, address(badGame));
        badToken.setGame(address(badGame));

        // Seed bankroll (just give the contract tokens directly).
        badToken.mint(address(badGame), 1_000_000e18);
        // Manually write bankroll — call seedBankroll via owner.
        // Actually we need to manipulate storage or use the owner path.
        // Since badToken.transferFrom is permissive, let's use a helper:
        vm.prank(address(this)); // We ARE the owner (VRFConsumerBaseV2Plus uses ConfirmedOwner).
        // Note: badGame was deployed by this test contract, so this IS the owner.
        badToken.mint(address(this), 1_000_000e18);
        badToken.approve(address(badGame), 1_000_000e18);
        badGame.seedBankroll(1_000_000e18);

        // Give attacker tokens and deposit.
        address attacker = address(0xA77ACB);
        badToken.mint(attacker, 100e18);
        vm.startPrank(attacker);
        badToken.approve(address(badGame), 100e18);
        badGame.deposit(100e18);
        vm.stopPrank();

        // During withdraw, the malicious token re-enters withdraw().
        // CEI means the balance was zeroed before transfer, so re-entry gets ZeroAmount.
        // The outer withdraw should succeed (100 PRF returned).
        uint256 balBefore = badToken.balanceOf(attacker);
        vm.prank(attacker);
        badGame.withdraw(); // Should not revert; second re-entrant call silently fails.
        uint256 balAfter = badToken.balanceOf(attacker);

        // Attacker received exactly their deposit — not double.
        assertEq(balAfter - balBefore, 100e18, "Attacker receives only their deposit");
        assertEq(badGame.inPlayOf(attacker), 0, "In-play zeroed after withdraw");
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function test_ViewsReturnCorrectValues() public {
        assertEq(_game.proofs(), address(_token), "proofs() address");
        assertEq(_game.bankroll(), BANKROLL_SEED, "bankroll()");
        assertEq(_game.inPlayOf(PLAYER), 100e18, "inPlayOf()");
        assertEq(_game.nonceOf(PLAYER), 0, "nonceOf() initial");
    }

    function test_MaxBetScalesWithBankroll() public {
        BetParams memory params = BetParams({ target: 200, rows: 0, risk: Risk.Low });
        uint256 cap1 = _game.maxBet(GameType.Limbo, params);

        // Seed more bankroll — cap should grow proportionally.
        vm.startPrank(OWNER);
        _token.mint(OWNER, BANKROLL_SEED);
        _token.approve(address(_game), BANKROLL_SEED);
        _game.seedBankroll(BANKROLL_SEED);
        vm.stopPrank();

        uint256 cap2 = _game.maxBet(GameType.Limbo, params);
        assertEq(cap2, cap1 * 2, "maxBet doubles when bankroll doubles");
    }
}
