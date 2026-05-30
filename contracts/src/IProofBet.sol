// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Game selector. Ordinals are part of the ABI — do NOT reorder.
enum GameType {
    Limbo,
    Plinko
}

/// @notice Plinko risk tier. Ordinals are part of the ABI — do NOT reorder.
enum Risk {
    Low,
    Medium,
    High
}

/// @notice Parameters for a single bet — one struct for both games. Fields the
///         active game does not use MUST be zero.
/// @param target Limbo target multiplier as ×100 fixed-point (200 = 2.00×). Plinko: 0.
/// @param rows   Plinko peg rows, 8..16 inclusive. Limbo: 0.
/// @param risk   Plinko risk tier. Limbo: Risk.Low (ignored).
struct BetParams {
    uint256 target;
    uint8 rows;
    Risk risk;
}

/// @title IProofBet — the integration seam between /contracts and /app.
/// @notice Provably-fair Limbo + Plinko on one VRF engine, one bankroll, one
///         deposit/withdraw. All multipliers are ×100 fixed-point integers.
///         Outcomes derive from `finalSeed = keccak256(abi.encode(uint256 vrfWord,
///         bytes32 clientSeed, uint256 nonce))` and are reproduced byte-for-byte
///         by the proofbet/shared package in the browser (the Verify drawer).
interface IProofBet {
    // ---------------------------------------------------------------------
    // Events — drive the app's pending-as-narrative flow and Verify drawer.
    // ---------------------------------------------------------------------

    /// @notice Proofs moved Wallet → In play.
    event Deposit(address indexed player, uint256 amount, uint256 newInPlay);

    /// @notice Proofs moved In play → Wallet (full-balance withdrawal).
    event Withdraw(address indexed player, uint256 amount);

    /// @notice A bet was accepted and VRF randomness requested.
    /// @param requestId Chainlink VRF request id; maps 1:1 to this bet.
    /// @param nonce     Per-player bet counter mixed into the seed.
    event BetPlaced(
        uint256 indexed requestId,
        address indexed player,
        GameType gameType,
        uint256 stake,
        bytes32 clientSeed,
        uint256 nonce,
        BetParams params
    );

    /// @notice The VRF callback settled a bet. Carries everything the Verify
    ///         drawer needs to independently recompute the outcome.
    /// @param vrfWord   Raw VRF random word returned on-chain.
    /// @param finalSeed keccak256(abi.encode(vrfWord, clientSeed, nonce)).
    /// @param outcome   crash×100 (Limbo) | multiplier×100 (Plinko).
    /// @param payout    Proofs credited to the player's In-play balance (0 on loss).
    event BetSettled(
        uint256 indexed requestId,
        address indexed player,
        GameType gameType,
        uint256 vrfWord,
        bytes32 finalSeed,
        uint256 outcome,
        uint256 payout,
        bool win
    );

    /// @notice Emitted when a winning payout's profit exceeded the bankroll and was
    ///         clamped to what the house could cover. The settled bet's `payout` in
    ///         {BetSettled} already reflects the clamped amount; this event records the
    ///         shortfall for auditing. Never fires in normal operation (per-bet caps
    ///         keep the house solvent) — only under extreme concurrent liability.
    /// @param fullProfit  Profit the player would have received if fully solvent.
    /// @param paidProfit  Profit actually paid (== bankroll at settlement time).
    event BankrollShortfall(uint256 indexed requestId, uint256 fullProfit, uint256 paidProfit);

    // ---------------------------------------------------------------------
    // Custom errors (no require-strings).
    // ---------------------------------------------------------------------

    error ZeroAmount();
    error InsufficientInPlay(uint256 have, uint256 want);
    error InsufficientBankroll(uint256 available, uint256 requested);
    error BetTooLarge(uint256 maxAllowed);
    error InvalidGameParams();
    error BetNotFound(uint256 requestId);
    error AlreadySettled(uint256 requestId);

    // ---------------------------------------------------------------------
    // Economy.
    // ---------------------------------------------------------------------

    /// @notice Move `amount` Proofs from the caller's wallet into In play.
    /// @dev Requires prior ERC20 approval; pulls via `transferFrom`.
    function deposit(uint256 amount) external;

    /// @notice Withdraw the caller's entire In-play balance to their wallet.
    /// @dev CEI + ReentrancyGuard: balance is zeroed BEFORE transfer.
    function withdraw() external;

    // ---------------------------------------------------------------------
    // Play.
    // ---------------------------------------------------------------------

    /// @notice Place a bet on either game; requests VRF randomness.
    /// @param gameType   Limbo or Plinko.
    /// @param stake      Proofs wagered, drawn from the caller's In-play balance.
    /// @param clientSeed Player-controlled seed mixed into the outcome.
    /// @param params     Per-game parameters (see {BetParams}).
    /// @return requestId VRF request id; pair with {BetSettled} to learn the result.
    function placeBet(
        GameType gameType,
        uint256 stake,
        bytes32 clientSeed,
        BetParams calldata params
    ) external returns (uint256 requestId);

    // ---------------------------------------------------------------------
    // Views.
    // ---------------------------------------------------------------------

    /// @notice The Proofs (PRF) ERC20 token used for all bets.
    function proofs() external view returns (address);

    /// @notice A player's In-play balance (Proofs escrowed in the contract).
    function inPlayOf(address player) external view returns (uint256);

    /// @notice The house bankroll available to cover payouts.
    function bankroll() external view returns (uint256);

    /// @notice Largest stake currently accepted for `gameType`/`params`, capped so
    ///         the worst-case payout stays within the bankroll risk budget.
    function maxBet(GameType gameType, BetParams calldata params)
        external
        view
        returns (uint256);

    /// @notice A player's current bet nonce (next bet uses this value).
    function nonceOf(address player) external view returns (uint256);
}
