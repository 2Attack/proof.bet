// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    VRFConsumerBaseV2Plus
} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {
    VRFV2PlusClient
} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

import { IProofBet, GameType, Risk, BetParams } from "./IProofBet.sol";
import { PlinkoTables } from "./generated/PlinkoTables.sol";

/// @title ProofBet — Provably-fair Limbo + Plinko on one VRF engine.
/// @notice Implements IProofBet.  One contract, two games, one bankroll, one
///         VRF subscription.  Randomness comes from Chainlink VRF V2.5 (native ETH
///         payment — no LINK required).
/// @dev Inherits VRFConsumerBaseV2Plus (which itself inherits ConfirmedOwner).
///      Do NOT also inherit OZ Ownable — they clash.
contract ProofBet is IProofBet, VRFConsumerBaseV2Plus, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Sepolia VRF V2.5 coordinator address (used as default in deploy script).
    address public constant SEPOLIA_VRF_COORDINATOR = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;

    /// @dev Sepolia key hash (500 gwei gas lane).
    bytes32 private constant KEY_HASH =
        0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;

    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant CALLBACK_GAS_LIMIT = 300_000;
    uint32 private constant NUM_WORDS = 1;

    /// @dev Risk budget: 1.5% of bankroll per bet (150 basis points).
    uint256 private constant RISK_BPS = 150;
    uint256 private constant BPS_DENOM = 10_000;

    /// @dev Fixed-point scale: multipliers are ×100 integers.
    uint256 private constant SCALE = 100;

    /// @dev Limbo crash divisor: 2^52.
    uint256 private constant E = 1 << 52;

    /// @dev Limbo minimum crashX100 (1.00× == 100 in ×100 fixed-point).
    uint256 private constant CRASH_MIN = 100;

    /// @dev Limbo maximum crashX100 (1,000,000× == 100_000_000 in ×100 fixed-point).
    uint256 private constant CRASH_MAX = 100_000_000;

    /// @dev Limbo target lower bound (must be > 100, i.e. > 1.00×).
    uint256 private constant TARGET_MIN = 101;

    /// @dev Limbo target upper bound (matches CRASH_MAX).
    uint256 private constant TARGET_MAX = CRASH_MAX;

    /// @dev Plinko valid row range.
    uint8 private constant ROWS_MIN = 8;
    uint8 private constant ROWS_MAX = 16;

    /// @dev Initial bankroll seed amount: 1,000,000 PRF.
    uint256 public constant INITIAL_BANKROLL = 1_000_000e18;

    // =========================================================================
    // Storage
    // =========================================================================

    /// @notice The Proofs (PRF) ERC20 token used for all bets.
    IERC20 private immutable _proofs;

    /// @notice VRF subscription id (uint256 for V2.5).
    uint256 private immutable _subscriptionId;

    /// @notice House bankroll: Proofs held by this contract and available to pay winners.
    uint256 private _bankroll;

    /// @notice Per-player In-play balance (Proofs escrowed inside this contract).
    mapping(address => uint256) private _playerBalances;

    /// @notice Per-player bet nonce (incremented on every placeBet call).
    mapping(address => uint256) private _nonces;

    // =========================================================================
    // Bet record
    // =========================================================================

    /// @dev On-chain representation of a pending bet, keyed by VRF requestId.
    struct Bet {
        address player;
        GameType gameType;
        uint256 stake;
        bytes32 clientSeed;
        uint256 nonce;
        BetParams params;
        bool settled;
    }

    /// @notice Maps VRF requestId → pending Bet.
    mapping(uint256 => Bet) private _bets;

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param proofsToken     Address of the Proofs (PRF) ERC20 token.
    /// @param subscriptionId  Chainlink VRF V2.5 subscription id (uint256, native ETH).
    /// @param vrfCoordinator  VRF coordinator address.  Use SEPOLIA_VRF_COORDINATOR for
    ///                        production; pass a mock address for tests.
    constructor(address proofsToken, uint256 subscriptionId, address vrfCoordinator)
        VRFConsumerBaseV2Plus(vrfCoordinator)
    {
        require(proofsToken != address(0), "ProofBet: zero proofs token");
        require(vrfCoordinator != address(0), "ProofBet: zero coordinator");
        _proofs = IERC20(proofsToken);
        _subscriptionId = subscriptionId;
    }

    // =========================================================================
    // IProofBet — Economy
    // =========================================================================

    /// @inheritdoc IProofBet
    function deposit(uint256 amount) external override {
        if (amount == 0) revert ZeroAmount();
        _playerBalances[msg.sender] += amount;
        // Pull from caller — requires prior ERC20 approval.
        _proofs.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount, _playerBalances[msg.sender]);
    }

    /// @inheritdoc IProofBet
    function withdraw() external override nonReentrant {
        uint256 amount = _playerBalances[msg.sender];
        if (amount == 0) revert ZeroAmount();
        // CEI: zero balance BEFORE transfer (prevents reentrancy).
        _playerBalances[msg.sender] = 0;
        _proofs.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    // =========================================================================
    // IProofBet — Play
    // =========================================================================

    /// @inheritdoc IProofBet
    function placeBet(
        GameType gameType,
        uint256 stake,
        bytes32 clientSeed,
        BetParams calldata params
    ) external override returns (uint256 requestId) {
        if (stake == 0) revert ZeroAmount();

        // Validate game-specific params.
        _validateParams(gameType, params);

        // Enforce max-bet cap (worst-case payout ≤ 1.5% of bankroll).
        uint256 cap = maxBet(gameType, params);
        if (stake > cap) revert BetTooLarge(cap);

        // Check player balance.
        uint256 balance = _playerBalances[msg.sender];
        if (balance < stake) revert InsufficientInPlay(balance, stake);

        // Debit stake immediately (escrow inside the contract; moves from playerBalance
        // to neither bucket until settlement — bankroll absorbs it at fulfillment).
        _playerBalances[msg.sender] = balance - stake;

        // Snapshot nonce, then increment for next bet.
        uint256 nonce = _nonces[msg.sender];
        _nonces[msg.sender] = nonce + 1;

        // Request VRF randomness (native ETH payment — no LINK required).
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: _subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: true })
                )
            })
        );

        // Store pending bet.
        _bets[requestId] = Bet({
            player: msg.sender,
            gameType: gameType,
            stake: stake,
            clientSeed: clientSeed,
            nonce: nonce,
            params: params,
            settled: false
        });

        emit BetPlaced(requestId, msg.sender, gameType, stake, clientSeed, nonce, params);
    }

    // =========================================================================
    // VRF callback — settlement
    // =========================================================================

    /// @notice Called by the VRF coordinator with the random word.
    ///         This is the ONLY place bets are settled.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords)
        internal
        override
    {
        Bet storage bet = _bets[requestId];

        // Guard: unknown request.
        if (bet.player == address(0)) revert BetNotFound(requestId);
        // Guard: double-settle.
        if (bet.settled) revert AlreadySettled(requestId);

        bet.settled = true;

        uint256 vrfWord = randomWords[0];

        // Derive deterministic final seed (seam contract).
        bytes32 finalSeed =
            keccak256(abi.encode(uint256(vrfWord), bet.clientSeed, uint256(bet.nonce)));

        // Route to per-game settlement.
        uint256 outcomeX100;
        uint256 payout;
        bool win;

        if (bet.gameType == GameType.Limbo) {
            (outcomeX100, payout, win) =
                _settleLimbo(uint256(finalSeed), bet.stake, bet.params.target);
        } else {
            (outcomeX100, payout, win) =
                _settlePlinko(uint256(finalSeed), bet.stake, bet.params.rows, bet.params.risk);
        }

        // Settle against the bankroll, then credit the player. On a win, `stake` is
        // covered by the escrowed pending stake; only the profit (payout - stake) is
        // drawn from the house bankroll. If the bankroll cannot cover the full profit
        // (only possible under extreme concurrent liability), pay what it can rather
        // than reverting: a revert here would strand the player's stake forever, since
        // the VRF coordinator does not retry a reverting callback.
        if (payout >= bet.stake) {
            uint256 profit = payout - bet.stake;
            if (profit > _bankroll) {
                emit BankrollShortfall(requestId, profit, _bankroll);
                profit = _bankroll;
                payout = bet.stake + profit;
            }
            _bankroll -= profit;
        } else {
            // House profits — bankroll grows.
            _bankroll += (bet.stake - payout);
        }

        _playerBalances[bet.player] += payout;

        emit BetSettled(
            requestId, bet.player, bet.gameType, vrfWord, finalSeed, outcomeX100, payout, win
        );
    }

    // =========================================================================
    // IProofBet — Views
    // =========================================================================

    /// @inheritdoc IProofBet
    function proofs() external view override returns (address) {
        return address(_proofs);
    }

    /// @inheritdoc IProofBet
    function inPlayOf(address player) external view override returns (uint256) {
        return _playerBalances[player];
    }

    /// @inheritdoc IProofBet
    function bankroll() external view override returns (uint256) {
        return _bankroll;
    }

    /// @inheritdoc IProofBet
    function maxBet(GameType gameType, BetParams calldata params)
        public
        view
        override
        returns (uint256)
    {
        uint256 riskBudget = (_bankroll * RISK_BPS) / BPS_DENOM;

        if (gameType == GameType.Limbo) {
            // Worst-case profit per unit stake = (target - 1) / SCALE when target > 100.
            // Rearranging: maxStake = riskBudget * SCALE / (target - SCALE).
            uint256 target = params.target;
            if (target <= SCALE) return 0; // target must be > 1.00×
            uint256 worstCaseProfit = target - SCALE; // units of SCALE per stake
            return (riskBudget * SCALE) / worstCaseProfit;
        } else {
            // Plinko: worst-case profit per unit stake = (maxMultX100 - 100) / 100.
            uint256 maxMult = PlinkoTables.maxMultiplierX100(params.rows, params.risk);
            if (maxMult <= SCALE) return 0;
            uint256 worstCaseProfit = maxMult - SCALE;
            return (riskBudget * SCALE) / worstCaseProfit;
        }
    }

    /// @inheritdoc IProofBet
    function nonceOf(address player) external view override returns (uint256) {
        return _nonces[player];
    }

    // =========================================================================
    // Owner — bankroll seeding
    // =========================================================================

    /// @notice Seed the bankroll from the owner's PRF balance.
    ///         Requires prior ERC20 approval from owner to this contract.
    /// @param amount Proofs (PRF) to add to the bankroll.
    function seedBankroll(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        _bankroll += amount;
        _proofs.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Withdraw seeded liquidity / accrued profit from the bankroll.
    /// @dev CEI + onlyOwner: only the house bankroll is withdrawable — escrowed player
    ///      balances and pending stakes are never reachable through this path.
    /// @param amount Proofs (PRF) to remove from the bankroll.
    function withdrawBankroll(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 current = _bankroll;
        if (amount > current) revert InsufficientBankroll(current, amount);
        // CEI: reduce bankroll BEFORE transfer.
        _bankroll = current - amount;
        _proofs.safeTransfer(msg.sender, amount);
    }

    // =========================================================================
    // Internal — per-game settlement (pure)
    // =========================================================================

    /// @dev Limbo settlement — pure math, no state access.
    ///      Exposed as internal so the test harness can call it directly.
    /// @param seedAsUint  uint256(finalSeed)
    /// @param stake       Proofs wagered (wei).
    /// @param targetX100  Player's target multiplier ×100.
    function _settleLimbo(uint256 seedAsUint, uint256 stake, uint256 targetX100)
        internal
        pure
        returns (uint256 crashX100, uint256 payout, bool win)
    {
        // Top 52 bits of finalSeed.
        uint256 h = seedAsUint >> 204;

        if (h % 50 == 0) {
            // Instant bust — 2% house edge.
            crashX100 = CRASH_MIN;
        } else {
            // crashX100 = floor((100·2^52 - h) / (2^52 - h))
            uint256 num = SCALE * E - h;
            uint256 den = E - h;
            crashX100 = num / den;
            // Clamp to [100, 100_000_000].
            if (crashX100 < CRASH_MIN) crashX100 = CRASH_MIN;
            if (crashX100 > CRASH_MAX) crashX100 = CRASH_MAX;
        }

        win = crashX100 >= targetX100;
        payout = win ? (stake * targetX100) / SCALE : 0;
    }

    /// @dev Plinko settlement — pure math, no state access.
    ///      Exposed as internal so the test harness can call it directly.
    /// @param seedAsUint  uint256(finalSeed)
    /// @param stake       Proofs wagered (wei).
    /// @param rows        Number of peg rows (8..16).
    /// @param risk        Risk tier.
    function _settlePlinko(uint256 seedAsUint, uint256 stake, uint8 rows, Risk risk)
        internal
        pure
        returns (uint256 multX100, uint256 payout, bool win)
    {
        // Top 192 bits → x.
        uint256 x = seedAsUint >> 64;

        // slot = popcount of low `rows` bits of x.
        uint256 slot = _popcount(x, rows);

        multX100 = PlinkoTables.slotMultiplierX100(rows, risk, slot);
        payout = (stake * multX100) / SCALE;
        win = multX100 >= SCALE;
    }

    // =========================================================================
    // Internal — helpers
    // =========================================================================

    /// @dev Validate game-specific params; revert InvalidGameParams if invalid.
    function _validateParams(GameType gameType, BetParams calldata params) internal pure {
        if (gameType == GameType.Limbo) {
            // target must be in [101, 100_000_000].
            if (params.target < TARGET_MIN || params.target > TARGET_MAX) {
                revert InvalidGameParams();
            }
            // Limbo fields: rows and risk are unused; they must be zero.
            if (params.rows != 0) revert InvalidGameParams();
        } else {
            // Plinko: rows 8..16, target must be 0.
            if (params.rows < ROWS_MIN || params.rows > ROWS_MAX) {
                revert InvalidGameParams();
            }
            if (params.target != 0) revert InvalidGameParams();
            // risk enum is validated implicitly (only 0, 1, 2 are valid — Solidity rejects others).
        }
    }

    /// @dev Count the number of 1-bits in the low `rows` bits of `x`.
    function _popcount(uint256 x, uint8 rows) internal pure returns (uint256 count) {
        count = 0;
        for (uint8 k = 0; k < rows; k++) {
            if ((x >> k) & 1 == 1) {
                count++;
            }
        }
    }

    // =========================================================================
    // Test helpers — pure view wrappers exposed for golden vector tests.
    // These do NOT touch state.
    // =========================================================================

    /// @notice Derive finalSeed from the three inputs (mirrors the seam contract).
    function deriveFinalSeed(uint256 vrfWord, bytes32 clientSeed, uint256 nonce)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(uint256(vrfWord), clientSeed, uint256(nonce)));
    }

    /// @notice Pure Limbo settlement — for golden vector tests.
    function settleLimboPublic(uint256 seedAsUint, uint256 stake, uint256 targetX100)
        external
        pure
        returns (uint256 crashX100, uint256 payout, bool win)
    {
        return _settleLimbo(seedAsUint, stake, targetX100);
    }

    /// @notice Pure Plinko settlement — for golden vector tests.
    ///         Also returns the slot so tests can assert it.
    function settlePlinkoPublic(uint256 seedAsUint, uint256 stake, uint8 rows, Risk risk)
        external
        pure
        returns (uint256 multX100, uint256 payout, bool win, uint256 slot)
    {
        // Reproduce slot computation here for the test return value.
        uint256 x = seedAsUint >> 64;
        slot = _popcount(x, rows);
        (multX100, payout, win) = _settlePlinko(seedAsUint, stake, rows, risk);
    }
}
